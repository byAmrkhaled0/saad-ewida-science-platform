'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scheduledTimeMillis,
  assignmentIsReleased,
  assignmentDueDatePassed,
  assignmentSubmissionIsOpen
} = require('../functions/lib/assignment-schedule');

const now = Date.parse('2026-07-30T10:00:00.000Z');

test('active homework without a schedule is immediately available', () => {
  assert.equal(assignmentIsReleased({ active: true }, now), true);
});

test('scheduled homework stays hidden until its release time', () => {
  assert.equal(assignmentIsReleased({ active: true, publishAt: '2026-07-30T10:00:01.000Z' }, now), false);
  assert.equal(assignmentIsReleased({ active: true, publishAt: '2026-07-30T10:00:00.000Z' }, now), true);
});

test('draft homework never becomes available automatically', () => {
  assert.equal(assignmentIsReleased({ active: false, publishAt: '2026-07-01T10:00:00.000Z' }, now), false);
});

test('Firestore-like timestamps are supported', () => {
  const timestamp = { toMillis: () => now - 1 };
  assert.equal(scheduledTimeMillis(timestamp), now - 1);
  assert.equal(assignmentIsReleased({ active: true, publishAt: timestamp }, now), true);
});

test('homework deadline closes after the Cairo calendar date ends', () => {
  assert.equal(assignmentDueDatePassed({ dueDate: '2026-07-30' }, '2026-07-30'), false);
  assert.equal(assignmentDueDatePassed({ dueDate: '2026-07-30' }, '2026-07-31'), true);
  assert.equal(assignmentDueDatePassed({ dueDate: '' }, '2026-07-31'), false);
});

test('homework upload requires both release and an open deadline', () => {
  const open = { active: true, publishAt: '2026-07-30T09:00:00.000Z', dueDate: '2026-07-30' };
  assert.equal(assignmentSubmissionIsOpen(open, now, '2026-07-30'), true);
  assert.equal(assignmentSubmissionIsOpen(open, now, '2026-07-31'), false);
  assert.equal(assignmentSubmissionIsOpen({ ...open, publishAt: '2026-07-30T11:00:00.000Z' }, now, '2026-07-30'), false);
});
