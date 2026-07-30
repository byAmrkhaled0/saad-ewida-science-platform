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

module.exports = { scheduledTimeMillis, assignmentIsReleased };
