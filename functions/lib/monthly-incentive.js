'use strict';

function cairoDateKey(value = new Date()) {
  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value && typeof value.toDate === 'function') date = value.toDate();
  else date = value instanceof Date ? value : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function recordDate(row = {}) {
  return cairoDateKey(row.date || row.submittedAt || row.createdAt || row.updatedAt || '');
}

function isComplete(row = {}) {
  return row.completed === true || row.approved === true || String(row.status || '').startsWith('تم');
}

function monthlyRows(rows, monthKey) {
  return (Array.isArray(rows) ? rows : []).filter(row => recordDate(row).slice(0, 7) === monthKey);
}

function calculateMonthlyMetrics({ studentCode = '', monthKey, attendance = [], grades = [], homeworks = [], recitations = [] }) {
  const att = monthlyRows(attendance, monthKey);
  const gradeRows = monthlyRows(grades, monthKey).filter(row => Number.isFinite(Number(row.score)));
  const homeworkRows = monthlyRows(homeworks, monthKey).filter(isComplete);
  const recitationRows = monthlyRows(recitations, monthKey).filter(isComplete);
  const present = att.filter(row => ['present', 'حاضر', 'متأخر'].includes(row.status)).length;
  const attendancePct = att.length ? Math.round((present / att.length) * 100) : 0;
  const gradePct = gradeRows.length
    ? Math.round(gradeRows.reduce((sum, row) => sum + Number(row.score), 0) / gradeRows.length)
    : 0;
  const classDates = new Set(att.map(recordDate).filter(Boolean));
  homeworkRows.forEach(row => { const date = recordDate(row); if (date) classDates.add(date); });
  recitationRows.forEach(row => { const date = recordDate(row); if (date) classDates.add(date); });
  const completedDates = rows => new Set(rows.map(recordDate).filter(Boolean)).size;
  const sessions = classDates.size;
  const homeworkPct = sessions ? Math.min(100, Math.round((completedDates(homeworkRows) / sessions) * 100)) : 0;
  const recitationPct = sessions ? Math.min(100, Math.round((completedDates(recitationRows) / sessions) * 100)) : 0;
  const score = Math.round(attendancePct * 0.30 + gradePct * 0.40 + homeworkPct * 0.15 + recitationPct * 0.15);
  return {
    studentCode,
    monthKey,
    score,
    attendancePct,
    gradePct,
    homeworkPct,
    recitationPct,
    activity: att.length + gradeRows.length + homeworkRows.length + recitationRows.length
  };
}

module.exports = { cairoDateKey, recordDate, calculateMonthlyMetrics };
