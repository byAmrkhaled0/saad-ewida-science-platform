'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStudentName, studentNameIdentity, hasAtLeastThreeNameParts } = require('../functions/lib/student-name');

test('Arabic spacing, diacritics and Alef variants resolve to one student name', () => {
  const variants = [
    'أحمد محمد علي',
    '  احمد   محمد على  ',
    'أَحْمَد مُحَمَّد عَلِي',
    'احمد-محمد-علي'
  ];
  const identities = variants.map(studentNameIdentity);
  assert.equal(new Set(identities.map(item => item.normalizedName)).size, 1);
  assert.equal(new Set(identities.map(item => item.nameKey)).size, 1);
});

test('different full student names keep different identity keys', () => {
  assert.notEqual(
    studentNameIdentity('أحمد محمد علي').nameKey,
    studentNameIdentity('أحمد محمود علي').nameKey
  );
});

test('empty names never produce a claim key', () => {
  assert.equal(normalizeStudentName('  ـَ  '), '');
  assert.equal(studentNameIdentity('  ـَ  ').nameKey, '');
});

test('student registration requires at least three name parts', () => {
  assert.equal(hasAtLeastThreeNameParts('أحمد محمد'), false);
  assert.equal(hasAtLeastThreeNameParts('أحمد محمد علي'), true);
  assert.equal(hasAtLeastThreeNameParts('  أحمد   محمد   علي   حسن '), true);
});
