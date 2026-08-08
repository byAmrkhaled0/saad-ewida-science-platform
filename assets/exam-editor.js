(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MFExamEditor=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const ARABIC_LABELS=['أ','ب','ج','د'];
  const TOKEN_INDEX=new Map([
    ['أ',0],['ا',0],['إ',0],['A',0],['1',0],
    ['ب',1],['B',1],['2',1],
    ['ج',2],['C',2],['3',2],
    ['د',3],['D',3],['4',3]
  ]);

  function normalized(value){
    return String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').toLocaleLowerCase('ar');
  }

  function compactLine(value){
    return String(value??'').replace(/\r?\n+/g,' ').replace(/\s+/g,' ').trim();
  }

  function answerIndex(question,optionsOverride){
    const source=question||{},options=Array.isArray(optionsOverride)?optionsOverride:(Array.isArray(source.options)?source.options:[]);
    const hasExplicit=source.correctIndex!==''&&source.correctIndex!==null&&source.correctIndex!==undefined;
    const explicit=hasExplicit?Number(source.correctIndex):NaN;
    if(Number.isInteger(explicit)&&explicit>=0&&explicit<options.length)return explicit;
    const answer=compactLine(source.answer),labels=Array.isArray(source.optionLabels)?source.optionLabels:ARABIC_LABELS;
    if(!answer)return null;
    const token=(answer.match(/^\s*([A-Da-dأإابجد1-4])(?:\s*[\)\.\-:：])?/)||[])[1];
    if(token){
      const mapped=TOKEN_INDEX.get(token.toUpperCase())??TOKEN_INDEX.get(token);
      if(Number.isInteger(mapped)&&mapped<options.length)return mapped;
    }
    const labelIndex=labels.findIndex(label=>normalized(label)===normalized(answer));
    if(labelIndex>=0&&labelIndex<options.length)return labelIndex;
    const optionIndex=options.findIndex(option=>normalized(option)===normalized(answer));
    return optionIndex>=0?optionIndex:null;
  }

  function normalizeQuestion(raw={}){
    const suppliedOptions=Array.isArray(raw.options)?raw.options.map(compactLine):[];
    const trueFalse=raw.type==='truefalse'||(suppliedOptions.length===2&&normalized(suppliedOptions[0])==='صح'&&normalized(suppliedOptions[1])==='غلط');
    const type=raw.type==='essay'?'essay':trueFalse?'truefalse':'mcq';
    const options=type==='essay'?[]:type==='truefalse'?['صح','غلط']:suppliedOptions.slice(0,4);
    while(type==='mcq'&&options.length<4)options.push('');
    return {
      type,
      question:String(raw.question??raw.content??'').trim(),
      options,
      correctIndex:type==='essay'?null:answerIndex(raw,options),
      points:Number(raw.points)>0?Number(raw.points):1
    };
  }

  function serializeQuestions(rows){
    const questions=(rows||[]).map(normalizeQuestion);
    for(let index=0;index<questions.length;index+=1){
      const row=questions[index];
      if(!compactLine(row.question))return {ok:false,index,error:'question',questions:[] ,text:''};
      if(!Number.isFinite(row.points)||row.points<=0)return {ok:false,index,error:'points',questions:[],text:''};
      if(row.type!=='essay'){
        const expected=row.type==='truefalse'?2:4;
        if(row.options.length!==expected||row.options.some(option=>!compactLine(option)))return {ok:false,index,error:'options',questions:[],text:''};
        if(!Number.isInteger(row.correctIndex)||row.correctIndex<0||row.correctIndex>=expected)return {ok:false,index,error:'answer',questions:[],text:''};
      }
    }
    const text=questions.map(row=>{
      const question=compactLine(row.question),mark=`\nالدرجة: ${row.points}`;
      if(row.type==='essay')return `${question}${mark}`;
      const options=row.options.map((option,index)=>`${ARABIC_LABELS[index]}) ${compactLine(option)}`).join('\n');
      return `${question}\n${options}\nالإجابة: ${ARABIC_LABELS[row.correctIndex]}${mark}`;
    }).join('\n\n');
    return {ok:true,index:-1,error:'',questions,text};
  }

  function localDateTimeToIso(value){
    const input=String(value||'').trim();
    if(!input)return {ok:true,value:''};
    const date=new Date(input);
    return Number.isNaN(date.getTime())?{ok:false,value:''}:{ok:true,value:date.toISOString()};
  }

  return {ARABIC_LABELS,answerIndex,compactLine,normalizeQuestion,serializeQuestions,localDateTimeToIso};
});
