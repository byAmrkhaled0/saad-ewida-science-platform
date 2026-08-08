'use strict';

const crypto = require('crypto');
const zlib = require('zlib');
const admin = require('firebase-admin');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2/options');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10, memory: '256MiB' });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const QRCode = require('qrcode');
const { calculateMonthlyMetrics } = require('./lib/monthly-incentive');
const { positiveScore, assignQuestionScores, scoreSummary } = require('./lib/exam-scoring');
const { getExamScheduleState, examSessionDeadline } = require('./lib/exam-schedule');
const { normalizeStudentName, studentNameIdentity, hasAtLeastThreeNameParts } = require('./lib/student-name');
const {
  scheduledTimeMillis,
  assignmentIsReleased,
  assignmentDueDatePassed,
  assignmentSubmissionIsOpen
} = require('./lib/assignment-schedule');
const BACKEND_RELEASE = '69.2.6';
// Callable endpoints must answer the browser's unauthenticated OPTIONS
// preflight. Authentication/rate limits are enforced inside each handler, so
// accepting browser origins here does not grant access to protected actions.
const CALLABLE_OPTIONS = {
  region: 'europe-west1',
  timeoutSeconds: 30,
  invoker: 'public',
  cors: true,
  enforceAppCheck: false,
  labels: { 'platform-release': '69-2-6' }
};
const HTTP_BRIDGE_OPTIONS = {
  region: 'europe-west1',
  timeoutSeconds: 540,
  memory: '512MiB',
  invoker: 'public',
  cors: true,
  labels: { 'platform-release': '69-2-6' }
};
const HTTP_BRIDGE_ACTIONS = new Set([
  'getPortalStudent', 'getPublicResources', 'getOnlineContentForStudent', 'recordLectureProgress',
  'getPublicLeaderboard', 'createAttendanceSession', 'claimAttendanceSession', 'createStudentAccess',
  'createBooking', 'approveBooking', 'getBookingStatus', 'rejectBooking', 'createReview',
  'recordClassProgress', 'getExamDashboard', 'startExam', 'syncExamSession', 'submitExam', 'prepareHomeworkUpload',
  'registerHomeworkSubmission', 'reportClientError', 'createBackupNow', 'listAutomaticBackups',
  'getBackupDownloadUrl', 'restoreAutomaticBackup', 'deleteStudentSafely', 'registerTeacherPushToken', 'registerStudentPushToken',
  'listStaffAccounts', 'upsertStaffAccount', 'setStaffAccountState',
  'createStudentTransferRequest', 'reviewStudentTransferRequest', 'saveGroupSchedule', 'deleteGroupSchedule'
  , 'uploadBookingReceipt', 'reviewBookingReceipt', 'listExamVersions', 'restoreExamVersion', 'getPlatformHealth'
]);

function cleanDocId(value) {
  return String(value || '').trim().replace(/[\\/#?\[\]]/g, '-');
}

function normalizeCode(value) {
  return normalizeDigits(value).trim().toUpperCase().replace(/\s+/g, '');
}

function validLegacyOrStrongCode(value) {
  return /^[A-Z0-9_-]{6,40}$/.test(normalizeCode(value));
}

function text(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function normalizeDigits(value) {
  return String(value || '')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776));
}

function digits(value) {
  return normalizeDigits(value).replace(/\D/g, '');
}

function safePublicUrl(value) {
  const url = text(value, 2000);
  return /^https:\/\//i.test(url) ? url : '';
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function randomCode(prefix, bytes = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const raw = crypto.randomBytes(bytes);
  let body = '';
  for (let i = 0; i < raw.length; i += 1) body += alphabet[raw[i] % alphabet.length];
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

function randomNumericCode(length = 8) {
  // Keep the first digit non-zero so spreadsheet/phone copy does not trim it.
  const first = String(crypto.randomInt(1, 10));
  let rest = '';
  while (rest.length < length - 1) rest += String(crypto.randomInt(0, 10));
  return first + rest;
}

function publicStudentName(value) {
  // The teacher requested the leaderboard to use the exact full student name
  // saved on the platform instead of shortening the family name to an initial.
  return text(value, 80).replace(/\s+/g, ' ').trim();
}

function duplicateStudentNameError() {
  return new HttpsError(
    'already-exists',
    'هذا الطالب مسجل بالفعل على المنصة. استخدم الكود السابق أو تواصل مع المستر لتحديث بياناته.'
  );
}

async function assertStudentNameAvailable(name, options = {}) {
  const { normalizedName, nameKey } = studentNameIdentity(name);
  if (!hasAtLeastThreeNameParts(normalizedName) || !nameKey) {
    throw new HttpsError('invalid-argument', 'اكتب اسم الطالب ثلاثيًا على الأقل، وإذا تكرر الاسم الثلاثي اكتب الاسم الرباعي.');
  }
  const excludeStudentCode = text(options.excludeStudentCode, 40);
  const allowedRequestId = text(options.requestId, 80);
  const [claimed, keyedStudents, keyedBookings, exactStudentName, exactName, exactBookingName] = await Promise.all([
    db.collection('_student_name_claims').doc(nameKey).get(),
    db.collection('students').where('nameKey', '==', nameKey).limit(2).get(),
    db.collection('bookings').where('nameKey', '==', nameKey).limit(2).get(),
    db.collection('students').where('studentName', '==', text(name, 100).replace(/\s+/g, ' ').trim()).limit(5).get(),
    db.collection('students').where('name', '==', text(name, 100).replace(/\s+/g, ' ').trim()).limit(5).get(),
    db.collection('bookings').where('studentName', '==', text(name, 100).replace(/\s+/g, ' ').trim()).limit(5).get()
  ]);
  const activeStudentExists = [...keyedStudents.docs, ...exactStudentName.docs, ...exactName.docs]
    .some(doc => doc.id !== excludeStudentCode && doc.data().active !== false);
  const activeBookingExists = [...keyedBookings.docs, ...exactBookingName.docs].length > 0;
  const claimBelongsToOtherStudent = claimed.exists
    && text(claimed.data().studentCode, 40) !== excludeStudentCode
    && (!allowedRequestId || text(claimed.data().requestId, 80) !== allowedRequestId);
  if (activeStudentExists || activeBookingExists || claimBelongsToOtherStudent) {
    throw duplicateStudentNameError();
  }
  // Older platform records predate nameKey. Scan only when the indexed and
  // atomic claim checks found nothing, so legacy Arabic spelling variants
  // cannot be registered again after this upgrade.
  const [legacyStudents, legacyBookings] = await Promise.all([
    db.collection('students').select('name', 'studentName', 'active').limit(2000).get(),
    db.collection('bookings').select('name', 'studentName').limit(2000).get()
  ]);
  const legacyStudentExists = legacyStudents.docs.some(doc => doc.id !== excludeStudentCode
    && doc.data().active !== false
    && normalizeStudentName(doc.data().studentName || doc.data().name) === normalizedName);
  const legacyBookingExists = legacyBookings.docs.some(doc =>
    normalizeStudentName(doc.data().studentName || doc.data().name) === normalizedName);
  if (legacyStudentExists || legacyBookingExists) throw duplicateStudentNameError();
  return { normalizedName, nameKey, claimRef: db.collection('_student_name_claims').doc(nameKey) };
}

async function uniqueNumericCode(collection, length = 8) {
  for (let i = 0; i < 12; i += 1) {
    const code = randomNumericCode(length);
    const snap = await db.collection(collection).doc(code).get();
    if (!snap.exists) return code;
  }
  throw new HttpsError('resource-exhausted', 'تعذر إنشاء كود رقمي فريد، حاول مرة أخرى.');
}

async function uniqueUnifiedAccessCode(length = 8) {
  for (let i = 0; i < 12; i += 1) {
    const code = randomNumericCode(length);
    // Every current booking and approved account owns a students/{code}
    // document. One indexed lookup is enough; atomic create() writes below
    // remain the final collision guard under heavy concurrent registration.
    const studentRecord = await db.collection('students').doc(code).get();
    if (!studentRecord.exists) return code;
  }
  throw new HttpsError('resource-exhausted', 'تعذر إنشاء كود موحد فريد، حاول مرة أخرى.');
}

async function uniqueCode(collection, prefix) {
  for (let i = 0; i < 8; i += 1) {
    const code = randomCode(prefix, 8);
    const snap = await db.collection(collection).doc(cleanDocId(code)).get();
    if (!snap.exists) return code;
  }
  throw new HttpsError('resource-exhausted', 'تعذر إنشاء كود فريد، حاول مرة أخرى.');
}

async function rateLimit(action, identity, limit, windowMs) {
  const key = hash(`${action}:${identity}`).slice(0, 40);
  const ref = db.collection('_rate_limits').doc(key);
  const now = Date.now();
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const started = Number(data.windowStartedAt || 0);
    const count = Number(data.count || 0);
    if (!started || now - started >= windowMs) {
      tx.set(ref, { action, count: 1, windowStartedAt: now, expiresAt: Timestamp.fromMillis(now + windowMs * 2) });
      return;
    }
    if (count >= limit) throw new HttpsError('resource-exhausted', 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.');
    tx.update(ref, { count: count + 1 });
  });
}

function requestIp(request) {
  const forwarded = request.rawRequest && request.rawRequest.headers
    ? request.rawRequest.headers['x-forwarded-for']
    : '';
  return text(String(forwarded || request.rawRequest?.ip || 'unknown').split(',')[0], 100);
}

async function rateLimitPublic(action, identity, request, identityLimit, ipLimit, windowMs) {
  const normalizedIdentity = text(identity || 'empty', 160);
  const ip = requestIp(request);
  await Promise.all([
    rateLimit(`${action}-identity`, normalizedIdentity, identityLimit, windowMs),
    rateLimit(`${action}-ip`, ip, ipLimit, windowMs)
  ]);
}

function jsonByteSize(value) {
  try { return Buffer.byteLength(JSON.stringify(value), 'utf8'); }
  catch (_) { return Number.MAX_SAFE_INTEGER; }
}

async function requireStaff(request, allowedRoles = ['admin', 'teacher', 'assistant']) {
  if (!request.auth || !request.auth.uid) throw new HttpsError('unauthenticated', 'يجب تسجيل دخول فريق العمل.');
  const userSnap = await db.collection('users').doc(request.auth.uid).get();
  const profile = userSnap.exists ? userSnap.data() : {};
  if (profile.active === false || !allowedRoles.includes(profile.role)) {
    throw new HttpsError('permission-denied', 'الحساب غير مصرح له بهذه العملية.');
  }
  return { uid: request.auth.uid, email: request.auth.token?.email || '', ...profile };
}

const STAFF_PERMISSION_KEYS = new Set(['overview','bookings','students','schedules','attendance','payments','exams','content','assignments','reviews','reports']);
function cleanStaffPermissions(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => text(item, 40)).filter(item => STAFF_PERMISSION_KEYS.has(item)))];
}
function requireStaffSection(staff, ...sections) {
  if (staff.role !== 'assistant') return staff;
  const permissions = cleanStaffPermissions(staff.permissions);
  if (!sections.some(section => permissions.includes(section))) throw new HttpsError('permission-denied', 'الحساب لا يملك صلاحية هذا القسم.');
  return staff;
}

exports.listStaffAccounts = onCall(CALLABLE_OPTIONS, async request => {
  await requireStaff(request, ['admin', 'teacher']);
  const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(100).get().catch(() => db.collection('users').limit(100).get());
  return snap.docs.map(doc => {
    const data = doc.data() || {};
    return { uid: doc.id, email: text(data.email, 200), name: text(data.name, 100), role: text(data.role, 30), active: data.active !== false, permissions: cleanStaffPermissions(data.permissions) };
  });
});

exports.upsertStaffAccount = onCall(CALLABLE_OPTIONS, async request => {
  const actor = await requireStaff(request, ['admin', 'teacher']);
  const body = request.data || {}, email = text(body.email, 200).toLowerCase(), name = text(body.name, 100);
  // A full-access teacher can manage assistants, but only an administrator
  // may create another full-access teacher account.
  const role = body.role === 'teacher' && actor.role === 'admin' ? 'teacher' : 'assistant';
  const permissions = role === 'teacher' ? [...STAFF_PERMISSION_KEYS] : cleanStaffPermissions(body.permissions);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'البريد الإلكتروني غير صالح.');
  let user;
  if (body.uid) user = await admin.auth().getUser(text(body.uid, 128));
  else {
    const password = String(body.password || '');
    if (password.length < 8) throw new HttpsError('invalid-argument', 'كلمة المرور يجب ألا تقل عن 8 أحرف.');
    try { user = await admin.auth().getUserByEmail(email); }
    catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      try {
        user = await admin.auth().createUser({ email, password, displayName: name || undefined, emailVerified: false, disabled: false });
      } catch (error) {
        if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'البريد الإلكتروني مستخدم بالفعل. حدّث الحساب الموجود بدل إنشاء حساب جديد.');
        if (error.code === 'auth/invalid-password') throw new HttpsError('invalid-argument', 'كلمة المرور غير صالحة؛ استخدم 8 أحرف على الأقل.');
        throw error;
      }
    }
  }
  if (body.password) {
    const password = String(body.password);
    if (password.length < 8) throw new HttpsError('invalid-argument', 'كلمة المرور يجب ألا تقل عن 8 أحرف.');
    await admin.auth().updateUser(user.uid, { password, displayName: name || undefined });
  }
  await db.collection('users').doc(user.uid).set({
    email, name, role, permissions, active: body.active !== false,
    createdBy: actor.uid, updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await db.collection('activityLog').add({ action:'تم حفظ حساب فريق عمل', meta:{ uid:user.uid,email,role,permissions }, actorUid:actor.uid, actorEmail:actor.email||'', actorRole:actor.role||'', createdAt:FieldValue.serverTimestamp() });
  return { uid:user.uid,email,name,role,permissions,active:body.active!==false };
});

exports.setStaffAccountState = onCall(CALLABLE_OPTIONS, async request => {
  const actor = await requireStaff(request, ['admin', 'teacher']);
  const uid = text(request.data?.uid, 128), active = request.data?.active === true;
  if (!uid || uid === actor.uid) throw new HttpsError('invalid-argument', 'لا يمكن إيقاف الحساب المستخدم حاليًا.');
  await admin.auth().updateUser(uid, { disabled: !active });
  await db.collection('users').doc(uid).set({ active, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
  return { uid, active };
});

async function notifyStaffAboutBooking(booking) {
  const snap = await db.collection('staff_push_tokens').where('active', '==', true).limit(500).get();
  const tokens = [...new Set(snap.docs.map(doc => text(doc.data().token, 500)).filter(Boolean))];
  if (!tokens.length) return;
  const bookingCode = text(booking.code, 40);
  const title = 'حجز طالب جديد';
  const body = `${text(booking.name, 80)} · ${text(booking.grade, 60)} · ${text(booking.group, 80)}`;
  const targetUrl = 'https://saad-ewida-science-platform.vercel.app/teacher-login.html?section=bookings';
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    data: { type: 'new-booking', bookingCode, title, body, url: targetUrl },
    webpush: {
      notification: {
        title,
        body,
        icon: 'https://saad-ewida-science-platform.vercel.app/assets/icon-192.png',
        badge: 'https://saad-ewida-science-platform.vercel.app/assets/icon-192.png',
        tag: `booking-${bookingCode}`,
        renotify: true
      },
      fcmOptions: { link: targetUrl }
    }
  });
  const invalid = [];
  response.responses.forEach((item, index) => {
    if (!item.success && /registration-token-not-registered|invalid-registration-token/.test(String(item.error?.code || ''))) invalid.push(tokens[index]);
  });
  if (invalid.length) {
    const batch = db.batch();
    snap.docs.filter(doc => invalid.includes(doc.data().token)).forEach(doc => batch.set(doc.ref, { active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
    await batch.commit();
  }
}

exports.registerTeacherPushToken = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const token = text(request.data && request.data.token, 500);
  if (token.length < 40) throw new HttpsError('invalid-argument', 'رمز الإشعارات غير صالح.');
  const tokenId = hash(token).slice(0, 48);
  await db.collection('staff_push_tokens').doc(tokenId).set({ token, uid: staff.uid, role: staff.role || '', active: true, userAgent: text(request.data?.userAgent, 250), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { registered: true };
});

exports.registerStudentPushToken = onCall(CALLABLE_OPTIONS, async request => {
  const studentCode = normalizeCode(request.data?.studentCode);
  const token = text(request.data?.token, 500);
  await rateLimitPublic('student-push-token', studentCode, request, 5, 12, 60 * 60 * 1000);
  if (token.length < 40) throw new HttpsError('invalid-argument', 'رمز الإشعارات غير صالح.');
  const found = await getStudentPortalByCode(studentCode);
  const student = found.data || {};
  const tokenId = hash(token).slice(0, 48);
  await db.collection('student_push_tokens').doc(tokenId).set({
    token, studentCode,
    grade:text(student.grade,80), group:text(student.group,100), scheduleId:text(student.scheduleId,100),
    deliveryMode:student.deliveryMode==='online'?'online':'center', academicYear:text(student.academicYear,20), term:text(student.term,40),
    active:true, userAgent:text(request.data?.userAgent,250), updatedAt:FieldValue.serverTimestamp()
  }, { merge:true });
  return { registered:true };
});

async function deactivateInvalidPushTokens(collection, docs, tokens, response) {
  const invalid=[];
  response.responses.forEach((item,index)=>{if(!item.success&&/registration-token-not-registered|invalid-registration-token/.test(String(item.error?.code||'')))invalid.push(tokens[index]);});
  if(!invalid.length)return;
  const batch=db.batch();docs.filter(doc=>invalid.includes(doc.data().token)).forEach(doc=>batch.set(collection.doc(doc.id),{active:false,updatedAt:FieldValue.serverTimestamp()},{merge:true}));await batch.commit();
}

async function notifyTargetedStudents(item,{type,title,body,url}) {
  const tokenCollection=db.collection('student_push_tokens');
  const snap=await tokenCollection.where('active','==',true).limit(5000).get();
  const docs=snap.docs.filter(doc=>learningTargetMatchesStudent(item,doc.data()));
  if(!docs.length)return { sent:0 };
  let sent=0;
  for(let index=0;index<docs.length;index+=500){
    const chunkDocs=docs.slice(index,index+500),tokens=chunkDocs.map(doc=>doc.data().token).filter(Boolean);
    if(!tokens.length)continue;
    const response=await admin.messaging().sendEachForMulticast({tokens,data:{type,title,body,url},webpush:{notification:{title,body,icon:'https://saad-ewida-science-platform.vercel.app/assets/icon-192.png',badge:'https://saad-ewida-science-platform.vercel.app/assets/icon-192.png',tag:`${type}-${text(item.id,100)}`,renotify:true},fcmOptions:{link:url}}});
    sent+=response.successCount;await deactivateInvalidPushTokens(tokenCollection,chunkDocs,tokens,response);
  }
  return { sent };
}

function contentNotification(before,after,typeLabel,url,type) {
  if(!after||after.active===false)return null;
  const action=!before||before.active===false?'تم نشر':'تم تعديل';
  return {type,title:`${action} ${typeLabel}`,body:text(after.title||typeLabel,180),url};
}

exports.notifyStudentsOnExamUpdated = onDocumentWritten({document:'exams/{examId}',region:'europe-west1',memory:'256MiB'},async event=>{
  const before=event.data?.before.data(),afterData=event.data?.after.data();if(!afterData)return;
  const after={id:event.params.examId,...afterData},notice=contentNotification(before,after,'امتحان','https://saad-ewida-science-platform.vercel.app/exams.html','exam');
  if(notice)await notifyTargetedStudents(after,notice);
});
exports.notifyStudentsOnAssignmentUpdated = onDocumentWritten({document:'assignments/{assignmentId}',region:'europe-west1',memory:'256MiB'},async event=>{
  const before=event.data?.before.data(),afterData=event.data?.after.data();if(!afterData)return;
  const after={id:event.params.assignmentId,...afterData},notice=contentNotification(before,after,'واجب','https://saad-ewida-science-platform.vercel.app/student.html','assignment');
  if(notice)await notifyTargetedStudents(after,notice);
});
exports.notifyStudentsOnLectureUpdated = onDocumentWritten({document:'materials/{materialId}',region:'europe-west1',memory:'256MiB'},async event=>{
  const before=event.data?.before.data(),afterData=event.data?.after.data();if(!afterData)return;
  const after={id:event.params.materialId,...afterData};
  if(after.deliveryMode!=='online'||!['live','upcoming','recording','file'].includes(after.contentType))return;
  const notice=contentNotification(before,after,'محاضرة','https://saad-ewida-science-platform.vercel.app/online.html','lecture');if(notice)await notifyTargetedStudents(after,notice);
});

exports.archiveExamVersion = onDocumentUpdated({document:'exams/{examId}',region:'europe-west1',memory:'256MiB'},async event=>{
  const before=event.data?.before.data();if(!before)return;
  const versionId=cleanDocId(`${Date.now()}_${text(event.id,80)}`);
  await db.collection('exam_versions').doc(event.params.examId).collection('versions').doc(versionId).set({
    examId:event.params.examId,title:text(before.title,200),snapshot:before,source:'before-update',createdAt:FieldValue.serverTimestamp()
  });
});

exports.listExamVersions = onCall(CALLABLE_OPTIONS, async request=>{
  await requireStaff(request,['admin','teacher']);const examId=cleanDocId(request.data?.examId);if(!examId)throw new HttpsError('invalid-argument','الامتحان غير صالح.');
  const snap=await db.collection('exam_versions').doc(examId).collection('versions').orderBy('createdAt','desc').limit(30).get();
  return snap.docs.map(doc=>{const data=doc.data()||{};return {id:doc.id,examId,title:text(data.title,200),createdAt:data.createdAt?.toDate?.().toISOString()||''};});
});

exports.restoreExamVersion = onCall(CALLABLE_OPTIONS, async request=>{
  const staff=await requireStaff(request,['admin','teacher']),examId=cleanDocId(request.data?.examId),versionId=cleanDocId(request.data?.versionId);
  if(!examId||!versionId)throw new HttpsError('invalid-argument','اختر نسخة صالحة للاستعادة.');
  const versionSnap=await db.collection('exam_versions').doc(examId).collection('versions').doc(versionId).get();
  if(!versionSnap.exists)throw new HttpsError('not-found','النسخة المطلوبة غير موجودة.');
  const snapshot=versionSnap.data()?.snapshot;if(!snapshot||typeof snapshot!=='object')throw new HttpsError('failed-precondition','بيانات النسخة غير مكتملة.');
  await db.collection('exams').doc(examId).set({...snapshot,id:examId,restoredFromVersion:versionId,restoredBy:staff.email||staff.uid,restoredAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  return {ok:true,examId,versionId};
});

exports.getPlatformHealth = onCall(CALLABLE_OPTIONS, async request=>{
  await requireStaff(request);const checkedAt=new Date().toISOString();
  const status={functions:{ok:true,release:BACKEND_RELEASE},database:{ok:false},storage:{ok:false},notifications:{ok:false,teacherTokens:0,studentTokens:0},lastPublished:{frontend:'69.2.6',backend:BACKEND_RELEASE}};
  try{await db.collection('settings').doc('platform').get();status.database={ok:true};}catch(error){status.database={ok:false,message:text(error.message,180)};}
  try{const [metadata]=await admin.storage().bucket().getMetadata();status.storage={ok:true,bucket:text(metadata.name,180)};}catch(error){status.storage={ok:false,message:text(error.message,180)};}
  try{const [teacherTokens,studentTokens]=await Promise.all([db.collection('staff_push_tokens').where('active','==',true).count().get(),db.collection('student_push_tokens').where('active','==',true).count().get()]);status.notifications={ok:true,teacherTokens:teacherTokens.data().count,studentTokens:studentTokens.data().count};}catch(error){status.notifications={ok:false,message:text(error.message,180),teacherTokens:0,studentTokens:0};}
  let errors=[];try{const snap=await db.collection('client_errors').orderBy('createdAt','desc').limit(25).get();errors=snap.docs.map(doc=>{const row=doc.data()||{};return {id:doc.id,message:text(row.message,500),page:text(row.page,500),createdAt:row.createdAt?.toDate?.().toISOString()||'',userAgent:text(row.userAgent,250)};});}catch(error){}
  return {checkedAt,status,errors};
});

// Push delivery runs independently from the public booking request. The
// student sees the success screen as soon as Firestore commits, even if FCM is
// temporarily slow or unavailable.
exports.notifyStaffOnBookingCreated = onDocumentCreated({ document: 'bookings/{bookingCode}', region: 'europe-west1', memory: '256MiB' }, async event => {
  const booking = event.data && event.data.data();
  if (booking) await notifyStaffAboutBooking(booking);
});

function publicExamSession(sessionId, exam, questions, startedAtMs, expiresAtMs) {
  return {
    sessionId,
    exam: {
      id: text(exam.id, 100),
      title: text(exam.title, 200),
      instructions: text(exam.instructions, 1500),
      duration: Math.max(1, Math.min(240, Number(exam.duration || 20))),
      maxScore: positiveScore(exam.maxScore, questions.reduce((sum,q)=>sum+positiveScore(q.points,1),0)),
      pdfUrl: safePublicUrl(exam.pdfUrl || exam.examPdfUrl),
      pdfName: text(exam.pdfName || exam.examPdfName, 220)
    },
    startedAt: new Date(startedAtMs).toISOString(),
    expiresAt: expiresAtMs,
    questions: questions.map(q => ({
      type: q.type,
      question: q.question,
      points: positiveScore(q.points,1),
      options: q.options,
      optionLabels: q.optionLabels
    }))
  };
}

function cleanAnswerLine(line) {
  return String(line || '').replace(/^(answer|correct|الإجابة|الاجابة|الإجابة الصحيحة|الاجابة الصحيحة)\s*[:=：-]?\s*/i, '').trim();
}

function parseOptionLine(line) {
  const raw = normalizeDigits(line).trim();
  let match = raw.match(/^([A-Da-dأإابجدهـه]|[1-4])\s*[\)\.\-:：]\s*(.+)$/);
  if (match) return { label: match[1].replace('إ', 'أ').replace('هـ', 'ه'), text: match[2].trim() };
  match = raw.match(/^-\s*(.+)$/);
  if (match) return { label: '', text: match[1].trim() };
  return null;
}

function parseExamQuestions(source) {
  const blocks = normalizeDigits(source).split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).slice(0, 200);
  return blocks.map(block => {
    const lines = block.split('\n').map(x => x.trim()).filter(Boolean);
    const answerLine = lines.find(line => /^(answer|correct|الإجابة|الاجابة|الإجابة الصحيحة|الاجابة الصحيحة)\s*[:=：-]?/i.test(line));
    const pointsLine = lines.find(line => /^(points?|marks?|score|الدرجة|درجات)\s*[:=：-]?/i.test(line));
    const answer = answerLine ? cleanAnswerLine(answerLine) : '';
    const points = pointsLine ? positiveScore(normalizeDigits(pointsLine).replace(/^[^:=：\-]*[:=：-]?\s*/i,''),1) : null;
    const options = [];
    const questionLines = [];
    for (const line of lines) {
      if (line === answerLine || line === pointsLine) continue;
      const option = parseOptionLine(line);
      if (option) options.push(option);
      else questionLines.push(line.replace(/^س\d*\s*[:\-]?\s*/, '').trim());
    }
    const question = text(questionLines[0] || lines[0] || 'سؤال', 1500);
    if (options.length) {
      return {
        type: 'mcq',
        question,
        options: options.slice(0, 8).map(o => text(o.text, 700)),
        optionLabels: options.slice(0, 8).map(o => text(o.label, 10)),
        answer: text(answer, 700), points
      };
    }
    return { type: 'essay', question, options: [], optionLabels: [], answer: '', points };
  }).filter(q => q.question);
}

function examQuestionList(exam) {
  const structured=Array.isArray(exam?.questions)?exam.questions.slice(0,200):[];
  const normalized=structured.map(raw=>{
    const type=raw?.type==='essay'?'essay':'mcq',question=text(raw?.question,1500),points=positiveScore(raw?.points,1);
    if(type==='essay')return {type,question,options:[],optionLabels:[],answer:'',points};
    const options=(Array.isArray(raw?.options)?raw.options:[]).slice(0,8).map(option=>text(option,700));
    const optionLabels=(Array.isArray(raw?.optionLabels)&&raw.optionLabels.length?raw.optionLabels:['أ','ب','ج','د']).slice(0,options.length).map(label=>text(label,10));
    const correctIndex=Number(raw?.correctIndex),answer=Number.isInteger(correctIndex)&&correctIndex>=0&&correctIndex<options.length?optionLabels[correctIndex]:text(raw?.answer,700);
    return {type,question,options,optionLabels,answer,points};
  }).filter(question=>question.question&&(question.type==='essay'||question.options.length>=2));
  return normalized.length?normalized:parseExamQuestions(exam?.text||exam?.questionsText||'');
}

function normalizeAnswer(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[\)\.\-:：]/g, '').replace(/إ/g, 'أ').replace(/هـ/g, 'ه');
}

function mcqCorrect(question, chosenIndex) {
  const index = Number(chosenIndex);
  if (!Number.isInteger(index) || index < 0 || index >= question.options.length) return false;
  const chosen = question.options[index] || '';
  const label = question.optionLabels[index] || String(index + 1);
  const correct = String(question.answer || '').trim();
  if (!correct) return null;
  const answerToken = (correct.match(/^([A-Da-dأإابجدهـه]|[1-4])/) || [])[1] || '';
  const normalized = normalizeAnswer(correct);
  return normalized === normalizeAnswer(label)
    || normalized === normalizeAnswer(chosen)
    || normalized === String(index + 1)
    || (answerToken && normalizeAnswer(answerToken) === normalizeAnswer(label));
}

function portalResponse(data, attempts, records = {}) {
  const mergedGrades = new Map();
  (Array.isArray(attempts) ? attempts : []).filter(item => item.score !== null && item.score !== undefined && item.score !== '').forEach(item => mergedGrades.set(String(item.attemptId || item.id), { ...item, exam: item.exam || item.examTitle || 'امتحان', date: item.date || text(item.submittedAt, 10) }));
  (Array.isArray(records.grades) ? records.grades : []).forEach(item => mergedGrades.set(String(item.attemptId || item.id), item));
  return {
    studentCode: text(data.studentCode || data.code, 40),
    name: text(data.studentName || data.name, 100),
    studentName: text(data.studentName || data.name, 100),
    grade: text(data.grade, 80),
    group: text(data.group, 100),
    deliveryMode: data.deliveryMode === 'online' ? 'online' : 'center',
    month: text(data.month, 40),
    academicYear: text(data.academicYear, 20),
    term: text(data.term, 40),
    bookingCode: text(data.bookingCode, 40),
    approvalStatus: text(data.approvalStatus || data.status, 100),
    scheduleId: text(data.scheduleId, 100),
    scheduleDays: text(data.scheduleDays, 100),
    scheduleStartTime: text(data.scheduleStartTime, 20),
    scheduleEndTime: text(data.scheduleEndTime, 20),
    paid: data.paid === true,
    paymentDate: text(data.paymentDate, 40),
    currentPaymentMonth: text(data.currentPaymentMonth, 20),
    paymentHistory: Array.isArray(records.payments) ? records.payments.slice(-36).reverse().map(item=>({
      id:text(item.id,120),monthKey:text(item.monthKey,20),monthLabel:text(item.monthLabel,40),paid:item.paid===true,
      paymentDate:text(item.paymentDate,40),amount:Number(item.amount||0),method:text(item.method,40),notes:text(item.notes,300)
    })) : [],
    notes: text(data.notes, 1500),
    attendance: Array.isArray(records.attendance) ? records.attendance.slice(-120) : (Array.isArray(data.attendance) ? data.attendance.slice(-120) : []),
    grades: mergedGrades.size ? [...mergedGrades.values()].sort((a,b)=>String(a.date||a.submittedAt||'').localeCompare(String(b.date||b.submittedAt||''))).slice(-120) : (Array.isArray(data.grades) ? data.grades.slice(-120) : []),
    homeworks: Array.isArray(records.homeworks) ? records.homeworks.slice(-120) : (Array.isArray(data.homeworks) ? data.homeworks.slice(-120) : []),
    recitations: Array.isArray(records.recitations) ? records.recitations.slice(-120) : (Array.isArray(data.recitations) ? data.recitations.slice(-120) : []),
    examAttempts: Array.isArray(attempts) ? attempts.slice(-120) : []
  };
}

function learningTargetMatchesStudent(item = {}, student = {}) {
  const itemMode = item.deliveryMode === 'online' ? 'online' : (item.deliveryMode === 'center' ? 'center' : 'all');
  const studentMode = student.deliveryMode === 'online' ? 'online' : 'center';
  const modeOk = itemMode === 'all' || itemMode === studentMode;
  const gradeOk = !item.grade || item.grade === 'كل الصفوف' || item.grade === student.grade;
  const itemScheduleId = text(item.scheduleId, 100);
  const studentScheduleId = text(student.scheduleId, 100);
  const groupOk = itemScheduleId && studentScheduleId
    ? itemScheduleId === studentScheduleId
    : (!item.group || item.group === 'كل المجموعات' || item.group === student.group);
  const yearOk = !item.academicYear || !student.academicYear || item.academicYear === student.academicYear;
  const termOk = !item.term || !student.term || item.term === student.term;
  return modeOk && gradeOk && groupOk && yearOk && termOk;
}

function scheduleMatchesStudent(schedule = {}, student = {}) {
  if (schedule.active === false) return false;
  return learningTargetMatchesStudent({
    ...schedule,
    group: 'كل المجموعات',
    scheduleId: ''
  }, student);
}

function publicSchedule(schedule = {}) {
  return {
    id: text(schedule.id, 100),
    name: text(schedule.name, 100),
    grade: text(schedule.grade, 80),
    deliveryMode: schedule.deliveryMode === 'online' ? 'online' : 'center',
    academicYear: text(schedule.academicYear, 20),
    term: text(schedule.term, 40),
    days: text(schedule.days, 100),
    startTime: text(schedule.startTime, 20),
    endTime: text(schedule.endTime, 20),
    capacity: Math.max(0, Math.min(500, Number(schedule.capacity || 0)))
  };
}

function firestoreMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return Number(value.toMillis()) || 0;
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

function publicTransferRequest(request = {}) {
  const createdAt = firestoreMillis(request.createdAt);
  const reviewedAt = firestoreMillis(request.reviewedAt);
  return {
    id: text(request.id, 120),
    status: ['pending', 'approved', 'rejected'].includes(request.status) ? request.status : 'pending',
    currentGroup: text(request.currentGroup, 100),
    targetGroup: text(request.targetGroup, 100),
    targetScheduleId: text(request.targetScheduleId, 100),
    reason: text(request.reason, 800),
    teacherNote: text(request.teacherNote, 800),
    createdAt: createdAt ? new Date(createdAt).toISOString() : '',
    reviewedAt: reviewedAt ? new Date(reviewedAt).toISOString() : ''
  };
}

async function getStudentPortalByCode(code) {
  const normalized = normalizeCode(code);
  if (!validLegacyOrStrongCode(normalized)) throw new HttpsError('invalid-argument', 'كود غير صالح.');
  const id = cleanDocId(normalized);
  const portalRef = db.collection('student_portal').doc(id);
  const portalSnap = await portalRef.get();
  if (portalSnap.exists) {
    if (portalSnap.data().active === false) throw new HttpsError('not-found', 'حساب الطالب غير نشط.');
    const canonicalSnap = await db.collection('students').doc(id).get().catch(() => null);
    const canonical = canonicalSnap?.exists ? canonicalSnap.data() : {};
    return { code: normalized, data: { ...portalSnap.data(), ...canonical, studentCode: normalized, code: normalized } };
  }
  // Older releases sometimes created the student record before the dedicated
  // portal document. Keep those real accounts working and repair them lazily.
  const studentSnap = await db.collection('students').doc(id).get();
  if (!studentSnap.exists || studentSnap.data().active === false) throw new HttpsError('not-found', 'لم يتم العثور على الطالب بهذا الكود.');
  const student = { ...studentSnap.data(), studentCode: normalized, code: normalized };
  const repaired = portalResponse(student, []);
  await portalRef.set({ ...repaired, parentCode: text(student.parentCode, 40), active: true, repairedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { code: normalized, data: student };
}

async function getParentPortalByCode(code) {
  const normalized = normalizeCode(code);
  if (!validLegacyOrStrongCode(normalized)) throw new HttpsError('invalid-argument', 'كود غير صالح.');
  const snap = await db.collection('parent_portal').doc(cleanDocId(normalized)).get();
  if (snap.exists && snap.data().active !== false) return { code: normalized, data: snap.data() };
  // Current accounts use one code for both portals. This fallback repairs the
  // user experience for records created before parent_portal was introduced or
  // while an older approval function was deployed.
  const studentSnap = await db.collection('student_portal').doc(cleanDocId(normalized)).get();
  if (!studentSnap.exists || studentSnap.data().active === false) throw new HttpsError('not-found', 'لم يتم العثور على التقرير.');
  return { code: normalized, data: { ...studentSnap.data(), parentCode: normalized } };
}

async function attemptSummaries(studentCode) {
  const parentRef = db.collection('student_attempts').doc(cleanDocId(studentCode));
  const sub = await parentRef.collection('attempts').orderBy('submittedAt', 'desc').limit(120).get().catch(() => null);
  let attempts = sub && !sub.empty ? sub.docs.map(doc => ({ id:doc.id, ...doc.data() })) : [];
  if (!attempts.length) {
    const legacy = await parentRef.get();
    attempts = legacy.exists && Array.isArray(legacy.data().attempts) ? legacy.data().attempts.slice(-120).reverse() : [];
  }
  return attempts.map(a => ({
    id: text(a.id, 120),
    examId: text(a.examId, 100),
    examTitle: text(a.examTitle, 200),
    submittedAt: text(a.submittedAt, 60),
    score: a.score === null || a.score === undefined ? null : Number(a.score),
    maxScore: Number(a.maxScore||100),
    percentage: a.percentage===null||a.percentage===undefined?(a.score===null||a.score===undefined?null:Math.round(Number(a.score)/Number(a.maxScore||100)*100)):Number(a.percentage),
    answers: Array.isArray(a.answers)?a.answers:[],
    autoScore: a.autoScore === null || a.autoScore === undefined ? null : Number(a.autoScore),
    needsManualReview: a.needsManualReview === true,
    status: text(a.status, 40)
  }));
}

async function studentRecords(studentCode) {
  const normalized = normalizeCode(studentCode);
  const load = async (collection, orderBy) => {
    let query = db.collection(collection).where('studentCode', '==', normalized);
    if (orderBy) query = query.orderBy(orderBy, 'desc');
    try {
      const snap = await query.limit(250).get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      // Keep portals available during the short interval in which a newly
      // deployed composite index is still building.
      if (!orderBy || !/failed-precondition|index/i.test(`${error?.code || ''} ${error?.message || ''}`)) throw error;
      const snap = await db.collection(collection).where('studentCode', '==', normalized).limit(250).get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  };
  const [attendance, grades, homeworks, recitations, payments] = await Promise.all([
    load('attendance', 'date'), load('grades', 'date'), load('homework_submissions', 'submittedAt'), load('recitations', 'date'), load('payment_records', 'monthKey')
  ]);
  const byDate = rows => rows.sort((a, b) => String(a.date || a.submittedAt || a.createdAt || '').localeCompare(String(b.date || b.submittedAt || b.createdAt || '')));
  return { attendance: byDate(attendance), grades: byDate(grades), homeworks: byDate(homeworks), recitations: byDate(recitations), payments: payments.sort((a,b)=>String(a.monthKey||'').localeCompare(String(b.monthKey||''))) };
}

async function getPortalStudentHandler(request) {
  const code = normalizeCode(request.data && request.data.code);
  const mode = request.data && request.data.mode === 'parent' ? 'parent' : 'student';
  await rateLimitPublic(`portal-${mode}`, code, request, 8, 35, 60 * 1000);
  const found = mode === 'parent' ? await getParentPortalByCode(code) : await getStudentPortalByCode(code);
  const studentCode = found.data.studentCode || found.data.code;
  const [attempts, records, assignmentSnap, monthlyRows, onlineContent, groupSnap, transferSnap] = await Promise.all([
    attemptSummaries(studentCode).catch(error => { console.warn('portal-attempts-unavailable', error?.message || error); return []; }),
    studentRecords(studentCode).catch(error => { console.warn('portal-records-unavailable', error?.message || error); return { attendance: [], grades: [], homeworks: [], recitations: [], payments: [] }; }),
    db.collection('assignments').limit(300).get().catch(()=>null),
    getMonthlyLeaderboardRows().catch(error => { console.warn('portal-incentive-unavailable', error?.message || error); return []; }),
    loadOnlineContentForStudent(found.data, studentCode).catch(error => { console.warn('portal-online-content-unavailable', error?.message || error); return []; }),
    db.collection('groups').limit(300).get().catch(()=>null),
    db.collection('student_transfer_requests').where('studentCode', '==', normalizeCode(studentCode)).limit(20).get().catch(()=>null)
  ]);
  const targetedAssignments = assignmentSnap
    ? assignmentSnap.docs.map(doc=>({id:doc.id,...doc.data()})).filter(item=>item.active!==false&&learningTargetMatchesStudent(item,found.data))
    : [];
  const todayKey = cairoDateKey(new Date());
  const assignments = targetedAssignments.filter(item=>assignmentIsReleased(item)).slice(-100).map(item=>({
    ...item,
    submissionClosed: assignmentDueDatePassed(item, todayKey)
  }));
  const nextAssignmentMillis = targetedAssignments.map(item=>scheduledTimeMillis(item.publishAt)).filter(value=>value>Date.now()).sort((a,b)=>a-b)[0]||0;
  const transferOptions = groupSnap
    ? groupSnap.docs.map(doc=>({id:doc.id,...doc.data()}))
      .filter(item=>scheduleMatchesStudent(item,found.data))
      .filter(item=>text(found.data.scheduleId,100)?item.id!==text(found.data.scheduleId,100):item.name!==found.data.group)
      .map(publicSchedule)
      .sort((a,b)=>`${a.days} ${a.startTime} ${a.name}`.localeCompare(`${b.days} ${b.startTime} ${b.name}`,'ar'))
    : [];
  const transferRequests = transferSnap
    ? transferSnap.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>firestoreMillis(b.createdAt)-firestoreMillis(a.createdAt))
    : [];
  const transferRequest = transferRequests.length ? publicTransferRequest(transferRequests[0]) : null;
  const monthKey = cairoDateKey(new Date()).slice(0, 7);
  const grade = text(found.data.grade, 50);
  const monthlyIncentive = monthlyRows.find(row => row.studentCode === normalizeCode(studentCode)) || {
    studentCode: normalizeCode(studentCode), monthKey, grade, rank: null, score: 0,
    attendancePct: 0, gradePct: 0, homeworkPct: 0, recitationPct: 0, activity: 0,
    participants: monthlyRows.filter(row => row.grade === grade).length
  };
  return {
    ...portalResponse(found.data, attempts, records),
    assignments,
    nextAssignmentPublishAt:nextAssignmentMillis?new Date(nextAssignmentMillis).toISOString():'',
    onlineContent,
    monthlyIncentive,
    transferOptions,
    transferRequest
  };
}

exports.getPortalStudent = onCall(CALLABLE_OPTIONS, getPortalStudentHandler);

async function scheduleEnrollment(schedule, scheduleId, excludeStudentCode = '') {
  const groupName = text(schedule.name, 100);
  if (!groupName) return [];
  const snap = await db.collection('students').where('group', '==', groupName).limit(1000).get();
  const mode = schedule.deliveryMode === 'online' ? 'online' : 'center';
  return snap.docs.map(doc=>({id:doc.id,...doc.data()})).filter(student=>{
    const studentMode = student.deliveryMode === 'online' ? 'online' : 'center';
    return student.active !== false
      && normalizeCode(student.studentCode || student.id) !== normalizeCode(excludeStudentCode)
      && student.grade === schedule.grade
      && studentMode === mode
      && (!schedule.term || !student.term || schedule.term === student.term)
      && (!schedule.academicYear || !student.academicYear || schedule.academicYear === student.academicYear)
      && (!student.scheduleId || text(student.scheduleId,100) === scheduleId);
  });
}

exports.createStudentTransferRequest = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const studentCode = normalizeCode(body.studentCode);
  await rateLimitPublic('student-transfer', studentCode, request, 3, 8, 60 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const targetScheduleId = cleanDocId(text(body.targetScheduleId, 100));
  const reason = text(body.reason, 800);
  if (!targetScheduleId) throw new HttpsError('invalid-argument', 'اختر المجموعة المطلوب النقل إليها.');
  if (reason.length < 3) throw new HttpsError('invalid-argument', 'اكتب سبب طلب النقل باختصار.');
  const [targetSnap, existingSnap] = await Promise.all([
    db.collection('groups').doc(targetScheduleId).get(),
    db.collection('student_transfer_requests').where('studentCode', '==', studentCode).limit(20).get()
  ]);
  if (!targetSnap.exists || targetSnap.data().active === false) throw new HttpsError('not-found', 'المجموعة المطلوبة لم تعد متاحة.');
  const target = { id:targetSnap.id, ...targetSnap.data() };
  if (!scheduleMatchesStudent(target, found.data)) throw new HttpsError('permission-denied', 'هذه المجموعة ليست مخصصة لصف الطالب أو نوع دراسته أو الترم الحالي.');
  if ((found.data.scheduleId && target.id === found.data.scheduleId) || (!found.data.scheduleId && target.name === found.data.group)) {
    throw new HttpsError('already-exists', 'الطالب موجود بالفعل في هذه المجموعة.');
  }
  if (existingSnap.docs.some(doc=>doc.data().status === 'pending')) {
    throw new HttpsError('already-exists', 'يوجد طلب نقل قيد المراجعة بالفعل.');
  }
  const capacity = Math.max(0, Math.min(500, Number(target.capacity || 0)));
  if (capacity) {
    const enrolled = await scheduleEnrollment(target, target.id, studentCode);
    if (enrolled.length >= capacity) throw new HttpsError('resource-exhausted', 'اكتمل عدد الطلاب في هذه المجموعة. اختر مجموعة أخرى.');
  }
  const ref = db.collection('student_transfer_requests').doc();
  const payload = {
    id: ref.id,
    studentCode,
    studentName: text(found.data.studentName || found.data.name, 100),
    studentPhone: digits(found.data.studentPhone),
    parentPhone: digits(found.data.parentPhone),
    grade: text(found.data.grade, 80),
    deliveryMode: found.data.deliveryMode === 'online' ? 'online' : 'center',
    academicYear: text(found.data.academicYear, 20),
    term: text(found.data.term, 40),
    currentGroup: text(found.data.group, 100),
    currentScheduleId: text(found.data.scheduleId, 100),
    targetGroup: text(target.name, 100),
    targetScheduleId: target.id,
    targetScheduleDays: text(target.days, 100),
    targetScheduleStartTime: text(target.startTime, 20),
    targetScheduleEndTime: text(target.endTime, 20),
    reason,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.create(payload);
  return publicTransferRequest({ ...payload, createdAt: new Date() });
});

exports.reviewStudentTransferRequest = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  requireStaffSection(staff, 'students', 'schedules');
  const requestId = cleanDocId(text(request.data?.requestId, 120));
  const action = request.data?.action === 'approve' ? 'approve' : (request.data?.action === 'reject' ? 'reject' : '');
  const teacherNote = text(request.data?.teacherNote, 800);
  if (!requestId || !action) throw new HttpsError('invalid-argument', 'بيانات مراجعة طلب النقل غير مكتملة.');
  const requestRef = db.collection('student_transfer_requests').doc(requestId);
  const result = await db.runTransaction(async tx => {
    const transferSnap = await tx.get(requestRef);
    if (!transferSnap.exists) throw new HttpsError('not-found', 'طلب النقل غير موجود.');
    const transfer = { id:transferSnap.id, ...transferSnap.data() };
    if (transfer.status !== 'pending') throw new HttpsError('failed-precondition', 'تم التعامل مع طلب النقل بالفعل.');
    if (action === 'reject') {
      tx.update(requestRef, {
        status:'rejected', teacherNote, reviewedBy:staff.email||staff.uid,
        reviewedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp()
      });
      return { ...transfer, status:'rejected', teacherNote, reviewedAt:new Date() };
    }
    const studentCode = normalizeCode(transfer.studentCode);
    const studentRef = db.collection('students').doc(cleanDocId(studentCode));
    const scheduleRef = db.collection('groups').doc(cleanDocId(transfer.targetScheduleId));
    const [studentSnap, scheduleSnap] = await Promise.all([tx.get(studentRef), tx.get(scheduleRef)]);
    if (!studentSnap.exists || studentSnap.data().active === false) throw new HttpsError('not-found', 'حساب الطالب غير موجود أو غير نشط.');
    if (!scheduleSnap.exists || scheduleSnap.data().active === false) throw new HttpsError('failed-precondition', 'المجموعة المطلوبة لم تعد متاحة.');
    const student = { id:studentSnap.id, ...studentSnap.data() };
    const schedule = { id:scheduleSnap.id, ...scheduleSnap.data() };
    if (!scheduleMatchesStudent(schedule, student)) throw new HttpsError('failed-precondition', 'المجموعة لم تعد مطابقة لصف الطالب أو الترم.');
    const capacity = Math.max(0, Math.min(500, Number(schedule.capacity || 0)));
    if (capacity) {
      const enrolledQuery = db.collection('students').where('group', '==', text(schedule.name,100)).limit(1000);
      const enrolledSnap = await tx.get(enrolledQuery);
      const mode = schedule.deliveryMode === 'online' ? 'online' : 'center';
      const enrolled = enrolledSnap.docs.filter(doc=>{
        const row=doc.data()||{},rowMode=row.deliveryMode==='online'?'online':'center';
        return row.active!==false
          && normalizeCode(row.studentCode||doc.id)!==studentCode
          && row.grade===schedule.grade
          && rowMode===mode
          && (!schedule.term||!row.term||row.term===schedule.term)
          && (!schedule.academicYear||!row.academicYear||row.academicYear===schedule.academicYear)
          && (!row.scheduleId||row.scheduleId===schedule.id);
      }).length;
      if (enrolled >= capacity) throw new HttpsError('resource-exhausted', 'اكتمل عدد الطلاب في المجموعة قبل اعتماد الطلب.');
    }
    const patch = {
      group:text(schedule.name,100),
      scheduleId:schedule.id,
      scheduleDays:text(schedule.days,100),
      scheduleStartTime:text(schedule.startTime,20),
      scheduleEndTime:text(schedule.endTime,20),
      schedulePending:false,
      updatedAt:FieldValue.serverTimestamp()
    };
    const parentCode = normalizeCode(student.parentCode || studentCode);
    tx.set(studentRef, patch, { merge:true });
    tx.set(db.collection('student_portal').doc(cleanDocId(studentCode)), { ...patch, studentCode, parentCode }, { merge:true });
    tx.set(db.collection('parent_portal').doc(cleanDocId(parentCode)), { ...patch, studentCode, parentCode }, { merge:true });
    tx.set(db.collection('payments').doc(cleanDocId(studentCode)), { group:patch.group, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    tx.update(requestRef, {
      status:'approved',
      targetGroup:patch.group,
      targetScheduleDays:patch.scheduleDays,
      targetScheduleStartTime:patch.scheduleStartTime,
      targetScheduleEndTime:patch.scheduleEndTime,
      teacherNote,
      reviewedBy:staff.email||staff.uid,
      reviewedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp()
    });
    return { ...transfer, status:'approved', targetGroup:patch.group, teacherNote, reviewedAt:new Date() };
  });
  await db.collection('activityLog').add({
    action: action==='approve'?'تم اعتماد طلب نقل طالب':'تم رفض طلب نقل طالب',
    meta:{ requestId, studentCode:result.studentCode, targetGroup:result.targetGroup },
    actorUid:staff.uid, actorEmail:staff.email||'', createdAt:FieldValue.serverTimestamp()
  }).catch(()=>{});
  return publicTransferRequest(result);
});

async function linkedStudentsForSchedule(scheduleId, previous = {}) {
  const queries = [db.collection('students').where('scheduleId', '==', scheduleId).limit(1000).get()];
  if (previous.name) queries.push(db.collection('students').where('group', '==', text(previous.name,100)).limit(1000).get());
  const snapshots = await Promise.all(queries);
  const found = new Map();
  snapshots.flatMap(snap=>snap.docs).forEach(doc=>{
    const student = { id:doc.id, ...doc.data() };
    const legacyMatch = !student.scheduleId
      && student.group === previous.name
      && (!previous.grade || student.grade === previous.grade)
      && (!previous.term || !student.term || student.term === previous.term)
      && (student.deliveryMode === 'online' ? 'online' : 'center') === (previous.deliveryMode === 'online' ? 'online' : 'center');
    if (student.scheduleId === scheduleId || legacyMatch) found.set(doc.id, student);
  });
  return [...found.values()];
}

async function linkedRecordsForSchedule(scheduleId) {
  const specs = [
    ['assignments','scheduleId'],
    ['exams','scheduleId'],
    ['materials','scheduleId'],
    ['student_transfer_requests','targetScheduleId'],
    ['student_transfer_requests','currentScheduleId']
  ];
  const snapshots = await Promise.all(specs.map(([collection,field])=>
    db.collection(collection).where(field,'==',scheduleId).limit(1000).get()
  ));
  const learning = new Map();
  const transfers = new Map();
  snapshots.forEach((snap,index)=>{
    const [collection] = specs[index];
    snap.docs.forEach(doc=>{
      const entry = { ref:doc.ref, id:doc.id, collection, data:doc.data()||{} };
      if (collection === 'student_transfer_requests') transfers.set(doc.ref.path, entry);
      else learning.set(doc.ref.path, entry);
    });
  });
  return { learning:[...learning.values()], transfers:[...transfers.values()] };
}

async function commitWriteOperations(operations, chunkSize = 400) {
  const queue = operations.slice();
  while (queue.length) {
    const batch = db.batch();
    queue.splice(0, chunkSize).forEach(operation=>operation(batch));
    await batch.commit();
  }
}

exports.saveGroupSchedule = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  requireStaffSection(staff, 'schedules');
  const body = request.data || {};
  const id = cleanDocId(text(body.id, 100));
  if (!id) throw new HttpsError('invalid-argument', 'معرّف المجموعة غير صالح.');
  const schedule = {
    id,
    name:text(body.name,100),
    grade:text(body.grade,80),
    deliveryMode:body.deliveryMode==='online'?'online':'center',
    academicYear:text(body.academicYear,20),
    term:text(body.term,40),
    days:text(body.days,100),
    startTime:text(body.startTime,20),
    endTime:text(body.endTime,20),
    capacity:Math.max(0,Math.min(500,Number(body.capacity||0))),
    notes:text(body.notes,1000),
    active:body.active!==false
  };
  if (!schedule.name || !schedule.grade || !schedule.days || !schedule.startTime) throw new HttpsError('invalid-argument', 'اسم المجموعة والصف والأيام والساعة مطلوبة.');
  const ref = db.collection('groups').doc(id);
  const [previousSnap, sameNameSnap] = await Promise.all([
    ref.get(),
    db.collection('groups').where('name','==',schedule.name).limit(50).get()
  ]);
  const duplicate = sameNameSnap.docs.some(doc=>{
    if (doc.id === id) return false;
    const row = doc.data()||{};
    return row.grade===schedule.grade
      && (row.deliveryMode==='online'?'online':'center')===schedule.deliveryMode
      && text(row.term,40)===schedule.term
      && text(row.academicYear,20)===schedule.academicYear;
  });
  if (duplicate) throw new HttpsError('already-exists', 'توجد مجموعة أخرى بنفس الاسم لنفس الصف والنوع والترم.');
  const previous = previousSnap.exists ? { id:previousSnap.id, ...previousSnap.data() } : {};
  const [students, linked] = await Promise.all([
    previousSnap.exists ? linkedStudentsForSchedule(id, previous) : Promise.resolve([]),
    linkedRecordsForSchedule(id)
  ]);
  if (students.length) {
    const structuralChange = previous.grade !== schedule.grade
      || (previous.deliveryMode==='online'?'online':'center') !== schedule.deliveryMode
      || text(previous.term,40) !== schedule.term
      || text(previous.academicYear,20) !== schedule.academicYear;
    if (structuralChange) throw new HttpsError('failed-precondition', 'لا يمكن تغيير صف أو نوع أو ترم مجموعة عليها طلاب. انقل الطلاب أولًا أو أنشئ مجموعة جديدة.');
  }
  if (schedule.capacity && students.length > schedule.capacity) {
    throw new HttpsError('failed-precondition', `سعة المجموعة لا يمكن أن تقل عن عدد طلابها الحالي (${students.length}).`);
  }
  const operations = [
    batch=>batch.set(ref, {
      ...schedule,
      createdAt:previousSnap.exists?(previous.createdAt||FieldValue.serverTimestamp()):FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp()
    }, { merge:true })
  ];
  students.forEach(student=>{
    const studentCode = normalizeCode(student.studentCode || student.id);
    const parentCode = normalizeCode(student.parentCode || studentCode);
    const patch = {
      group:schedule.name,
      scheduleId:id,
      scheduleDays:schedule.days,
      scheduleStartTime:schedule.startTime,
      scheduleEndTime:schedule.endTime,
      schedulePending:false,
      updatedAt:FieldValue.serverTimestamp()
    };
    operations.push(batch=>batch.set(db.collection('students').doc(cleanDocId(studentCode)),patch,{merge:true}));
    operations.push(batch=>batch.set(db.collection('student_portal').doc(cleanDocId(studentCode)),{...patch,studentCode,parentCode},{merge:true}));
    operations.push(batch=>batch.set(db.collection('parent_portal').doc(cleanDocId(parentCode)),{...patch,studentCode,parentCode},{merge:true}));
    operations.push(batch=>batch.set(db.collection('payments').doc(cleanDocId(studentCode)),{group:schedule.name,updatedAt:FieldValue.serverTimestamp()},{merge:true}));
  });
  linked.learning.forEach(item=>{
    operations.push(batch=>batch.set(item.ref,{
      group:schedule.name,
      grade:schedule.grade,
      deliveryMode:schedule.deliveryMode,
      academicYear:schedule.academicYear,
      term:schedule.term,
      updatedAt:FieldValue.serverTimestamp()
    },{merge:true}));
  });
  linked.transfers.filter(item=>item.data.status==='pending').forEach(item=>{
    const patch = { updatedAt:FieldValue.serverTimestamp() };
    if (item.data.targetScheduleId===id) {
      Object.assign(patch,{
        targetGroup:schedule.name,
        targetScheduleDays:schedule.days,
        targetScheduleStartTime:schedule.startTime,
        targetScheduleEndTime:schedule.endTime,
        grade:schedule.grade,
        deliveryMode:schedule.deliveryMode,
        academicYear:schedule.academicYear,
        term:schedule.term
      });
    }
    if (item.data.currentScheduleId===id) patch.currentGroup=schedule.name;
    operations.push(batch=>batch.set(item.ref,patch,{merge:true}));
  });
  await commitWriteOperations(operations);
  return schedule;
});

exports.deleteGroupSchedule = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  requireStaffSection(staff, 'schedules');
  const id = cleanDocId(text(request.data?.id, 100));
  const ref = db.collection('groups').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'المجموعة غير موجودة.');
  const schedule = { id:snap.id, ...snap.data() };
  const [students, linked] = await Promise.all([
    linkedStudentsForSchedule(id, schedule),
    linkedRecordsForSchedule(id)
  ]);
  if (students.length) throw new HttpsError('failed-precondition', `لا يمكن حذف المجموعة لأن بها ${students.length} طالب. انقل الطلاب أولًا.`);
  if (linked.transfers.some(item=>item.data.status==='pending')) throw new HttpsError('failed-precondition', 'لا يمكن حذف المجموعة لوجود طلبات نقل معلقة مرتبطة بها.');
  if (linked.learning.length) throw new HttpsError('failed-precondition', `لا يمكن حذف المجموعة لأن عليها ${linked.learning.length} واجب أو امتحان أو محاضرة. غيّر استهداف المحتوى أولًا.`);
  await ref.delete();
  return { ok:true, id };
});

exports.getPublicResources = onCall(CALLABLE_OPTIONS, async request => {
  await rateLimit('public-resources-ip', requestIp(request), 80, 60 * 1000);
  const [materialsSnap, questionsSnap] = await Promise.all([
    db.collection('materials').limit(500).get(),
    db.collection('questions').limit(1000).get()
  ]);
  const publicTarget = item => item.active !== false
    && item.access !== 'subscribers'
    && !['live', 'upcoming', 'recording'].includes(item.contentType);
  const resourcePayload = item => ({
    id: text(item.id, 120),
    title: text(item.title, 220),
    desc: text(item.desc || item.content, 1200),
    content: text(item.content, 3000),
    answer: text(item.answer, 3000),
    grade: text(item.grade || 'كل الصفوف', 80),
    deliveryMode: ['center', 'online'].includes(item.deliveryMode) ? item.deliveryMode : 'all',
    contentType: text(item.contentType, 30),
    term: text(item.term, 40),
    unit: text(item.unit, 120),
    chapter: text(item.chapter, 120),
    fileName: text(item.fileName, 180),
    fileType: text(item.fileType, 100),
    fileUrl: safePublicUrl(item.fileUrl || item.url),
    linkUrl: safePublicUrl(item.linkUrl),
    coverUrl: safePublicUrl(item.coverUrl)
  });
  return {
    materials: materialsSnap.docs.map(doc => ({ id:doc.id, ...doc.data() })).filter(publicTarget).map(resourcePayload),
    questions: questionsSnap.docs.map(doc => ({ id:doc.id, ...doc.data() })).filter(publicTarget).map(resourcePayload)
  };
});

async function loadOnlineContentForStudent(student = {}, code = '') {
  const snap = await db.collection('materials').limit(300).get();
  const progressSnap = await db.collection('lecture_progress').where('studentCode', '==', code).limit(300).get().catch(() => null);
  const progress = new Map(progressSnap ? progressSnap.docs.map(doc => [String(doc.data().lectureId || ''), Number(doc.data().progress || 0)]) : []);
  const now = Date.now();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(item => ['live','upcoming','recording','file'].includes(item.contentType))
    .filter(item => item.active !== false)
    .filter(item => item.deliveryMode === 'online')
    .filter(item => learningTargetMatchesStudent(item, student))
    .filter(item => (item.access || 'subscribers') !== 'subscribers' || student.paid === true)
    .map(item => {
      const startAt = scheduledTimeMillis(item.startAt);
      const duration = Math.max(0, Number(item.duration || 120)) * 60 * 1000;
      const timeUnlocked = !startAt || (['live','upcoming'].includes(item.contentType)
        ? now >= startAt - 15 * 60 * 1000 && now <= startAt + duration
        : now >= startAt);
      const prerequisiteUnlocked = !item.requiredLessonId || (progress.get(String(item.requiredLessonId)) || 0) >= 80;
      const linkUnlocked = timeUnlocked && prerequisiteUnlocked;
      return {
      id: text(item.id, 120), title: text(item.title, 220), desc: text(item.desc, 800), contentType: text(item.contentType, 30),
      grade: text(item.grade, 80), group: text(item.group,100), scheduleId:text(item.scheduleId,100), academicYear:text(item.academicYear,20), term: text(item.term, 40), unit: text(item.unit, 120), chapter: text(item.chapter, 120),
      courseTitle: text(item.courseTitle, 160), moduleTitle: text(item.moduleTitle, 160), lessonOrder: Number(item.lessonOrder || 0),
      requiredLessonId: text(item.requiredLessonId, 120),
      startAt: text(item.startAt, 60), duration: Number(item.duration || 120), access: text(item.access, 30),
      coverUrl: safePublicUrl(item.coverUrl), linkUrl: linkUnlocked ? safePublicUrl(item.linkUrl || item.fileUrl) : '',
      progress: progress.get(String(item.id)) || 0,
      timeUnlocked,
      prerequisiteUnlocked
    };
    });
}

exports.getOnlineContentForStudent = onCall(CALLABLE_OPTIONS, async request => {
  const code = normalizeCode(request.data && request.data.code);
  await rateLimitPublic('online-content', code, request, 12, 45, 60 * 1000);
  const found = await getStudentPortalByCode(code);
  if ((found.data?.deliveryMode || 'center') !== 'online') {
    throw new HttpsError('permission-denied', 'هذا الكود خاص بطالب السنتر. افتح بوابة الطالب بدل قسم الأونلاين.');
  }
  return loadOnlineContentForStudent(found.data || {}, code);
});

exports.recordLectureProgress = onCall(CALLABLE_OPTIONS, async request => {
  const code = normalizeCode(request.data && request.data.code), lectureId = text(request.data && request.data.lectureId, 120);
  const progress = Math.max(0, Math.min(100, Number(request.data && request.data.progress || 0)));
  if (!lectureId) throw new HttpsError('invalid-argument', 'المحاضرة غير صالحة.');
  const [found, lectureSnap] = await Promise.all([
    getStudentPortalByCode(code),
    db.collection('materials').doc(cleanDocId(lectureId)).get()
  ]);
  if (!lectureSnap.exists) throw new HttpsError('not-found', 'المحاضرة غير موجودة.');
  const lecture = { id:lectureSnap.id, ...lectureSnap.data() };
  if (lecture.active === false || lecture.deliveryMode !== 'online' || !learningTargetMatchesStudent(lecture, found.data)) {
    throw new HttpsError('permission-denied', 'هذه المحاضرة غير مخصصة للطالب.');
  }
  if ((lecture.access || 'subscribers') === 'subscribers' && found.data.paid !== true) {
    throw new HttpsError('permission-denied', 'هذه المحاضرة مخصصة للمشتركين.');
  }
  const startAt = scheduledTimeMillis(lecture.startAt);
  if (startAt && Date.now() < startAt) throw new HttpsError('failed-precondition', 'لم يحن موعد فتح المحاضرة بعد.');
  if (lecture.requiredLessonId) {
    const prerequisiteId = cleanDocId(`${code}_${lecture.requiredLessonId}`);
    const prerequisiteSnap = await db.collection('lecture_progress').doc(prerequisiteId).get();
    if (!prerequisiteSnap.exists || Number(prerequisiteSnap.data().progress || 0) < 80) {
      throw new HttpsError('failed-precondition', 'أكمل الدرس السابق أولًا.');
    }
  }
  const id = cleanDocId(`${code}_${lectureId}`);
  await db.collection('lecture_progress').doc(id).set({ studentCode: code, lectureId, progress, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, progress };
});

const leaderboardStateRef = db.collection('_system').doc('leaderboard');
let leaderboardCache = { expiresAt: 0, version: -1, rows: [] };

async function markLeaderboardDirty(reason = 'activity') {
  try {
    await leaderboardStateRef.set({
      version: FieldValue.increment(1),
      reason: text(reason, 60),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('leaderboard-dirty-marker-failed', error?.message || error);
  }
}

function cairoDateKey(value = new Date()) {
  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value && typeof value.toDate === 'function') date = value.toDate();
  else date = value instanceof Date ? value : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function leaderboardRecordDate(row = {}) {
  return cairoDateKey(row.date || row.submittedAt || row.createdAt || row.updatedAt || '');
}

function nextMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function loadMonthlyCollection(collectionName, monthKey) {
  const nextMonth = nextMonthKey(monthKey);
  const [year, month] = monthKey.split('-').map(Number);
  const timestampStart = Timestamp.fromMillis(Date.UTC(year, month - 1, 1) - 24 * 60 * 60 * 1000);
  const timestampEnd = Timestamp.fromMillis(Date.UTC(year, month, 1) + 24 * 60 * 60 * 1000);
  const specs = [
    query => query.where('monthKey', '==', monthKey),
    query => query.where('date', '>=', `${monthKey}-01`).where('date', '<', `${nextMonth}-01`),
    query => query.where('submittedAt', '>=', `${monthKey}-01`).where('submittedAt', '<', `${nextMonth}-01`),
    query => query.where('createdAt', '>=', timestampStart).where('createdAt', '<', timestampEnd)
  ];
  const results = await Promise.all(specs.map(async makeQuery => {
    try {
      const snap = await makeQuery(db.collection(collectionName)).get();
      return { ok: true, docs: snap.docs };
    } catch (error) {
      console.warn('monthly-query-failed', collectionName, error?.message || error);
      return { ok: false, docs: [] };
    }
  }));
  let docs = results.flatMap(result => result.docs);
  if (!results.some(result => result.ok)) {
    const fallback = await db.collection(collectionName).limit(3000).get();
    docs = fallback.docs;
  }
  const unique = new Map(docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
  return [...unique.values()].filter(row => leaderboardRecordDate(row).slice(0, 7) === monthKey);
}

async function getMonthlyLeaderboardRows() {
  const stateSnap = await leaderboardStateRef.get().catch(() => null);
  const stateVersion = stateSnap?.exists ? Number(stateSnap.data()?.version || 0) : 0;
  if (leaderboardCache.expiresAt > Date.now() && leaderboardCache.version === stateVersion) return leaderboardCache.rows;
  const monthKey = cairoDateKey(new Date()).slice(0, 7);
  const [studentsSnap, attendanceRows, gradeRows, attemptRows, homeworkRows, recitationRows] = await Promise.all([
    db.collection('students').where('active', '==', true).get(),
    loadMonthlyCollection('attendance', monthKey),
    loadMonthlyCollection('grades', monthKey),
    loadMonthlyCollection('exam_attempts', monthKey),
    loadMonthlyCollection('homework_submissions', monthKey),
    loadMonthlyCollection('recitations', monthKey)
  ]);
  const grouped = rows => {
    const map = new Map();
    rows.forEach(row => {
      const code = normalizeCode(row.studentCode);
      if (!code) return;
      if (!map.has(code)) map.set(code, []);
      map.get(code).push(row);
    });
    return map;
  };
  const mergedGrades = new Map();
  attemptRows.forEach(row => mergedGrades.set(String(row.attemptId || row.id), row));
  gradeRows.forEach(row => mergedGrades.set(String(row.attemptId || row.id), row));
  const attendance = grouped(attendanceRows), grades = grouped([...mergedGrades.values()]), homeworks = grouped(homeworkRows), recitations = grouped(recitationRows);
  let rows = studentsSnap.docs.map(doc => {
    const student = doc.data() || {};
    const studentCode = normalizeCode(student.studentCode || student.code || doc.id);
    const metrics = calculateMonthlyMetrics({
      studentCode,
      monthKey,
      attendance: attendance.get(studentCode) || student.attendance || [],
      grades: grades.get(studentCode) || student.grades || [],
      homeworks: homeworks.get(studentCode) || student.homeworks || [],
      recitations: recitations.get(studentCode) || student.recitations || []
    });
    return { ...metrics, name: publicStudentName(student.studentName || student.name), grade: text(student.grade, 50) };
  }).filter(row => row.name && row.activity > 0)
    .sort((a, b) => b.score - a.score || b.attendancePct - a.attendancePct || b.gradePct - a.gradePct || a.name.localeCompare(b.name, 'ar'));
  const gradeRanks = new Map(), gradeCounts = new Map();
  rows.forEach(row => gradeCounts.set(row.grade, (gradeCounts.get(row.grade) || 0) + 1));
  rows = rows.map(row => {
    const rank = (gradeRanks.get(row.grade) || 0) + 1;
    gradeRanks.set(row.grade, rank);
    return { ...row, rank, participants: gradeCounts.get(row.grade) || 0 };
  });
  leaderboardCache = { expiresAt: Date.now() + 5 * 60 * 1000, version: stateVersion, rows };
  return rows;
}

exports.getPublicLeaderboard = onCall(CALLABLE_OPTIONS, async request => {
  // The old shared identity "all" imposed one 30-request limit on the whole
  // website. Limit per visitor IP instead so simultaneous students can load it.
  await rateLimit('public-leaderboard-ip', requestIp(request), 60, 60 * 1000);
  const requestedGrade = text(request.data?.grade, 50);
  const rows = await getMonthlyLeaderboardRows();
  return rows.filter(row => row.grade === requestedGrade).slice(0, 5).map(row => {
    const { studentCode, activity, participants, ...publicRow } = row;
    return publicRow;
  });
});

exports.createAttendanceSession = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  const body = request.data || {};
  const scheduleId = cleanDocId(text(body.scheduleId, 100));
  const grade = text(body.grade, 80);
  const group = text(body.group, 100);
  const deliveryMode = body.deliveryMode === 'online' ? 'online' : 'center';
  if (deliveryMode !== 'online') throw new HttpsError('invalid-argument', 'باركود الشاشة مخصص لحصص الأونلاين.');
  if (!grade || !group) throw new HttpsError('invalid-argument', 'اختر الصف وموعد الأونلاين أولًا.');
  if (scheduleId) {
    const scheduleSnap = await db.collection('groups').doc(scheduleId).get();
    if (!scheduleSnap.exists) throw new HttpsError('not-found', 'موعد الأونلاين غير موجود.');
    const schedule = scheduleSnap.data() || {};
    if (schedule.active === false || schedule.deliveryMode !== 'online' || text(schedule.grade, 80) !== grade || text(schedule.name, 100) !== group) {
      throw new HttpsError('failed-precondition', 'بيانات موعد الأونلاين غير متطابقة.');
    }
  }
  const token = crypto.randomBytes(24).toString('hex');
  const sessionId = hash(token).slice(0, 40);
  const expiresAt = Timestamp.fromMillis(Date.now() + 30 * 60 * 1000);
  const attendanceDate = cairoDateKey(new Date());
  await db.collection('attendance_sessions').doc(sessionId).set({
    sessionId, tokenHash: hash(token), scheduleId, grade, group, deliveryMode,
    attendanceDate, active: true, createdBy: staff.uid, createdAt: FieldValue.serverTimestamp(), expiresAt
  });
  const baseUrl = safePublicUrl(body.baseUrl) || 'https://saad-ewida-science-platform.vercel.app/student.html';
  const attendanceUrl = `${baseUrl.split('?')[0]}?attendance=${encodeURIComponent(token)}`;
  const qrDataUrl = await QRCode.toDataURL(attendanceUrl, { width: 720, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0f4f42', light: '#ffffff' } });
  return { sessionId, attendanceUrl, qrDataUrl, grade, group, expiresAt: expiresAt.toDate().toISOString() };
});

exports.claimAttendanceSession = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const token = text(body.token, 100);
  const studentCode = normalizeCode(body.studentCode);
  await rateLimitPublic('attendance-claim', `${studentCode}:${hash(token).slice(0,12)}`, request, 6, 80, 60 * 1000);
  if (!/^[a-f0-9]{48}$/.test(token) || !validLegacyOrStrongCode(studentCode)) throw new HttpsError('invalid-argument', 'بيانات تسجيل الحضور غير صحيحة.');
  const sessionRef = db.collection('attendance_sessions').doc(hash(token).slice(0, 40));
  const studentRef = db.collection('students').doc(cleanDocId(studentCode));
  return db.runTransaction(async tx => {
    const [sessionSnap, studentSnap] = await Promise.all([tx.get(sessionRef), tx.get(studentRef)]);
    if (!sessionSnap.exists) throw new HttpsError('not-found', 'باركود الحضور غير صالح.');
    const session = sessionSnap.data() || {}, student = studentSnap.exists ? studentSnap.data() : null;
    if (!student || student.active === false) throw new HttpsError('not-found', 'حساب الطالب غير موجود أو غير نشط.');
    if (session.active === false || session.tokenHash !== hash(token) || session.expiresAt?.toMillis() < Date.now()) throw new HttpsError('deadline-exceeded', 'انتهت صلاحية باركود الحضور. اطلب من المدرس باركودًا جديدًا.');
    if ((student.deliveryMode === 'online' ? 'online' : 'center') !== 'online'
      || text(student.grade,80) !== session.grade
      || text(student.group,100) !== session.group
      || (session.scheduleId && student.scheduleId && text(student.scheduleId,100) !== text(session.scheduleId,100))) {
      throw new HttpsError('permission-denied', 'هذا الباركود ليس مخصصًا لموعد الطالب.');
    }
    const date = session.attendanceDate || cairoDateKey(new Date());
    const attendanceId = cleanDocId(`${studentCode}_${session.sessionId}`);
    const attendanceRef = db.collection('attendance').doc(attendanceId);
    const attendanceSnap = await tx.get(attendanceRef);
    if (attendanceSnap.exists && attendanceSnap.data()?.status === 'present') {
      const existing = attendanceSnap.data() || {};
      return { ok:true, alreadyPresent:true, studentName:text(existing.studentName || student.studentName || student.name,100), date, time:text(existing.time,40) };
    }
    const record = { id: attendanceId, studentId: studentCode, studentCode, studentName: text(student.studentName || student.name,100), grade: text(student.grade,80), group: text(student.group,100), deliveryMode:'online', scheduleId:session.scheduleId||'', sessionKey:`${date}_${session.sessionId}`, status:'present', date, monthKey:date.slice(0,7), time:new Date().toLocaleTimeString('ar-EG',{timeZone:'Africa/Cairo',hour:'numeric',minute:'2-digit',hour12:true}), method:'online_screen_qr', sessionId:session.sessionId, createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() };
    tx.set(attendanceRef, record, { merge: true });
    tx.set(leaderboardStateRef, { version:FieldValue.increment(1), reason:'online-attendance', updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    return { ok:true, alreadyPresent:false, studentName:record.studentName, date, time:record.time };
  });
});

exports.createStudentAccess = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const body = request.data || {};
  const name = text(body.studentName || body.name, 100).replace(/\s+/g, ' ').trim();
  const parentPhone = digits(body.parentPhone);
  if (!hasAtLeastThreeNameParts(name)) throw new HttpsError('invalid-argument', 'اكتب اسم الطالب ثلاثيًا على الأقل، وإذا تكرر الاسم الثلاثي اكتب الاسم الرباعي.');
  if (digits(parentPhone).length < 10) throw new HttpsError('invalid-argument', 'اكتب رقم ولي أمر صحيحًا.');
  const nameIdentity = await assertStudentNameAvailable(name);
  const requestedMode = body.deliveryMode === 'online' ? 'online' : 'center';
  const requestedGrade = text(body.grade, 80);
  const requestedTerm = text(body.term, 40);
  const requestedYear = text(body.academicYear, 20);
  const requestedScheduleId = cleanDocId(text(body.scheduleId, 100));
  let selectedSchedule = null;
  if (requestedScheduleId) {
    const scheduleSnap = await db.collection('groups').doc(requestedScheduleId).get();
    if (!scheduleSnap.exists || scheduleSnap.data().active === false) throw new HttpsError('failed-precondition', 'المجموعة المختارة غير متاحة.');
    selectedSchedule = { id:scheduleSnap.id, ...scheduleSnap.data() };
    const candidateStudent = {
      grade:requestedGrade, deliveryMode:requestedMode, term:requestedTerm, academicYear:requestedYear,
      group:text(body.group,100), scheduleId:requestedScheduleId
    };
    if (!scheduleMatchesStudent(selectedSchedule, candidateStudent)) throw new HttpsError('failed-precondition', 'المجموعة لا تطابق نوع دراسة الطالب أو صفه أو الترم.');
    const capacity = Math.max(0, Math.min(500, Number(selectedSchedule.capacity || 0)));
    if (capacity && (await scheduleEnrollment(selectedSchedule, requestedScheduleId)).length >= capacity) {
      throw new HttpsError('resource-exhausted', 'اكتمل عدد الطلاب في هذه المجموعة.');
    }
  }

  for (let attemptNo = 0; attemptNo < 8; attemptNo += 1) {
    const studentCode = await uniqueUnifiedAccessCode(8);
    const parentCode = studentCode;
    const studentRef = db.collection('students').doc(cleanDocId(studentCode));
    const studentPortalRef = db.collection('student_portal').doc(cleanDocId(studentCode));
    const parentPortalRef = db.collection('parent_portal').doc(cleanDocId(parentCode));
    const paymentRef = db.collection('payments').doc(cleanDocId(studentCode));
    const student = {
      studentCode,
      code: studentCode,
      parentCode,
      studentName: name,
      name,
      nameKey: nameIdentity.nameKey,
      normalizedName: nameIdentity.normalizedName,
      studentPhone: digits(body.studentPhone),
      parentPhone,
      grade: requestedGrade,
      month: text(body.month, 40),
      group: selectedSchedule ? text(selectedSchedule.name, 100) : text(body.group, 100),
      deliveryMode: requestedMode,
      academicYear: requestedYear,
      term: requestedTerm,
      scheduleId: selectedSchedule ? selectedSchedule.id : '',
      scheduleDays: selectedSchedule ? text(selectedSchedule.days, 100) : text(body.scheduleDays, 100),
      scheduleStartTime: selectedSchedule ? text(selectedSchedule.startTime, 20) : text(body.scheduleStartTime, 20),
      scheduleEndTime: selectedSchedule ? text(selectedSchedule.endTime, 20) : text(body.scheduleEndTime, 20),
      schedulePending: !selectedSchedule && body.schedulePending === true,
      notes: text(body.notes, 1500),
      paid: body.paid === true,
      paymentDate: text(body.paymentDate, 40),
      active: body.active !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    const portal = portalResponse(student, []);
    const batch = db.batch();
    batch.create(studentRef, student);
    batch.create(studentPortalRef, { ...portal, studentCode, parentCode, active: student.active, updatedAt: FieldValue.serverTimestamp() });
    batch.create(parentPortalRef, { ...portal, studentCode, parentCode, active: student.active, updatedAt: FieldValue.serverTimestamp() });
    batch.set(paymentRef, {
      studentCode,
      studentName: name,
      grade: student.grade,
      group: student.group,
      academicYear: student.academicYear,
      term: student.term,
      paid: student.paid,
      paymentDate: student.paymentDate,
      updatedAt: FieldValue.serverTimestamp()
    });
    const logRef = db.collection('activityLog').doc();
    batch.set(logRef, {
      action: 'تم تسجيل طالب جديد',
      meta: { studentCode },
      actorUid: staff.uid,
      actorEmail: staff.email || '',
      actorRole: staff.role || '',
      createdAt: FieldValue.serverTimestamp()
    });
    batch.create(nameIdentity.claimRef, {
      nameKey: nameIdentity.nameKey,
      normalizedName: nameIdentity.normalizedName,
      studentCode,
      source: 'staff',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    try {
      await batch.commit();
      return { ...portal, studentCode, code: studentCode, parentCode, active: student.active };
    } catch (error) {
      const existingClaim = await nameIdentity.claimRef.get().catch(() => null);
      if (existingClaim?.exists) throw duplicateStudentNameError();
      if (attemptNo === 7) throw new HttpsError('aborted', 'تعذر إنشاء أكواد فريدة، حاول مرة أخرى.');
    }
  }
  throw new HttpsError('resource-exhausted', 'تعذر إنشاء أكواد فريدة، حاول مرة أخرى.');
});

exports.createBooking = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const rawRequestId = text(body.requestId, 80);
  const requestId = /^[A-Za-z0-9_-]{12,80}$/.test(rawRequestId) ? rawRequestId : '';
  const requestRef = requestId ? db.collection('_booking_requests').doc(cleanDocId(requestId)) : null;
  if (requestRef) {
    const previous = await requestRef.get();
    if (previous.exists && previous.data().response) return previous.data().response;
  }
  const identity = `${digits(body.parentPhone)}:${request.rawRequest.ip || ''}`;
  await rateLimitPublic('booking-v2', identity, request, 12, 60, 10 * 60 * 1000);
  const name = text(body.name, 80).replace(/\s+/g, ' ').trim();
  const studentPhone = digits(body.studentPhone);
  const parentPhone = digits(body.parentPhone);
  if (!hasAtLeastThreeNameParts(name)) throw new HttpsError('invalid-argument', 'اكتب اسم الطالب ثلاثيًا على الأقل، وإذا تكرر الاسم الثلاثي اكتب الاسم الرباعي.');
  if (studentPhone.length < 10 || parentPhone.length < 10) throw new HttpsError('invalid-argument', 'اكتب أرقام هاتف صحيحة.');
  const nameIdentity = await assertStudentNameAvailable(name, { requestId });
  const requestedGrade = text(body.grade, 80);
  const requestedTerm = text(body.term, 40);
  const requestedGroup = text(body.group, 100);
  const requestedDeliveryMode = body.deliveryMode === 'online' ? 'online' : 'center';
  const paymentMethod = ['center', 'vodafone_cash', 'instapay'].includes(body.paymentMethod) ? body.paymentMethod : 'center';
  const selectedScheduleId = cleanDocId(text(body.scheduleId, 100));
  // These reads do not depend on one another. Parallel execution removes one
  // complete Firestore round-trip from each registration request.
  const [scheduleSnap, code] = await Promise.all([
    selectedScheduleId ? db.collection('groups').doc(selectedScheduleId).get() : Promise.resolve(null),
    uniqueUnifiedAccessCode(8)
  ]);
  if (selectedScheduleId && (!scheduleSnap?.exists || scheduleSnap.data().active === false)) {
    throw new HttpsError('failed-precondition', 'هذا الموعد لم يعد متاحًا. حدّث الصفحة واختر موعدًا آخر.');
  }
  const schedule = scheduleSnap?.exists ? scheduleSnap.data() : {};
  if (selectedScheduleId) {
    const scheduleDeliveryMode = schedule.deliveryMode === 'online' ? 'online' : 'center';
    if (scheduleDeliveryMode !== requestedDeliveryMode) throw new HttpsError('failed-precondition', 'نوع الموعد المختار تغيّر. حدّث الصفحة واختر الموعد من جديد.');
    if (text(schedule.grade, 80) !== requestedGrade) throw new HttpsError('failed-precondition', 'الموعد المختار غير متاح لهذا الصف.');
    if (schedule.term && text(schedule.term, 40) !== requestedTerm) throw new HttpsError('failed-precondition', 'الموعد المختار غير متاح لهذا الترم.');
    if (text(schedule.name, 100) !== requestedGroup) throw new HttpsError('failed-precondition', 'المجموعة المختارة تغيّرت. حدّث الصفحة واخترها من جديد.');
  }
  const capacity = Math.max(0, Math.min(500, Number(schedule.capacity || 0)));
  if (selectedScheduleId && capacity) {
    // Count both current records linked by scheduleId and older records that
    // only stored the group name, so a migrated group cannot overbook.
    const enrolledSnap = await db.collection('students').where('group', '==', requestedGroup).limit(1000).get();
    const enrolled = enrolledSnap.docs.filter(doc => {
      const student = doc.data() || {};
      return student.active !== false
        && text(student.grade, 80) === requestedGrade
        && (student.deliveryMode === 'online' ? 'online' : 'center') === requestedDeliveryMode
        && (!student.scheduleId || text(student.scheduleId, 100) === selectedScheduleId);
    }).length;
    if (enrolled >= capacity) throw new HttpsError('resource-exhausted', 'اكتمل عدد الطلاب في هذا الموعد. اختر موعدًا آخر.');
  }
  // All codes shown after booking are digits only and can be typed with Arabic
  // or English numerals. They are issued immediately and never change later.
  const studentCode = code;
  const parentCode = code;
  const payload = {
    id: code,
    code,
    name,
    studentName: name,
    nameKey: nameIdentity.nameKey,
    normalizedName: nameIdentity.normalizedName,
    studentPhone,
    parentPhone,
    grade: requestedGrade,
    month: text(body.month, 40),
    group: selectedScheduleId ? text(schedule.name, 100) : (requestedGroup || 'في انتظار تحديد المجموعة'),
    deliveryMode: requestedDeliveryMode,
    scheduleId: selectedScheduleId,
    scheduleDays: text(schedule.days, 100),
    scheduleStartTime: text(schedule.startTime, 20),
    scheduleEndTime: text(schedule.endTime, 20),
    schedulePending: !selectedScheduleId,
    academicYear: text(body.academicYear, 20),
    term: requestedTerm,
    notes: text(body.notes, 1000),
    paymentMethod,
    receiptStatus: paymentMethod === 'center' ? 'غير مطلوب' : 'بانتظار رفع الإيصال',
    studentCode,
    parentCode,
    status: 'قيد التسجيل',
    date: new Date().toISOString().slice(0, 10),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  const statusPayload = {
    code,
    name: payload.name,
    grade: payload.grade,
    month: payload.month,
    group: payload.group,
    deliveryMode: payload.deliveryMode,
    scheduleId: payload.scheduleId,
    scheduleDays: payload.scheduleDays,
    scheduleStartTime: payload.scheduleStartTime,
    scheduleEndTime: payload.scheduleEndTime,
    academicYear: payload.academicYear,
    term: payload.term,
    status: payload.status,
    studentCode,
    parentCode,
    updatedAt: FieldValue.serverTimestamp()
  };
  const batch = db.batch();
  batch.create(db.collection('bookings').doc(cleanDocId(code)), payload);
  batch.create(db.collection('booking_status').doc(cleanDocId(code)), statusPayload);
  const provisionalStudent = {
    ...payload,
    bookingCode: code,
    requestId,
    code: studentCode,
    id: studentCode,
    studentCode,
    parentCode,
    paid: false,
    paymentDate: '',
    active: true,
    approvalStatus: 'قيد التسجيل'
  };
  const provisionalPortal = portalResponse(provisionalStudent, []);
  batch.create(db.collection('students').doc(studentCode), provisionalStudent);
  batch.create(db.collection('student_portal').doc(studentCode), { ...provisionalPortal, parentCode, active: true, updatedAt: FieldValue.serverTimestamp() });
  batch.create(db.collection('parent_portal').doc(parentCode), { ...provisionalPortal, parentCode, active: true, updatedAt: FieldValue.serverTimestamp() });
  batch.create(nameIdentity.claimRef, {
    nameKey: nameIdentity.nameKey,
    normalizedName: nameIdentity.normalizedName,
    studentCode,
    bookingCode: code,
    requestId,
    source: 'public-booking',
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  const response = { code, bookingCode: code, studentCode, parentCode, status: payload.status, paymentMethod, receiptStatus: payload.receiptStatus };
  if (requestRef) batch.create(requestRef, { requestId, response, createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000) });
  try {
    await batch.commit();
  } catch (error) {
    // A retried browser request can race the original request. The first batch
    // wins; the retry returns the exact same codes instead of creating a second
    // booking or showing a false failure.
    if (requestRef) {
      const previous = await requestRef.get().catch(() => null);
      if (previous?.exists && previous.data().response) return previous.data().response;
    }
    const existingClaim = await nameIdentity.claimRef.get().catch(() => null);
    if (existingClaim?.exists) throw duplicateStudentNameError();
    throw error;
  }
  return response;
});

exports.uploadBookingReceipt = onCall({ ...CALLABLE_OPTIONS, memory: '512MiB' }, async request => {
  const body = request.data || {};
  const code = normalizeCode(body.bookingCode);
  if (!/^\d{6,12}$/.test(code)) throw new HttpsError('invalid-argument', 'كود الحجز غير صالح.');
  const bookingRef = db.collection('bookings').doc(cleanDocId(code));
  await rateLimitPublic('booking-receipt', `${code}:${request.rawRequest.ip || ''}`, request, 5, 15, 10 * 60 * 1000);
  const snap = await bookingRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'الحجز غير موجود.');
  const booking = snap.data() || {};
  if (!['vodafone_cash', 'instapay'].includes(booking.paymentMethod)) throw new HttpsError('failed-precondition', 'هذا الحجز لا يحتاج إيصال تحويل.');
  const contentType = text(body.contentType, 80).toLowerCase();
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(contentType)) throw new HttpsError('invalid-argument', 'ارفع صورة JPG أو PNG أو WebP أو ملف PDF.');
  const encoded = String(body.base64 || '').replace(/^data:[^;]+;base64,/, '');
  let buffer;
  try { buffer = Buffer.from(encoded, 'base64'); } catch (_) { throw new HttpsError('invalid-argument', 'ملف الإيصال غير صالح.'); }
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) throw new HttpsError('invalid-argument', 'حجم الإيصال يجب ألا يتجاوز 4MB.');
  const extension = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1].replace('jpeg', 'jpg');
  const token = crypto.randomUUID();
  const path = `booking-receipts/${code}/receipt-${Date.now()}.${extension}`;
  const file = admin.storage().bucket().file(path);
  await file.save(buffer, { resumable: false, contentType, metadata: { metadata: { firebaseStorageDownloadTokens: token, bookingCode: code } } });
  const bucket = admin.storage().bucket().name;
  const receiptUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  const patch = { receiptPath: path, receiptUrl, receiptContentType: contentType, receiptStatus: 'بانتظار المراجعة', receiptUploadedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  await Promise.all([
    bookingRef.set(patch, { merge: true }),
    db.collection('booking_status').doc(cleanDocId(code)).set(patch, { merge: true })
  ]);
  return { ok: true, receiptUrl, receiptStatus: patch.receiptStatus };
});

exports.reviewBookingReceipt = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  requireStaffSection(staff, 'bookings', 'payments');
  const code = normalizeCode(request.data?.code);
  if (!validLegacyOrStrongCode(code)) throw new HttpsError('invalid-argument', 'كود الحجز غير صالح.');
  const ref = db.collection('bookings').doc(cleanDocId(code));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'الحجز غير موجود.');
  const approved = request.data?.approved === true;
  const patch = { receiptStatus: approved ? 'تم اعتماد الإيصال' : 'الإيصال مرفوض', receiptReviewNotes: text(request.data?.notes, 500), receiptReviewedBy: staff.email || staff.uid, receiptReviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  await Promise.all([ref.set(patch, { merge: true }), db.collection('booking_status').doc(cleanDocId(code)).set(patch, { merge: true })]);
  return { ok: true, receiptStatus: patch.receiptStatus, receiptReviewNotes: patch.receiptReviewNotes, receiptReviewedBy: patch.receiptReviewedBy, receiptReviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
});

async function approveBookingHandler(request) {
  const staff = await requireStaff(request);
  requireStaffSection(staff, 'bookings');
  const bookingCode = normalizeCode(request.data && request.data.code);
  const bookingId = text(request.data && (request.data.bookingId || request.data.code), 40);
  if (!validLegacyOrStrongCode(bookingCode) || !validLegacyOrStrongCode(bookingId)) throw new HttpsError('invalid-argument', 'كود الحجز غير صالح.');

  // Candidates also let legacy bookings be approved instead of forcing the
  // teacher to delete and recreate them. Existing V55 codes are preserved.
  // Current bookings already use their numeric booking code as the unified
  // access code. Avoid five unnecessary uniqueness reads on every approval;
  // only old alphanumeric bookings need a fresh fallback code.
  const fallbackStudentCode = /^\d{6,12}$/.test(bookingCode) ? bookingCode : await uniqueUnifiedAccessCode(8);

  const bookingRef = db.collection('bookings').doc(cleanDocId(bookingId));
  const statusRef = db.collection('booking_status').doc(cleanDocId(bookingCode));
  return db.runTransaction(async tx => {
    // The normal path needs one read only. booking_status is consulted only
    // when the teacher taps an already-approved request again.
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) {
      const statusSnap = await tx.get(statusRef);
      const status = statusSnap.exists ? statusSnap.data() : {};
      if (String(status.status || '').includes('القبول')) {
        const approved = portalResponse(status, []);
        return { ...approved, bookingCode, code: approved.studentCode, parentCode: text(status.parentCode || approved.studentCode, 40), alreadyApproved: true, bookingDeleted: true };
      }
      throw new HttpsError('not-found', 'الحجز غير موجود أو تم التعامل معه من قبل.');
    }
    const status = {};
    const booking = bookingSnap.data() || {};
    if (['vodafone_cash', 'instapay'].includes(booking.paymentMethod) && booking.receiptStatus !== 'تم اعتماد الإيصال') {
      throw new HttpsError('failed-precondition', 'راجع إيصال التحويل واعتمده قبل قبول الحجز.');
    }
    const existingStudentCode = text(booking.studentCode || status.studentCode, 40);
    const oldParentCode = text(booking.parentCode || status.parentCode, 40);
    const studentCode = /^\d{6,12}$/.test(existingStudentCode) ? existingStudentCode : fallbackStudentCode;
    const parentCode = studentCode;
    const name = text(booking.studentName || booking.name, 100);
    const student = {
      ...booking,
      id: studentCode,
      code: studentCode,
      studentCode,
      parentCode,
      bookingCode,
      name,
      studentName: name,
      paid: booking.receiptStatus === 'تم اعتماد الإيصال',
      paymentDate: booking.receiptStatus === 'تم اعتماد الإيصال' ? new Date().toISOString().slice(0, 10) : '',
      active: true,
      approvalStatus: 'تم القبول والتسجيل كطالب',
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    const portal = portalResponse(student, []);
    tx.set(db.collection('students').doc(studentCode), student, { merge: true });
    tx.set(db.collection('student_portal').doc(studentCode), { ...portal, parentCode, active: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(db.collection('parent_portal').doc(parentCode), { ...portal, parentCode, active: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (oldParentCode && oldParentCode !== parentCode) tx.delete(db.collection('parent_portal').doc(cleanDocId(oldParentCode)));
    tx.set(db.collection('payments').doc(studentCode), { studentCode, studentName: name, grade: student.grade, group: student.group, academicYear: student.academicYear, term: student.term, paymentMethod: student.paymentMethod || 'center', receiptUrl: student.receiptUrl || '', receiptStatus: student.receiptStatus || '', paid: student.paid, paymentDate: student.paymentDate, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(statusRef, { ...status, code: bookingCode, name, studentName: name, studentCode, parentCode, status: 'تم القبول والتسجيل كطالب', acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.delete(bookingRef);
    tx.set(db.collection('activityLog').doc(), { action: 'تم قبول الحجز وتسجيل الطالب', meta: { bookingCode, bookingId, studentCode }, actorUid: staff.uid, actorEmail: staff.email || '', actorRole: staff.role || '', createdAt: FieldValue.serverTimestamp() });
    // Never return FieldValue.serverTimestamp() sentinels to a callable client.
    // They are valid Firestore writes but are not a stable JSON response and
    // previously turned a successful approval into FirebaseError: INTERNAL.
    return { ...portal, bookingCode, code: studentCode, studentCode, parentCode, bookingDeleted: true };
  });
}

exports.approveBooking = onCall(CALLABLE_OPTIONS, approveBookingHandler);

async function firebaseAuthFromHttp(request) {
  const header = String(request.headers?.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const token = await admin.auth().verifyIdToken(match[1]);
    return { uid: token.uid, token };
  } catch (_) {
    throw new HttpsError('unauthenticated', 'جلسة تسجيل الدخول غير صالحة. سجّل الدخول من جديد.');
  }
}

function httpStatusForHttpsError(code) {
  return ({
    'invalid-argument': 400,
    unauthenticated: 401,
    'permission-denied': 403,
    'not-found': 404,
    'already-exists': 409,
    'failed-precondition': 412,
    'resource-exhausted': 429,
    unavailable: 503
  })[code] || 500;
}

// Public HTTP bridge for the two critical portal actions. onRequest exposes
// invoker:public in the deployment manifest, unlike older callable revisions
// whose Cloud Run IAM state can remain private. The approval handler still
// validates the Firebase ID token and the staff document before any write.
exports.platformApi = onRequest(HTTP_BRIDGE_OPTIONS, async (request, response) => {
  response.set('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, error: { code: 'method-not-allowed', message: 'استخدم POST فقط.' }, release: BACKEND_RELEASE });
    return;
  }
  try {
    const action = text(request.body?.action, 80);
    const data = request.body?.data && typeof request.body.data === 'object' ? request.body.data : {};
    const auth = await firebaseAuthFromHttp(request);
    const callableRequest = { data, auth, rawRequest: request };
    let result;
    if (action === 'getPortalStudent') result = await getPortalStudentHandler(callableRequest);
    else if (action === 'approveBooking') result = await approveBookingHandler(callableRequest);
    else if (HTTP_BRIDGE_ACTIONS.has(action) && typeof exports[action]?.run === 'function') result = await exports[action].run(callableRequest);
    else throw new HttpsError('invalid-argument', 'العملية المطلوبة غير مدعومة.');
    response.status(200).json({ ok: true, data: result, release: BACKEND_RELEASE });
  } catch (error) {
    const knownCode = String(error?.code || '').replace(/^functions\//, '');
    const known = error instanceof HttpsError || knownCode in {
      'invalid-argument': 1, unauthenticated: 1, 'permission-denied': 1,
      'not-found': 1, 'already-exists': 1, 'failed-precondition': 1,
      'resource-exhausted': 1, unavailable: 1
    };
    const code = known ? knownCode : 'internal';
    if (!known) console.error('platform-api-error', error);
    response.status(httpStatusForHttpsError(code)).json({
      ok: false,
      error: { code, message: known ? text(error.message, 500) : 'تعذر تنفيذ العملية الآن.' },
      release: BACKEND_RELEASE
    });
  }
});

exports.getBookingStatus = onCall(CALLABLE_OPTIONS, async request => {
  const code = normalizeCode(request.data && request.data.code);
  await rateLimitPublic('booking-status', code, request, 10, 40, 60 * 1000);
  if (!validLegacyOrStrongCode(code)) throw new HttpsError('invalid-argument', 'كود الحجز غير صالح.');
  let snap = await db.collection('booking_status').doc(cleanDocId(code)).get();
  if (!snap.exists) snap = await db.collection('bookings').doc(cleanDocId(code)).get();
  if (!snap.exists) throw new HttpsError('not-found', 'لم يتم العثور على الحجز.');
  const data = snap.data();
  return {
    code,
    name: text(data.name || data.studentName, 80),
    grade: text(data.grade, 80),
    month: text(data.month, 40),
    group: text(data.group, 100),
    deliveryMode: data.deliveryMode === 'online' ? 'online' : 'center',
    scheduleId: text(data.scheduleId, 100),
    scheduleDays: text(data.scheduleDays, 100),
    scheduleStartTime: text(data.scheduleStartTime, 20),
    scheduleEndTime: text(data.scheduleEndTime, 20),
    academicYear: text(data.academicYear, 20),
    term: text(data.term, 40),
    status: text(data.status, 100)
  };
});

exports.rejectBooking = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const bookingCode = normalizeCode(request.data && request.data.code);
  if (!validLegacyOrStrongCode(bookingCode)) throw new HttpsError('invalid-argument', 'كود الحجز غير صالح.');
  const bookingRef = db.collection('bookings').doc(cleanDocId(bookingCode));
  const statusRef = db.collection('booking_status').doc(cleanDocId(bookingCode));
  return db.runTransaction(async tx => {
    const [bookingSnap, statusSnap] = await Promise.all([tx.get(bookingRef), tx.get(statusRef)]);
    const data = bookingSnap.exists ? bookingSnap.data() : (statusSnap.exists ? statusSnap.data() : null);
    if (!data) throw new HttpsError('not-found', 'الحجز غير موجود.');
    const studentCode = text(data.studentCode, 40);
    const parentCode = text(data.parentCode, 40);
    const { nameKey } = studentNameIdentity(data.studentName || data.name);
    const claimRef = nameKey ? db.collection('_student_name_claims').doc(nameKey) : null;
    const claimSnap = claimRef ? await tx.get(claimRef) : null;
    if (studentCode) {
      tx.set(db.collection('students').doc(cleanDocId(studentCode)), { active: false, approvalStatus: 'تم رفض الحجز', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(db.collection('student_portal').doc(cleanDocId(studentCode)), { active: false, approvalStatus: 'تم رفض الحجز', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    if (parentCode) tx.set(db.collection('parent_portal').doc(cleanDocId(parentCode)), { active: false, approvalStatus: 'تم رفض الحجز', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (claimSnap?.exists && text(claimSnap.data().studentCode, 40) === studentCode) tx.delete(claimRef);
    tx.set(statusRef, { ...data, status: 'تم رفض الحجز', rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (bookingSnap.exists) tx.delete(bookingRef);
    tx.set(db.collection('activityLog').doc(), { action: 'تم رفض حجز طالب', meta: { bookingCode, studentCode }, actorUid: staff.uid, actorEmail: staff.email || '', actorRole: staff.role || '', createdAt: FieldValue.serverTimestamp() });
    return { code: bookingCode, status: 'تم رفض الحجز' };
  });
});

exports.createReview = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  await rateLimitPublic('review', text(body.name, 60), request, 2, 8, 60 * 60 * 1000);
  const name = text(body.name, 60);
  const reviewText = text(body.text, 600);
  const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));
  if (name.length < 2 || reviewText.length < 5) throw new HttpsError('invalid-argument', 'اكتب اسمًا وتقييمًا واضحًا.');
  const ref = db.collection('reviews').doc();
  await ref.set({
    id: ref.id,
    name,
    role: text(body.role, 30),
    text: reviewText,
    rating: String(rating),
    brand: 'saad-ewida',
    approved: false,
    date: new Date().toISOString().slice(0, 10),
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true };
});

exports.recordClassProgress = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const body = request.data || {};
  const type = body.type === 'recitation' ? 'recitation' : (body.type === 'homework' ? 'homework' : '');
  const studentCode = normalizeCode(body.studentCode);
  const date = text(body.date, 10);
  const completed = body.completed !== false;
  if (!type || !validLegacyOrStrongCode(studentCode) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError('invalid-argument', 'بيانات متابعة الحصة غير مكتملة.');
  }
  const studentSnap = await db.collection('students').doc(cleanDocId(studentCode)).get();
  if (!studentSnap.exists || studentSnap.data().active === false) throw new HttpsError('not-found', 'الطالب غير موجود أو غير نشط.');
  const student = studentSnap.data() || {};
  const collection = type === 'recitation' ? 'recitations' : 'homework_submissions';
  const id = cleanDocId(`${studentCode}_${date}_class`);
  const ref = db.collection(collection).doc(id);
  if (!completed) {
    await ref.delete().catch(() => {});
    await markLeaderboardDirty(`${type}-removed`);
    return { id, type, studentCode, date, completed: false, removed: true };
  }
  const payload = {
    id,
    type,
    studentCode,
    studentName: text(student.studentName || student.name, 100),
    grade: text(student.grade, 80),
    group: text(student.group, 100),
    academicYear: text(student.academicYear, 20),
    term: text(student.term, 40),
    date,
    monthKey: date.slice(0, 7),
    time: text(body.time, 30),
    title: type === 'recitation' ? 'تسميع الحصة' : 'واجب الحصة',
    status: type === 'recitation' ? 'تم التسميع' : 'تم عمل الواجب',
    completed: true,
    approved: true,
    method: 'teacher_class_check',
    checkedBy: staff.email || staff.uid,
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.set(payload, { merge: true });
  await markLeaderboardDirty(type);
  return { ...payload, updatedAt: new Date().toISOString() };
});

function examMatchesStudent(exam, student) {
  return learningTargetMatchesStudent(exam, student);
}

function examIsOpen(exam, now = Date.now()) {
  return getExamScheduleState(exam,now).state==='open';
}

exports.getExamDashboard = onCall(CALLABLE_OPTIONS, async request => {
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  await rateLimitPublic('exam-dashboard', studentCode, request, 10, 35, 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const grade = text(found.data.grade, 80);
  const snap = await db.collection('exams').get();
  const exams = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(exam => examMatchesStudent(exam, found.data))
    .filter(exam => exam.active !== false)
    .map(exam => ({
      id: text(exam.id, 100),
      title: text(exam.title, 200),
      grade: text(exam.grade, 80),
      group: text(exam.group, 100),
      academicYear: text(exam.academicYear, 20),
      term: text(exam.term, 40),
      openAt: text(exam.openAt, 60),
      closeAt: text(exam.closeAt, 60),
      duration: Math.max(1, Math.min(240, Number(exam.duration || 20))),
      instructions: text(exam.instructions, 1500),
      pdfUrl: safePublicUrl(exam.pdfUrl || exam.examPdfUrl),
      pdfName: text(exam.pdfName || exam.examPdfName, 220),
      examFormat: ['pdf', 'mixed'].includes(exam.examFormat) ? exam.examFormat : 'questions',
      allowRetake: exam.allowRetake === true,
      maxScore: positiveScore(exam.maxScore,100),
      scheduleState: getExamScheduleState(exam).state,
      questionCount: Number(exam.questionCount || examQuestionList(exam).length)
    }));
  const [attempts, records] = await Promise.all([attemptSummaries(studentCode), studentRecords(studentCode)]);
  return { student: portalResponse(found.data, attempts, records), exams, serverNow:Date.now() };
});

exports.startExam = onCall(CALLABLE_OPTIONS, async request => {
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  const examId = cleanDocId(request.data && request.data.examId);
  await rateLimitPublic('exam-start', `${studentCode}:${examId}`, request, 5, 20, 10 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) throw new HttpsError('not-found', 'الامتحان غير موجود.');
  const exam = { id: examSnap.id, ...examSnap.data() };
  if (!examIsOpen(exam)) throw new HttpsError('failed-precondition', 'الامتحان غير متاح في الوقت الحالي.');
  if (!examMatchesStudent(exam, found.data)) {
    throw new HttpsError('permission-denied', 'هذا الامتحان غير مخصص لصفك أو مجموعتك أو عامك الدراسي.');
  }
  const questions = assignQuestionScores(examQuestionList(exam),exam.maxScore);
  if (!questions.length) throw new HttpsError('failed-precondition', 'الامتحان لا يحتوي على أسئلة صالحة.');
  if (questions.length > 200) throw new HttpsError('failed-precondition', 'عدد أسئلة الامتحان أكبر من الحد المسموح.');

  const now = Date.now();
  const initialTiming=examSessionDeadline(exam,now,now);
  const durationMinutes=initialTiming.durationMinutes;
  const sessionDeadline=initialTiming.expiresAtMs;
  const sessionId = cleanDocId(`${examId}_${studentCode}`);
  const sessionRef = db.collection('exam_sessions').doc(sessionId);
  const lockRef = db.collection('exam_locks').doc(sessionId);

  const sessionData = await db.runTransaction(async tx => {
    const [existingSessionSnap, lockSnap] = await Promise.all([tx.get(sessionRef), tx.get(lockRef)]);
    if (lockSnap.exists && exam.allowRetake !== true) {
      throw new HttpsError('already-exists', 'تم تسليم الامتحان بالفعل.');
    }
    if (existingSessionSnap.exists) {
      const existing = existingSessionSnap.data();
      const existingExpiresAt = existing.expiresAt?.toMillis ? existing.expiresAt.toMillis() : 0;
      const existingStartedAt = existing.startedAt?.toMillis ? existing.startedAt.toMillis() : now;
      const revisedTiming = examSessionDeadline(exam, existingStartedAt, now);
      if (existing.status === 'submitted' && exam.allowRetake !== true) {
        throw new HttpsError('already-exists', 'تم تسليم الامتحان بالفعل.');
      }
      if (existing.status === 'started' && revisedTiming.expiresAtMs > now) {
        const timingChanged = existingExpiresAt !== revisedTiming.expiresAtMs || Number(existing.duration || 0) !== revisedTiming.durationMinutes;
        if (timingChanged) {
          const updated = {
            ...existing,
            duration: revisedTiming.durationMinutes,
            expiresAt: Timestamp.fromMillis(revisedTiming.expiresAtMs),
            examTimingSyncedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          };
          tx.set(sessionRef, {
            duration: updated.duration,
            expiresAt: updated.expiresAt,
            examTimingSyncedAt: updated.examTimingSyncedAt,
            updatedAt: updated.updatedAt
          }, { merge:true });
          return updated;
        }
        return existing;
      }
      if (existing.status === 'started' && revisedTiming.expiresAtMs <= now && exam.allowRetake !== true) {
        throw new HttpsError('deadline-exceeded', 'انتهى وقت الامتحان ولا يمكن بدء الوقت من جديد. راجع المدرس.');
      }
    }

    const attemptSequence = existingSessionSnap.exists
      ? Number(existingSessionSnap.data().attemptSequence || 0) + 1
      : 1;
    const fresh = {
      sessionId,
      examId,
      studentCode,
      studentName: text(found.data.studentName || found.data.name, 100),
      grade: text(found.data.grade, 80),
      group: text(found.data.group, 100),
      academicYear: text(found.data.academicYear, 20),
      term: text(found.data.term, 40),
      examTitle: text(exam.title, 200),
      instructions: text(exam.instructions, 1500),
      pdfUrl: safePublicUrl(exam.pdfUrl || exam.examPdfUrl),
      pdfName: text(exam.pdfName || exam.examPdfName, 220),
      duration: durationMinutes,
      maxScore: questions.reduce((sum,q)=>sum+positiveScore(q.points,1),0),
      allowRetake: exam.allowRetake === true,
      attemptSequence,
      status: 'started',
      questions,
      startedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(sessionDeadline),
      deleteAt: Timestamp.fromMillis(now + 30 * 24 * 60 * 60 * 1000),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    tx.set(sessionRef, fresh);
    return fresh;
  });

  const startedAtMs = sessionData.startedAt?.toMillis ? sessionData.startedAt.toMillis() : now;
  const expiresAtMs = sessionData.expiresAt?.toMillis
    ? sessionData.expiresAt.toMillis()
    : startedAtMs + durationMinutes * 60 * 1000;
  const snapshotQuestions = Array.isArray(sessionData.questions) && sessionData.questions.length
    ? sessionData.questions
    : questions;
  return publicExamSession(sessionId, {
    id: examId,
    title: sessionData.examTitle || exam.title,
    instructions: sessionData.instructions || exam.instructions,
    duration: sessionData.duration || durationMinutes,
    pdfUrl: sessionData.pdfUrl || exam.pdfUrl || exam.examPdfUrl,
    pdfName: sessionData.pdfName || exam.pdfName || exam.examPdfName
    ,maxScore: sessionData.maxScore||exam.maxScore
  }, snapshotQuestions, startedAtMs, expiresAtMs);
});

exports.syncExamSession = onCall(CALLABLE_OPTIONS, async request => {
  const sessionId = cleanDocId(request.data && request.data.sessionId);
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  if (!sessionId || !validLegacyOrStrongCode(studentCode)) throw new HttpsError('invalid-argument', 'بيانات جلسة الامتحان غير مكتملة.');
  await rateLimitPublic('exam-session-sync', `${studentCode}:${sessionId}`, request, 30, 90, 60 * 1000);
  const sessionRef = db.collection('exam_sessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'جلسة الامتحان غير موجودة.');
  const session = sessionSnap.data() || {};
  if (normalizeCode(session.studentCode) !== studentCode) throw new HttpsError('permission-denied', 'كود الطالب لا يطابق جلسة الامتحان.');
  const serverNow = Date.now();
  if (session.status !== 'started') {
    return { status:text(session.status,30)||'submitted', serverNow, expiresAt:session.expiresAt?.toMillis?.()||0 };
  }
  const examSnap = await db.collection('exams').doc(cleanDocId(session.examId)).get();
  if (!examSnap.exists) throw new HttpsError('not-found', 'الامتحان لم يعد موجودًا.');
  const exam = { id:examSnap.id, ...examSnap.data() };
  const startedAtMs = session.startedAt?.toMillis?.() || serverNow;
  const timing = examSessionDeadline(exam, startedAtMs, serverNow);
  const previousExpiresAt = session.expiresAt?.toMillis?.() || 0;
  if (previousExpiresAt !== timing.expiresAtMs || Number(session.duration || 0) !== timing.durationMinutes) {
    await sessionRef.set({
      duration:timing.durationMinutes,
      expiresAt:Timestamp.fromMillis(timing.expiresAtMs),
      examTimingSyncedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp()
    }, { merge:true });
  }
  return {
    status:'started',
    duration:timing.durationMinutes,
    expiresAt:timing.expiresAtMs,
    serverNow,
    scheduleState:timing.schedule.state,
    changed:previousExpiresAt !== timing.expiresAtMs
  };
});

exports.submitExam = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const sessionId = cleanDocId(body.sessionId);
  const studentCode = normalizeCode(body.studentCode);
  const rawAnswers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : {};
  if (jsonByteSize(rawAnswers) > 64 * 1024) throw new HttpsError('invalid-argument', 'حجم الإجابات أكبر من الحد المسموح.');
  await rateLimitPublic('exam-submit', `${studentCode}:${sessionId}`, request, 4, 20, 10 * 60 * 1000);
  if (!sessionId || !validLegacyOrStrongCode(studentCode)) throw new HttpsError('invalid-argument', 'بيانات المحاولة غير مكتملة.');
  const sessionRef = db.collection('exam_sessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'جلسة الامتحان غير موجودة.');
  const session = sessionSnap.data();
  if (session.studentCode !== studentCode) throw new HttpsError('permission-denied', 'كود الطالب لا يطابق جلسة الامتحان.');
  if (session.status === 'submitted' && session.result) return session.result;
  const expiresAt = session.expiresAt && session.expiresAt.toMillis ? session.expiresAt.toMillis() : 0;
  if (expiresAt && Date.now() > expiresAt + 120 * 1000) throw new HttpsError('deadline-exceeded', 'انتهى وقت الامتحان.');
  const examSnap = await db.collection('exams').doc(session.examId).get();
  const exam = examSnap.exists ? { id: examSnap.id, ...examSnap.data() } : {
    id: session.examId,
    title: session.examTitle || 'امتحان',
    allowRetake: session.allowRetake === true
  };
  const questions = assignQuestionScores(Array.isArray(session.questions) && session.questions.length
    ? session.questions
    : examQuestionList(exam),session.maxScore||exam.maxScore);
  if (!questions.length) throw new HttpsError('failed-precondition', 'تعذر قراءة أسئلة الامتحان.');
  if (Object.keys(rawAnswers).length > questions.length + 5) throw new HttpsError('invalid-argument', 'عدد الإجابات غير صالح.');

  let correctCount = 0;
  let mcqCount = 0;
  let essayCount = 0;
  let needsManualReview = false;
  const staffAnswers = [];
  questions.forEach((question, index) => {
    const value = rawAnswers[String(index)] ?? rawAnswers[index] ?? '';
    if (question.type === 'mcq') {
      mcqCount += 1;
      const chosenIndex = Number(value);
      const chosen = Number.isInteger(chosenIndex) ? question.options[chosenIndex] || '' : '';
      const correct = mcqCorrect(question, chosenIndex);
      if (correct === true) correctCount += 1;
      if (correct === null) needsManualReview = true;
      staffAnswers.push({
        question: question.question,
        type: 'mcq',
        answer: text(chosen, 1000),
        answerIndex: Number.isInteger(chosenIndex) ? chosenIndex : null,
        correct,
        correctAnswer: question.answer,
        options: question.options,
        optionLabels: question.optionLabels,
        points: positiveScore(question.points,1),
        awardedScore: correct===true?positiveScore(question.points,1):0
      });
    } else {
      essayCount += 1;
      needsManualReview = true;
      staffAnswers.push({
        question: question.question,
        type: 'essay',
        answer: text(value, 4000),
        correct: null,
        correctAnswer: 'يصححها المدرس',
        points: positiveScore(question.points,1),
        awardedScore: null
      });
    }
  });

  const autoAwarded=Math.round(staffAnswers.reduce((sum,item)=>sum+(Number(item.awardedScore)||0),0)*100)/100;
  const scored=scoreSummary(questions,staffAnswers.map(item=>item.awardedScore),needsManualReview);
  const autoScore=autoAwarded;
  const score=scored.score,percentage=scored.percentage,maxScore=scored.maxScore;
  const attemptRef = db.collection('exam_attempts').doc();
  const submittedAt = new Date().toISOString();
  const monthKey = cairoDateKey(submittedAt).slice(0, 7);
  const attempt = {
    id: attemptRef.id,
    examId: session.examId,
    examTitle: text(exam.title, 200),
    studentCode,
    studentName: text(session.studentName, 100),
    grade: text(session.grade, 80),
    group: text(session.group, 100),
    academicYear: text(session.academicYear, 20),
    term: text(session.term, 40),
    startedAt: session.startedAt && session.startedAt.toDate ? session.startedAt.toDate().toISOString() : submittedAt,
    submittedAt,
    score,
    autoScore,
    maxScore,
    percentage,
    mcqCount,
    essayCount,
    questionCount: questions.length,
    correctCount,
    needsManualReview,
    status: needsManualReview ? 'pending_manual' : 'submitted',
    answers: staffAnswers,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  const summary = {
    id: attemptRef.id,
    examId: session.examId,
    examTitle: attempt.examTitle,
    submittedAt,
    score,
    autoScore,
    maxScore,
    percentage,
    answers: staffAnswers,
    needsManualReview,
    status: attempt.status,
    academicYear: attempt.academicYear,
    term: attempt.term
  };
  const lockRef = db.collection('exam_locks').doc(cleanDocId(`${session.examId}_${studentCode}`));
  const studentAttemptsRef = db.collection('student_attempts').doc(cleanDocId(studentCode));
  const summaryRef = studentAttemptsRef.collection('attempts').doc(attemptRef.id);
  const gradeRef = db.collection('grades').doc(attemptRef.id);
  const committedResult = await db.runTransaction(async tx => {
    const latestSession = await tx.get(sessionRef);
    if (!latestSession.exists) throw new HttpsError('not-found', 'جلسة الامتحان غير موجودة.');
    const latestData = latestSession.data();
    if (latestData.status === 'submitted' && latestData.result) return latestData.result;
    if (session.allowRetake !== true) {
      const existingLock = await tx.get(lockRef);
      if (existingLock.exists) throw new HttpsError('already-exists', 'تم تسليم الامتحان بالفعل.');
    }
    tx.set(attemptRef, attempt);
    tx.set(summaryRef, summary);
    tx.set(studentAttemptsRef, { studentCode, lastAttempt:summary, count:FieldValue.increment(1), updatedAt:FieldValue.serverTimestamp() }, { merge: true });
    if (score !== null) {
      tx.set(gradeRef, {
        id: attemptRef.id,
        attemptId: attemptRef.id,
        examId: session.examId,
        exam: attempt.examTitle,
        examTitle: attempt.examTitle,
        studentCode,
        studentName: attempt.studentName,
        grade: attempt.grade,
        group: attempt.group,
        score,
        maxScore,
        percentage,
        date: cairoDateKey(submittedAt),
        submittedAt,
        monthKey,
        source: 'secure_exam',
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
      tx.set(leaderboardStateRef, { version:FieldValue.increment(1), reason:'exam-grade', updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    }
    if (session.allowRetake !== true) tx.set(lockRef, { examId: session.examId, studentCode, attemptId: attemptRef.id, submittedAt: FieldValue.serverTimestamp() });
    tx.update(sessionRef, { status: 'submitted', result: summary, submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), deleteAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    return summary;
  });
  return committedResult;
});

exports.prepareHomeworkUpload = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const studentCode = normalizeCode(body.studentCode);
  await rateLimitPublic('homework-prepare', studentCode, request, 5, 15, 60 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const assignmentId = text(body.assignmentId, 120);
  let assignmentTitle = '';
  if (!assignmentId) throw new HttpsError('invalid-argument', 'اختر الواجب المطلوب قبل رفع الملف.');
  const assignmentSnap = await db.collection('assignments').doc(cleanDocId(assignmentId)).get();
  if (!assignmentSnap.exists || !assignmentIsReleased(assignmentSnap.data())) throw new HttpsError('not-found', 'الواجب غير متاح حاليًا أو لم يحن موعد نشره بعد.');
  const assignment = { id:assignmentSnap.id, ...assignmentSnap.data() };
  if (!learningTargetMatchesStudent(assignment, found.data)) throw new HttpsError('permission-denied', 'هذا الواجب غير مخصص للطالب.');
  if (!assignmentSubmissionIsOpen(assignment, Date.now(), cairoDateKey(new Date()))) {
    throw new HttpsError('deadline-exceeded', 'انتهى آخر موعد لتسليم هذا الواجب.');
  }
  assignmentTitle = text(assignment.title, 160);
  const fileName = text(body.fileName, 180).replace(/[\\/#?\[\]]/g, '-');
  const contentType = text(body.contentType, 100);
  const size = Number(body.size || 0);
  if (!fileName || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) throw new HttpsError('invalid-argument', 'بيانات ملف الواجب غير صالحة.');
  if (!(['image/jpeg','image/png','image/webp','application/pdf'].includes(contentType))) throw new HttpsError('invalid-argument', 'مسموح بالصور وملفات PDF فقط.');
  const uploadId = crypto.randomBytes(18).toString('hex');
  const safeName = `${Date.now()}-${fileName}`.slice(0, 220);
  await db.collection('_homework_upload_tokens').doc(uploadId).set({
    studentCode,
    safeName,
    contentType,
    size,
    assignmentId,
    assignmentTitle,
    dueDate: text(assignment.dueDate, 10),
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
    createdAt: FieldValue.serverTimestamp()
  });
  return { uploadId, safeName, path: `homework/${cleanDocId(studentCode)}/${uploadId}/${safeName}` };
});

exports.registerHomeworkSubmission = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const studentCode = normalizeCode(body.studentCode);
  await rateLimitPublic('homework-submit', studentCode, request, 5, 15, 60 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const uploadId = text(body.uploadId, 80);
  const tokenRef = db.collection('_homework_upload_tokens').doc(cleanDocId(uploadId));
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) throw new HttpsError('permission-denied', 'انتهت صلاحية رفع الملف. ابدأ الرفع من جديد.');
  const token = tokenSnap.data() || {};
  const expiresAt = token.expiresAt?.toMillis?.() || 0;
  if (token.studentCode !== studentCode || expiresAt <= Date.now()) {
    await tokenRef.delete().catch(() => {});
    throw new HttpsError('permission-denied', 'انتهت صلاحية رفع الملف. ابدأ الرفع من جديد.');
  }
  const filePath = text(body.path || body.filePath, 500);
  const expectedPath = `homework/${cleanDocId(studentCode)}/${uploadId}/${token.safeName}`;
  if (filePath !== expectedPath) {
    throw new HttpsError('permission-denied', 'مسار ملف الواجب غير صالح.');
  }
  const bucket = admin.storage().bucket();
  let metadata;
  try{[metadata] = await bucket.file(filePath).getMetadata();}catch(error){throw new HttpsError('not-found', 'ملف الواجب لم يكتمل رفعه. حاول مرة أخرى.');}
  const size = Number(metadata.size || 0),contentType = text(metadata.contentType, 100);
  if (size !== Number(token.size) || contentType !== token.contentType) throw new HttpsError('permission-denied', 'بيانات الملف المرفوع لا تطابق طلب الرفع.');
  let downloadToken = text(metadata.metadata?.firebaseStorageDownloadTokens?.split(',')?.[0], 200);
  if (!downloadToken) {
    downloadToken = crypto.randomUUID();
    await bucket.file(filePath).setMetadata({ metadata: { ...(metadata.metadata || {}), firebaseStorageDownloadTokens: downloadToken } });
  }
  const fileUrl = downloadToken ? `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${encodeURIComponent(downloadToken)}` : '';
  if (!fileUrl) throw new HttpsError('internal', 'تعذر تجهيز رابط ملف الواجب. حاول مرة أخرى.');
  const assignmentId = text(token.assignmentId, 120);
  if (text(body.assignmentId, 120) !== assignmentId) throw new HttpsError('permission-denied', 'بيانات الواجب لا تطابق تصريح الرفع.');
  const assignmentSnap = await db.collection('assignments').doc(cleanDocId(assignmentId)).get();
  if (!assignmentSnap.exists) throw new HttpsError('not-found', 'الواجب لم يعد متاحًا.');
  const assignment = { id:assignmentSnap.id, ...assignmentSnap.data() };
  if (!learningTargetMatchesStudent(assignment, found.data)) throw new HttpsError('permission-denied', 'هذا الواجب لم يعد مخصصًا للطالب.');
  if (!assignmentSubmissionIsOpen(assignment, Date.now(), cairoDateKey(new Date()))) {
    await bucket.file(filePath).delete().catch(()=>{});
    await tokenRef.delete().catch(()=>{});
    throw new HttpsError('deadline-exceeded', 'انتهى آخر موعد لتسليم هذا الواجب.');
  }
  const ref = assignmentId ? db.collection('homework_submissions').doc(cleanDocId(`${studentCode}_${assignmentId}`)) : db.collection('homework_submissions').doc();
  const submittedAt = new Date().toISOString();
  const batch = db.batch();
  batch.set(ref, {
    id: ref.id,
    studentCode,
    studentName: text(found.data.studentName || found.data.name, 100),
    grade: text(found.data.grade, 80),
    group: text(found.data.group, 100),
    assignmentId,
    assignmentTitle: text(token.assignmentTitle, 160),
    title: text(token.assignmentTitle, 160) || 'واجب مرفوع',
    academicYear: text(found.data.academicYear, 20),
    term: text(found.data.term, 40),
    fileName: text(body.fileName || token.safeName, 180),
    fileUrl,
    url: fileUrl,
    filePath,
    path: filePath,
    contentType,
    size,
    date: cairoDateKey(submittedAt),
    submittedAt,
    monthKey: submittedAt.slice(0, 7),
    status: 'بانتظار مراجعة المدرس',
    completed: false,
    approved: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.delete(tokenRef);
  await batch.commit();
  return { id: ref.id, ok: true };
});

exports.reportClientError = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  await rateLimitPublic('client-error', text(body.page, 120), request, 5, 15, 60 * 60 * 1000);
  await db.collection('client_errors').add({
    message: text(body.message, 1000),
    page: text(body.page, 500),
    userAgent: text(body.userAgent, 500),
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true };
});


const BACKUP_COLLECTIONS = [
  'settings','users','students','student_portal','parent_portal','bookings','booking_status','reviews',
  'materials','questions','groups','assignments','exams','exam_attempts','homework_submissions',
  'attendance','recitations','grades','payments','payment_records','reports','activityLog','client_errors',
  'student_attempts','exam_locks','student_transfer_requests'
];

function encodeBackupValue(value) {
  if (value instanceof Timestamp) return { __mfType: 'timestamp', iso: value.toDate().toISOString() };
  if (value instanceof admin.firestore.GeoPoint) return { __mfType: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (Array.isArray(value)) return value.map(encodeBackupValue);
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = encodeBackupValue(item);
    return output;
  }
  return value;
}

function decodeBackupValue(value) {
  if (Array.isArray(value)) return value.map(decodeBackupValue);
  if (value && typeof value === 'object') {
    if (value.__mfType === 'timestamp' && value.iso) return Timestamp.fromDate(new Date(value.iso));
    if (value.__mfType === 'geopoint') return new admin.firestore.GeoPoint(Number(value.latitude), Number(value.longitude));
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = decodeBackupValue(item);
    return output;
  }
  return value;
}

async function exportCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  const rows = [];
  for (const doc of snap.docs) {
    const row = { id: doc.id, data: encodeBackupValue(doc.data()) };
    if (collectionName === 'student_attempts') {
      const attempts = await doc.ref.collection('attempts').get();
      row.attempts = attempts.docs.map(attempt => ({ id: attempt.id, data: encodeBackupValue(attempt.data()) }));
    }
    rows.push(row);
  }
  return rows;
}

async function createPlatformBackup(reason, actor = {}) {
  const collections = {};
  for (const name of BACKUP_COLLECTIONS) collections[name] = await exportCollection(name);
  const payload = {
    schemaVersion: 54,
    backupFormatVersion: 2,
    project: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'saad-ewida-science-platform',
    reason: text(reason, 100),
    createdAt: new Date().toISOString(),
    actor: { uid: text(actor.uid, 120), email: text(actor.email, 200), role: text(actor.role, 40) },
    collections
  };
  const buffer = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 9 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `automatic-backups/${stamp}-${text(reason || 'scheduled', 40).replace(/[^a-zA-Z0-9_-]/g, '-')}.json.gz`;
  const bucket = admin.storage().bucket();
  await bucket.file(name).save(buffer, { resumable: false, contentType: 'application/gzip', metadata: { cacheControl: 'private, max-age=0', metadata: { schemaVersion: '54', reason: text(reason, 100) } } });
  await db.collection('backup_runs').add({ name, reason: text(reason, 100), size: buffer.length, createdAt: FieldValue.serverTimestamp(), actorUid: text(actor.uid, 120) });
  return { name, size: buffer.length, createdAt: payload.createdAt };
}

async function pruneBackups(retentionDays = 14) {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'automatic-backups/' });
  const cutoff = Date.now() - Math.max(3, Math.min(90, Number(retentionDays) || 14)) * 24 * 60 * 60 * 1000;
  await Promise.all(files.filter(file => new Date(file.metadata.timeCreated || 0).getTime() < cutoff).map(file => file.delete().catch(() => null)));
}

exports.scheduledPlatformBackup = onSchedule({ schedule: '30 2 * * *', timeZone: 'Africa/Cairo', region: 'europe-west1', timeoutSeconds: 540, memory: '512MiB' }, async () => {
  const settings = await db.collection('settings').doc('platform').get().catch(() => null);
  const retentionDays = settings?.exists ? Number(settings.data().backupRetentionDays || 14) : 14;
  await createPlatformBackup('scheduled');
  await pruneBackups(retentionDays);
});

exports.createBackupNow = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 540, memory: '512MiB' }, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  const result = await createPlatformBackup('manual', staff);
  await pruneBackups(14);
  return result;
});

exports.listAutomaticBackups = onCall(CALLABLE_OPTIONS, async request => {
  await requireStaff(request, ['admin', 'teacher']);
  const [files] = await admin.storage().bucket().getFiles({ prefix: 'automatic-backups/' });
  const backups = files.map(file => ({ name: file.name, size: Number(file.metadata.size || 0), createdAt: file.metadata.timeCreated || '' }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50);
  return { backups };
});

exports.getBackupDownloadUrl = onCall(CALLABLE_OPTIONS, async request => {
  await requireStaff(request, ['admin', 'teacher']);
  const name = text(request.data && request.data.name, 500);
  if (!name.startsWith('automatic-backups/')) throw new HttpsError('invalid-argument', 'مسار النسخة غير صالح.');
  const [url] = await admin.storage().bucket().file(name).getSignedUrl({ action: 'read', expires: Date.now() + 10 * 60 * 1000, version: 'v4' });
  return { url };
});


async function deleteRootCollection(collectionName) {
  while (true) {
    const snap = await db.collection(collectionName).limit(350).get();
    if (snap.empty) return;
    const refs = [];
    for (const doc of snap.docs) {
      if (collectionName === 'student_attempts') {
        const attempts = await doc.ref.collection('attempts').get().catch(() => null);
        if (attempts) refs.push(...attempts.docs.map(item => item.ref));
      }
      refs.push(doc.ref);
    }
    await commitDeleteRefs(refs);
    if (snap.size < 350) return;
  }
}

async function restoreCollection(collectionName, rows) {
  await deleteRootCollection(collectionName);
  const operations = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !row.id || !row.data) continue;
    const ref = db.collection(collectionName).doc(cleanDocId(row.id));
    operations.push(batch => batch.set(ref, decodeBackupValue(row.data)));
    if (collectionName === 'student_attempts') {
      for (const attempt of Array.isArray(row.attempts) ? row.attempts : []) {
        if (!attempt || !attempt.id || !attempt.data) continue;
        operations.push(batch => batch.set(ref.collection('attempts').doc(cleanDocId(attempt.id)), decodeBackupValue(attempt.data)));
      }
    }
  }
  const queue = operations.slice();
  while (queue.length) {
    const batch = db.batch();
    queue.splice(0, 350).forEach(operation => operation(batch));
    await batch.commit();
  }
}

exports.restoreAutomaticBackup = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 540, memory: '1GiB' }, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  const name = text(request.data && request.data.name, 500);
  const confirmation = text(request.data && request.data.confirmation, 50);
  if (!name.startsWith('automatic-backups/') || !name.endsWith('.json.gz')) {
    throw new HttpsError('invalid-argument', 'مسار النسخة غير صالح.');
  }
  if (!['RESTORE-V53', 'RESTORE-V54'].includes(confirmation)) throw new HttpsError('failed-precondition', 'تأكيد الاستعادة غير صحيح.');

  const file = admin.storage().bucket().file(name);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError('not-found', 'النسخة الاحتياطية غير موجودة.');
  const [compressed] = await file.download();
  let payload;
  try { payload = JSON.parse(zlib.gunzipSync(compressed).toString('utf8')); }
  catch (_) { throw new HttpsError('data-loss', 'تعذر قراءة النسخة الاحتياطية.'); }
  if (!payload || ![53,54].includes(payload.schemaVersion) || payload.backupFormatVersion !== 2 || !payload.collections) {
    throw new HttpsError('failed-precondition', 'هذه النسخة ليست بصيغة الاستعادة الآمنة للإصدار 53.');
  }

  const safetyBackup = await createPlatformBackup('pre-restore', staff);
  for (const collectionName of BACKUP_COLLECTIONS) {
    await restoreCollection(collectionName, payload.collections[collectionName] || []);
  }
  await db.collection('activityLog').add({
    action: 'تمت استعادة نسخة احتياطية سحابية',
    meta: { restoredFrom: name, safetyBackup: safetyBackup.name },
    actorUid: staff.uid, actorEmail: staff.email || '', actorRole: staff.role || '', createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true, restoredFrom: name, safetyBackup: safetyBackup.name };
});

async function queryStudentDocuments(collection, studentCode) {
  const snap = await db.collection(collection).where('studentCode', '==', studentCode).get().catch(() => null);
  return snap ? snap.docs : [];
}

async function commitDeleteRefs(refs) {
  const queue = refs.slice();
  while (queue.length) {
    const batch = db.batch();
    queue.splice(0, 400).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

exports.deleteStudentSafely = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: '512MiB' }, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  if (!validLegacyOrStrongCode(studentCode)) throw new HttpsError('invalid-argument', 'كود الطالب غير صالح.');
  const studentRef = db.collection('students').doc(cleanDocId(studentCode));
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists) throw new HttpsError('not-found', 'الطالب غير موجود.');
  const student = studentSnap.data();
  const { nameKey } = studentNameIdentity(student.studentName || student.name);
  const relatedCollections = ['attendance','grades','recitations','homework_submissions','exam_attempts','payment_records','student_transfer_requests'];
  const relatedEntries = {};
  const relatedDocs = [];
  for (const collection of relatedCollections) {
    const docs = await queryStudentDocuments(collection, studentCode);
    relatedEntries[collection] = docs.map(doc => ({ id: doc.id, data: doc.data() }));
    relatedDocs.push(...docs.map(doc => doc.ref));
  }
  const attemptsParent = db.collection('student_attempts').doc(cleanDocId(studentCode));
  const attemptsChildren = await attemptsParent.collection('attempts').get().catch(() => null);
  const deletionSnapshot = {
    schemaVersion: 54,
    deletedAt: new Date().toISOString(),
    deletedBy: { uid: staff.uid, email: staff.email || '', role: staff.role || '' },
    student: { id: studentSnap.id, data: student },
    related: relatedEntries,
    studentAttempts: attemptsChildren ? attemptsChildren.docs.map(doc => ({ id: doc.id, data: doc.data() })) : []
  };
  const archiveName = `deleted-students/${cleanDocId(studentCode)}/${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`;
  await admin.storage().bucket().file(archiveName).save(zlib.gzipSync(Buffer.from(JSON.stringify(deletionSnapshot), 'utf8')), { resumable: false, contentType: 'application/gzip' });
  const refs = [studentRef, db.collection('student_portal').doc(cleanDocId(studentCode)), db.collection('payments').doc(cleanDocId(studentCode)), attemptsParent, ...relatedDocs];
  if (student.parentCode) refs.push(db.collection('parent_portal').doc(cleanDocId(student.parentCode)));
  if (nameKey) refs.push(db.collection('_student_name_claims').doc(nameKey));
  if (attemptsChildren) refs.push(...attemptsChildren.docs.map(doc => doc.ref));
  await commitDeleteRefs(refs);
  await db.collection('activityLog').add({ action: 'تم حذف طالب مع نسخة استرجاع', meta: { studentCode, archiveName }, actorUid: staff.uid, actorEmail: staff.email || '', actorRole: staff.role || '', createdAt: FieldValue.serverTimestamp() });
  await markLeaderboardDirty('student-deleted');
  return { ok: true, archiveName };
});
