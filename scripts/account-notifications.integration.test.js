'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const admin = require('../functions/node_modules/firebase-admin');
const notifications = require('../functions/lib/account-notifications');

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('This test requires a local Firestore emulator.');
}
const app = admin.initializeApp({ projectId: 'demo-saad-account-notifications' });
const db = app.firestore();
test.after(async () => { await db.terminate(); await app.delete(); });

test('audience isolation, durable per-student read state and idempotent send', async () => {
  const suffix = randomUUID();
  const teacher = 'teacher-' + suffix;
  const group = 'group-' + suffix;
  const first = { code: 'one-' + suffix, data: { scheduleId: group } };
  const second = { code: 'two-' + suffix, data: { scheduleId: group } };
  const outsider = { code: 'other-' + suffix, data: { scheduleId: 'other-' + suffix } };
  const resolve = async (type, id) => ({ id, label: type });
  const direct = { targetType: 'student', targetId: first.code, title: 'رسالة خاصة', body: 'مراجعة الدرس', requestId: randomUUID() };
  const shared = { targetType: 'group', targetId: group, title: 'رسالة للمجموعة', body: 'موعد الحصة', requestId: randomUUID() };
  const created = await Promise.all([
    notifications.publish(db, teacher, direct, resolve),
    notifications.publish(db, teacher, shared, resolve),
    notifications.publish(db, teacher, shared, resolve)
  ]);
  assert.deepEqual(created[1], created[2]);
  await assert.rejects(notifications.publish(db, teacher, { ...shared, body: 'محتوى مختلف' }, resolve), { code: 'already-exists' });
  const firstInbox = await notifications.listStudent(db, first);
  const secondInbox = await notifications.listStudent(db, second);
  assert.equal(firstInbox.length, 2);
  assert.deepEqual(secondInbox.map(row => row.title), [shared.title]);
  assert.deepEqual(await notifications.listStudent(db, outsider), []);
  const groupNotice = firstInbox.find(row => row.id === created[1].id);
  const directNotice = firstInbox.find(row => row.id === created[0].id);
  await assert.rejects(notifications.setRead(db, second, { ...directNotice, read: true }), { code: 'permission-denied' });
  await assert.rejects(notifications.setRead(db, outsider, { ...groupNotice, read: true }), { code: 'permission-denied' });
  await notifications.setRead(db, first, { ...groupNotice, read: true });
  assert.equal((await notifications.listStudent(db, first)).find(row => row.id === groupNotice.id).read, true);
  assert.equal((await notifications.listStudent(db, second))[0].read, false);
  await notifications.setRead(db, first, { ...groupNotice, read: false });
  assert.equal((await notifications.listStudent(db, first)).find(row => row.id === groupNotice.id).read, false);
  assert.equal((await notifications.listSent(db, teacher)).length, 2);
  assert.deepEqual(await notifications.listSent(db, 'other-' + suffix), []);
});
