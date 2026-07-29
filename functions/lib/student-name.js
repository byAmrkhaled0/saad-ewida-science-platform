'use strict';

const crypto = require('crypto');

function normalizeStudentName(value) {
  return String(value || '')
    .slice(0, 100)
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ar');
}

function studentNameIdentity(value) {
  const normalizedName = normalizeStudentName(value);
  return {
    normalizedName,
    nameKey: normalizedName
      ? crypto.createHash('sha256').update(normalizedName).digest('hex').slice(0, 40)
      : ''
  };
}

function hasAtLeastThreeNameParts(value) {
  return normalizeStudentName(value).split(' ').filter(Boolean).length >= 3;
}

module.exports = { normalizeStudentName, studentNameIdentity, hasAtLeastThreeNameParts };
