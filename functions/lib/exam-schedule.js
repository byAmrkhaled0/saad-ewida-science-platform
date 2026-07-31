'use strict';

function scheduleTime(value) {
  if (value === undefined || value === null || value === '') return { present:false, valid:true, ms:0 };
  let ms=NaN;
  if(typeof value?.toMillis==='function')ms=Number(value.toMillis());
  else if(typeof value?.toDate==='function')ms=value.toDate().getTime();
  else if(typeof value==='number')ms=value;
  else ms=new Date(value).getTime();
  return {present:true,valid:Number.isFinite(ms),ms:Number.isFinite(ms)?ms:0};
}
function getExamScheduleState(exam,now=Date.now()){
  const open=scheduleTime(exam?.openAt),close=scheduleTime(exam?.closeAt),current=Number(now)||Date.now();
  if(exam?.active===false)return {state:'closed',reason:'inactive',openAtMs:open.ms,closeAtMs:close.ms};
  if(!open.valid||!close.valid||(open.present&&close.present&&close.ms<=open.ms))return {state:'closed',reason:'invalid-schedule',openAtMs:open.ms,closeAtMs:close.ms};
  if(open.present&&current<open.ms)return {state:'upcoming',reason:'before-open',openAtMs:open.ms,closeAtMs:close.ms};
  if(close.present&&current>=close.ms)return {state:'closed',reason:'after-close',openAtMs:open.ms,closeAtMs:close.ms};
  return {state:'open',reason:'within-window',openAtMs:open.ms,closeAtMs:close.ms};
}
module.exports={scheduleTime,getExamScheduleState};
