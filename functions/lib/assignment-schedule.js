'use strict';

function scheduledTimeMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') {
    const millis = Number(value.toMillis());
    return Number.isFinite(millis) ? millis : 0;
  }
  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isFinite(millis) ? millis : 0;
  }
  const millis = Date.parse(String(value));
  return Number.isFinite(millis) ? millis : 0;
}

function assignmentIsReleased(assignment, now = Date.now()) {
  if (!assignment || assignment.active === false) return false;
  const publishAt = scheduledTimeMillis(assignment.publishAt);
  return publishAt === 0 || publishAt <= Number(now);
}

function assignmentDueDatePassed(assignment, todayKey) {
  const dueDate = String(assignment?.dueDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false;
  return String(todayKey || '') > dueDate;
}

function assignmentSubmissionIsOpen(assignment, now = Date.now(), todayKey = '') {
  return assignmentIsReleased(assignment, now) && !assignmentDueDatePassed(assignment, todayKey);
}

module.exports = {
  scheduledTimeMillis,
  assignmentIsReleased,
  assignmentDueDatePassed,
  assignmentSubmissionIsOpen
};
