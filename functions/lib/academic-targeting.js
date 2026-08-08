'use strict';

function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776));
}

function normalizeAcademicText(value) {
  return normalizeDigits(value)
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ar')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ');
}

function canonicalGrade(value) {
  const normalized = normalizeAcademicText(value).replace(/(^|\s)الصف(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const level = /ابتدائي/.test(normalized)
    ? 'primary'
    : /اعدادي/.test(normalized)
      ? 'preparatory'
      : /ثانوي/.test(normalized)
        ? 'secondary'
        : '';
  if (!level) return normalized;
  const ordinals = [
    [1, /(?:^|\s)(?:ال)?(?:اول|اولي|واحد)(?:\s|$)/],
    [2, /(?:^|\s)(?:ال)?(?:ثاني|ثانيه|تاني|تانيه|اثنين)(?:\s|$)/],
    [3, /(?:^|\s)(?:ال)?(?:ثالث|ثالثه|تالت|تالته|ثلاثه)(?:\s|$)/],
    [4, /(?:^|\s)(?:ال)?(?:رابع|رابعه|اربعه)(?:\s|$)/],
    [5, /(?:^|\s)(?:ال)?(?:خامس|خامسه|خمسه)(?:\s|$)/],
    [6, /(?:^|\s)(?:ال)?(?:سادس|سادسه|سته)(?:\s|$)/]
  ];
  const ordinal = ordinals.find(([, pattern]) => pattern.test(` ${normalized} `));
  return ordinal ? `${level}:${ordinal[0]}` : normalized;
}

function canonicalAcademicYear(value) {
  const normalized = normalizeDigits(value).trim();
  if (!normalized) return '';
  const years = normalized.match(/\d{4}/g);
  if (years && years.length >= 2) return `${years[0]}/${years[1]}`;
  return normalized.replace(/\s+/g, '').replace(/[–—-]/g, '/');
}

function canonicalTerm(value) {
  const normalized = normalizeAcademicText(value).replace(/(^|\s)(?:ال)?(?:ترم|فصل)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (/(?:^|\s)(?:1|(?:ال)?(?:اول|اولي))(?:\s|$)/.test(normalized)) return '1';
  if (/(?:^|\s)(?:2|(?:ال)?(?:ثاني|ثانيه|تاني|تانيه))(?:\s|$)/.test(normalized)) return '2';
  return normalized;
}

function sameAcademicValue(left, right, kind = 'text') {
  const normalize = kind === 'grade'
    ? canonicalGrade
    : kind === 'year'
      ? canonicalAcademicYear
      : kind === 'term'
        ? canonicalTerm
        : normalizeAcademicText;
  return Boolean(normalize(left)) && normalize(left) === normalize(right);
}

function isEveryGrade(value) {
  const normalized = normalizeAcademicText(value);
  return !normalized || normalized === 'كل الصفوف' || normalized === 'جميع الصفوف';
}

function isEveryGroup(value) {
  const normalized = normalizeAcademicText(value);
  return !normalized || normalized === 'كل المجموعات' || normalized === 'جميع المجموعات';
}

function learningTargetMatchesStudent(item = {}, student = {}) {
  const targetMode = item.deliveryMode === 'online' ? 'online' : item.deliveryMode === 'center' ? 'center' : 'all';
  const studentMode = student.deliveryMode === 'online' ? 'online' : 'center';
  if (targetMode !== 'all' && targetMode !== studentMode) return false;

  if (!isEveryGrade(item.grade) && !sameAcademicValue(item.grade, student.grade, 'grade')) return false;
  if (item.academicYear && student.academicYear && !sameAcademicValue(item.academicYear, student.academicYear, 'year')) return false;
  if (item.term && student.term && !sameAcademicValue(item.term, student.term, 'term')) return false;
  if (isEveryGroup(item.group)) return true;

  const targetScheduleId = String(item.scheduleId || '').trim();
  const studentScheduleId = String(student.scheduleId || '').trim();
  if (targetScheduleId && studentScheduleId && targetScheduleId === studentScheduleId) return true;

  // Old portal records can retain an obsolete schedule id after a transfer or
  // import. The human-readable group is the safe compatibility fallback once
  // grade, mode, year and term have already matched above.
  return sameAcademicValue(item.group, student.group, 'text');
}

module.exports = {
  normalizeDigits,
  normalizeAcademicText,
  canonicalGrade,
  canonicalAcademicYear,
  canonicalTerm,
  sameAcademicValue,
  isEveryGrade,
  isEveryGroup,
  learningTargetMatchesStudent
};
