'use strict';

function positiveScore(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : fallback;
}

function assignQuestionScores(questions, configuredMaxScore) {
  const rows = (questions || []).map(question => ({ ...question }));
  const explicit = rows.every(question => Number.isFinite(Number(question.points)) && Number(question.points) > 0);
  const desiredTotal = positiveScore(configuredMaxScore, explicit ? rows.reduce((sum, question) => sum + Number(question.points), 0) : 100);
  if (!explicit) {
    const share = desiredTotal / Math.max(1, rows.length);
    let assignedTotal = 0;
    rows.forEach((question, index) => {
      question.points = index === rows.length - 1 ? Math.round((desiredTotal - assignedTotal) * 100) / 100 : Math.round(share * 100) / 100;
      assignedTotal += question.points;
    });
  } else rows.forEach(question => { question.points = positiveScore(question.points, 1); });
  return rows;
}

function scoreSummary(questions, awardedScores, pendingManual = false) {
  const maxScore = Math.round((questions || []).reduce((sum, question) => sum + positiveScore(question.points, 1), 0) * 100) / 100;
  const awarded = Math.round((awardedScores || []).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0) * 100) / 100;
  return { score: pendingManual ? null : awarded, maxScore, percentage: pendingManual || !maxScore ? null : Math.round(awarded / maxScore * 100) };
}

module.exports = { positiveScore, assignQuestionScores, scoreSummary };
