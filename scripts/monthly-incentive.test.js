'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { cairoDateKey, calculateMonthlyMetrics } = require('../functions/lib/monthly-incentive');

test('ISO timestamps are assigned using Cairo calendar boundaries', () => {
  assert.equal(cairoDateKey('2026-06-30T22:30:00.000Z'), '2026-07-01');
  assert.equal(cairoDateKey('2026-07-01'), '2026-07-01');
});

test('monthly incentive uses only the requested month and separates homework delivery from its grade', () => {
  const result = calculateMonthlyMetrics({
    studentCode: '60248827',
    monthKey: '2026-07',
    attendance: [
      { date: '2026-07-01', status: 'present' },
      { date: '2026-07-08', status: 'absent' },
      { date: '2026-06-28', status: 'present' }
    ],
    grades: [
      { submittedAt: '2026-07-04T10:00:00.000Z', score: 80 },
      { submittedAt: '2026-06-20T10:00:00.000Z', score: 100 }
    ],
    homeworks: [{ date: '2026-07-01', approved: true }],
    recitations: [{ date: '2026-07-08', completed: true }]
  });
  assert.equal(result.attendancePct, 50);
  assert.equal(result.gradePct, 80);
  assert.equal(result.homeworkPct, 50);
  assert.equal(result.homeworkGradePct, 0);
  assert.equal(result.recitationPct, 50);
  assert.equal(result.score, 59);
  assert.equal(result.activity, 5);
});

test('center and online students use the exact same calculation', () => {
  const records = {
    monthKey: '2026-07',
    attendance: [{ date: '2026-07-02', status: 'present' }],
    grades: [{ date: '2026-07-03', score: 90 }],
    homeworks: [{ date: '2026-07-02', status: 'تمت المراجعة' }],
    recitations: [{ date: '2026-07-02', status: 'تم التسميع' }]
  };
  const center = calculateMonthlyMetrics({ studentCode: '11111111', ...records });
  const online = calculateMonthlyMetrics({ studentCode: '22222222', ...records });
  assert.deepEqual({ ...center, studentCode: '' }, { ...online, studentCode: '' });
  assert.equal(center.score, 97);
});

test('a student with attendance and class work enters without an exam grade', () => {
  const result = calculateMonthlyMetrics({
    studentCode: '33333333',
    monthKey: '2026-07',
    attendance: [{ date: '2026-07-05', status: 'present' }],
    homeworks: [{ date: '2026-07-05', completed: true }],
    recitations: [{ date: '2026-07-05', completed: true }]
  });
  assert.equal(result.activity, 3);
  assert.equal(result.score, 70);
});

test('reviewed homework grade is independent from exam average and changes the monthly score immediately', () => {
  const result = calculateMonthlyMetrics({
    studentCode: '44444444',
    monthKey: '2026-07',
    attendance: [{ date: '2026-07-05', status: 'present' }],
    grades: [
      { id:'exam-1', date:'2026-07-05', score:90, maxScore:100, source:'secure_exam' },
      { id:'homework_hw-1', date:'2026-07-05', score:60, maxScore:100, type:'homework', assignmentId:'hw-1', sourceId:'submission-1' }
    ],
    homeworks: [{ id:'submission-1', assignmentId:'hw-1', date:'2026-07-05', approved:true, score:60 }],
    recitations: [{ date:'2026-07-05', completed:true }]
  });
  assert.equal(result.gradePct,90);
  assert.equal(result.homeworkPct,100);
  assert.equal(result.homeworkGradePct,60);
  assert.equal(result.homeworkGradeCount,1);
  assert.equal(result.score,91);
});
