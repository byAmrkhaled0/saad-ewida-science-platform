'use strict';

const { createHash } = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');

const limit = 20;
const digest = (...values) => createHash('sha256').update(JSON.stringify(values)).digest('hex');
const audience = (type, id) => digest(type, id);
const messageCollection = (db, key) => db.collection('account_notification_audiences').doc(key).collection('messages');
const sentCollection = (db, uid) => db.collection('account_notification_senders').doc(uid).collection('messages');

function studentAudiences(student) {
  const keys = [audience('student', student.code)];
  if (student.data.scheduleId) keys.push(audience('group', String(student.data.scheduleId)));
  return keys;
}

function notificationReceipt(db, student, audienceKey, id) {
  return db.collection('account_notification_receipts').doc(digest(student.code)).collection('messages').doc(digest(audienceKey, id));
}

function boundedText(value, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) throw new HttpsError('invalid-argument', 'راجع طول العنوان والرسالة والبيانات المطلوبة.');
  return text;
}

async function publish(db, uid, input, resolveTarget) {
  const type = input.targetType;
  if (!['student', 'group'].includes(type)) throw new HttpsError('invalid-argument', 'اختر طالب أو مجموعة.');
  const title = boundedText(input.title, 100);
  const body = boundedText(input.body, 500);
  const targetId = boundedText(input.targetId, 120);
  const requestId = boundedText(input.requestId, 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(requestId)) throw new HttpsError('invalid-argument', 'معرّف الإرسال غير صالح.');
  const id = digest(uid, requestId);
  const target = await resolveTarget(type, targetId);
  const recipient = messageCollection(db, audience(type, target.id)).doc(id);
  const sent = sentCollection(db, uid).doc(id);
  const message = { title, body, createdAt: Date.now() };
  const fingerprint = digest(type, target.id, title, body);
  return db.runTransaction(async transaction => {
    const existing = await transaction.get(sent);
    if (existing.exists) {
      if (existing.data().fingerprint !== fingerprint) throw new HttpsError('already-exists', 'محاولة الإرسال مسجلة بمحتوى مختلف.');
      return { id, createdAt: existing.data().createdAt };
    }
    transaction.create(recipient, message);
    transaction.create(sent, { ...message, targetType: type, targetLabel: target.label, fingerprint });
    return { id, createdAt: message.createdAt };
  });
}

async function listStudent(db, student) {
  const keys = studentAudiences(student);
  const snapshots = await Promise.all(keys.map(key => messageCollection(db, key).orderBy('createdAt', 'desc').limit(limit).get()));
  const rows = snapshots.flatMap((snapshot, index) => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, audienceKey: keys[index] })))
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)).slice(0, limit);
  const receipts = rows.length ? await db.getAll(...rows.map(row => notificationReceipt(db, student, row.audienceKey, row.id))) : [];
  return rows.map((row, index) => ({ ...row, read: receipts[index]?.exists === true }));
}

async function setRead(db, student, { audienceKey, id, read }) {
  if (!studentAudiences(student).includes(audienceKey) || typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id) || typeof read !== 'boolean') {
    throw new HttpsError('permission-denied', 'الإشعار غير متاح للحساب.');
  }
  const message = await messageCollection(db, audienceKey).doc(id).get();
  if (!message.exists) throw new HttpsError('not-found', 'الإشعار غير موجود.');
  const receipt = notificationReceipt(db, student, audienceKey, id);
  if (read) await receipt.set({ readAt: Date.now() });
  else await receipt.delete();
  return { read };
}

async function listSent(db, uid) {
  const snapshot = await sentCollection(db, uid).orderBy('createdAt', 'desc').limit(limit).get();
  return snapshot.docs.map(doc => {
    const { title, body, targetType, targetLabel, createdAt } = doc.data();
    return { id: doc.id, title, body, targetType, targetLabel, createdAt };
  });
}

module.exports = { publish, listStudent, setRead, listSent };
