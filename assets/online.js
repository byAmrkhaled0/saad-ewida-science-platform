(()=>{
const params=new URLSearchParams(location.search);
const requestedTab=params.get('tab'),requestedLesson=params.get('lesson');
let student=null,activeTab=['upcoming','recording','file'].includes(requestedTab)?requestedTab:'upcoming',rows=[],contentRefreshBusy=false,lastContentRefreshAt=0;
const $=id=>document.getElementById(id),clean=v=>String(v||'').trim(),safe=v=>typeof esc==='function'?esc(v):clean(v).replace(/[<>&"]/g,'');
const dashboardMarkup=`<div id="onlineStudentWelcome"></div><div class="online-tabs" role="tablist" aria-label="نوع المحتوى"><button class="active" data-online-tab="upcoming" role="tab" aria-selected="true">المحاضرات القادمة</button><button data-online-tab="recording" role="tab" aria-selected="false">التسجيلات</button><button data-online-tab="file" role="tab" aria-selected="false">ملفات المحاضرات</button></div><p class="science-online-summary" id="scienceOnlineSummary" role="status" hidden></p><section class="online-filter-panel" aria-labelledby="onlineFilterTitle"><div class="online-filter-head"><div><span class="kicker">فلترة المحتوى</span><h2 id="onlineFilterTitle">اختار الصف والترم والوحدة</h2></div><small>تظهر الاختيارات الخاصة بالطالب بعد إدخال الكود.</small></div><div class="online-filters"><label for="onlineGradeFilter"><span>الصف الدراسي</span><select id="onlineGradeFilter" aria-label="تصفية حسب الصف" disabled><option value="">كل الصفوف</option></select></label><label for="onlineTermFilter"><span>الترم</span><select id="onlineTermFilter" aria-label="تصفية حسب الترم" disabled><option value="">كل الترمات</option></select></label><label for="onlineUnitFilter"><span>الوحدة أو الباب</span><select id="onlineUnitFilter" aria-label="تصفية حسب الوحدة" disabled><option value="">كل الوحدات</option></select></label></div></section><div id="onlineContentGrid" class="online-content-grid"><div class="online-locked-state"><span class="logo-mark"></span><h2>محتوى صفك محمي بالكود</h2><p>اكتب كود الطالب بالأعلى لعرض المحاضرات المخصصة لك.</p></div></div>`;
const safeUrl=value=>{
  const source=clean(value);
  if(!source)return '';
  try{
    const url=new URL(source,location.origin);
    return ['http:','https:'].includes(url.protocol)?url.href:'';
  }catch{return '';}
};
const studentContent=all=>(all||[]).filter(item=>item.deliveryMode==='online').filter(item=>!student||!window.learningTargetMatchesStudentClient||window.learningTargetMatchesStudentClient(item,student)).filter(item=>item.access!=='subscribers'||student?.paid===true);
const onlineKind=item=>item.contentType==='live'?'upcoming':item.contentType||'file';
// The server returns an already scoped online projection without deliveryMode.
const onlineProjection=items=>items.map(item=>({...item,deliveryMode:item.deliveryMode||'online'}));
const progressKey=id=>`saad_watch_${student?.studentCode||'guest'}_${id}`;
const progress=item=>Math.max(0,Math.min(100,Number(item.progress||localStorage.getItem(progressKey(item.id))||0)));
const countdown=value=>{const diff=new Date(value).getTime()-Date.now();if(!value||!Number.isFinite(diff))return 'الموعد يحدد قريبًا';if(diff<=0)return 'المحاضرة بدأت';const d=Math.floor(diff/86400000),h=Math.floor(diff%86400000/3600000),m=Math.floor(diff%3600000/60000);return d?`متبقي ${d} يوم و${h} ساعة`:`متبقي ${h} ساعة و${m} دقيقة`;};
const liveWindow=item=>{if(!item.startAt)return true;const start=new Date(item.startAt).getTime(),duration=Number(item.duration||120)*60000,now=Date.now();return now>=start-15*60000&&now<=start+duration;};
function prerequisiteLocked(item){if(!item.requiredLessonId)return false;const required=rows.find(row=>String(row.id)===String(item.requiredLessonId));return !required||progress(required)<80;}
function card(item){const p=progress(item),kind=onlineKind(item),subscriptionLocked=item.access==='subscribers'&&!student?.paid,sequenceLocked=prerequisiteLocked(item),locked=subscriptionLocked||sequenceLocked,url=safeUrl(item.linkUrl||item.fileUrl||''),isYoutube=/^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url),canOpen=!locked&&(kind!=='upcoming'||liveWindow(item)),watchLabel=isYoutube?'مشاهدة على YouTube':kind==='recording'?(p?'أكمل المشاهدة':'ابدأ المشاهدة'):'دخول المحاضرة';return `<article data-lesson-id="${safe(item.id)}" class="online-lecture-card ${sequenceLocked?'is-sequence-locked':''}"><div class="lecture-cover">${safeUrl(item.coverUrl)?`<img src="${safe(safeUrl(item.coverUrl))}" alt="${safe(item.title)}" loading="lazy">`:`<span class="science-lecture-placeholder" data-icon="book-open" aria-hidden="true"></span>`}<span class="badge">${safe(item.grade||'كل الصفوف')}</span></div><div class="lecture-body">${item.courseTitle?`<small class="course-path">${safe(item.courseTitle)} · ${safe(item.moduleTitle||'')}</small>`:''}<div class="lecture-meta"><span>${safe(item.term||'الترم الحالي')}</span><span>الدرس ${safe(item.lessonOrder||'-')}</span>${item.chapter?`<span>${safe(item.chapter)}</span>`:''}</div><h3>${safe(item.title||'محاضرة')}</h3><p>${safe(item.desc||'')}</p>${kind==='upcoming'?`<div class="lecture-countdown" data-countdown="${safe(item.startAt)}">${safe(countdown(item.startAt))}</div>`:''}${kind==='recording'?`<div class="watch-progress"><span style="width:${p}%"></span></div><small>${p?`تمت مشاهدة ${p}%`:'لم تبدأ المشاهدة'}</small>`:''}<div class="lecture-actions">${subscriptionLocked?'<button class="btn ghost" disabled>للمشتركين فقط</button>':sequenceLocked?'<button class="btn ghost" disabled>أكمل الدرس السابق أولًا</button>':canOpen&&url?`<a class="btn primary" href="${safe(url)}" target="_blank" rel="noopener noreferrer" data-watch="${safe(item.id)}">${watchLabel}</a>`:`<button class="btn ghost" disabled>${kind==='upcoming'?'يظهر الزر قبل الموعد بـ15 دقيقة':'الرابط يضاف قريبًا'}</button>`}${kind==='recording'&&!locked&&p<100?`<button class="small-btn ghost" type="button" data-complete-lesson="${safe(item.id)}">تمت المشاهدة</button>`:''}</div></div></article>`;}
function groupOnlineLessons(list){
  const groups=new Map();
  for(const item of list){
    const term=clean(item.term),unit=clean(item.unit||item.chapter||item.moduleTitle);
    const key=JSON.stringify([term,unit]);
    if(!groups.has(key))groups.set(key,{label:[term,unit].filter(Boolean).join(' · ')||'محتوى صفك',items:[]});
    groups.get(key).items.push(item);
  }
  return [...groups.values()].map(group=>`<section class="science-lesson-group"><h3>${safe(group.label)}</h3><div class="online-content-grid">${group.items.map(card).join('')}</div></section>`).join('');
}
function render(){if(!student)return;const term=$('onlineTermFilter')?.value||'',unit=$('onlineUnitFilter')?.value||'',grade=$('onlineGradeFilter')?.value||'';let list=studentContent(rows).filter(x=>onlineKind(x)===activeTab).filter(x=>!term||x.term===term).filter(x=>!unit||x.unit===unit).filter(x=>!grade||x.grade===grade).sort((a,b)=>Number(a.lessonOrder||0)-Number(b.lessonOrder||0));const summary=$('scienceOnlineSummary');if(summary){summary.hidden=false;summary.textContent=list.length?'المحتوى المتاح في التبويب: '+list.length:'مفيش محتوى مطابق للاختيارات الحالية';}$('onlineContentGrid').innerHTML=list.length?groupOnlineLessons(list):`<div class="online-locked-state"><span data-icon="book-open"></span><h2>لا يوجد محتوى هنا حاليًا</h2><p>سيظهر المحتوى فور نشره من لوحة المدرس.</p></div>`;document.querySelectorAll('[data-watch]').forEach(a=>a.onclick=()=>{const id=a.dataset.watch,item=rows.find(x=>String(x.id)===id),value=Math.max(10,progress(item));localStorage.setItem(progressKey(id),String(value));if(item)item.progress=value;window.MFCloud?.recordLectureProgress?.(student.studentCode||student.code,id,value).catch(()=>{});});document.querySelectorAll('[data-complete-lesson]').forEach(button=>button.onclick=()=>{const id=button.dataset.completeLesson,item=rows.find(x=>String(x.id)===id);localStorage.setItem(progressKey(id),'100');if(item)item.progress=100;window.MFCloud?.recordLectureProgress?.(student.studentCode||student.code,id,100).catch(()=>{});render();});hydrateIcons();}
function filters(){const values=k=>[...new Set(studentContent(rows).map(x=>x[k]).filter(Boolean))],grade=$('onlineGradeFilter'),term=$('onlineTermFilter'),unit=$('onlineUnitFilter');grade.innerHTML=`<option value="${safe(student.grade||'')}">${safe(student.grade||'صف الطالب')}</option>`;grade.value=student.grade||'';grade.disabled=true;term.innerHTML='<option value="">كل الترمات</option>'+values('term').map(x=>`<option>${safe(x)}</option>`).join('');unit.innerHTML='<option value="">كل الوحدات</option>'+values('unit').map(x=>`<option>${safe(x)}</option>`).join('');term.disabled=false;unit.disabled=false;[term,unit].forEach(select=>select.onchange=render);const hint=document.querySelector('.online-filter-head small');if(hint)hint.textContent=`المحتوى المعروض خاص بـ ${student.grade||'صف الطالب'} فقط.`;}
async function refreshOnlineContent(){
  if(!student||contentRefreshBusy||document.hidden||Date.now()-lastContentRefreshAt<15000||!window.MFCloud?.getOnlineContentForStudent)return;
  const account=student;
  contentRefreshBusy=true;
  lastContentRefreshAt=Date.now();
  try{
    const latest=await window.MFCloud.getOnlineContentForStudent(account.studentCode||account.code);
    if(student===account&&Array.isArray(latest)){rows=onlineProjection(latest);render();}
  }catch{
    if(navigator.onLine===false)console.warn('online-content-offline');
  }finally{contentRefreshBusy=false;}
}
function selectOnlineTab(key){
  if(!['upcoming','recording','file'].includes(key))return;
  activeTab=key;
  document.querySelectorAll('[data-online-tab]').forEach(button=>{
    const selected=button.dataset.onlineTab===key;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-selected',String(selected));
  });
  render();
}
function setupOnlineDashboard(root){
  root.innerHTML=dashboardMarkup;
  root.querySelectorAll('[data-online-tab]').forEach(button=>{
    button.type='button';
    button.onclick=()=>selectOnlineTab(button.dataset.onlineTab);
  });
  hydrateIcons();
}
function showOnlineAccount(account,tab,lessonId){
  student=account;
  lastContentRefreshAt=Date.now();
  rows=onlineProjection(Array.isArray(account.onlineContent)?account.onlineContent:[]);
  filters();
  selectOnlineTab(tab||activeTab);
  focusOnlineLesson(lessonId);
}
function focusOnlineLesson(lessonId){
  if(lessonId){
    const lesson=[...document.querySelectorAll('[data-lesson-id]')].find(node=>node.dataset.lessonId===lessonId);
    lesson?.scrollIntoView({block:'start'});
  }
}
window.MFOnlineDashboard={
  mount(root,account,tab,lessonId){
    if(!$('onlineContentGrid'))setupOnlineDashboard(root);
    showOnlineAccount(account,tab,lessonId);
  },
  select(tab,lessonId){
    if(!student)return;
    if(tab)selectOnlineTab(tab);
    focusOnlineLesson(lessonId);
  }
};
async function login(code){
  const account=window.MFCloud?.getStudentByCode?await window.MFCloud.getStudentByCode(code):findStudentByCode(code);
  if(!account)throw new Error('الكود غير صحيح');
  if((account.deliveryMode||'center')!=='online')throw new Error('هذا الكود خاص بطالب السنتر. افتح بوابة الطالب بدل قسم الأونلاين.');
  if(!Array.isArray(account.onlineContent)){
    account.onlineContent=window.MFCloud?.getOnlineContentForStudent?await window.MFCloud.getOnlineContentForStudent(code):appData.materials;
  }
  $('onlineStudentWelcome').innerHTML=`<div class="online-welcome"><div><small>أهلًا بك في فصلك الأونلاين</small><h2>${safe(account.name||account.studentName)}</h2><p>${safe(account.grade||'')} · ${account.paid?'اشتراكك فعّال':'المحتوى المجاني متاح'}</p></div><a class="btn ghost" href="student.html">افتح بوابة الطالب</a></div>`;
  showOnlineAccount(account,requestedTab,requestedLesson);
  sessionStorage.setItem('saad_student_code',code);
  safeStorageSet(LAST_STUDENT_CODE_KEY,code);
}
document.addEventListener('DOMContentLoaded',()=>{
  const root=$('onlineDashboardMount'),form=$('onlineAccessForm');
  if(!root||!form)return;
  setupOnlineDashboard(root);
  selectOnlineTab(activeTab);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('button');
    button.disabled=true;
    try{await login(clean($('onlineStudentCode').value));}
    catch(error){toast(error.message||'تعذر فتح المحتوى');}
    finally{button.disabled=false;}
  });
  const saved=params.get('code')||(params.get('from')==='student'?localStorage.getItem('mf_last_student_code'):sessionStorage.getItem('saad_student_code'));
  if(saved){
    $('onlineStudentCode').value=saved;
    login(saved).catch(()=>{});
  }
  setInterval(()=>document.querySelectorAll('[data-countdown]').forEach(node=>node.textContent=countdown(node.dataset.countdown)),60000);
  setInterval(refreshOnlineContent,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshOnlineContent();});
  window.addEventListener('online',()=>{lastContentRefreshAt=0;refreshOnlineContent();});
});
})();
