'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sanitizeExamAnswers, mergeExamAnswers, completedAnswerCount } = require('../functions/lib/assessment-reliability');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('exam draft validation keeps only bounded question answers', () => {
  assert.deepEqual(sanitizeExamAnswers({ 0:'أ', 1:'إجابة', 9:'خارج', bad:'x' }, 2), { 0:'أ', 1:'إجابة' });
  assert.equal(sanitizeExamAnswers({ 0:`a\0b` }, 1)['0'], 'ab');
});

test('latest client answers merge with the server draft without dropping unanswered rows', () => {
  const merged = mergeExamAnswers({ 0:'1', 1:'نص محفوظ' }, { 0:'2', 2:'إجابة جديدة' }, 3);
  assert.deepEqual(merged, { 0:'2', 1:'نص محفوظ', 2:'إجابة جديدة' });
  assert.equal(completedAnswerCount(merged), 3);
});

test('oversized exam drafts are rejected before a Firestore write', () => {
  assert.throws(() => sanitizeExamAnswers({ 0:'x'.repeat(4000), 1:'y'.repeat(4000), 2:'z'.repeat(4000), 3:'a'.repeat(4000), 4:'b'.repeat(4000), 5:'c'.repeat(4000), 6:'d'.repeat(4000), 7:'e'.repeat(4000), 8:'f'.repeat(4000), 9:'g'.repeat(4000), 10:'h'.repeat(4000), 11:'i'.repeat(4000), 12:'j'.repeat(4000), 13:'k'.repeat(4000), 14:'l'.repeat(4000), 15:'m'.repeat(4000), 16:'n'.repeat(4000) }, 20), /EXAM_ANSWERS_TOO_LARGE/);
});

test('frontend and backend wire server autosave, homework recovery, and safe service-worker activation', () => {
  const app = read('assets/app.js'), sync = read('assets/firebase-sync.js'), functions = read('functions/index.js'), worker = read('service-worker.js');
  assert.match(functions, /exports\.saveExamProgress/);
  assert.match(functions, /mergeExamAnswers\(session\.answerDraft, clientAnswers/);
  assert.match(sync, /saveSecureExamProgress/);
  assert.match(app, /HOMEWORK_DRAFT_DB='mf-homework-drafts-v1'/);
  assert.match(app, /protectedStudentWorkflowActive/);
  assert.match(app, /measurePlatformAction\('exam-submit'/);
  assert.doesNotMatch(worker.match(/self\.addEventListener\("install"[\s\S]*?\n\}\);/)?.[0] || '', /skipWaiting/);
  assert.match(worker, /cache\.put\(new Request\(url\.pathname\)/);
});

test('homework resubmission preserves history and student directory is paginated', () => {
  const app = read('assets/app.js'), admin = read('assets/admin.js'), sync = read('assets/firebase-sync.js'), functions = read('functions/index.js'), rules = read('firestore.rules');
  assert.match(functions, /exports\.reopenHomeworkSubmission/);
  assert.match(functions, /homework_submission_history/);
  assert.match(functions, /archivedReason:'student-resubmission'/);
  assert.match(sync, /reopenHomeworkSubmission:async/);
  assert.match(admin, /reopenHomeworkV700/);
  assert.match(app, /مطلوب إعادة التسليم/);
  assert.match(rules, /match \/homework_submission_history/);
  assert.match(sync, /loadNextStudentPage/);
  assert.match(admin, /studentDirectoryHasMore/);
});
