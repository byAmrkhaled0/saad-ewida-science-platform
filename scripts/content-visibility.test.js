'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {
  canonicalGrade,
  canonicalAcademicYear,
  canonicalTerm,
  normalizeDigits,
  learningTargetMatchesStudent
} = require('../functions/lib/academic-targeting');
const { getExamScheduleState } = require('../functions/lib/exam-schedule');
const { localDateTimeToIso } = require('../assets/exam-editor');

const student = {
  studentCode:'12345678',
  deliveryMode:'center',
  grade:'الصف الثاني الإعدادي',
  group:'مجموعه السبت 11 صباحا',
  scheduleId:'current-schedule',
  academicYear:'2026-2027',
  term:'الفصل الدراسي الأول'
};

test('individual assessment scope matches in the browser and the backend', () => {
  const source = fs.readFileSync(require.resolve('../assets/app.js'), 'utf8');
  const start = source.indexOf('function normalizeText(');
  const end = source.indexOf('function phoneDigits(', start);
  assert.ok(start >= 0 && end > start);
  const browser = { window: {}, toEnglishDigits: normalizeDigits };
  vm.runInNewContext(source.slice(start, end), browser);
  for (const matches of [learningTargetMatchesStudent, browser.window.learningTargetMatchesStudentClient]) {
    const audience = { targetingMode:'students', targetStudentCodes:['١٢٣٤٥٦٧٨'], grade:'تانية إعدادي', scheduleId:student.scheduleId };
    assert.equal(matches(audience, student), true);
    assert.equal(matches(audience, { ...student, studentCode:'87654321' }), false);
    assert.equal(matches(audience, { ...student, grade:'تالتة إعدادي' }), false);
    assert.equal(matches({ ...audience, targetStudentCodes:[] }, student), false);
    assert.equal(matches({ ...audience, targetStudentCodes:'12345678' }, student), false);
    assert.equal(matches({ ...audience, targetStudentCodes:Array(41).fill('12345678') }, student), false);
    assert.equal(matches({ grade:'تانية إعدادي' }, student), true);
  }
});

test('academic aliases and year/term formats resolve to one target identity', () => {
  assert.equal(canonicalGrade('تانية إعدادي'), canonicalGrade(student.grade));
  assert.equal(canonicalAcademicYear('٢٠٢٦ / ٢٠٢٧'), canonicalAcademicYear(student.academicYear));
  assert.equal(canonicalTerm('الترم الأول'), canonicalTerm(student.term));
});

test('every admin learning type reaches the selected student target', () => {
  const target = {
    deliveryMode:'center',
    grade:'تانية إعدادي',
    group:'مجموعة السبت 11 صباحاً',
    scheduleId:'legacy-schedule',
    academicYear:'٢٠٢٦/٢٠٢٧',
    term:'الترم الأول',
    active:true
  };
  for (const type of ['exam','assignment','lecture','review','question-bank']) {
    assert.equal(learningTargetMatchesStudent({ ...target, type }, student), true, `${type} should be visible`);
  }
});

test('a different grade, group or delivery mode never leaks content', () => {
  assert.equal(learningTargetMatchesStudent({ grade:'تالتة إعدادي', group:'كل المجموعات' }, student), false);
  assert.equal(learningTargetMatchesStudent({ grade:'تانية إعدادي', group:'مجموعة الأحد' }, student), false);
  assert.equal(learningTargetMatchesStudent({ grade:'تانية إعدادي', group:'كل المجموعات', deliveryMode:'online' }, student), false);
});

test('all-groups targeting is not blocked by an obsolete schedule id', () => {
  assert.equal(learningTargetMatchesStudent({
    grade:'تانية إعدادي',
    group:'كل المجموعات',
    scheduleId:'old-schedule',
    academicYear:'2026/2027',
    term:'الترم الاول'
  }, student), true);
});

test('lecture cards use a fallback for a missing cover and escape link queries once', () => {
  const source = fs.readFileSync(require.resolve('../assets/online.js'), 'utf8');
  const browser = {
    location: { origin: 'https://example.test', search: '' },
    URL,
    URLSearchParams,
    window: {},
    document: { addEventListener() {} },
    localStorage: { getItem: () => null },
    esc: value => String(value).replace(/&/g, '&amp;')
  };
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'this.renderLectureCard = card;})();'), browser);
  const noMedia = browser.renderLectureCard({ id: 'demo', contentType: 'file', title: 'ملف الدرس', coverUrl: ' ', fileUrl: '' });
  assert.match(noMedia, /science-lecture-placeholder/);
  assert.doesNotMatch(noMedia, /<img|data-watch=/);
  const withMedia = browser.renderLectureCard({
    id: 'demo', contentType: 'file', title: 'ملف الدرس',
    coverUrl: '/cover.png', fileUrl: 'https://example.test/file?view=1&download=0'
  });
  assert.match(withMedia, /<img src="https:\/\/example\.test\/cover\.png"/);
  assert.match(withMedia, /href="https:\/\/example\.test\/file\?view=1&amp;download=0"/);
});

test('an 11 AM to 9 PM Cairo exam is open at noon Cairo', () => {
  const openAt = localDateTimeToIso('2026-08-08T11:00');
  const closeAt = localDateTimeToIso('2026-08-08T21:00');
  const noon = localDateTimeToIso('2026-08-08T12:00');
  assert.deepEqual(openAt, { ok:true, value:'2026-08-08T08:00:00.000Z' });
  assert.deepEqual(closeAt, { ok:true, value:'2026-08-08T18:00:00.000Z' });
  assert.equal(getExamScheduleState({ active:true, openAt:openAt.value, closeAt:closeAt.value }, Date.parse(noon.value)).state, 'open');
});
