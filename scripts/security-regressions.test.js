const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('homework registration uses a permanent server transaction lock', () => {
  const source = read('functions/index.js');
  const block = source.slice(source.indexOf('exports.registerHomeworkSubmission'), source.indexOf('exports.reviewHomeworkSubmission'));
  assert.match(block, /homework_submission_locks/);
  assert.match(block, /db\.runTransaction/);
  assert.match(block, /tx\.create\(lockRef/);
  assert.match(block, /lock\.exists \|\| existing\.exists/);
});

test('homework grading and student-code migration are callable-only', () => {
  const sync = read('assets/firebase-sync.js');
  const rules = read('firestore.rules');
  assert.match(sync, /callable\('reviewHomeworkSubmission'\)/);
  assert.match(sync, /callable\('migrateStudentCodeSafely'\)/);
  assert.doesNotMatch(sync, /collection\('homework_submissions'\).*\.set\(patch/);
  assert.match(rules, /match \/homework_submissions\/\{id\}[\s\S]*allow update: if false;/);
});

test('assistant section checks and admin-only staff management remain enforced', () => {
  const source = read('functions/index.js');
  assert.match(source, /exports\.createStudentAccess[\s\S]*requireStaffSection\(staff, 'students'\)/);
  assert.match(source, /exports\.upsertStaffAccount[\s\S]*requireStaff\(request, \['admin'\]\)/);
  assert.match(source, /exports\.setStaffAccountState[\s\S]*requireStaff\(request, \['admin'\]\)/);
});

test('public leaderboard masks family names', () => {
  const source = read('functions/index.js');
  assert.match(source, /return `\$\{parts\[0\]\} \$\{parts\[1\]\.charAt\(0\)\}\.`/);
});
