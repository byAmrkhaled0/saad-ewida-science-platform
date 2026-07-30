'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../assets/admin.js'), 'utf8');
const academicStart = source.indexOf('function stCode(');
const academicEnd = source.indexOf('function calcStudentAdmin(');
const requestStart = source.indexOf('function studentRequestLinkedStudent(');
const requestEnd = source.indexOf('function studentRequestRows(');

assert.ok(academicStart >= 0 && academicEnd > academicStart, 'academic helpers must exist');
assert.ok(requestStart >= 0 && requestEnd > requestStart, 'request linking helpers must exist');

const context = {
  GRADES: ['رابعة ابتدائي', 'أولى إعدادي', 'تانية إعدادي', 'تالتة ثانوي'],
  adminData: {
    groups: [
      { id: 'group-1', name: 'مجموعة السبت', grade: 'أولى إعدادي', active: true },
      { id: 'group-2', name: 'مجموعة الأحد', grade: 'أولى إعدادي', active: true },
      { id: 'group-3', name: 'مجموعة الإثنين', grade: 'تانية إعدادي', active: true }
    ],
    students: [{
      studentCode: '12345678',
      studentName: 'أحمد محمد علي',
      scheduleId: 'group-1',
      studentPhone: '01011112222',
      parentPhone: '01099998888',
      attendance: [
        { status: 'absent', date: '2026-07-20', scheduleId: 'group-1' },
        { status: 'absent', date: '2026-07-23', scheduleId: 'group-1' }
      ]
    }]
  },
  normalizeText(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  },
  toEnglishDigits(value) {
    return String(value || '');
  },
  phoneDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }
};

vm.createContext(context);
vm.runInContext(`${source.slice(academicStart, academicEnd)}\n${source.slice(requestStart, requestEnd)}`, context, {
  filename: 'admin-academic-linking-runtime.js'
});

test('legacy student academic data resolves from scheduleId', () => {
  const student = context.academicStudent(context.adminData.students[0]);
  assert.equal(student.grade, 'أولى إعدادي');
  assert.equal(student.group, 'مجموعة السبت');
  assert.equal(student.scheduleId, 'group-1');
});

test('grade and group catalogs include Firebase schedules, not only visible warnings', () => {
  const grades = context.adminGradeCatalog([]);
  assert.ok(grades.includes('تالتة ثانوي'));
  const firstGradeGroups = context.adminGroupCatalog('أولى إعدادي', []);
  assert.deepEqual([...firstGradeGroups].sort(), ['مجموعة الأحد', 'مجموعة السبت'].sort());
  assert.equal(firstGradeGroups.includes('مجموعة الإثنين'), false);
});

test('legacy transfer request inherits student grade and both schedule names', () => {
  const request = context.studentRequestRecord({
    id: 'transfer-1',
    studentCode: '12345678',
    currentScheduleId: 'group-1',
    targetScheduleId: 'group-2',
    status: 'pending'
  });
  assert.equal(request.studentName, 'أحمد محمد علي');
  assert.equal(request.grade, 'أولى إعدادي');
  assert.equal(request.currentGroup, 'مجموعة السبت');
  assert.equal(request.targetGroup, 'مجموعة الأحد');
  assert.equal(request.parentPhone, '01099998888');
});
