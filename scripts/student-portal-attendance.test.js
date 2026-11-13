'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'assets/admin.js'), 'utf8');
const functions = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');

test('public student entry requires the code while account and attendance links resume normally', async () => {
  const start = app.indexOf('async function setupStudent()');
  const end = app.indexOf('function applyStudentModeVisibility(', start);
  async function openStudentPage(search) {
    const input = { value: '', addEventListener() {} };
    const form = { dataset: {}, querySelector: () => input, addEventListener() {} };
    let autoSubmitted = false;
    const browser = vm.createContext({
      document: { getElementById: () => form },
      location: { search },
      URLSearchParams,
      LAST_STUDENT_CODE_KEY: 'mf_last_student_code',
      pendingStudentAttendanceToken: '',
      toEnglishDigits: value => value,
      safeStorageGet: () => '12345678',
      showStudentAttendanceBanner() {},
      setTimeout: () => { autoSubmitted = true; }
    });
    await vm.runInContext(app.slice(start, end) + '\nsetupStudent();', browser);
    return { value: input.value, autoSubmitted };
  }

  assert.deepEqual(await openStudentPage('?login=1&section=grades'), { value: '', autoSubmitted: false });
  assert.deepEqual(await openStudentPage('?login=1&code=87654321'), { value: '', autoSubmitted: false });
  assert.deepEqual(await openStudentPage(''), { value: '12345678', autoSubmitted: true });
  assert.deepEqual(await openStudentPage('?attendance=demo'), { value: '12345678', autoSubmitted: true });
  assert.deepEqual(await openStudentPage('?code=87654321'), { value: '87654321', autoSubmitted: true });
});

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
  assert.match(app, /pendingAssignments=assignedHomeworks\.filter\(item=>!submittedIds\.has/);
  assert.doesNotMatch(app, /class="saad-student-home"/);
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

test('student priorities put open exams first and exclude completed exams without retakes', () => {
  const start=app.indexOf('function cairoPortalDateKey(');
  const end=app.indexOf('function studentProfileHTML(',start);
  const browser=vm.createContext({});
  vm.runInContext(app.slice(start,end),browser);
  const exams=browser.studentExamTasks({student:{examAttempts:[{examId:'submitted',status:'submitted'},{examId:'started',status:'started'}]},exams:[
    {id:'later',scheduleState:'upcoming',openAt:'2026-11-18T12:00Z'},
    {id:'submitted',scheduleState:'open'},
    {id:'started',scheduleState:'open',closeAt:'2026-11-13T22:00Z'},
    {id:'urgent',scheduleState:'open',closeAt:'2026-11-13T18:00Z'},
    {id:'closed',scheduleState:'closed'}
  ]});
  assert.deepEqual(Array.from(exams,exam=>exam.id),['urgent','started','later']);
  assert.equal(browser.studentAssignmentDeadline({dueDate:'2026-11-13',resubmissionAllowed:true,resubmissionAllowedUntil:'2026-11-14T23:00Z'},Date.parse('2026-11-13T00:00Z')),'2026-11-15');
});
