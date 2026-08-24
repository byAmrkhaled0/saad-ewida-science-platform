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

function isHomeworkGrade(row = {}) {
  return row.type === 'homework'
    || String(row.source || '').startsWith('homework')
    || String(row.id || '').startsWith('homework_')
    || Boolean(row.assignmentId && row.sourceId);
}

function gradePercentage(row = {}) {
  const saved = Number(row.percentage);
  if (Number.isFinite(saved)) return saved;
  const score = Number(row.score), max = Number(row.maxScore || 100);
  return Number.isFinite(score) && max > 0 ? score * 100 / max : null;
}

function calculateMonthlyMetrics({ studentCode = '', monthKey, attendance = [], grades = [], homeworks = [], recitations = [] }) {
  const att = monthlyRows(attendance, monthKey);
  const allGradeRows = monthlyRows(grades, monthKey).filter(row => Number.isFinite(Number(row.score)));
  const gradeRows = allGradeRows.filter(row => !isHomeworkGrade(row));
  const homeworkRows = monthlyRows(homeworks, monthKey).filter(isComplete);
  const homeworkGradeMap = new Map();
  [...allGradeRows.filter(isHomeworkGrade), ...homeworkRows.filter(row => Number.isFinite(Number(row.score)))].forEach(row => {
    homeworkGradeMap.set(String(row.assignmentId || row.sourceId || row.id || homeworkGradeMap.size), row);
  });
  const homeworkGradeRows = [...homeworkGradeMap.values()];
  const recitationRows = monthlyRows(recitations, monthKey).filter(isComplete);
  const present = att.filter(row => ['present', 'حاضر', 'متأخر'].includes(row.status)).length;
  const attendancePct = att.length ? Math.round((present / att.length) * 100) : 0;
  const gradePct = gradeRows.length
    ? Math.round(gradeRows.reduce((sum, row) => sum + (gradePercentage(row) || 0), 0) / gradeRows.length)
    : 0;
  const classDates = new Set(att.map(recordDate).filter(Boolean));
  homeworkRows.forEach(row => { const date = recordDate(row); if (date) classDates.add(date); });
  recitationRows.forEach(row => { const date = recordDate(row); if (date) classDates.add(date); });
  const completedDates = rows => new Set(rows.map(recordDate).filter(Boolean)).size;
  const sessions = classDates.size;
  const homeworkPct = sessions ? Math.min(100, Math.round((completedDates(homeworkRows) / sessions) * 100)) : 0;
  const homeworkGradePct = homeworkGradeRows.length
    ? Math.round(homeworkGradeRows.reduce((sum, row) => sum + (gradePercentage(row) || 0), 0) / homeworkGradeRows.length)
    : 0;
  const recitationPct = sessions ? Math.min(100, Math.round((completedDates(recitationRows) / sessions) * 100)) : 0;
  // Keep submission discipline and homework quality as two independent
  // components. Until a homework is graded, its delivery percentage is used
  // provisionally so a pending teacher review never lowers the student rank.
  const homeworkGradeComponent = homeworkGradeRows.length ? homeworkGradePct : homeworkPct;
  const score = Math.round(attendancePct * 0.25 + gradePct * 0.30 + homeworkPct * 0.15 + homeworkGradeComponent * 0.15 + recitationPct * 0.15);
  return {
    studentCode,
    monthKey,
    score,
    attendancePct,
    gradePct,
    homeworkPct,
    homeworkGradePct,
    homeworkGradeCount:homeworkGradeRows.length,
    recitationPct,
    activity: att.length + allGradeRows.length + homeworkRows.length + recitationRows.length
  };
}

module.exports = { cairoDateKey, recordDate, isHomeworkGrade, calculateMonthlyMetrics };
