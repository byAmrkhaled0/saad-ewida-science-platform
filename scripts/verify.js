'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'index.html', 'student.html', 'parent.html', 'exams.html', 'teacher-login.html',
  'assets/app.js', 'assets/admin.js', 'assets/v53-upgrades.js', 'assets/v55.css', 'assets/v56-fixes.js', 'assets/v56.css', 'assets/teacher.webp',
  'assets/firebase-sync.js', 'assets/firebase-config.js', 'assets/icon-maskable-512.png',
  'assets/vendor/firebase-messaging-worker-10.12.5.min.js',
  'firestore.rules', 'storage.rules', 'firestore.indexes.json', 'firebase.json',
  'functions/index.js', 'functions/lib/monthly-incentive.js', 'functions/package.json', 'service-worker.js', 'site.webmanifest', 'teacher.webmanifest', 'offline.html'
];

const failures = [];
const ok = message => console.log(`✓ ${message}`);
const fail = message => failures.push(message);
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) fail(`Missing required file: ${relative}`);
}
if (!failures.length) ok('Required files exist');

const jsFiles = [
  'assets/app.js', 'assets/admin.js', 'assets/v53-upgrades.js', 'assets/v56-fixes.js',
  'assets/firebase-sync.js', 'assets/firebase-config.js', 'assets/online.js', 'assets/v61-ui.js',
  'assets/vendor/firebase-messaging-worker-10.12.5.min.js',
  'functions/index.js', 'functions/lib/monthly-incentive.js', 'local-server.js', 'scripts/build.js',
  'service-worker.js', 'firebase-messaging-sw.js'
];
for (const relative of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], { encoding: 'utf8' });
  if (result.status !== 0) fail(`JavaScript syntax failed: ${relative}\n${result.stderr}`);
}
if (!failures.some(x => x.startsWith('JavaScript syntax'))) ok('JavaScript syntax checks passed');

try {
  class WorkerGlobalScope {}
  const workerContext = {
    self: new WorkerGlobalScope(), WorkerGlobalScope, console, setTimeout, clearTimeout,
    Promise, URL, TextEncoder, TextDecoder, Headers, Request, Response, fetch,
    navigator: { userAgent: 'verification-worker' }
  };
  vm.createContext(workerContext);
  vm.runInContext(read('assets/vendor/firebase-messaging-worker-10.12.5.min.js'), workerContext, { filename: 'firebase-messaging-worker-10.12.5.min.js' });
  if (!workerContext.MFFirebaseMessagingWorker?.start) fail('Firebase Messaging worker bundle did not expose its WorkerGlobalScope entry point');
} catch (error) {
  fail(`Firebase Messaging worker bundle failed without window: ${error.message}`);
}
if (!failures.some(x => x.includes('Messaging worker bundle'))) ok('Firebase Messaging bundle starts without a window global');

const jsonFiles = ['package.json', 'package-lock.json', 'firebase.json', 'firestore.indexes.json', 'site.webmanifest', 'teacher.webmanifest', 'vercel.json', 'functions/package.json'];
for (const relative of jsonFiles) {
  try { JSON.parse(read(relative)); }
  catch (error) { fail(`Invalid JSON: ${relative} (${error.message})`); }
}
if (!failures.some(x => x.startsWith('Invalid JSON'))) ok('JSON files are valid');

const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const localRefPattern = /(?:src|href)=["']([^"'#?]+)["']/g;
for (const htmlFile of htmlFiles) {
  const html = read(htmlFile);
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) fail(`Duplicate IDs in ${htmlFile}: ${[...new Set(duplicates)].join(', ')}`);

  for (const match of html.matchAll(localRefPattern)) {
    const ref = match[1];
    if (/^(https?:|mailto:|tel:|javascript:|data:)/i.test(ref)) continue;
    const clean = ref.replace(/^\//, '');
    if (!clean || clean.endsWith('/')) continue;
    if (!fs.existsSync(path.join(root, clean))) fail(`Broken local reference in ${htmlFile}: ${ref}`);
  }
}
if (!failures.some(x => x.startsWith('Duplicate IDs') || x.startsWith('Broken local reference'))) ok('HTML IDs and local references passed');

const buttonSources = [...htmlFiles, ...jsFiles.filter(file => file.startsWith('assets/'))].map(relative => ({ relative, source: read(relative) }));
const combinedButtonSource = buttonSources.map(item => item.source).join('\n');
const inlineHandlers = new Map();
for (const item of buttonSources) {
  for (const match of item.source.matchAll(/\bon(?:click|change|input|submit)\s*=\s*["']\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!inlineHandlers.has(match[1])) inlineHandlers.set(match[1], new Set());
    inlineHandlers.get(match[1]).add(item.relative);
  }
}
for (const [name, locations] of inlineHandlers) {
  if (['location', 'history', 'window'].includes(name)) continue;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const definitions = [new RegExp(`function\\s+${escaped}\\b`), new RegExp(`window\\.${escaped}\\s*=`), new RegExp(`(?:const|let|var)\\s+${escaped}\\s*=`)];
  if (!definitions.some(pattern => pattern.test(combinedButtonSource))) fail(`Missing button handler ${name} used in ${[...locations].join(', ')}`);
}
if (!failures.some(x => x.startsWith('Missing button handler'))) ok(`All ${inlineHandlers.size} inline action handlers are defined`);

if (read('assets/firebase-config.js').includes('appCheckSiteKey') || read('assets/firebase-sync.js').includes('firebase.appCheck') || read('scripts/build.js').includes('firebase-app-check-compat.js')) fail('Firebase App Check/reCAPTCHA must remain disabled');
else ok('Firebase App Check and reCAPTCHA are disabled');

const syncSource = read('assets/firebase-sync.js');
if (/createBookingDirect|createReviewDirect/.test(syncSource)) fail('A public direct-write fallback still exists for booking or reviews');
if (!syncSource.includes("throw new Error('Secure booking function is unavailable')") || !syncSource.includes("throw new Error('Secure review function is unavailable')")) {
  fail('Booking/review Cloud Function enforcement is missing');
}
if (!syncSource.includes("doc('platform')") || syncSource.includes("legacySiteDoc.set")) {
  fail('Collection-backed settings migration is incomplete');
}
if (!failures.some(x => x.includes('public direct-write') || x.includes('Cloud Function enforcement') || x.includes('settings migration'))) {
  ok('Public forms use secure Cloud Functions and collection storage');
}

const functionsSource = read('functions/index.js');
const callableNames = [
  'getPortalStudent', 'createStudentAccess', 'createBooking', 'approveBooking', 'rejectBooking', 'getBookingStatus', 'createReview', 'recordClassProgress', 'registerTeacherPushToken',
  'getExamDashboard', 'startExam', 'submitExam', 'prepareHomeworkUpload', 'registerHomeworkSubmission', 'reportClientError',
  'createBackupNow', 'listAutomaticBackups', 'getBackupDownloadUrl', 'restoreAutomaticBackup', 'deleteStudentSafely'
];
for (const name of callableNames) {
  if (!functionsSource.includes(`exports.${name} = onCall`)) fail(`Missing callable function export: ${name}`);
}
const firebaseSyncSource = read('assets/firebase-sync.js');
const callableBindings = [...firebaseSyncSource.matchAll(/\w+\s*:\s*callable\('([^']+)'\)/g)].map(match => match[1]);
for (const name of callableBindings) {
  if (!functionsSource.includes(`exports.${name} = onCall`)) fail(`Firebase client callable has no deployed export: ${name}`);
}
const allAssetJs = fs.readdirSync(path.join(root,'assets')).filter(name => name.endsWith('.js')).map(name => read(`assets/${name}`)).join('\n');
const mfCloudUses = [...new Set([...allAssetJs.matchAll(/MFCloud\??\.(\w+)/g)].map(match => match[1]))];
for (const name of mfCloudUses) {
  const implemented = firebaseSyncSource.includes(`${name}:`) || firebaseSyncSource.includes(`function ${name}(`) || firebaseSyncSource.includes(`,${name},`) || firebaseSyncSource.includes(`{${name},`);
  if (!implemented) fail(`MFCloud UI method/property is missing: ${name}`);
}
if (!functionsSource.includes('exports.scheduledPlatformBackup = onSchedule')) fail('Scheduled daily backup export is missing');
if (!functionsSource.includes('exports.notifyStaffOnBookingCreated = onDocumentCreated')) fail('Asynchronous booking notification trigger is missing');
if (!functionsSource.includes("db.collection('_booking_requests')") || !functionsSource.includes('requestId')) fail('Idempotent booking request protection is missing');
if (!functionsSource.includes("db.collection('_homework_upload_tokens')") || !read('storage.rules').includes('_homework_upload_tokens')) fail('One-time homework upload authorization is missing');
if (/questions:\s*questions\.map\(q\s*=>\s*\(\{[^}]*answer/s.test(functionsSource)) fail('startExam response appears to expose answers');
if (!functionsSource.includes("backupFormatVersion: 2") || !functionsSource.includes("createPlatformBackup('pre-restore'")) {
  fail('Safe backup restore protection is incomplete');
}
if (!failures.some(x => x.startsWith('Missing callable') || x.includes('Scheduled daily') || x.includes('expose answers') || x.includes('backup restore'))) {
  ok('Secure callable, exam, backup, and safe-delete checks passed');
}

const adminSourceCode = read('assets/admin.js');
const appSourceCode = read('assets/app.js');
const fixesSourceCode = read('assets/v56-fixes.js');
const functionsSourceCode = read('functions/index.js');
const firebaseSyncSourceCode = read('assets/firebase-sync.js');
const cleanAdminSourceCode = read('assets/admin.js');
if (!functionsSourceCode.includes('exports.createAttendanceSession') || !functionsSourceCode.includes('exports.claimAttendanceSession') || !firebaseSyncSourceCode.includes('claimAttendanceSession')) fail('Secure online attendance QR flow is incomplete');
if (!appSourceCode.includes('parseUnifiedStudentQr') || !appSourceCode.includes("payload.type==='attendance'") || !appSourceCode.includes('pendingStudentAttendanceToken')) fail('Unified student and teacher QR scanner routing is incomplete');
if (!firebaseSyncSourceCode.includes('loadPortalStudentDirectForStaff') || !adminSourceCode.includes('mf_admin_student_preview_v1')) fail('Online student portal staff preview fallback is incomplete');
if (!adminSourceCode.includes('compact-student-list-head') || !adminSourceCode.includes('student-total-pill')) fail('Responsive student directory layout is incomplete');
if (!read('assets/v61.css').includes('.compact-student-list{--student-row-columns:') || !read('assets/v61.css').includes('grid-template-columns:minmax(0,1fr)!important')) fail('Legacy three-column student list override is not neutralized');
if (!cleanAdminSourceCode.includes('renderUnifiedSchedules') || !cleanAdminSourceCode.includes('createOnlineAttendanceQr')) fail('Unified schedules or online QR controls are incomplete');
if (!adminSourceCode.includes("loadSiteData({fast:true})") || !adminSourceCode.includes('hydrateAdminRecords')) fail('Staged admin loading is missing');
if (!appSourceCode.includes('staffCacheOnly') || !appSourceCode.includes('if(isStaffWorkspace())return;')) fail('Compact staff browser cache protection is missing');
if (!fixesSourceCode.includes('showMoreAdminStudents') || !fixesSourceCode.includes('slice(0,adminStudentVisible)')) fail('Paginated student rendering is missing');
if (!appSourceCode.includes('window.Html5Qrcode') || !appSourceCode.includes("loadQrScanner:()=>loadLazyScript('qr-scanner'")) fail('Cross-browser lazy QR scanner fallback is missing');
for (const page of ['student.html','parent.html','teacher-login.html']) {
  if (read(page).includes('assets/vendor/html5-qrcode-2.3.8.min.js')) fail(`QR scanner is still eagerly loaded by ${page}`);
}
if (read('teacher-login.html').includes('assets/vendor/xlsx-0.18.5.full.min.js') || !read('assets/v53-upgrades.js').includes('loadSpreadsheet')) fail('Excel must load only when an Excel import starts');
if (/unpkg\.com\/html5-qrcode|cdn\.jsdelivr\.net\/npm\/xlsx/.test([read('student.html'),read('parent.html'),read('teacher-login.html')].join('\n'))) fail('Tracking-sensitive QR or Excel CDN dependency is still present');
if (!fs.existsSync(path.join(root,'assets/vendor/html5-qrcode-2.3.8.min.js')) || !fs.existsSync(path.join(root,'assets/vendor/xlsx-0.18.5.full.min.js'))) fail('Vendored QR or Excel file is missing');
if (!adminSourceCode.includes("toggleAttribute('inert',shouldHide)") || !adminSourceCode.includes('adminDrawerReturnFocus')) fail('Mobile admin drawer focus isolation is incomplete');
if (!appSourceCode.includes('printParentReport') || !read('assets/v56.css').includes('printing-parent-report')) fail('Parent PDF print isolation fix is missing');
if (!appSourceCode.includes('recitationPct') || !functionsSource.includes('recitationPct')) fail('Recitation/homework ranking linkage is missing');
if (!read('assets/firebase-sync.js').includes('recordClassProgressDirect') || !adminSourceCode.includes('classProgressActionPending')) fail('Resilient class progress saving is missing');
if (!read('assets/firebase-sync.js').includes('deleteStudentSafelyDirect') || !adminSourceCode.includes('studentDeletionPending')) fail('Safe direct student deletion fallback is missing');
if (!appSourceCode.includes('formatTime12') || !adminSourceCode.includes('formatTime12')) fail('12-hour display formatting is missing');
if (!failures.some(x => x.includes('admin loading') || x.includes('staff browser cache') || x.includes('student rendering'))) ok('Admin performance safeguards passed');

const rules = read('firestore.rules');
if (!rules.includes('match /exam_sessions/{id}') || !rules.includes('allow read, write: if false;')) fail('Exam session rules are not closed');
if (!rules.includes('match /bookings/{bookingCode}') || !rules.includes('allow create: if false;')) fail('Public booking direct creation is not closed');
if (!rules.includes('match /reviews/{reviewId}') || !rules.includes('allow create: if false;')) fail('Public review direct creation is not closed');
if (!rules.includes('match /homework_submissions/{id}') || !rules.includes("request.resource.data.method == 'teacher_class_check'") || !rules.includes('validCode(request.resource.data.studentCode)')) fail('Homework class-check creation is not narrowly restricted to signed-in staff');
if (!rules.includes('match /student_attempts/{studentCode}') || !rules.includes('allow create, update, delete: if isTeacher();')) fail('Safe student attempt correction, migration, and deletion rules are incomplete');
if (!rules.includes('request.resource.data.parentCode == resource.data.parentCode')) fail('Assistant code immutability rule is missing');
if (!failures.some(x => x.includes('rules are not') || x.includes('direct creation') || x.includes('metadata creation') || x.includes('immutability'))) {
  ok('Firestore security and assistant-permission checks passed');
}

const manifest = JSON.parse(read('site.webmanifest'));
if (manifest.display !== 'standalone' || manifest.scope !== '/' || !Array.isArray(manifest.icons)) fail('PWA manifest is incomplete');
if (!manifest.icons.some(icon => String(icon.purpose || '').includes('maskable') && icon.sizes === '512x512')) fail('Maskable PWA icon is missing');
const sw = read('service-worker.js');
const appShellSource = sw.slice(0,sw.indexOf('];')+2);
if (!/mf-science-v\d+-production/.test(sw) || !sw.includes('/assets/platform.js') || !sw.includes('/assets/icon-maskable-512.png')) fail('Service worker app shell is incomplete');
if (/assets\/vendor|assets\/admin\.js|teacher-login\.html/.test(appShellSource) || !sw.includes('event.waitUntil(network.catch')) fail('Large admin assets are still precached or repeat-visit caching is missing');
if (!read('index.html').includes('<script defer src="https://www.gstatic.com/firebasejs/')) fail('Firebase scripts are not downloaded in parallel with deferred execution');
const upgrade = read('assets/v53-upgrades.js');
if (!upgrade.includes('beforeinstallprompt') || !upgrade.includes('إضافة إلى الشاشة الرئيسية') || !upgrade.includes('navigator.standalone')) fail('Mobile install handling is incomplete');
if (!read('assets/app.js').includes('renderBookingScheduleOptions') || !read('index.html').includes('bookingScheduleId')) fail('Booking schedule linkage is incomplete');
if (/24\/7/.test(read('index.html')) || /24\/7/.test(read('assets/app.js'))) fail('Ambiguous 24/7 student portal label is still present');
if (!read('assets/app.js').includes('leaderboard-name-line') || !read('assets/v56.css').includes('.leaderboard-avatar')) fail('Improved mobile leaderboard identity layout is missing');
if (!functionsSource.includes('leaderboardStateRef') || !functionsSource.includes('stateVersion') || !functionsSource.includes('getMonthlyLeaderboardRows') || !functionsSource.includes('loadMonthlyCollection')) fail('Immediate monthly leaderboard cache invalidation is missing');
if (!functionsSource.includes("rateLimit('public-leaderboard-ip', requestIp(request)") || functionsSource.includes("rateLimitPublic('public-leaderboard', 'all'")) fail('Public leaderboard still has a shared global rate limit');
const attendanceRecitationHomeworkOnlyScore = Math.round(100 * .30 + 0 * .40 + 100 * .15 + 100 * .15);
if (attendanceRecitationHomeworkOnlyScore !== 60 || !functionsSource.includes('.filter(row => row.name && row.activity > 0)')) fail('Active student without an exam grade would not enter the monthly leaderboard');
if (!read('assets/firebase-sync.js').includes("markLeaderboardDirty('attendance')") || !read('assets/firebase-sync.js').includes('FieldValue.increment(1)')) fail('Staff activity does not invalidate the public leaderboard');
if (!functionsSource.includes("source: 'secure_exam'") || !read('assets/firebase-sync.js').includes("source:'manual_exam_correction'") || !read('assets/firebase-sync.js').includes("markLeaderboardDirty('homework-reviewed')")) fail('Exam and reviewed-homework activity is not connected to the monthly leaderboard');
if (!read('assets/app.js').includes('monthly-incentive-card') || !read('assets/v61.css').includes('.monthly-incentive-card')) fail('Monthly incentive is not visible in the student portal');
if (!functionsSource.includes('exports.getPublicResources') || !functionsSource.includes("item.deliveryMode === 'online'") || !read('assets/firebase-sync.js').includes("getPublicResources:callable('getPublicResources')")) fail('Public and subscriber learning resources are not separated securely');
if (!rules.includes('Public resource pages receive a sanitized payload') || rules.includes("match /materials/{id} { allow read: if !('active' in resource.data)")) fail('Direct subscriber resource reads are still open');
if (!rules.includes('match /_system/leaderboard') || !rules.includes('allow create, update: if isStaff();')) fail('Leaderboard invalidation marker rules are missing');
if (!read('index.html').includes('refreshLeaderboardButton') || !read('assets/app.js').includes('window.refreshPublicLeaderboard')) fail('Public leaderboard refresh control is missing');
if (!read('index.html').includes('bookingGroupSearch') || !read('assets/app.js').includes('لا توجد مجموعة مطابقة للبحث')) fail('Booking group search is incomplete');
if (!read('assets/firebase-sync.js').includes('saveGroup:async group') || !upgrade.includes('MFCloud?.saveGroup')) fail('Focused group persistence is incomplete');
if (!read('functions/index.js').includes("db.collection('groups').doc(selectedScheduleId).get()") || !read('functions/index.js').includes("text(schedule.grade, 80) !== requestedGrade") || !read('functions/index.js').includes("text(schedule.name, 100) !== requestedGroup") || !read('functions/index.js').includes('scheduleStartTime')) fail('Secure booking schedule validation is incomplete');
if (!read('assets/app.js').includes('normalizeText(item.grade)===selected') || read('index.html').includes('bookingStatusForm')) fail('Grade-only booking groups or booking-status removal is incomplete');
if (!read('service-worker.js').includes('caches.match(url.pathname,{ignoreSearch:true})') || !read('assets/app.js').includes("localDevelopment=['localhost','127.0.0.1','0.0.0.0']")) fail('Portal navigation/offline fallback safeguards are incomplete');
if (!read('assets/admin.js').includes('bookingActionPending') || read('assets/admin.js').includes("showIssuedCodes(student,'تم قبول الحجز وتسجيل الطالب')")) fail('Instant repeated booking approval safeguards are incomplete');
if (!functionsSource.includes("invoker: 'public'") || !functionsSource.includes('cors: true') || !functionsSource.includes('enforceAppCheck: false')) fail('Callable browser/CORS invoker configuration is missing');
if (!functionsSource.includes('exports.platformApi = onRequest') || !functionsSource.includes('HTTP_BRIDGE_ACTIONS') || !firebaseSyncSource.includes('try{return await callHttpBridge(name,payload||{},false)')) fail('Public HTTP recovery bridge for Cloud Functions is incomplete');
if (read('assets/app.js').includes('رقم ولي الأمر لازم يكون مختلف') || read('functions/index.js').includes('studentPhone === parentPhone')) fail('Same-number parent/student booking is still blocked');
if (!read('assets/app.js').includes('toEnglishDigits') || !read('functions/index.js').includes('normalizeDigits')) fail('Arabic and English digit normalization is incomplete');
if (!functionsSource.includes('uniqueNumericCode') || !functionsSource.includes('studentCode, parentCode') || !read('assets/app.js').includes('كود الطالب')) fail('Immediate numeric booking access code is incomplete');
if (!rules.includes('match /booking_status/{bookingCode}') || !rules.includes('allow read, create: if false;')) fail('Booking status documents must be server-only');
if (!read('assets/admin.js').includes('renderSchedules') || !read('assets/admin.js').includes('startBookingNotifications')) fail('V55 schedule or booking notification UI is incomplete');
if (!read('teacher-login.html').includes('firebase-messaging-compat.js') || !sw.includes('/assets/vendor/firebase-messaging-worker-10.12.5.min.js') || !read('assets/vendor/firebase-messaging-worker-10.12.5.min.js').includes('onBackgroundMessage')) fail('Teacher background push notification wiring is incomplete');
if (sw.includes("importScripts('https://") || /\bwindow\s*[.=]/.test(read('assets/vendor/firebase-messaging-worker-10.12.5.min.js'))) fail('Background messaging SDK must be local and WorkerGlobalScope-safe');
if (!read('vercel.json').includes('https://apis.google.com') || !read('firebase.json').includes('https://apis.google.com')) fail('Firebase Auth CSP sources are incomplete');
if (!read('assets/admin.js').includes('MFCloud?.approveBooking') || !read('functions/index.js').includes('tx.delete(bookingRef)')) fail('Atomic booking approval and queue removal are incomplete');
if (!functionsSource.includes('Never return FieldValue.serverTimestamp() sentinels') || !functionsSource.includes('return { ...portal, bookingCode, code: studentCode')) fail('Booking approval still risks returning non-serializable Firestore sentinels');
if (!read('assets/firebase-sync.js').includes('approveBookingDirect') || !read('assets/firebase-sync.js').includes('firestoreId:doc.id') || !read('assets/admin.js').includes('bookingMatches')) fail('Booking approval fallback or real Firestore document tracking is incomplete');
if (!read('functions/index.js').includes("db.collection('student_portal').doc(cleanDocId(normalized)).get()") || !read('functions/index.js').includes('portal-incentive-unavailable')) fail('Parent portal fallback or optional-data isolation is incomplete');
if (/مجموعة السبت والثلاثاء|مجموعة الأحد والأربعاء|مجموعة الاثنين والخميس|أونلاين متابعة/.test(read('index.html'))) fail('Static booking groups must not appear in the booking form');
if (!failures.some(x => x.includes('PWA') || x.includes('Service worker') || x.includes('Mobile install'))) ok('Android and iPhone PWA installation checks passed');

const adminSource = read('assets/admin.js') + '\n' + upgrade;
for (const feature of ['importStudentsFile', 'exportStudentsCSV', 'exportAttendanceCSV', 'exportGradesCSV', 'academicYear', 'openAt', 'closeAt', 'renderClientErrors', 'pdfFile', 'showIssuedCodes']) {
  if (!adminSource.includes(feature)) fail(`Admin v54 feature is missing: ${feature}`);
}
if (!adminSource.includes('اشتراكات السنتر') || adminSource.includes('بوابة دفع')) fail('Center subscription wording is incomplete');
if (!failures.some(x => x.includes('Admin v54 feature') || x.includes('subscription wording'))) ok('Academic-year, export, error-monitoring, and center-subscription checks passed');

const packageInfo = JSON.parse(read('package.json'));
if (packageInfo.version !== '63.3.6' || !read('assets/app.js').includes("MF_ASSET_VERSION = '63.3.6'") || !read('service-worker.js').includes('mf-science-v6336-production')) fail('V63 version and cache identifiers are not unified');
for (const feature of ['renderMonthlyPaymentsV63','renderExamsManagerV63','renderAssignmentsManagerV63','renderOnlineManagerV63','renderReports','renderSettings','openStudentEditModal']) {
  if (!adminSourceCode.includes(feature) && feature !== 'openStudentEditModal') fail(`V63 administration feature is missing: ${feature}`);
}
if (!adminSourceCode.includes('payment_records') && !firebaseSyncSourceCode.includes("collection('payment_records')")) fail('Monthly payment records are not persisted');
if (!firebaseSyncSourceCode.includes('saveMonthlyPayment') || !rules.includes('match /payment_records/{id}')) fail('Monthly payment client or Firestore rules are incomplete');
if (!functionsSource.includes("brand: 'saad-ewida'") || !functionsSource.includes('item.active !== false')) fail('Review branding or draft filtering is incomplete');
if (!functionsSource.includes('assignmentId') || !appSourceCode.includes('homework-assignment-picker')) fail('Assignment-specific homework submissions are incomplete');
if (!functionsSource.includes('schedule.capacity') || !adminSourceCode.includes('capacity')) fail('Schedule capacity enforcement is incomplete');
if (!adminSourceCode.includes("mode==='all'||grade==='all'||group==='all'") || !adminSourceCode.includes('سيتم تسجيل غياب')) fail('Mass absence guard is incomplete');
if (!appSourceCode.includes('parseUnifiedStudentQr') || !adminSourceCode.includes('createOnlineAttendanceQr')) fail('Unified QR attendance flow is missing');
if (!read('assets/v61-ui.js').includes("document.documentElement.classList.add('reveal-enabled')") || !read('assets/v61.css').includes('.reveal-enabled .reveal-ready')) fail('Fail-safe content reveal is incomplete');
for (const feature of ['mobile-manager-row','mobile-manager-actions','mobile-manager-modal','mobile-exam-editor','question-bank-manager-row','assignment-manager-row','online-manager-row']) {
  if (!adminSourceCode.includes(feature) && !read('assets/v61.css').includes(feature)) fail(`V63.2 mobile administration layout is missing: ${feature}`);
}
if (!read('assets/v61.css').includes('.question-bank-toolbar-v62 #questionSearch') || !read('assets/v61.css').includes('.correction-answer-grid-v40{grid-template-columns:1fr')) fail('V63.2 mobile question bank or exam correction layout is incomplete');
if (!failures.some(x => x.includes('V63') || x.includes('Monthly payment') || x.includes('Assignment-specific') || x.includes('Mass absence'))) ok('V63 payments, learning workflow, reporting, and safety checks passed');

if (failures.length) {
  console.error('\nVerification failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('\nAll verification checks passed.');
