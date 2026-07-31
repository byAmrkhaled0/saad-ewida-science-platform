(function(){
  'use strict';

  function connectLabels(){
    document.querySelectorAll('.field').forEach((field,index)=>{
      const label=field.querySelector(':scope > label');
      const control=field.querySelector('input:not([type="hidden"]),select,textarea');
      if(!label||!control)return;
      if(!control.id)control.id=`mf-field-${index+1}`;
      if(!label.htmlFor)label.htmlFor=control.id;
    });
    document.querySelectorAll('[data-star-input] button[data-rate]').forEach(button=>{
      const rate=Number(button.dataset.rate||0);
      button.setAttribute('aria-label',`${rate} ${rate===1?'نجمة':'نجوم'}`);
      button.setAttribute('aria-pressed',String(Number(button.parentElement?.querySelector('input')?.value||5)===rate));
      button.addEventListener('click',()=>{
        button.parentElement?.querySelectorAll('button[data-rate]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
      });
    });
    document.querySelectorAll('.theme-toggle').forEach(button=>{
      if(!button.getAttribute('aria-label'))button.setAttribute('aria-label','تغيير ألوان العرض');
    });
    const toast=document.getElementById('toast');
    if(toast){toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');}
  }

  function closePublicMenu(){document.body.classList.remove('v56-public-menu-open');document.querySelector('.v56-site-menu-button')?.setAttribute('aria-expanded','false');}
  function installPublicMobileMenu(){
    const navbar=document.querySelector('.site-header .navbar'),nav=document.querySelector('.site-header .navlinks');
    if(!navbar||!nav||document.querySelector('.v56-site-menu-button'))return;
    const links=[...nav.querySelectorAll('a')].map(link=>`<a href="${link.getAttribute('href')||'#'}">${link.textContent.trim()}</a>`).join('');
    navbar.insertAdjacentHTML('beforeend','<button class="v56-site-menu-button" type="button" aria-label="فتح قائمة الموقع" aria-expanded="false"><span></span><span></span><span></span></button>');
    document.body.insertAdjacentHTML('beforeend',`<div class="v56-public-menu-backdrop" aria-hidden="true"></div><aside class="v56-public-menu" aria-label="قائمة الموقع"><div class="v56-public-menu-head"><div><small>منصة العلوم</small><b>المستر سعد عويضة</b></div><button type="button" aria-label="إغلاق القائمة">×</button></div><nav>${links}</nav><a class="btn primary" href="index.html#booking">احجز مكانك الآن</a></aside>`);
    const button=document.querySelector('.v56-site-menu-button'),backdrop=document.querySelector('.v56-public-menu-backdrop'),drawer=document.querySelector('.v56-public-menu');
    button.addEventListener('click',()=>{const open=!document.body.classList.contains('v56-public-menu-open');document.body.classList.toggle('v56-public-menu-open',open);button.setAttribute('aria-expanded',String(open));});
    backdrop.addEventListener('click',closePublicMenu);drawer.querySelector('.v56-public-menu-head button').addEventListener('click',closePublicMenu);drawer.querySelectorAll('a').forEach(link=>link.addEventListener('click',closePublicMenu));
  }

  function removeLegacyMobileBars(){
    document.querySelectorAll('.mobile-bottom,.admin-mobile-bottom,.floating-top-tools,.pro-scroll-top').forEach(bar=>bar.remove());
    document.body.classList.remove('mobile-nav-active');
  }

  function installCleanScrollTop(){
    if(document.getElementById('v56ScrollTop'))return;
    document.body.insertAdjacentHTML('beforeend','<button id="v56ScrollTop" class="v56-scroll-top" type="button" aria-label="الرجوع لأول الصفحة"><span aria-hidden="true">↑</span></button>');
    const button=document.getElementById('v56ScrollTop');
    const update=()=>button.classList.toggle('show',window.scrollY>320);
    button.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    window.addEventListener('scroll',update,{passive:true});update();
  }

  function installAdminDrawerActions(){
    const sidebar=document.getElementById('adminSidebar'),footer=sidebar?.querySelector('.admin-sidebar-footer');
    if(!sidebar||!footer||footer.querySelector('.v56-admin-drawer-actions'))return;
    footer.insertAdjacentHTML('afterbegin','<div class="v56-admin-drawer-actions"><button type="button" onclick="enableBookingNotifications()"><span data-icon="calendar"></span> تنبيهات الحجز</button><button type="button" onclick="forceFirestoreSync()"><span data-icon="refresh-cw"></span> حفظ التغييرات</button><button type="button" class="danger" onclick="adminLogout()"><span data-icon="external-link"></span> تسجيل الخروج</button></div>');
    if(typeof hydrateIcons==='function')hydrateIcons();
  }

  let adminStudentRows=[];
  let adminStudentVisible=60;
  function renderAdminStudentRows(){
    const normalized=adminStudentRows;
    const paid=normalized.filter(student=>student.paid).length;
    const manager=typeof currentStaff!=='undefined'&&['admin','teacher'].includes(currentStaff?.role);
    const visible=normalized.slice(0,adminStudentVisible);
    const cards=visible.map(student=>{
      const result=typeof calcStudentAdmin==='function'?calcStudentAdmin(student):{attendancePct:0,avg:0};
      const initial=String(student.name||'ط').trim().charAt(0)||'ط';
      return `<article class="v56-student-row">
        <div class="v56-student-identity"><span class="student-avatar">${safe(initial)}</span><div><b>${safe(student.name)}</b><small>${safe(student.studentCode)} · ${safe(student.grade||'-')} · ${safe(student.group||'-')}</small></div></div>
        <div class="v56-student-kpis"><span class="badge ${student.paid?'good':'warn'}">${student.paid?'مشترك':'غير مشترك'}</span><span><small>الحضور</small><b>${Number(result.attendancePct||0)}%</b></span><span><small>الدرجات</small><b>${Number(result.avg||0)}%</b></span><span><small>التسميع</small><b>${Number(result.recitationPct||0)}%</b></span><span><small>الواجب</small><b>${Number(result.homeworkPct||0)}%</b></span></div>
        <div class="v56-student-actions"><button class="small-btn primary" type="button" onclick="editStudent('${safe(student.studentCode)}')">تعديل</button><button class="small-btn" type="button" onclick="printStudentReport('${safe(student.studentCode)}')">الملف</button><details><summary class="small-btn" aria-label="إجراءات الطالب">إجراءات</summary><div class="v56-action-menu"><button type="button" onclick="openStudentGroupManager('${safe(student.studentCode)}')">نقل أو إضافة لمجموعة</button><button type="button" onclick="quickPresent('${safe(student.studentCode)}')">تسجيل حضور</button><button type="button" onclick="sendParentMonthlyReport('${safe(student.studentCode)}')">إرسال واتساب</button><button type="button" onclick="copyStudentCodes('${safe(student.studentCode)}')">نسخ الكود الموحّد</button>${manager?`<button type="button" onclick="regenerateStudentCode('${safe(student.studentCode)}')">تغيير الكود الموحّد</button><button class="danger" type="button" onclick="deleteStudent('${safe(student.studentCode)}')">حذف الطالب</button>`:''}</div></details></div>
      </article>`;
    }).join('');
    const more=adminStudentVisible<normalized.length?`<button class="btn ghost full-width" type="button" onclick="showMoreAdminStudents()">عرض ${Math.min(60,normalized.length-adminStudentVisible)} طالب إضافي</button>`:'';
    return `<div class="v56-student-summary"><span><b>${normalized.length}</b><small>طالب مطابق</small></span><span><b>${paid}</b><small>مشترك</small></span><span><b>${normalized.length-paid}</b><small>غير مشترك</small></span></div><div class="v56-student-list">${cards||'<div class="empty-state"><h3>لا يوجد طلاب مطابقون</h3><p>غيّر البحث أو أضف طالبًا جديدًا.</p></div>'}${more}</div>`;
  }
  window.showMoreAdminStudents=function(){adminStudentVisible+=60;const box=document.getElementById('studentsTableBox');if(box)box.innerHTML=renderAdminStudentRows();if(typeof hydrateIcons==='function')hydrateIcons();};
  function applyAdminStudentList(){
    if(typeof studentsTable!=='function'||typeof normalizeStudent!=='function')return;
    studentsTable=function(rows){
      adminStudentRows=(rows||[]).map(normalizeStudent);adminStudentVisible=60;
      return renderAdminStudentRows();
    };
  }

  window.closeStudentGroupManager=function(){document.getElementById('studentGroupManager')?.remove();};
  window.openStudentGroupManager=function(code){
    const student=(adminData.students||[]).find(item=>String(item.studentCode||item.code)===String(code));
    if(!student)return aToast('تعذر العثور على الطالب');
    closeStudentGroupManager();
    const groups=(adminData.groups||[]).filter(group=>group.active!==false&&group.grade===student.grade);
    const unique=[];groups.forEach(group=>{if(group.name&&!unique.some(item=>item.name===group.name))unique.push(group);});
    if(student.group&&!unique.some(group=>group.name===student.group))unique.unshift({name:student.group,id:student.scheduleId||'',days:student.scheduleDays||'',startTime:student.scheduleStartTime||''});
    document.body.insertAdjacentHTML('beforeend',`<div class="v56-group-modal" id="studentGroupManager" role="dialog" aria-modal="true" aria-labelledby="studentGroupManagerTitle"><div class="v56-group-dialog"><div class="v56-group-dialog-head"><div><small>إدارة مجموعة الطالب</small><h3 id="studentGroupManagerTitle">${safe(student.name||student.studentName||'الطالب')}</h3></div><button type="button" onclick="closeStudentGroupManager()" aria-label="إغلاق">×</button></div><div class="v56-current-group"><span>المجموعة الحالية</span><b>${safe(student.group||'لم يتم تحديد مجموعة')}</b><small>${safe(student.grade||'')}</small></div><div class="field"><label for="studentNewGroup">اختار من مواعيد نفس الصف</label><select id="studentNewGroup"><option value="">اختار مجموعة</option>${unique.map(group=>`<option value="${safe(group.name)}" data-id="${safe(group.id||'')}" ${group.name===student.group?'selected':''}>${safe(group.name)}${group.days?` — ${safe(group.days)}`:''}${group.startTime?` — ${safe(typeof formatTime12==='function'?formatTime12(group.startTime):group.startTime)}`:''}</option>`).join('')}</select></div><div class="v56-group-dialog-actions"><button class="btn ghost" type="button" onclick="closeStudentGroupManager()">إلغاء</button><button class="btn primary" id="saveStudentGroupButton" type="button" onclick="saveStudentGroupChange('${safe(code)}')">حفظ المجموعة</button></div></div></div>`);
  };
  window.saveStudentGroupChange=async function(code){
    const student=(adminData.students||[]).find(item=>String(item.studentCode||item.code)===String(code));
    const select=document.getElementById('studentNewGroup');
    if(!student||!select)return;
    const groupName=select.value;
    if(!groupName)return aToast('اختار مجموعة من مواعيد نفس الصف');
    const schedule=(adminData.groups||[]).find(group=>group.name===groupName&&group.active!==false);
    const before={group:student.group||'',scheduleId:student.scheduleId||'',scheduleDays:student.scheduleDays||'',scheduleStartTime:student.scheduleStartTime||'',scheduleEndTime:student.scheduleEndTime||'',updatedAt:student.updatedAt};
    const oldGroup=student.group||'بدون مجموعة';
    student.group=groupName;student.scheduleId=schedule?.id||'';student.scheduleDays=schedule?.days||'';student.scheduleStartTime=schedule?.startTime||'';student.scheduleEndTime=schedule?.endTime||'';student.updatedAt=new Date().toISOString();
    const button=document.getElementById('saveStudentGroupButton');if(button){button.disabled=true;button.classList.add('is-loading');}
    try{if(!window.MFCloud?.saveStudent)throw new Error('Student service unavailable');await window.MFCloud.saveStudent(student);saveData(adminData);aToast(`تم نقل الطالب من ${oldGroup} إلى ${groupName}`);closeStudentGroupManager();renderStudents();}
    catch(error){Object.assign(student,before);saveData(adminData);aToast(adminActionErrorMessage(error,'تعذر حفظ مجموعة الطالب.'));if(button){button.disabled=false;button.classList.remove('is-loading');}}
  };

  function enhanceStudentTools(){
    const section=document.querySelector('.admin-section');
    const form=document.getElementById('addStudentForm');
    const toolbar=document.querySelector('.admin-toolbar');
    if(!section||!form||!toolbar||section.querySelector('.v56-student-tools'))return;
    const head=section.querySelector(':scope > .section-head');
    const addPanel=form.parentElement;
    const reportPanel=section.querySelector('.monthly-report-help-v38');
    const importPanel=document.getElementById('studentImportTools');
    const legacyButton=[...(head?.querySelectorAll('button')||[])].find(button=>/ترقية الأكواد|توحيد الأكواد/.test(button.textContent));
    head?.querySelectorAll('button').forEach(button=>button.hidden=true);
    [addPanel,reportPanel,importPanel].forEach(panel=>{if(panel){panel.hidden=true;panel.classList.add('v56-tool-panel');}});
    toolbar.classList.add('v56-student-filterbar');
    toolbar.insertAdjacentHTML('afterbegin','<div class="v56-filter-title"><span data-icon="search"></span><div><b>ابحث وصفّي الطلاب</b><small>اكتب الكود أو رقم ولي الأمر، ثم حدّد الصف والدفع والعام والترم.</small></div></div>');
    head?.insertAdjacentHTML('afterend',`<div class="v56-student-tools" aria-label="أدوات إدارة الطلاب">
      <button type="button" data-student-tool="add"><span class="iconbox" data-icon="user"></span><span><b>إضافة طالب</b><small>تسجيل وإصدار الكود الموحّد</small></span></button>
      <button type="button" data-student-tool="report"><span class="iconbox" data-icon="send"></span><span><b>تقارير الشهر</b><small>رسالة واتساب جاهزة</small></span></button>
      <button type="button" data-student-tool="import"><span class="iconbox" data-icon="file-text"></span><span><b>استيراد وتصدير</b><small>CSV وExcel</small></span></button>
      <button type="button" data-student-tool="upgrade"><span class="iconbox" data-icon="refresh-cw"></span><span><b>توحيد الأكواد</b><small>تحديث أي حساب قديم</small></span></button>
    </div>`);
    const panels={add:addPanel,report:reportPanel,import:importPanel};
    section.querySelectorAll('[data-student-tool]').forEach(button=>button.addEventListener('click',()=>{
      const key=button.dataset.studentTool;
      if(key==='upgrade'){legacyButton?.click();return;}
      const target=panels[key];if(!target)return;
      const willOpen=target.hidden;
      Object.values(panels).forEach(panel=>{if(panel)panel.hidden=true;});
      section.querySelectorAll('[data-student-tool]').forEach(item=>item.classList.remove('active'));
      target.hidden=!willOpen;
      if(willOpen){button.classList.add('active');target.scrollIntoView({behavior:'smooth',block:'nearest'});}
    }));
    if(typeof hydrateIcons==='function')hydrateIcons();
  }

  function installStudentPageEnhancement(){
    if(typeof renderStudents!=='function'||renderStudents.v56Enhanced)return;
    const base=renderStudents;
    renderStudents=function(){base();enhanceStudentTools();};
    renderStudents.v56Enhanced=true;
    if(document.getElementById('addStudentForm'))enhanceStudentTools();
  }

  function closeOpenMenus(event){
    if(event.target.closest('.v56-student-actions details'))return;
    document.querySelectorAll('.v56-student-actions details[open]').forEach(item=>item.removeAttribute('open'));
  }

  document.addEventListener('DOMContentLoaded',()=>{
    connectLabels();
    removeLegacyMobileBars();
    installCleanScrollTop();
    installPublicMobileMenu();
    setTimeout(()=>{applyAdminStudentList();installStudentPageEnhancement();installAdminDrawerActions();},30);
    const adminMenuObserver=new MutationObserver(()=>{removeLegacyMobileBars();installAdminDrawerActions();if(document.querySelector('.v56-admin-drawer-actions'))adminMenuObserver.disconnect();});
    adminMenuObserver.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',closeOpenMenus);
  });
})();

/* V69.2.1 — admin exam attendance filters (exam, grade and group). */
(function(){
  'use strict';
  const studentKey=row=>String(row?.studentCode||row?.code||row?.id||'');
  const studyMode=row=>row?.deliveryMode==='online'?'online':'center';
  const pct=row=>{const saved=Number(row?.percentage),max=Number(row?.maxScore||100);return Number.isFinite(saved)?Math.max(0,Math.min(100,saved)):(max?Math.round(Number(row?.score||0)/max*100):0);};
  const correctionState=row=>(row?.needsManualReview||row?.status==='pending_manual')?'pending':'done';
  const dateText=value=>{const raw=value?.toDate?.()||value,date=raw?new Date(raw):null;return date&&!Number.isNaN(date.getTime())?date.toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'}):'—';};
  function examTargetsStudent(exam,student){
    if(!exam||!student)return false;
    const grade=!exam.grade||exam.grade==='كل الصفوف'||String(exam.grade)===String(student.grade||'');
    const mode=!exam.deliveryMode||['all','both'].includes(exam.deliveryMode)||exam.deliveryMode===studyMode(student);
    const schedule=exam.scheduleId&&student.scheduleId?String(exam.scheduleId)===String(student.scheduleId):true;
    const group=exam.scheduleId&&student.scheduleId?true:(!exam.group||exam.group==='كل المجموعات'||String(exam.group)===String(student.group||''));
    return grade&&mode&&schedule&&group;
  }
  function setGroupOptions(){
    const select=document.getElementById('saadExamGroupV6921');if(!select)return;
    const grade=document.getElementById('saadExamGradeV6921')?.value||'',mode=document.getElementById('saadExamModeV6921')?.value||'',current=select.value;
    const groups=[...new Set((adminData.students||[]).filter(student=>(!grade||String(student.grade||'')===grade)&&(!mode||studyMode(student)===mode)).map(student=>String(student.group||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    select.innerHTML=`<option value="">كل المجموعات</option>${groups.map(group=>`<option value="${safe(group)}">${safe(group)}</option>`).join('')}`;
    if(groups.includes(current))select.value=current;
  }
  function renderRows(event){
    const host=document.getElementById('saadExamResultRowsV6921');if(!host)return;
    if(['saadExamGradeV6921','saadExamModeV6921'].includes(event?.target?.id))setGroupOptions();
    const examId=document.getElementById('saadExamFilterV6921')?.value||'',grade=document.getElementById('saadExamGradeV6921')?.value||'',group=document.getElementById('saadExamGroupV6921')?.value||'',mode=document.getElementById('saadExamModeV6921')?.value||'',participation=document.getElementById('saadExamParticipationV6921')?.value||'',status=document.getElementById('saadExamCorrectionV6921')?.value||'',query=String(document.getElementById('saadExamSearchV6921')?.value||'').trim().toLowerCase();
    const exam=(adminData.exams||[]).find(item=>String(item.id)===examId),students=adminData.students||[],studentMap=new Map(students.map(student=>[studentKey(student),student]));
    let rows=(adminData.examAttempts||[]).filter(row=>!examId||String(row.examId||'')===examId||(!row.examId&&String(row.examTitle||'')===String(exam?.title||''))).map(row=>({...row,_student:studentMap.get(String(row.studentCode||'')),_attendance:'attempted'}));
    if(exam){
      const attempted=new Set(rows.map(row=>String(row.studentCode||'')));
      students.filter(student=>examTargetsStudent(exam,student)&&!attempted.has(studentKey(student))).forEach(student=>rows.push({studentCode:studentKey(student),studentName:student.studentName||student.name,grade:student.grade,group:student.group,deliveryMode:studyMode(student),examId:exam.id,examTitle:exam.title,maxScore:exam.maxScore||100,_student:student,_attendance:'missing'}));
    }
    rows=rows.filter(row=>{const student=row._student,rowGrade=String(student?.grade||row.grade||''),rowGroup=String(student?.group||row.group||''),rowMode=student?studyMode(student):studyMode(row),hay=`${row.studentName||student?.studentName||student?.name||''} ${row.studentCode||''} ${row.examTitle||''} ${rowGrade} ${rowGroup}`.toLowerCase();return(!grade||rowGrade===grade)&&(!group||rowGroup===group)&&(!mode||rowMode===mode)&&(!participation||row._attendance===participation)&&(!status||row._attendance==='attempted'&&correctionState(row)===status)&&(!query||hay.includes(query));});
    const attemptedRows=rows.filter(row=>row._attendance==='attempted'),missingRows=rows.filter(row=>row._attendance==='missing'),corrected=attemptedRows.filter(row=>correctionState(row)==='done'),average=corrected.length?corrected.reduce((sum,row)=>sum+pct(row),0)/corrected.length:0;
    document.getElementById('saadExamDidKpi').textContent=attemptedRows.length;document.getElementById('saadExamMissedKpi').textContent=exam?missingRows.length:'—';document.getElementById('saadExamReviewKpi').textContent=attemptedRows.length-corrected.length;document.getElementById('saadExamAvgKpi').textContent=corrected.length?`${average.toFixed(1)}%`:'—';document.getElementById('saadExamCountV6921').textContent=`${rows.length} طالب`;
    host.innerHTML=rows.length?rows.slice(0,500).map(row=>{const student=row._student,missing=row._attendance==='missing',ready=!missing&&row.score!==null&&row.score!==undefined,state=missing?'not-attempted':correctionState(row),phone=String(student?.parentPhone||'').replace(/\D/g,'');return `<article class="exam-result-row ${missing?'exam-result-missing':''}"><div class="exam-result-student"><span class="exam-result-avatar">${safe(String(row.studentName||student?.studentName||student?.name||'ط').trim().charAt(0))}</span><div><b>${safe(row.studentName||student?.studentName||student?.name||row.studentCode||'طالب')}</b><small>${safe(row.studentCode||'—')} · ${studyMode(student||row)==='online'?'أونلاين':'سنتر'} · ${safe(student?.grade||row.grade||'')} · ${safe(student?.group||row.group||'بدون مجموعة')}</small></div></div><div><b>${safe(row.examTitle||exam?.title||'امتحان')}</b><small>${missing?'لم يبدأ الامتحان':safe(dateText(row.submittedAt))}</small></div><div class="exam-result-score"><b>${missing?'—':ready?`${Number(row.score)} من ${Number(row.maxScore||100)}`:'قيد التصحيح'}</b><small>${ready?`${pct(row).toFixed(1)}%`:''}</small></div><span class="exam-result-status ${state}">${missing?'لسه ممتحنش':state==='pending'?'ينتظر التصحيح':'امتحن'}</span><div class="exam-result-actions">${missing?(phone?`<button class="small-btn ghost" onclick="window.open('https://wa.me/${safe(phone)}','_blank','noopener')">تذكير واتساب</button>`:'<small>لا توجد محاولة</small>'):`<button class="small-btn primary" onclick="correctAttempt('${safe(row.id)}')">عرض التصحيح</button>${phone?`<button class="small-btn ghost" onclick="sendExamGradeToParent('${safe(row.id)}')">واتساب</button>`:''}`}</div></article>`;}).join(''):`<div class="exam-results-empty"><b>لا يوجد طلاب مطابقون</b><small>${exam?'غيّر الصف أو المجموعة أو حالة الأداء.':'اختر امتحانًا لمعرفة من امتحن ومن لم يمتحن.'}</small></div>`;
  }
  window.filterSaadExamAttendanceV6921=renderRows;
  function install(){
    const old=document.getElementById('saadExamResults');if(!old||document.getElementById('saadExamResultsV6921'))return;
    const exams=(adminData.exams||[]),grades=[...new Set((adminData.students||[]).map(student=>String(student.grade||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    old.insertAdjacentHTML('afterend',`<section class="card exam-results-dashboard exam-attendance-dashboard" id="saadExamResultsV6921"><div class="exam-results-head"><div><span class="kicker">متابعة أداء الطلاب</span><h3>مين امتحن ومين لسه؟</h3><p>اختر الامتحان ثم الصف والمجموعة لعرض الطلاب المستهدفين وحالة كل طالب.</p></div><b id="saadExamCountV6921">0 طالب</b></div><div class="exam-results-kpis"><article><small>امتحنوا</small><b id="saadExamDidKpi">0</b></article><article><small>لسه ممتحنوش</small><b id="saadExamMissedKpi">—</b></article><article><small>ينتظر التصحيح</small><b id="saadExamReviewKpi">0</b></article><article><small>متوسط المستوى</small><b id="saadExamAvgKpi">—</b></article></div><div class="exam-results-filters exam-attendance-filters"><label><span>الامتحان</span><select id="saadExamFilterV6921" onchange="filterSaadExamAttendanceV6921(event)"><option value="">كل الامتحانات</option>${exams.map(exam=>`<option value="${safe(exam.id)}">${safe(exam.title||'امتحان')}</option>`).join('')}</select></label><label><span>الصف</span><select id="saadExamGradeV6921" onchange="filterSaadExamAttendanceV6921(event)"><option value="">كل الصفوف</option>${grades.map(item=>`<option value="${safe(item)}">${safe(item)}</option>`).join('')}</select></label><label><span>المجموعة</span><select id="saadExamGroupV6921" onchange="filterSaadExamAttendanceV6921(event)"><option value="">كل المجموعات</option></select></label><label><span>حالة أداء الامتحان</span><select id="saadExamParticipationV6921" onchange="filterSaadExamAttendanceV6921(event)"><option value="">الكل</option><option value="attempted">امتحن</option><option value="missing">لسه ممتحنش</option></select></label><label><span>نوع الدراسة</span><select id="saadExamModeV6921" onchange="filterSaadExamAttendanceV6921(event)"><option value="">السنتر والأونلاين</option><option value="center">سنتر</option><option value="online">أونلاين</option></select></label><label><span>حالة التصحيح</span><select id="saadExamCorrectionV6921" onchange="filterSaadExamAttendanceV6921(event)"><option value="">كل الحالات</option><option value="done">تم التصحيح</option><option value="pending">ينتظر التصحيح</option></select></label><label class="exam-result-search"><span>بحث</span><input id="saadExamSearchV6921" type="search" placeholder="اسم الطالب أو الكود" oninput="filterSaadExamAttendanceV6921(event)"></label></div><div class="exam-results-columns"><span>الطالب</span><span>الامتحان</span><span>الدرجة</span><span>الحالة</span><span>الإجراء</span></div><div id="saadExamResultRowsV6921" class="exam-results-rows"></div></section>`);
    old.remove();setGroupOptions();renderRows();
  }
  const render=window.renderExamsManagerV63;window.renderExamsManagerV63=function(){render();requestAnimationFrame(()=>requestAnimationFrame(install));};
})();

(function(){
  'use strict';
  function resultPct(row){const saved=Number(row?.percentage);if(Number.isFinite(saved))return Math.max(0,Math.min(100,saved));const max=Number(row?.maxScore||100);return max?Math.round(Number(row?.score||0)/max*100):0;}
  function resultStatus(row){return (row.needsManualReview||row.status==='pending_manual')?'pending':'done';}
  function resultDate(value){const raw=value?.toDate?.()||value,date=raw?new Date(raw):null;return date&&!Number.isNaN(date.getTime())?date.toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'}):'—';}
  function drawRows(){const host=document.getElementById('saadExamResultRows');if(!host)return;const query=String(document.getElementById('saadExamResultSearch')?.value||'').toLowerCase(),exam=document.getElementById('saadExamFilter')?.value||'',mode=document.getElementById('saadExamMode')?.value||'',status=document.getElementById('saadExamStatus')?.value||'';const rows=(adminData.examAttempts||[]).filter(row=>{const student=(adminData.students||[]).find(item=>String(item.studentCode||item.code)===String(row.studentCode)),delivery=student?.deliveryMode||row.deliveryMode||'center',hay=`${row.studentName||''} ${row.studentCode||''} ${row.examTitle||''} ${row.grade||''} ${row.group||''}`.toLowerCase();return (!query||hay.includes(query))&&(!exam||String(row.examId||row.examTitle)===exam)&&(!mode||delivery===mode)&&(!status||resultStatus(row)===status);});host.innerHTML=rows.length?rows.slice(0,150).map(row=>{const student=(adminData.students||[]).find(item=>String(item.studentCode||item.code)===String(row.studentCode)),delivery=student?.deliveryMode||row.deliveryMode||'center',ready=row.score!==null&&row.score!==undefined,state=resultStatus(row);return `<article class="exam-result-row"><div class="exam-result-student"><span class="exam-result-avatar">${safe(String(row.studentName||'ط').trim().charAt(0))}</span><div><b>${safe(row.studentName||row.studentCode||'طالب')}</b><small>${safe(row.studentCode||'—')} · ${delivery==='online'?'أونلاين':'سنتر'} · ${safe(row.grade||'')}</small></div></div><div><b>${safe(row.examTitle||'امتحان')}</b><small>${safe(resultDate(row.submittedAt))}</small></div><div class="exam-result-score"><b>${ready?`${Number(row.score)} من ${Number(row.maxScore||100)}`:'قيد التصحيح'}</b><small>${ready?`${resultPct(row).toFixed(1)}%`:''}</small></div><span class="exam-result-status ${state}">${state==='pending'?'ينتظر التصحيح':'تم التصحيح'}</span><div class="exam-result-actions"><button class="small-btn primary" onclick="correctAttempt('${safe(row.id)}')">عرض التصحيح</button>${student?.parentPhone?`<button class="small-btn ghost" onclick="sendExamGradeToParent('${safe(row.id)}')">واتساب</button>`:''}</div></article>`;}).join(''):'<div class="exam-results-empty"><b>لا توجد نتائج مطابقة</b><small>ستظهر محاولة الطالب فور التسليم.</small></div>';document.getElementById('saadExamResultCount').textContent=`${rows.length} نتيجة`;}
  window.filterSaadExamResults=drawRows;
  function enhance(){const content=document.getElementById('adminContent');if(!content||document.getElementById('saadExamResults'))return;content.querySelectorAll(':scope > details.admin-collapsible').forEach(item=>item.remove());const attempts=adminData.examAttempts||[],done=attempts.filter(row=>resultStatus(row)==='done'),average=attempts.length?attempts.reduce((sum,row)=>sum+resultPct(row),0)/attempts.length:0,exams=[...new Map(attempts.map(row=>[String(row.examId||row.examTitle||''),row.examTitle||'امتحان'])).entries()].filter(([id])=>id);const modal=content.querySelector('#examEditorV63');modal?.insertAdjacentHTML('beforebegin',`<section class="card exam-results-dashboard" id="saadExamResults"><div class="exam-results-head"><div><span class="kicker">النتائج المباشرة</span><h3>الطلاب الذين أدّوا الامتحانات</h3><p>الدرجة الفعلية من الدرجة النهائية، للسنتر والأونلاين.</p></div><b id="saadExamResultCount">${attempts.length} نتيجة</b></div><div class="exam-results-kpis"><article><small>إجمالي المحاولات</small><b>${attempts.length}</b></article><article><small>تم التصحيح</small><b>${done.length}</b></article><article><small>ينتظر التصحيح</small><b>${attempts.length-done.length}</b></article><article><small>متوسط المستوى</small><b>${average.toFixed(1)}%</b></article></div><div class="exam-results-filters"><label><span>بحث</span><input id="saadExamResultSearch" type="search" placeholder="اسم الطالب أو الكود" oninput="filterSaadExamResults()"></label><label><span>الامتحان</span><select id="saadExamFilter" onchange="filterSaadExamResults()"><option value="">كل الامتحانات</option>${exams.map(([id,title])=>`<option value="${safe(id)}">${safe(title)}</option>`).join('')}</select></label><label><span>نوع الدراسة</span><select id="saadExamMode" onchange="filterSaadExamResults()"><option value="">السنتر والأونلاين</option><option value="center">سنتر</option><option value="online">أونلاين</option></select></label><label><span>الحالة</span><select id="saadExamStatus" onchange="filterSaadExamResults()"><option value="">كل الحالات</option><option value="done">تم التصحيح</option><option value="pending">ينتظر التصحيح</option></select></label></div><div class="exam-results-columns"><span>الطالب</span><span>الامتحان</span><span>الدرجة</span><span>الحالة</span><span>الإجراء</span></div><div id="saadExamResultRows" class="exam-results-rows"></div></section>`);drawRows();}
  const base=window.renderExamsManagerV63;window.renderExamsManagerV63=function(){base();requestAnimationFrame(enhance);};
  window.correctAttempt=function(id){const row=adminData.examAttempts.find(item=>String(item.id)===String(id));if(!row)return;document.querySelector('.correction-modal-v40')?.remove();const answers=Array.isArray(row.answers)?row.answers:[],max=Number(row.maxScore||100);document.body.insertAdjacentHTML('beforeend',`<div class="correction-modal-v40"><div class="correction-card-v40 card"><div class="profile-top"><div><span class="kicker">تصحيح امتحان</span><h2>${safe(row.studentName||'-')}</h2><p>${safe(row.examTitle||'امتحان')} · من ${max}</p></div><button class="small-btn danger" onclick="closeCorrectionModal()">إغلاق</button></div><div class="correction-list-v40">${answers.map((answer,index)=>`<div class="correction-question-v40"><h3>${index+1}. ${safe(answer.question||'سؤال')} <span class="badge">من ${Number(answer.points||1)}</span></h3><div class="correction-answer-grid-v40"><div><span>إجابة الطالب</span><p>${safe(answer.answer||'-')}</p></div><div><span>الإجابة الصحيحة</span><p>${safe(answer.correctAnswer||'يصححها المدرس')}</p></div></div><label>درجة الطالب <input data-saad-awarded="${index}" type="number" min="0" max="${Number(answer.points||1)}" step="0.25" value="${answer.awardedScore??0}" oninput="recalculateCorrectionScore()"> من ${Number(answer.points||1)}</label></div>`).join('')}</div><div class="correction-final-v40"><label>المجموع من ${max}<input id="manualFinalScore" type="number" value="0" readonly></label><button class="btn primary" onclick="saveSaadWeightedCorrection('${safe(row.id)}')">حفظ التصحيح</button></div></div></div>`);recalculateCorrectionScore();};
  window.recalculateCorrectionScore=function(){const input=document.getElementById('manualFinalScore');if(input)input.value=Math.round([...document.querySelectorAll('[data-saad-awarded]')].reduce((sum,field)=>sum+Math.max(0,Math.min(Number(field.max),Number(field.value)||0)),0)*100)/100;};
  window.saveSaadWeightedCorrection=async function(id){const row=adminData.examAttempts.find(item=>String(item.id)===String(id));if(!row)return;const before=structuredClone(row),fields=[...document.querySelectorAll('[data-saad-awarded]')];fields.forEach(field=>{const answer=row.answers[Number(field.dataset.saadAwarded)],awarded=Math.max(0,Math.min(Number(answer.points||1),Number(field.value)||0));answer.awardedScore=awarded;answer.correct=awarded>=Number(answer.points||1);answer.teacherReviewed=true;});row.score=Number(document.getElementById('manualFinalScore')?.value||0);row.maxScore=Number(row.maxScore||fields.reduce((sum,field)=>sum+Number(field.max),0)||100);row.percentage=row.maxScore?Math.round(row.score/row.maxScore*100):0;row.needsManualReview=false;row.status='corrected';row.teacherCorrectedAt=new Date().toISOString();try{await window.MFCloud.saveExamAttempt(row);aToast('تم حفظ التصحيح والدرجة');closeCorrectionModal();renderExamsManagerV63();}catch(error){Object.assign(row,before);aToast('تعذر حفظ التصحيح');}};
})();

(function(){
  'use strict';
  function examTime(value){if(!value)return 0;const time=new Date(value).getTime();return Number.isFinite(time)?time:0;}
  function availability(exam){if(exam?.scheduleState)return exam.scheduleState;const now=Date.now(),open=examTime(exam?.openAt),close=examTime(exam?.closeAt);if(exam?.active===false)return 'closed';if(open&&now<open)return 'upcoming';if(close&&now>=close)return 'closed';return 'open';}
  function attemptPct(row){const saved=Number(row?.percentage);if(Number.isFinite(saved))return Math.max(0,Math.min(100,Math.round(saved)));const score=Number(row?.score),max=Number(row?.maxScore||100);return Number.isFinite(score)&&max>0?Math.round(score/max*100):null;}
  function correction(row){const answers=Array.isArray(row?.answers)?row.answers:[];if(!answers.length)return '';return `<details class="exam-correction-details"><summary>عرض تصحيح الأسئلة</summary><div class="exam-correction-list">${answers.map((answer,index)=>{const state=answer.correct===true?'correct':answer.correct===false?'wrong':'pending',label=state==='correct'?'إجابة صحيحة':state==='wrong'?'إجابة خاطئة':'تنتظر تصحيح المدرس';return `<article class="exam-correction-item ${state}"><header><b>السؤال ${index+1}</b><span class="badge ${state==='correct'?'good':state==='wrong'?'danger':'warn'}">${label}</span></header><h4>${esc(answer.question||'سؤال')}</h4><div><p><small>إجابتك</small>${esc(answer.answer||'لم تتم الإجابة')}</p><p><small>الإجابة الصحيحة</small>${esc(answer.correctAnswer||'تظهر بعد التصحيح')}</p></div><footer>${answer.awardedScore===null||answer.awardedScore===undefined?'قيد التصحيح':`${esc(answer.awardedScore)} من ${esc(answer.points||1)}`}</footer></article>`;}).join('')}</div></details>`;}
  function startCountdowns(root){
    const tick=()=>root.querySelectorAll('[data-exam-countdown]').forEach(card=>{const mode=card.dataset.mode,target=Number(card.dataset.examCountdown||0),value=card.querySelector('[data-countdown-value]');if(!value||!target)return;const left=target-Date.now();if(left<=0){value.textContent=mode==='upcoming'?'متاح الآن':'انتهى الوقت';setTimeout(()=>window.renderExamPortal?.(currentExamStudent,currentSecureExams),80);return;}const total=Math.ceil(left/1000),d=Math.floor(total/86400),h=Math.floor(total%86400/3600),m=Math.floor(total%3600/60),s=total%60;value.textContent=d?`${d} يوم و ${h} ساعة`:`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;});
    clearInterval(window.__saadExamCountdown);tick();window.__saadExamCountdown=setInterval(tick,1000);
  }
  window.renderExamPortal=function(st,exams){
    const box=document.getElementById('examStudentResult');if(!box)return;currentExamStudent=normalizedStudent(st);currentSecureExams=Array.isArray(exams)?exams:currentSecureExams;const attempts=(st.examAttempts||[]).slice().reverse();
    const cards=currentSecureExams.map(ex=>{const state=availability(ex),done=attempts.some(a=>String(a.examId)===String(ex.id)&&a.status!=='started')&&!ex.allowRetake,draft=readExamDraft(ex.id,st.studentCode),pdfOnly=ex.examFormat==='pdf'||(ex.pdfUrl&&Number(ex.questionCount||0)===0),target=state==='upcoming'?examTime(ex.openAt):state==='open'?examTime(ex.closeAt):0,disabled=done||state!=='open';const message=done?'تم تسليم الامتحان وحفظ نتيجتك.':state==='closed'?'انتهى الوقت — لم تستطع أداء الامتحان هذه المرة.':state==='upcoming'?'ترقّب الامتحان وذاكر ببراعة — سيفتح في موعده.':'الامتحان متاح الآن؛ ابدأ قبل انتهاء الوقت.';return `<article class="exam-portal-card ${done?'completed':state}" data-exam-countdown="${target||''}" data-mode="${state}"><div class="exam-card-top"><span class="iconbox" data-icon="clipboard"></span><div class="exam-card-badges"><span class="badge">${esc(ex.duration||20)} دقيقة</span><span class="badge">${esc(ex.maxScore||100)} درجة</span>${!pdfOnly?`<span class="badge">${esc(ex.questionCount||'-')} سؤال</span>`:''}<span class="badge ${state==='closed'?'danger':state==='upcoming'?'warn':'good'}">${done?'تم التسليم':state==='closed'?'انتهى':state==='upcoming'?'قادم':'متاح'}</span></div></div><h3>${esc(ex.title)}</h3><p>${esc(ex.instructions||'اقرأ كل سؤال جيدًا.')}</p><p class="exam-status-message">${message}</p><div class="exam-card-countdown"><small>${state==='upcoming'?'يفتح بعد':state==='open'&&target?'الوقت المتبقي':'الحالة'}</small><b data-countdown-value>${state==='closed'?'انتهى الوقت':target?'--:--:--':'متاح الآن'}</b></div>${ex.pdfUrl?`<a class="btn ghost" href="${esc(ex.pdfUrl)}" target="_blank" rel="noopener noreferrer">فتح ملف PDF</a>`:''}${pdfOnly?'':`<button class="btn ${disabled?'ghost':'primary'} exam-start-btn" type="button" data-exam-id="${esc(ex.id)}" data-student-code="${esc(st.studentCode)}" ${disabled?'disabled':''}>${done?'تم التسليم':state==='closed'?'انتهى الوقت':state==='upcoming'?'لم يفتح بعد':draft?'متابعة الامتحان':'بدء الامتحان'}</button>`}</article>`;}).join('');
    const results=attempts.length?attempts.map(row=>{const ready=row.score!==null&&row.score!==undefined,pct=attemptPct(row);return `<article class="exam-result-card exam-result-detailed"><div><span class="record-eyebrow">${esc(formatPortalDate(row.submittedAt))}</span><h4>${esc(row.examTitle||'امتحان')}</h4><small>${row.needsManualReview?'تم تصحيح الاختياري وتنتظر الأسئلة المقالية':'تم التصحيح'}</small>${ready?`<small>مستواك: ${pct}%</small>`:''}</div><strong class="score-pill ${ready?scoreClass(pct):'warn'}">${ready?`${Number(row.score)} من ${Number(row.maxScore||100)}`:'قيد التصحيح'}</strong>${correction(row)}</article>`;}).join(''):'<div class="portal-empty"><h3>لا توجد محاولات بعد</h3></div>';
    box.innerHTML=`<section class="exam-student-banner"><span class="student-avatar">${esc(String(st.name||'ط').trim().charAt(0))}</span><div><small>امتحانات الطالب</small><h2>${esc(st.name)}</h2><p>${esc(st.grade||'')} · ${esc(st.deliveryMode==='online'?'أونلاين':'سنتر')}</p></div></section><div class="exam-portal-section"><div class="student-panel-title"><div><span class="kicker">حالة الامتحانات</span><h3>اعرف موقف كل امتحان بوضوح</h3></div><span class="badge">${currentSecureExams.length} امتحان</span></div><div class="exam-portal-grid">${cards||'<div class="portal-empty"><h3>لا توجد امتحانات حاليًا</h3></div>'}</div></div><div class="exam-portal-section"><div class="student-panel-title"><h3>سجل النتائج</h3></div><div class="exam-results-grid">${results}</div></div>`;
    box.querySelectorAll('.exam-start-btn:not([disabled])').forEach(button=>button.addEventListener('click',()=>window.startExam(button.dataset.examId,button.dataset.studentCode)));startCountdowns(box);hydrateIcons();
  };
  const originalStart=window.startExam;window.startExam=async function(examId,studentCode){const exam=currentSecureExams.find(item=>String(item.id)===String(examId)),state=availability(exam);if(state==='upcoming')return toast('الامتحان لم يبدأ بعد — ترقّبه وذاكر ببراعة.');if(state==='closed')return toast('انتهى وقت الامتحان، لم تستطع أداءه هذه المرة.');return originalStart(examId,studentCode);};
})();
