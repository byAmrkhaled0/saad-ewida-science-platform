'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { examSessionDeadline } = require('../functions/lib/exam-schedule');
const fs = require('node:fs');
const vm = require('node:vm');

test('the exam card crosses its time window even when the last server snapshot is unchanged', () => {
  const source=fs.readFileSync(require.resolve('../assets/v56-fixes.js'),'utf8');
  const start=source.indexOf('  function examTime(');
  const end=source.indexOf('  function attemptPct(',start);
  const available=vm.runInNewContext(source.slice(start,end)+'\navailability');
  const openAt='2026-11-13T10:00:00Z',closeAt='2026-11-13T11:00:00Z';
  const exam={openAt,closeAt,scheduleState:'upcoming'};
  assert.equal(available(exam,Date.parse(openAt)-1),'upcoming');
  assert.equal(available(exam,Date.parse(openAt)),'open');
  assert.equal(available({...exam,scheduleState:'open'},Date.parse(closeAt)),'closed');
  assert.equal(available({...exam,scheduleState:'closed'},Date.parse(openAt)),'closed');
});

const minute = 60 * 1000;
const startedAt = Date.parse('2026-08-02T12:00:00.000Z');

test('extends an active session after the teacher increases exam duration', () => {
  const result = examSessionDeadline({ active:true, duration:45 }, startedAt, startedAt + 10 * minute);
  assert.equal(result.durationMinutes,45);
  assert.equal(result.expiresAtMs,startedAt + 45 * minute);
  assert.equal(result.schedule.state,'open');
});

test('shortens an active session after the teacher reduces exam duration', () => {
  const result = examSessionDeadline({ active:true, duration:15 }, startedAt, startedAt + 10 * minute);
  assert.equal(result.expiresAtMs,startedAt + 15 * minute);
});

test('never lets a session continue past the revised exam close time', () => {
  const closeAt = new Date(startedAt + 22 * minute).toISOString();
  const result = examSessionDeadline({ active:true, duration:60, closeAt }, startedAt, startedAt + 5 * minute);
  assert.equal(result.expiresAtMs,startedAt + 22 * minute);
});

test('ends the session immediately when the exam is deactivated', () => {
  const now = startedAt + 8 * minute;
  const result = examSessionDeadline({ active:false, duration:60 }, startedAt, now);
  assert.equal(result.expiresAtMs,now);
  assert.equal(result.schedule.reason,'inactive');
});
