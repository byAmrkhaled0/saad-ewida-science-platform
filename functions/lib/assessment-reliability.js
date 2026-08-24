'use strict';

const MAX_ANSWER_LENGTH = 4000;
const MAX_ANSWER_BYTES = 64 * 1024;

function answerObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeExamAnswers(rawAnswers, questionCount = 200) {
  const limit = Math.max(0, Math.min(200, Number(questionCount) || 0));
  const output = {};
  for (const [rawKey, rawValue] of Object.entries(answerObject(rawAnswers))) {
    if (!/^\d{1,3}$/.test(rawKey)) continue;
    const index = Number(rawKey);
    if (!Number.isInteger(index) || index < 0 || index >= limit) continue;
    const value = typeof rawValue === 'string' || typeof rawValue === 'number'
      ? String(rawValue).replace(/\0/g, '').slice(0, MAX_ANSWER_LENGTH)
      : '';
    output[String(index)] = value;
  }
  if (Buffer.byteLength(JSON.stringify(output), 'utf8') > MAX_ANSWER_BYTES) {
    throw new RangeError('EXAM_ANSWERS_TOO_LARGE');
  }
  return output;
}

function mergeExamAnswers(serverAnswers, clientAnswers, questionCount) {
  return {
    ...sanitizeExamAnswers(serverAnswers, questionCount),
    ...sanitizeExamAnswers(clientAnswers, questionCount)
  };
}

function completedAnswerCount(answers) {
  return Object.values(answerObject(answers)).filter(value => String(value ?? '').trim() !== '').length;
}

module.exports = {
  MAX_ANSWER_LENGTH,
  MAX_ANSWER_BYTES,
  sanitizeExamAnswers,
  mergeExamAnswers,
  completedAnswerCount
};
