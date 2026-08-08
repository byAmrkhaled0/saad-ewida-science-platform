'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {answerIndex,normalizeQuestion,serializeQuestions,localDateTimeToIso}=require('../assets/exam-editor');

test('legacy Arabic, English, numeric and answer-text values resolve deterministically',()=>{
  const options=['خلية','نسيج','عضو','جهاز'];
  assert.equal(answerIndex({answer:'ب',options}),1);
  assert.equal(answerIndex({answer:'C)',options}),2);
  assert.equal(answerIndex({answer:'4',options}),3);
  assert.equal(answerIndex({answer:'نسيج',options}),1);
});

test('an empty correct answer never silently selects the first option',()=>{
  const question=normalizeQuestion({type:'mcq',question:'اختر',options:['أول','ثان','ثالث','رابع'],answer:''});
  assert.equal(question.correctIndex,null);
  const result=serializeQuestions([question]);
  assert.equal(result.ok,false);
  assert.equal(result.error,'answer');
});

test('structured questions retain the chosen answer and marks through serialization',()=>{
  const result=serializeQuestions([
    {type:'mcq',question:'ما وحدة بناء الكائن الحي؟',options:['الخلية','النسيج','العضو','الجهاز'],correctIndex:0,points:3},
    {type:'truefalse',question:'النبات يصنع غذاءه',correctIndex:1,points:2},
    {type:'essay',question:'فسر أهمية البناء الضوئي',points:5}
  ]);
  assert.equal(result.ok,true);
  assert.equal(result.questions.length,3);
  assert.equal(result.questions[1].correctIndex,1);
  assert.match(result.text,/الإجابة: أ/);
  assert.match(result.text,/الإجابة: ب/);
  assert.equal(result.questions.reduce((sum,row)=>sum+row.points,0),10);
});

test('large exams serialize in one deterministic pass',()=>{
  const rows=Array.from({length:150},(_,index)=>({type:'mcq',question:`سؤال ${index+1}`,options:['أ','ب','ج','د'],correctIndex:index%4,points:1}));
  const result=serializeQuestions(rows);
  assert.equal(result.ok,true);
  assert.equal(result.questions.length,150);
  assert.equal(result.text.split(/\n\s*\n/).length,150);
});

test('local exam dates reject invalid input and preserve valid instants',()=>{
  assert.deepEqual(localDateTimeToIso('not-a-date'),{ok:false,value:''});
  const valid=localDateTimeToIso('2026-08-07T14:30');
  assert.equal(valid.ok,true);
  assert.equal(Number.isNaN(Date.parse(valid.value)),false);
});
