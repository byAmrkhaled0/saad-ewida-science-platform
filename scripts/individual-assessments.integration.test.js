'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('This test requires a local Firestore emulator.');
}
process.env.GCLOUD_PROJECT = 'demo-saad-individual-assessment';
const endpoints = require('../functions/index.js');
const admin = require('../functions/node_modules/firebase-admin');
const db = admin.firestore();
test.after(async () => { await db.terminate(); await admin.app().delete(); });

test('a classmate cannot see, begin or upload work for an individually assigned assessment', async () => {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const chosen = 'A-' + suffix;
  const classmate = 'B-' + suffix;
  const examId = 'exam-' + suffix;
  const assignmentId = 'assignment-' + suffix;
  const academic = { grade:'أولى ثانوي', group:'مجموعة العلوم', deliveryMode:'center', active:true };
  const scope = { ...academic, targetingMode:'students', targetStudentCodes:[chosen] };
  const batch = db.batch();
  for (const code of [chosen, classmate]) {
    const student = { ...academic, name:'طالب تجريبي', studentCode:code, code };
    batch.set(db.collection('students').doc(code), student);
    batch.set(db.collection('student_portal').doc(code), student);
  }
  const exam = db.collection('exams').doc(examId);
  batch.set(exam, { ...scope, title:'امتحان مخصص', questions:[{ type:'essay', question:'اشرح دور الخلية', points:10 }], maxScore:10 });
  batch.set(db.collection('assignments').doc(assignmentId), { ...scope, title:'واجب مخصص' });
  await batch.commit();

  const call = (name, code, data = {}) => endpoints[name].run({
    data: { code, studentCode:code, ...data }, rawRequest: { ip:`127.0.${parseInt(suffix.slice(0,2),16)}.${parseInt(suffix.slice(2,4),16)}` }
  });
  const allowed = await call('getExamDashboard', chosen);
  const denied = await call('getExamDashboard', classmate);
  assert.ok(allowed.exams.some(item => item.id === examId && !('targetStudentCodes' in item)));
  assert.ok(!denied.exams.some(item => item.id === examId));
  const portal = await call('getPortalStudent', chosen);
  const otherPortal = await call('getPortalStudent', classmate);
  assert.ok(portal.assignments.some(item => item.id === assignmentId && !('targetStudentCodes' in item)));
  assert.ok(!otherPortal.assignments.some(item => item.id === assignmentId));
  await assert.rejects(call('startExam', classmate, { examId }), { code:'permission-denied' });
  await assert.rejects(call('prepareHomeworkUpload', classmate, { assignmentId }), { code:'permission-denied' });
  await assert.rejects(call('prepareHomeworkUpload', chosen, { assignmentId }), { code:'invalid-argument' });
  const session = await call('startExam', chosen, { examId });
  await exam.update({ targetStudentCodes:[classmate] });
  await assert.rejects(call('syncExamSession', chosen, { sessionId:session.sessionId }), { code:'permission-denied' });
  await assert.rejects(call('submitExam', chosen, { sessionId:session.sessionId, answers:{ 0:'إجابة تجريبية' } }), { code:'permission-denied' });
});
