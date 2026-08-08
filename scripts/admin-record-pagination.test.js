'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const adminSource=fs.readFileSync(path.resolve(__dirname,'../assets/admin.js'),'utf8');
const helperStart=adminSource.indexOf('function adminRecordKey(');
const helperEnd=adminSource.indexOf('function adminRecordStatusText(');
assert.ok(helperStart>=0&&helperEnd>helperStart,'paginated record merge helpers must exist');

function runtime(){
  const context={
    adminData:{
      students:[
        {studentCode:'10000001',attendance:[{id:'stale',date:'2025-01-01'}],grades:[],homeworks:[],recitations:[]},
        {studentCode:'10000002',attendance:[],grades:[],homeworks:[],recitations:[]}
      ],
      examAttempts:[],grades:[],paymentRecords:[]
    },
    ensureCollections(){},
    stCode(student){return student.studentCode;},
    Date,Map,String,Number,Object,Array
  };
  vm.createContext(context);
  vm.runInContext(adminSource.slice(helperStart,helperEnd),context,{filename:'admin-record-pagination-runtime.js'});
  return context;
}

test('the first record page replaces stale cached history only for its own type',()=>{
  const context=runtime();
  context.mergeAdminRecordPage('attendance',[
    {id:'a2',studentCode:'10000001',date:'2026-08-02',status:'present'},
    {id:'a1',studentCode:'10000001',date:'2026-08-01',status:'absent'}
  ],true);
  assert.deepEqual([...context.adminData.students[0].attendance].map(row=>row.id),['a1','a2']);
  assert.deepEqual([...context.adminData.students[0].homeworks],[]);
});

test('later pages merge without duplicates and preserve chronological student history',()=>{
  const context=runtime();
  context.mergeAdminRecordPage('attendance',[{id:'a2',studentCode:'10000001',date:'2026-08-02'}],true);
  context.mergeAdminRecordPage('attendance',[
    {id:'a2',studentCode:'10000001',date:'2026-08-02',status:'present'},
    {id:'a1',studentCode:'10000001',date:'2026-08-01',status:'absent'}
  ]);
  assert.equal(context.adminData.students[0].attendance.length,2);
  assert.deepEqual([...context.adminData.students[0].attendance].map(row=>row.id),['a1','a2']);
  assert.equal(context.adminData.students[0].attendance[1].status,'present');
});

test('each heavy admin section requests only the records it uses',()=>{
  assert.match(adminSource,/attendance:\['attendance','recitations','homeworks'\]/);
  assert.match(adminSource,/payments:\['paymentRecords'\]/);
  assert.match(adminSource,/exams:\['attempts'\]/);
  assert.match(adminSource,/assignments:\['homeworks'\]/);
  assert.doesNotMatch(adminSource,/studentRequests:\[/);
});

test('Firestore composite indexes cover ordered student history queries',()=>{
  const config=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../firestore.indexes.json'),'utf8'));
  const signatures=new Set(config.indexes.map(index=>`${index.collectionGroup}:${index.fields.map(field=>`${field.fieldPath}:${field.order}`).join('|')}`));
  for(const expected of [
    'attendance:studentCode:ASCENDING|date:DESCENDING',
    'grades:studentCode:ASCENDING|date:DESCENDING',
    'recitations:studentCode:ASCENDING|date:DESCENDING',
    'homework_submissions:studentCode:ASCENDING|submittedAt:DESCENDING',
    'exam_attempts:studentCode:ASCENDING|submittedAt:DESCENDING',
    'payment_records:studentCode:ASCENDING|monthKey:DESCENDING'
  ])assert.ok(signatures.has(expected),`missing index ${expected}`);
});
