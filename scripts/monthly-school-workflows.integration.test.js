'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Requires local Firestore.');

process.env.GCLOUD_PROJECT = 'demo-saad-school-' + randomUUID().slice(0,8);
const endpoints = require('../functions/index.js');
const admin = require('../functions/node_modules/firebase-admin');
const { cairoDateKey } = require('../functions/lib/monthly-incentive');
const db = admin.firestore();
test.after(async () => { await db.terminate(); await admin.app().delete(); });

test('center grade batches, immutable parent reports and deduplicated monthly congratulations', async () => {
  const [year,month] = cairoDateKey().split('-').map(Number);
  const period = new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7);
  const day = period+'-12', groupId = 'center-science';
  const chosen = '12345678', absent = '87654321', outsider = '11223344';
  const batch=db.batch();
  batch.set(db.collection('users').doc('teacher'),{role:'teacher',active:true});
  batch.set(db.collection('groups').doc(groupId),{name:'سنتر العلوم',active:true,deliveryMode:'center'});
  for(const [code,scheduleId] of [[chosen,groupId],[absent,groupId],[outsider,'another-group']]){
    const student={studentCode:code,code,name:'طالب علوم تجريبي',grade:'أولى ثانوي',group:'سنتر العلوم',scheduleId,deliveryMode:'center',active:true};
    for(const collection of ['students','student_portal','parent_portal'])batch.set(db.collection(collection).doc(code),student);
  }
  await batch.commit();
  const staff = (name,data) => endpoints[name].run({auth:{uid:'teacher',token:{}},data});
  const parent = (code) => endpoints.getArchivedParentReport.run({data:{code,monthKey:period},rawRequest:{ip:'127.0.0.1'}});
  const details={groupId,title:'اختبار الخلية في السنتر',date:day,maxScore:20};
  const rows=[{studentCode:chosen,score:0},{studentCode:absent,absent:true}];
  await assert.rejects(staff('saveCenterExamGrades',{...details,rows:[...rows,{studentCode:outsider,score:20}]}),{code:'permission-denied'});
  assert.equal((await db.collection('grades').get()).size,0);
  const saved=await staff('saveCenterExamGrades',{...details,rows});
  assert.deepEqual(saved.rows.map(row=>[row.status,row.score]),[['graded',0],['absent',null]]);
  await staff('saveCenterExamGrades',{...details,rows});
  assert.equal((await db.collection('grades').get()).size,2);
  await assert.rejects(staff('saveCenterExamGrades',{...details,maxScore:30,rows}),{code:'failed-precondition'});
  const reportData={studentCode:chosen,monthKey:period};
  const preview=await staff('manageParentReportArchive',{...reportData,action:'preview'});
  assert.equal(preview.report.grades[0].score,0);
  assert.equal((await parent(chosen)).report,null);
  await staff('manageParentReportArchive',{...reportData,action:'save'});
  await staff('saveCenterExamGrades',{...details,rows:[{studentCode:chosen,score:18}]});
  assert.equal((await parent(chosen)).report.grades[0].score,0);
  assert.equal((await parent(outsider)).report,null);
  await staff('manageParentReportArchive',{...reportData,action:'confirmDelivery'});
  assert.ok((await staff('manageParentReportArchive',reportData)).deliveredAt);

  const ranking=await staff('manageMonthlyRankingArchive',{action:'freeze',monthKey:period});
  assert.equal(ranking.archive.studentCount,1);
  assert.equal(ranking.rows[0].rank,1);
  await staff('manageMonthlyRankingArchive',{action:'freeze',monthKey:period});
  const studentInbox=code=>endpoints.getStudentAccountNotifications.run({data:{studentCode:code},rawRequest:{ip:'127.0.0.1'}});
  assert.equal((await studentInbox(chosen)).filter(row=>row.title==='تهنئة على ترتيبك الشهري').length,1);
  assert.equal((await studentInbox(absent)).length,0);
});
