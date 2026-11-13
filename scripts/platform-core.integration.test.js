'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Requires local Firestore.');
process.env.GCLOUD_PROJECT = 'demo-saad-core-' + randomUUID().slice(0,8);

const endpoints = require('../functions/index.js');
const admin = require('../functions/node_modules/firebase-admin');
const db = admin.firestore();
test.after(async () => { await db.terminate(); await admin.app().delete(); });

const call = (name, data, uid) => endpoints[name].run({
  data, rawRequest:{ip:'127.0.0.1'}, ...(uid?{auth:{uid,token:{}}}:{})
});

test('payment client writes historical entries without overwriting current summaries', async () => {
  const source=fs.readFileSync(require.resolve('../assets/firebase-sync.js'),'utf8');
  const start=source.indexOf('saveMonthlyPayment:');
  const end=source.indexOf('remindMissingHomeworkAdmin:',start);
  const commit=[];
  const context={
    getCurrentStaffProfile:async()=>({allowed:true,uid:'test-teacher'}),
    normalizedStudent:student=>student,
    cleanDocId:value=>value,
    cairoPortalDateKey:()=>'2026-11-12',
    nowIso:()=>'2026-11-12T10:00:00Z',
    serverTime:()=>({timestamp:'server'}),
    db:{collection:collection=>({doc:id=>collection+'/'+id})},
    commitOperations:async operations=>{for(const operation of operations)operation({set:path=>commit.push(path)});},
    logActivity:async()=>{throw new Error('Activity log is server-only');}
  };
  assert.ok(start>=0&&end>start);
  const client=vm.runInNewContext('({'+source.slice(start,end)+'})',context);
  const student={studentCode:'12345678',parentCode:'12345678'};
  await client.saveMonthlyPayment({monthKey:'2026-10',paid:true},student);
  assert.deepEqual(commit,['payment_records/12345678_2026-10']);
  commit.length=0;
  await client.saveMonthlyPayment({monthKey:'2026-11',paid:true},student);
  assert.deepEqual(commit,['payment_records/12345678_2026-11','payments/12345678','students/12345678','student_portal/12345678','parent_portal/12345678']);
});

test('booking approval, online attendance and exam submission respect identity and retries', async () => {
  const group = {name:'مجموعة علوم تجريبية',grade:'أولى ثانوي',term:'الترم الأول',active:true,deliveryMode:'online'};
  const batch=db.batch();
  batch.set(db.collection('users').doc('teacher'),{role:'teacher',active:true});
  batch.set(db.collection('groups').doc('online-group'),group);
  batch.set(db.collection('students').doc('11223344'),{...group,name:'طالب آخر تجريبي',group:'مجموعة أخرى',studentCode:'11223344',scheduleId:'other'});
  await batch.commit();

  const request={name:'طالب علوم تجريبي',parentPhone:'01000000001',studentPhone:'01000000002',grade:group.grade,group:group.name,
    term:group.term,scheduleId:'online-group',deliveryMode:'online',paymentMethod:'center',requestId:randomUUID()};
  const booking=await call('createBooking',request);
  assert.equal((await call('createBooking',request)).studentCode,booking.studentCode);
  assert.equal((await db.collection('bookings').get()).size,1);
  assert.equal((await call('getBookingStatus',{code:booking.code})).status,'قيد التسجيل');
  await assert.rejects(call('approveBooking',{code:booking.code}),{code:'unauthenticated'});
  const approved=await call('approveBooking',{code:booking.code},'teacher');
  assert.equal(approved.studentCode,booking.studentCode);
  assert.match((await call('getBookingStatus',{code:booking.code})).status,/تم القبول/);
  assert.equal((await call('getPortalStudent',{code:approved.studentCode,mode:'parent'})).studentCode,approved.studentCode);
  assert.equal((await db.collection('payments').doc(approved.studentCode).get()).data().paid,false);
  const currentMonth=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit'}).format(new Date()).replace('/','-');
  const paymentBatch=db.batch();
  paymentBatch.update(db.collection('students').doc(approved.studentCode),{paid:true,currentPaymentMonth:'2000-01'});
  paymentBatch.set(db.collection('payment_records').doc('old-payment'),{studentCode:approved.studentCode,monthKey:'2000-01',paid:true});
  await paymentBatch.commit();
  assert.equal((await call('getPortalStudent',{code:approved.studentCode})).paid,false);
  await db.collection('payment_records').doc('current-payment').set({studentCode:approved.studentCode,monthKey:currentMonth,paid:true});
  assert.equal((await call('getPortalStudent',{code:approved.studentCode})).paid,true);

  const attendance=await call('createAttendanceSession',{scheduleId:'online-group',grade:group.grade,group:group.name,deliveryMode:'online'},'teacher');
  const token=new URL(attendance.attendanceUrl).searchParams.get('attendance');
  await assert.rejects(call('claimAttendanceSession',{token,studentCode:'11223344'}),{code:'permission-denied'});
  assert.equal((await call('claimAttendanceSession',{token,studentCode:approved.studentCode})).alreadyPresent,false);
  assert.equal((await call('claimAttendanceSession',{token,studentCode:approved.studentCode})).alreadyPresent,true);
  assert.equal((await db.collection('attendance').get()).size,1);

  const examId='science-core-exam';
  await db.collection('exams').doc(examId).set({active:true,title:'اختبار العلوم التجريبي',maxScore:30,questions:[
    {type:'mcq',question:'أول سؤال',options:['صح','غلط'],correctIndex:0,points:10},
    {type:'mcq',question:'تاني سؤال',options:['البذرة','الخلية'],answer:'الخلية',points:10},
    {type:'mcq',question:'ثالث سؤال',options:['غلط','صح'],correctIndex:1,points:10}
  ]});
  const started=await call('startExam',{examId,studentCode:approved.studentCode});
  await call('saveExamProgress',{sessionId:started.sessionId,studentCode:approved.studentCode,revision:1,answers:{1:'0',2:'1'}});
  const result=await call('submitExam',{sessionId:started.sessionId,studentCode:approved.studentCode,answers:{0:'   '}});
  assert.equal(result.score,10);
  assert.equal((await call('submitExam',{sessionId:started.sessionId,studentCode:approved.studentCode})).score,10);
  const attempts=(await db.collection('exam_attempts').get()).docs;
  assert.equal(attempts.length,1);
  assert.equal(attempts[0].data().answers[0].answerIndex,null);
  assert.equal(attempts[0].data().answers[1].correct,false);
});
