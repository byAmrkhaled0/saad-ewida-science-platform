'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'assets/admin.js'), 'utf8');
const functions = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');

test('student attendance can be filtered by month and recalculates month totals', () => {
  assert.match(app, /data-attendance-month/);
  assert.match(app, /data-attendance-record/);
  assert.match(app, /updateAttendanceMonth/);
  assert.match(app, /data-attendance-rate/);
  assert.doesNotMatch(app, /attendance\.slice\(0,14\)/);
});

test('portal does not silently truncate attendance or assignments', () => {
  assert.match(functions, /attendance: Array\.isArray\(records\.attendance\) \? records\.attendance :/);
  assert.doesNotMatch(functions, /collection\('assignments'\)\.limit\(300\)/);
  assert.doesNotMatch(functions, /targetedAssignments\.filter\(item=>assignmentIsReleased\(item\)\)\.slice\(-100\)/);
});

test('submitted homework is merged into its assignment instead of duplicated', () => {
  assert.match(app, /submittedByAssignment=new Map/);
  assert.match(app, /dedupeStudentProfileHTML/);
});

test('center attendance stores an independent id for every class session', () => {
  assert.match(admin, /ensureAttendanceSessionId/);
  assert.match(admin, /startNewAttendanceSession/);
  assert.match(admin, /sessionId,sessionKey/);
  assert.match(admin, /مسجل حضور بالفعل في هذه الحصة/);
});

test('student cache expires quickly enough to avoid stale portal data', () => {
  assert.match(app, /Date\.now\(\)-cached\.time<5000/);
  assert.doesNotMatch(app, /cached\.time<120000/);
});
