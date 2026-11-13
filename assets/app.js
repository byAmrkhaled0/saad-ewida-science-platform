var DEFAULT_SITE_URL = 'https://saad-ewida-science-platform.vercel.app';
var TEACHER_WHATSAPP = '201097163200';
var ENGINEER_WHATSAPP = '201008454029';
var GRADES = ['رابعة ابتدائي','خامسة ابتدائي','سادسة ابتدائي','أولى إعدادي','تانية إعدادي','تالتة إعدادي','أولى ثانوي','تانية ثانوي','تالتة ثانوي'];
var MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
var STORAGE_KEY = 'mf_science_v53_data';
var OLD_STORAGE_KEY = 'mf_science_v11_data';
var PUBLIC_STORAGE_KEY = 'mf_science_v53_public_cache';
var LAST_STUDENT_CODE_KEY = 'mf_last_student_code';
var ADMIN_STUDENT_PREVIEW_KEY = 'mf_admin_student_preview_v1';
var LAST_EXAM_CODE_KEY = 'mf_last_exam_code';
var EXAM_DRAFT_PREFIX = 'mf_exam_draft_v2_';
var PENDING_BOOKING_REQUEST_KEY = 'mf_pending_booking_request_v1';
var cloudSaveTimer = null;
var MF_ASSET_VERSION = '70.0.0';
var mfLazyScriptPromises = Object.create(null);

window.__mfPerformanceSamples=window.__mfPerformanceSamples||[];
async function measurePlatformAction(name,action){
  const started=performance.now();
  try{return await action();}
  finally{
    const duration=Math.round((performance.now()-started)*10)/10;
    const sample={name:String(name||'action'),duration,at:new Date().toISOString()};
    window.__mfPerformanceSamples.push(sample);
    if(window.__mfPerformanceSamples.length>120)window.__mfPerformanceSamples.splice(0,window.__mfPerformanceSamples.length-120);
    if(duration>2000)console.warn('platform-action-slow',sample);
  }
}

function protectedStudentWorkflowActive(){
  return document.body.classList.contains('exam-open')||document.body.classList.contains('homework-open')||document.querySelector('.homework-upload-form.is-uploading')!==null;
}

function loadLazyScript(key, source, readyCheck){
  if(typeof readyCheck==='function'&&readyCheck())return Promise.resolve(true);
  if(mfLazyScriptPromises[key])return mfLazyScriptPromises[key];
  mfLazyScriptPromises[key]=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.async=true;
    script.dataset.mfLazy=key;
    const url=new URL(source,document.baseURI);
    if(url.origin===location.origin&&!url.searchParams.has('v'))url.searchParams.set('v',MF_ASSET_VERSION);
    script.src=url.href;
    script.onload=()=>{
      if(typeof readyCheck!=='function'||readyCheck())resolve(true);
      else reject(new Error(`Lazy asset did not initialize: ${key}`));
    };
    script.onerror=()=>reject(new Error(`Lazy asset failed to load: ${key}`));
    document.head.appendChild(script);
  }).catch(error=>{delete mfLazyScriptPromises[key];throw error;});
  return mfLazyScriptPromises[key];
}

window.MFAssets={
  loadQrScanner:()=>loadLazyScript('qr-scanner','assets/vendor/html5-qrcode-2.3.8.min.js',()=>typeof window.Html5Qrcode==='function'),
  loadSpreadsheet:()=>loadLazyScript('spreadsheet','assets/vendor/xlsx-0.18.5.full.min.js',()=>typeof window.XLSX!=='undefined')
};
var icons = {
  atom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"></circle><path d="M12 2c3 3.8 5 7.1 5 10s-2 6.2-5 10c-3-3.8-5-7.1-5-10s2-6.2 5-10Z"></path><path d="M2 12c3.8-3 7.1-5 10-5s6.2 2 10 5c-3.8 3-7.1 5-10 5S5.8 15 2 12Z"></path></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 2v4M16 2v4M3 10h18"></path><rect x="3" y="5" width="18" height="17" rx="3"></rect></svg>',
  bookOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 7v14"></path><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H12V5H6.5A2.5 2.5 0 0 0 4 7.5v12Z"></path><path d="M20 19.5a2.5 2.5 0 0 0-2.5-2.5H12V5h5.5A2.5 2.5 0 0 1 20 7.5v12Z"></path></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="5" y="4" width="14" height="18" rx="2"></rect><path d="M9 4a3 3 0 0 1 6 0"></path><path d="M9 12h6M9 16h4"></path></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
  robot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7" width="14" height="13" rx="4"/><path d="M12 7V3m-2 0h4M3 12v4m18-4v4M9.5 16h5"/><circle cx="9" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r=".8" fill="currentColor" stroke="none"/></svg>',
  logIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M4 12h11m-4-4 4 4-4 4"/></svg>',
  logOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m-2-8h11m-4-4 4 4-4 4"/></svg>',
  moreHorizontal: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  refreshCw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4v5h-5M4 20v-5h5M20 9a8 8 0 0 0-13-3l-3 3m16 6-3 3a8 8 0 0 1-13-3"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  barChart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 20V4"></path><path d="M4 20h17"></path><rect x="7" y="11" width="3" height="6" rx="1"></rect><rect x="12" y="7" width="3" height="10" rx="1"></rect><rect x="17" y="13" width="3" height="4" rx="1"></rect></svg>',
  userCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7" r="4"></circle><path d="m16 11 2 2 4-5"></path></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.45c1 .35 1.9.6 2.9.7A2 2 0 0 1 22 16.9Z"></path></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"></path><path d="M19 14l.9 2.6L22 17.5l-2.1.9L19 21l-.9-2.6-2.1-.9 2.1-.9L19 14ZM4 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"></path></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m22 2-7 20-4-9-9-4 20-7Z"></path><path d="M22 2 11 13"></path></svg>',
  database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"></path><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"></path></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>',
  fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6M8 13h8M8 17h6"></path></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.8 1.2 6.9L12 17.8 5.8 21 7 14.1 2 9.3l6.9-1L12 2Z"></path></svg>',
  externalLink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.25 10.44 22v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.77l-.44 2.91h-2.33V22C18.34 21.25 22 17.08 22 12.06Z"/></svg>',
  helpCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 1 1 5.6 1.5c-.8 1.2-2.7 1.5-2.7 3"></path><path d="M12 17h.01"></path></svg>',
  alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.4 4.5 2.7 18a1.8 1.8 0 0 0 1.6 2.7h15.4a1.8 1.8 0 0 0 1.6-2.7L13.6 4.5a1.8 1.8 0 0 0-3.2 0Z"></path><path d="M12 9v4m0 3.5h.01"></path></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><path d="M14 14h3v3h-3zM18 14h3M14 19h7M19 18v3"></path></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 15H6L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M17 8l-5-5-5 5"></path><path d="M12 3v12"></path></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"></path></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>'
};

var PRODUCTION_MODE = true;
var appDataLoadFailed = false;

function iconNameToKey(name){return String(name||'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());}
function hydrateIcons(){document.querySelectorAll('[data-icon]').forEach(el=>{const key=iconNameToKey(el.dataset.icon); if(icons[key]) el.innerHTML=icons[key];});}
function toast(msg){const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2800);}
function firebaseFriendlyError(err,fallback){const raw=`${err?.code||''} ${err?.message||''}`;if(/function.*unavailable|service.*unavailable/i.test(raw))return 'الخدمة غير مفعّلة حاليًا. تواصل مع المدرس أو حاول لاحقًا.';if(/resource-exhausted/i.test(raw))return 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.';if(/failed-precondition/i.test(raw))return raw.split(':').pop().trim()||'الاختيار لم يعد متاحًا. حدّث الصفحة وحاول مرة أخرى.';if(/invalid-argument/i.test(raw)){const message=raw.split(':').pop().trim();return /firebase|firestore|function|permission|internal/i.test(message)?(fallback||'تعذر إتمام الطلب. راجع البيانات وحاول مرة أخرى.'):message;}if(/deadline-exceeded/i.test(raw))return 'انتهى وقت الامتحان.';if(/already-exists/i.test(raw))return /طالب|مسجل بالفعل|الكود السابق/i.test(raw)?'هذا الطالب مسجل بالفعل على المنصة. استخدم الكود السابق أو تواصل مع المستر.':'تم تنفيذ هذه العملية بالفعل.';if(/permission-denied|unauthenticated/i.test(raw))return 'لا يمكن تنفيذ الطلب حاليًا. حدّث الصفحة ثم حاول مرة أخرى.';if(/unavailable|network|internal|fetch|offline|timeout/i.test(raw))return 'تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مرة أخرى.';if(/not-found/i.test(raw))return 'الكود غير صحيح أو غير موجود.';return fallback||'حدث خطأ غير متوقع.';}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function toEnglishDigits(v){return String(v||'').replace(/[٠-٩]/g,digit=>String(digit.charCodeAt(0)-1632)).replace(/[۰-۹]/g,digit=>String(digit.charCodeAt(0)-1776));}
function normalizeText(v){return toEnglishDigits(v).trim().toLowerCase().replace(/\s+/g,' ');}
function academicComparableClient(value){return normalizeText(value).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/(^|\s)(?:ال)?صف(?=\s|$)/g,' ')
  .replace(/(^|\s)(?:ال)?(?:اول|اولي)(?=\s|$)/g,' اولي')
  .replace(/(^|\s)(?:ال)?(?:ثاني|ثانيه|تاني|تانيه)(?=\s|$)/g,' تانيه')
  .replace(/(^|\s)(?:ال)?(?:ثالث|ثالثه|تالت|تالته)(?=\s|$)/g,' تالته')
  .replace(/(^|\s)(?:ال)?(?:رابع|رابعه)(?=\s|$)/g,' رابعه')
  .replace(/(^|\s)(?:ال)?(?:خامس|خامسه)(?=\s|$)/g,' خامسه')
  .replace(/(^|\s)(?:ال)?(?:سادس|سادسه)(?=\s|$)/g,' سادسه')
  .replace(/\s+/g,' ').trim();}
function academicGradeClient(value){const comparable=academicComparableClient(value),level=/ابتدائي/.test(comparable)?'primary':/اعدادي/.test(comparable)?'preparatory':/ثانوي/.test(comparable)?'secondary':'',ordinal=['اولي','تانيه','تالته','رابعه','خامسه','سادسه'].findIndex(token=>new RegExp(`(^|\\s)${token}(?=\\s|$)`).test(comparable));return level&&ordinal>=0?`${level}:${ordinal+1}`:comparable;}
function academicTermClient(value){const comparable=academicComparableClient(value);if(/(^|\s)(?:1|اولي)(?=\s|$)/.test(comparable))return '1';if(/(^|\s)(?:2|تانيه)(?=\s|$)/.test(comparable))return '2';return comparable;}
function academicYearClient(value){const years=toEnglishDigits(value).match(/\d{4}/g);return years?.length>=2?`${years[0]}/${years[1]}`:toEnglishDigits(value).replace(/[^0-9]/g,'');}
function assessmentAudienceIncludesClient(item,studentCode){
  const targets=item.targetStudentCodes;
  if(item.targetingMode!=='students'&&(targets==null||Array.isArray(targets)&&!targets.length))return true;
  const normalize=code=>toEnglishDigits(String(code??'')).trim().toUpperCase();
  const code=normalize(studentCode);
  return /^[A-Z0-9_-]{6,40}$/.test(code)&&Array.isArray(targets)&&targets.length<=40&&targets.some(target=>normalize(target)===code);
}
function learningTargetMatchesStudentClient(item={},student={}){if(!assessmentAudienceIncludesClient(item,student.studentCode||student.code||student.id))return false;const targetMode=item.deliveryMode==='online'?'online':item.deliveryMode==='center'?'center':'all',studentMode=student.deliveryMode==='online'?'online':'center',rawGrade=academicComparableClient(item.grade),grade=academicGradeClient(item.grade),studentGrade=academicGradeClient(student.grade),group=academicComparableClient(item.group),studentGroup=academicComparableClient(student.group),allGrades=!rawGrade||['كل الصفوف','جميع الصفوف'].includes(rawGrade),allGroups=!group||['كل المجموعات','جميع المجموعات'].includes(group);if(targetMode!=='all'&&targetMode!==studentMode)return false;if(!allGrades&&grade!==studentGrade)return false;if(item.academicYear&&student.academicYear&&academicYearClient(item.academicYear)!==academicYearClient(student.academicYear))return false;if(item.term&&student.term&&academicTermClient(item.term)!==academicTermClient(student.term))return false;if(allGroups)return true;const targetSchedule=String(item.scheduleId||'').trim(),studentSchedule=String(student.scheduleId||'').trim();return Boolean(targetSchedule&&studentSchedule&&targetSchedule===studentSchedule)||Boolean(group&&group===studentGroup);}
window.learningTargetMatchesStudentClient=learningTargetMatchesStudentClient;
function phoneDigits(v){return toEnglishDigits(v).replace(/\D/g,'');}
function formatTime12(value){
  const normalized=toEnglishDigits(value||'').trim();
  const match=normalized.match(/^(\d{1,2}):(\d{2})/);
  if(!match)return String(value||'');
  const hour=Math.min(23,Math.max(0,Number(match[1]))),minute=match[2];
  const shown=hour%12||12,suffix=hour<12?'ص':'م';
  return `${shown}:${minute} ${suffix}`.replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}
function uid(prefix='ST'){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=new Uint8Array(8);if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);const body=[...bytes].map(x=>alphabet[x%alphabet.length]).join('');return `${prefix}-${body.slice(0,4)}-${body.slice(4,8)}`;}
function isoDate(d=new Date()){return d.toISOString().slice(0,10);}
function arStatus(status){return status==='present'?'حاضر':status==='absent'?'غائب':(status||'-');}
function statusClass(status){return status==='present'||status==='حاضر'||status===true?'good':status==='absent'||status==='غائب'||status===false?'danger':'warn';}
function whatsappLink(phone,msg){return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;}
function whatsappPhone(v){const d=phoneDigits(v); if(!d) return ''; if(d.startsWith('20')) return d; if(d.startsWith('0')) return '2'+d; return d;}
function monthLabel(st){const key=String(st?.monthlyIncentive?.monthKey||'');if(/^\d{4}-\d{2}$/.test(key))return new Date(`${key}-01T12:00:00`).toLocaleDateString('ar-EG',{month:'long',year:'numeric'});return st?.month || MONTHS[new Date().getMonth()] || '';}
function assignmentPublishMillis(value){if(!value)return 0;if(typeof value.toMillis==='function'){const millis=Number(value.toMillis());return Number.isFinite(millis)?millis:0;}const millis=Date.parse(String(value));return Number.isFinite(millis)?millis:0;}
function assignmentIsReleasedClient(item,now=Date.now()){return item?.active!==false&&(!assignmentPublishMillis(item?.publishAt)||assignmentPublishMillis(item.publishAt)<=now);}
function safeStorageGet(key){try{return localStorage.getItem(key)||'';}catch(e){return '';}}
function safeStorageSet(key,value){try{localStorage.setItem(key,String(value??''));return true;}catch(e){return false;}}
function safeStorageRemove(key){try{localStorage.removeItem(key);}catch(e){}}
function readAdminStudentPreview(code){try{const raw=sessionStorage.getItem(ADMIN_STUDENT_PREVIEW_KEY);if(!raw)return null;const payload=JSON.parse(raw),student=payload?.student;if(!student||Number(payload.expiresAt||0)<Date.now()){sessionStorage.removeItem(ADMIN_STUDENT_PREVIEW_KEY);return null;}const wanted=normalizeText(code),saved=normalizeText(student.studentCode||student.code||student.id);return wanted&&wanted===saved?normalizedStudent(student):null;}catch(error){return null;}}
function formatPortalDate(value){if(!value)return '-'; try{return new Date(value).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'});}catch(e){return String(value);}}
function scoreLabel(score){const n=Number(score); if(Number.isNaN(n)) return 'بانتظار التصحيح'; return n>=90?'ممتاز':n>=75?'جيد جدًا':n>=60?'جيد':'يحتاج متابعة';}
function scoreClass(score){const n=Number(score); if(Number.isNaN(n)) return 'warn'; return n>=75?'good':n>=60?'warn':'danger';}
function gradePercentage(row){const stored=Number(row?.percentage);if(Number.isFinite(stored))return Math.max(0,Math.min(100,Math.round(stored)));const score=Number(row?.score),max=Number(row?.maxScore||row?.totalScore||100);return Number.isFinite(score)&&max>0?Math.max(0,Math.min(100,Math.round(score/max*100))):null;}
function gradeMark(row){return `${Number(row?.score||0)} من ${Number(row?.maxScore||row?.totalScore||100)}`;}
function getSiteBase(){return (appData.settings?.siteUrl || DEFAULT_SITE_URL || location.origin).replace(/\/$/,'');}
function defaultData(){return {students:[],bookings:[],materials:[],questions:[],exams:[],examAttempts:[],grades:[],reviews:[],groups:[],assignments:[],paymentRecords:[],studentTransferRequests:[],settings:{siteUrl:DEFAULT_SITE_URL||'',teacherPhone:TEACHER_WHATSAPP||''}};}
function mergeData(data){const d=defaultData(); const p=data||{}; return {...d,...p,settings:{...d.settings,...(p.settings||{})},students:Array.isArray(p.students)?p.students:[],bookings:Array.isArray(p.bookings)?p.bookings:[],materials:Array.isArray(p.materials)?p.materials:[],questions:Array.isArray(p.questions)?p.questions:[],exams:Array.isArray(p.exams)?p.exams:[],examAttempts:Array.isArray(p.examAttempts)?p.examAttempts:[],grades:Array.isArray(p.grades)?p.grades:[],reviews:Array.isArray(p.reviews)?p.reviews:[],groups:Array.isArray(p.groups)?p.groups:[],assignments:Array.isArray(p.assignments)?p.assignments:[],paymentRecords:Array.isArray(p.paymentRecords)?p.paymentRecords:[],studentTransferRequests:Array.isArray(p.studentTransferRequests)?p.studentTransferRequests:[]};}
function isStaffWorkspace(){return (location.pathname.split('/').pop()||'')==='teacher-login.html';}
function publicDataOnly(data){const d=mergeData(data),settings=d.settings||{},published=rows=>(rows||[]).filter(item=>item.active!==false);return {...defaultData(),materials:published(d.materials),questions:published(d.questions),reviews:d.reviews.filter(r=>r.approved===true),groups:published(d.groups),assignments:(d.assignments||[]).filter(item=>assignmentIsReleasedClient(item)),settings:{siteUrl:settings.siteUrl||DEFAULT_SITE_URL,teacherPhone:settings.teacherPhone||TEACHER_WHATSAPP,teacherName:settings.teacherName||'المستر سعد عويضة',facebookUrl:settings.facebookUrl||'https://www.facebook.com/saad.abomoaz',homeNotice:settings.homeNotice||'',academicYear:settings.academicYear||'',term:settings.term||'الترم الأول',vodafoneCashNumber:settings.vodafoneCashNumber||'',instapayAccount:settings.instapayAccount||'',paymentReceiverName:settings.paymentReceiverName||'',paymentInstructions:settings.paymentInstructions||''}};}
function staffCacheOnly(data){
  const d=mergeData(data);
  // Keep the browser cache intentionally small. Historical attendance, grades,
  // homework and exam attempts remain in Firestore and are loaded in the
  // background for staff instead of being JSON-stringified on every click.
  const students=d.students.map(raw=>{const student={...raw};delete student.attendance;delete student.grades;delete student.homeworks;delete student.recitations;delete student.practicals;return student;});
  return {...d,students,examAttempts:[],grades:[],paymentRecords:[]};
}
function loadData(){
  try{
    if(isStaffWorkspace()){
      const current=sessionStorage.getItem(STORAGE_KEY);
      const legacy=current||localStorage.getItem(STORAGE_KEY)||'{}';
      if(!current&&legacy!=='{}'){sessionStorage.setItem(STORAGE_KEY,legacy);localStorage.removeItem(STORAGE_KEY);}
      return mergeData(JSON.parse(legacy));
    }
    return publicDataOnly(JSON.parse(localStorage.getItem(PUBLIC_STORAGE_KEY)||'{}'));
  }catch(e){return defaultData();}
}
function saveData(data){
  try{
    if(isStaffWorkspace()){
      sessionStorage.setItem(STORAGE_KEY,JSON.stringify(staffCacheOnly(data)));
      localStorage.removeItem(STORAGE_KEY);
    }else{
      localStorage.setItem(PUBLIC_STORAGE_KEY,JSON.stringify(publicDataOnly(data)));
    }
  }catch(e){}
}
function bookingFingerprint(payload){return [payload.name,payload.studentPhone,payload.parentPhone,payload.deliveryMode,payload.grade,payload.term,payload.month,payload.scheduleId,payload.group].map(value=>normalizeText(value||'')).join('|');}
function newRequestId(){
  if(window.crypto?.randomUUID)return window.crypto.randomUUID();
  const bytes=new Uint8Array(16);window.crypto?.getRandomValues?.(bytes);
  return `booking-${Date.now()}-${[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('')}`;
}
function bookingRequestId(payload){
  const fingerprint=bookingFingerprint(payload);
  try{
    const pending=JSON.parse(sessionStorage.getItem(PENDING_BOOKING_REQUEST_KEY)||'null');
    if(pending?.id&&pending.fingerprint===fingerprint&&Date.now()-Number(pending.createdAt||0)<15*60*1000)return pending.id;
  }catch(_){ }
  const id=newRequestId();
  try{sessionStorage.setItem(PENDING_BOOKING_REQUEST_KEY,JSON.stringify({id,fingerprint,createdAt:Date.now()}));}catch(_){ }
  return id;
}
function clearBookingRequest(){try{sessionStorage.removeItem(PENDING_BOOKING_REQUEST_KEY);}catch(_){ }}
var appData = loadData();
function queueCloudSave(){ if(!window.MFCloud?.ready || !window.MFCloud.saveSiteData) return; clearTimeout(cloudSaveTimer); cloudSaveTimer=setTimeout(()=>window.MFCloud.saveSiteData(appData).catch(()=>{}),500); }
function persist(msg){saveData(appData); queueCloudSave(); if(msg) toast(msg); refreshActiveViews();}
function dataErrorHTML(message='تعذر تحميل بيانات الطالب'){return `<div class="empty-state compact-empty-v29"><span class="iconbox" data-icon="database"></span><h3>${esc(message)}</h3><p>راجع الكود واتصال الإنترنت وحاول مرة أخرى. لو استمرت المشكلة تواصل مع المدرس.</p></div>`;}
async function initFirebaseData(){
  // The admin bundle performs a staged staff load (core first, records later).
  // Starting the public full-data loader here as well caused duplicate reads
  // and was a major source of freezes on the teacher page.
  if(isStaffWorkspace())return;
  if(!window.MFCloud?.ready || !window.MFCloud.loadSiteData) return;
  try{
    const cloudData = await window.MFCloud.loadSiteData();
    if(cloudData){ appData = mergeData(cloudData); saveData(appData); refreshActiveViews(); }
  }catch(e){ appDataLoadFailed=true; refreshActiveViews(); }
}
window.addEventListener('mfcloudready',()=>initFirebaseData());
function refreshActiveViews(){
  const path=(location.pathname.split('/').pop()||'index.html');
  try{
    if(document.getElementById('liveCounts')) renderHomeCounts();
    if(document.getElementById('publicLeaderboard')) renderPublicLeaderboard();
    if(document.getElementById('reviewsList')) renderReviews();
    if(document.getElementById('bookingGroup')) renderBookingScheduleOptions();
    if(path==='materials.html') renderUnifiedResourcesPage();
    setupContact();
    setupHomeNotice();
  }catch(e){}
}
function setupTheme(){
  const saved=localStorage.getItem('theme')||'light'; document.documentElement.dataset.theme=saved;
  document.querySelectorAll('#themeToggle,#themeToggleAdmin').forEach(btn=>{btn.innerHTML=icons[saved==='dark'?'sun':'moon']; btn.onclick=()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark'; document.documentElement.dataset.theme=next; localStorage.setItem('theme',next); setupTheme();};});
}
function fillSelects(){
  const grade=document.getElementById('bookingGrade'); if(grade) grade.innerHTML=GRADES.map(g=>`<option>${esc(g)}</option>`).join('');
  const month=document.getElementById('bookingMonth'); if(month) month.innerHTML=MONTHS.map(m=>`<option>${esc(m)}</option>`).join('');
  const term=document.getElementById('bookingTerm'),terms=Array.isArray(window.ACADEMIC_TERMS)&&window.ACADEMIC_TERMS.length?window.ACADEMIC_TERMS:['الترم الأول','الترم الثاني'];
  if(term){term.innerHTML=terms.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');term.value=terms.includes(appData.settings?.term)?appData.settings.term:terms[0];}
  if(month){const currentMonth=MONTHS[new Date().getMonth()];if(currentMonth)month.value=currentMonth;}
  if(grade&&!grade.dataset.scheduleBound){grade.dataset.scheduleBound='true';grade.addEventListener('change',()=>{const search=document.getElementById('bookingGroupSearch');if(search)search.value='';renderBookingScheduleOptions();});}
  if(term&&!term.dataset.scheduleBound){term.dataset.scheduleBound='true';term.addEventListener('change',()=>{const search=document.getElementById('bookingGroupSearch');if(search)search.value='';renderBookingScheduleOptions();});}
  const deliveryMode=document.getElementById('bookingDeliveryMode');if(deliveryMode&&!deliveryMode.dataset.bound){deliveryMode.dataset.bound='true';deliveryMode.addEventListener('change',()=>{const search=document.getElementById('bookingGroupSearch');if(search)search.value='';renderBookingScheduleOptions();});}
  const groupSearch=document.getElementById('bookingGroupSearch');if(groupSearch&&!groupSearch.dataset.bound){groupSearch.dataset.bound='true';groupSearch.addEventListener('input',renderBookingScheduleOptions);}
  renderBookingScheduleOptions();
}
function activeSchedulesForGrade(grade,deliveryMode='center',term=''){
  const selected=normalizeText(grade);
  return (appData.groups||[]).filter(item=>item&&item.active!==false&&normalizeText(item.grade)===selected&&String(item.deliveryMode||'center')===deliveryMode&&(!item.term||!term||item.term===term));
}
function scheduleOptionLabel(item){const time=[item.startTime,item.endTime].filter(Boolean).map(formatTime12).join(' - ');return [item.name,item.term,item.days,time,item.notes].filter(Boolean).join(' — ');}
function renderBookingScheduleOptions(){
  const select=document.getElementById('bookingGroup');if(!select)return;
  const grade=document.getElementById('bookingGrade')?.value||GRADES[0];
  const deliveryMode=document.getElementById('bookingDeliveryMode')?.value||'center';
  const term=document.getElementById('bookingTerm')?.value||'';
  const query=normalizeText(document.getElementById('bookingGroupSearch')?.value||'');
  const allSchedules=activeSchedulesForGrade(grade,deliveryMode,term);
  const schedules=query?allSchedules.filter(item=>normalizeText([item.name,item.days,item.startTime,item.endTime,item.notes].filter(Boolean).join(' ')).includes(query)):allSchedules;
  const currentId=document.getElementById('bookingScheduleId')?.value||'';
  const scheduleIdInput=document.getElementById('bookingScheduleId');
  const submit=document.querySelector('#bookingForm button[type="submit"]');
  const hint=document.getElementById('bookingGroupHint');
  select.disabled=false;
  if(!allSchedules.length){
    select.innerHTML=`<option value="في انتظار تحديد المجموعة">احجز الآن — وسيتم تحديد موعد ${esc(grade)} لاحقًا</option>`;
    if(scheduleIdInput)scheduleIdInput.value='';
    if(submit)submit.disabled=false;
    if(hint)hint.innerHTML=`<b>لا يوجد موعد ${deliveryMode==='online'?'أونلاين':'مجموعة'} منشور لـ ${esc(grade)} — ${esc(term||'الترم الحالي')} حاليًا.</b> يمكنك إكمال الحجز، وسيتواصل معك المستر لتحديد الموعد.`;
    return;
  }
  if(!schedules.length){
    select.innerHTML='<option value="">لا توجد مجموعة مطابقة للبحث</option>';
    if(scheduleIdInput)scheduleIdInput.value='';
    if(submit)submit.disabled=true;
    if(hint)hint.textContent='امسح كلمة البحث لعرض كل مواعيد الصف المختار.';
    return;
  }
  if(submit)submit.disabled=false;
  select.innerHTML='<option value="في انتظار تحديد المجموعة">احجز الآن وحدد الموعد لاحقًا</option>'+schedules.map(item=>`<option value="${esc(item.name||'')}" data-schedule-id="${esc(item.id||'')}">${esc(scheduleOptionLabel(item))}</option>`).join('');
  const retained=[...select.options].find(option=>option.dataset.scheduleId===currentId);
  if(retained)retained.selected=true;else if(scheduleIdInput)scheduleIdInput.value='';
  if(hint)hint.textContent=`يعرض ${allSchedules.length} موعد ${deliveryMode==='online'?'أونلاين':'مجموعة'} خاصًا بـ ${grade} — ${term||'كل الترمات'}${query?` — نتائج البحث ${schedules.length}`:''}.`;
  select.onchange=()=>{const option=select.selectedOptions[0];if(scheduleIdInput)scheduleIdInput.value=option?.dataset.scheduleId||'';};
}
function groupOptions(){return (appData.groups||[]).filter(item=>item&&item.active!==false).map(item=>item.name).filter(Boolean);}
function classRecordComplete(record){return record?.completed===true||record?.approved===true||/^تم/.test(String(record?.status||''));}
function classRecordDate(record){const value=String(record?.date||record?.submittedAt||record?.createdAt||'');return value.slice(0,10);}
function isHomeworkGradeClient(record){return record?.type==='homework'||String(record?.source||'').startsWith('homework')||String(record?.id||'').startsWith('homework_')||Boolean(record?.assignmentId&&record?.sourceId);}
function calcStudent(st){
  const attendance = getAttendanceRows(st);
  const total = attendance.length;
  const present = attendance.filter(a=>(a.status==='present'||a.status==='حاضر'||a.status==='متأخر')).length;
  const attendancePct = total ? Math.round((present/total)*100) : 0;
  const allGraded=(st.grades||[]).filter(g=>g.score!==''&&g.score!==undefined&&g.score!==null&&!isNaN(Number(g.score)));
  const graded=allGraded.filter(g=>!isHomeworkGradeClient(g));
  const avg=graded.length?Math.round(graded.reduce((s,g)=>s+(gradePercentage(g)||0),0)/graded.length):0;
  const recitations=(st.recitations||[]).filter(classRecordComplete),homeworks=(st.homeworks||[]).filter(classRecordComplete);
  const classDates=new Set(attendance.map(classRecordDate).filter(Boolean));
  recitations.forEach(row=>{const date=classRecordDate(row);if(date)classDates.add(date);});
  homeworks.forEach(row=>{const date=classRecordDate(row);if(date)classDates.add(date);});
  const sessions=classDates.size;
  const completedDates=rows=>new Set(rows.map(classRecordDate).filter(Boolean)).size;
  const recitationCount=completedDates(recitations),homeworkCount=completedDates(homeworks);
  const recitationPct=sessions?Math.min(100,Math.round(recitationCount/sessions*100)):0;
  const homeworkPct=sessions?Math.min(100,Math.round(homeworkCount/sessions*100)):0;
  const homeworkGradeMap=new Map();[...allGraded.filter(isHomeworkGradeClient),...(st.homeworks||[]).filter(g=>g.score!==''&&g.score!==undefined&&g.score!==null&&!isNaN(Number(g.score)))].forEach(g=>homeworkGradeMap.set(String(g.assignmentId||g.sourceId||g.id||homeworkGradeMap.size),g));
  const homeworkGrades=[...homeworkGradeMap.values()],homeworkGradeAvg=homeworkGrades.length?Math.round(homeworkGrades.reduce((sum,g)=>sum+(gradePercentage(g)||0),0)/homeworkGrades.length):0;
  const final=Math.round(attendancePct*.25+avg*.30+homeworkPct*.15+(homeworkGrades.length?homeworkGradeAvg:homeworkPct)*.15+recitationPct*.15);
  const level= final>=90?'ممتاز':final>=75?'جيد جدًا':final>=60?'جيد':'محتاج متابعة';
  return {attendancePct,avg,homeworkGradeAvg,homeworkGradeCount:homeworkGrades.length,hwPct:homeworkPct,homeworkPct,recitationPct,homeworkCount,recitationCount,sessions,final,level,totalAttendance:total,present,absent:attendance.filter(a=>(a.status==='absent'||a.status==='غائب')).length,lastGrade:graded.at(-1)};
}
function normalizedStudent(st){const code=toEnglishDigits(st?.studentCode||st?.code||st?.id||'').trim().toUpperCase(); return {...(st||{}),id:code,code,studentCode:code,parentCode:toEnglishDigits(st?.parentCode||'').trim().toUpperCase(),name:st?.studentName||st?.name||'',studentName:st?.studentName||st?.name||''};}
function findStudentByCode(code){const q=normalizeText(code); return (appData.students||[]).map(normalizedStudent).find(s=>normalizeText(s.code)===q || normalizeText(s.studentCode)===q) || null;}
function attendanceDocId(st,date){return `${st.studentCode||st.code}_${date}`.replace(/[\\/#?\[\]]/g,'-');}
function getAttendanceRows(st){
  const legacy=(st.attendance||[]).map(a=>({...a,status:a.status==='حاضر'?'present':a.status==='غائب'?'absent':a.status,date:String(a.date||'').replaceAll('/','-'),time:a.time||'',group:a.group||st.group}));
  return legacy.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function attendanceSummaryHTML(st){
  const rows=getAttendanceRows(st); const total=rows.length; const present=rows.filter(a=>a.status==='present'||a.status==='حاضر'||a.status==='متأخر').length; const absent=rows.filter(a=>a.status==='absent'||a.status==='غائب').length; const pct=total?Math.round(present/total*100):0;
  return `<div class="attendance-public-card"><div class="section-head mini"><div><span class="kicker"><span data-icon="calendar"></span> الحضور والغياب</span><h3>ملخص حضور الطالب</h3></div></div><div class="metric-grid parent-metrics-v29"><div class="metric"><b>${total}</b><small>إجمالي الحصص</small></div><div class="metric"><b>${present}</b><small>أيام الحضور</small></div><div class="metric"><b>${absent}</b><small>أيام الغياب</small></div><div class="metric"><b>${pct}%</b><small>نسبة الحضور</small></div></div><div class="mobile-card-table">${rows.slice(0,12).map(r=>`<div class="mobile-row"><b>${esc(r.date||'-')}</b><span class="badge ${statusClass(r.status)}">${arStatus(r.status)}</span><small>${esc(formatTime12(r.time)||'-')} · ${esc(r.group||st.group||'-')}</small></div>`).join('')||'<p class="section-desc">لا توجد سجلات حضور بعد.</p>'}</div><div class="table-wrap attendance-table"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>الوقت</th><th>المجموعة</th></tr></thead><tbody>${rows.slice(0,12).map(r=>`<tr><td>${esc(r.date||'-')}</td><td><span class="badge ${statusClass(r.status)}">${arStatus(r.status)}</span></td><td>${esc(formatTime12(r.time)||'-')}</td><td>${esc(r.group||st.group||'-')}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد سجلات حضور بعد</td></tr>'}</tbody></table></div></div>`;
}
function qrValue(st){return st.studentCode||st.code||'';}
const QR_ALPHA='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
function qrGfTables(){
  const exp=new Array(512).fill(0), log=new Array(256).fill(0); let x=1;
  for(let i=0;i<255;i++){exp[i]=x; log[x]=i; x<<=1; if(x&0x100) x^=0x11d;}
  for(let i=255;i<512;i++) exp[i]=exp[i-255];
  return {exp,log};
}
const QR_GF=qrGfTables();
function qrGfMul(x,y){return (!x||!y)?0:QR_GF.exp[(QR_GF.log[x]+QR_GF.log[y])%255];}
function qrRsDivisor(deg){
  const res=new Array(deg).fill(0); res[deg-1]=1; let root=1;
  for(let i=0;i<deg;i++){
    for(let j=0;j<deg;j++){res[j]=qrGfMul(res[j],root); if(j+1<deg) res[j]^=res[j+1];}
    root=qrGfMul(root,2);
  }
  return res;
}
function qrRsRemainder(data,deg){
  const div=qrRsDivisor(deg), rem=new Array(deg).fill(0);
  for(const b of data){const factor=b^rem.shift(); rem.push(0); for(let i=0;i<deg;i++) rem[i]^=qrGfMul(div[i],factor);}
  return rem;
}
function qrAppendBits(arr,val,len){for(let i=len-1;i>=0;i--) arr.push((val>>>i)&1);}
function qrDataCodewords(text){
  const bits=[]; qrAppendBits(bits,0b0010,4); qrAppendBits(bits,text.length,9);
  for(let i=0;i<text.length;i+=2){
    if(i+1<text.length) qrAppendBits(bits,QR_ALPHA.indexOf(text[i])*45+QR_ALPHA.indexOf(text[i+1]),11);
    else qrAppendBits(bits,QR_ALPHA.indexOf(text[i]),6);
  }
  const capacity=19*8; qrAppendBits(bits,0,Math.min(4,capacity-bits.length));
  while(bits.length%8) bits.push(0);
  const data=[]; for(let i=0;i<bits.length;i+=8){let b=0; for(let j=0;j<8;j++) b=(b<<1)|bits[i+j]; data.push(b);}
  for(let p=0;data.length<19;p++) data.push(p%2?0x11:0xec);
  return data;
}
function qrFormatBits(ecl,mask){
  const data=(ecl<<3)|mask; let rem=data;
  for(let i=0;i<10;i++) rem=(rem<<1)^(((rem>>>9)&1)*0x537);
  return ((data<<10)|rem)^0x5412;
}
function qrMatrix(value){
  const size=21, modules=Array.from({length:size},()=>Array(size).fill(false)), reserved=Array.from({length:size},()=>Array(size).fill(false));
  const set=(x,y,v)=>{if(x>=0&&x<size&&y>=0&&y<size){modules[y][x]=!!v; reserved[y][x]=true;}};
  const finder=(x,y)=>{for(let dy=-1;dy<=7;dy++)for(let dx=-1;dx<=7;dx++){const xx=x+dx, yy=y+dy; if(xx<0||xx>=size||yy<0||yy>=size) continue; const dark=dx>=0&&dx<=6&&dy>=0&&dy<=6&&(dx===0||dx===6||dy===0||dy===6||(dx>=2&&dx<=4&&dy>=2&&dy<=4)); set(xx,yy,dark);}};
  finder(0,0); finder(size-7,0); finder(0,size-7);
  for(let i=8;i<size-8;i++){set(i,6,i%2===0); set(6,i,i%2===0);}
  const f=qrFormatBits(1,0), bit=i=>((f>>>i)&1)===1;
  for(let i=0;i<6;i++) set(8,i,bit(i)); set(8,7,bit(6)); set(8,8,bit(7)); set(7,8,bit(8));
  for(let i=9;i<15;i++) set(14-i,8,bit(i));
  for(let i=0;i<8;i++) set(size-1-i,8,bit(i));
  for(let i=8;i<15;i++) set(8,size-15+i,bit(i));
  set(8,size-8,true);
  const data=qrDataCodewords(value), all=data.concat(qrRsRemainder(data,7)), bits=[];
  for(const b of all) for(let i=7;i>=0;i--) bits.push((b>>>i)&1);
  let idx=0, upward=true;
  for(let x=size-1;x>0;x-=2){
    if(x===6) x--;
    for(let step=0;step<size;step++){
      const y=upward ? size-1-step : step;
      for(const dx of [0,1]){const xx=x-dx; if(!reserved[y][xx]){let v=idx<bits.length?bits[idx++]:0; if((xx+y)%2===0) v^=1; modules[y][xx]=!!v;}}
    }
    upward=!upward;
  }
  return modules;
}
function makeQR(value){
  const text=String(value||'').trim().toUpperCase();
  if(!text || text.length>25 || ![...text].every(ch=>QR_ALPHA.includes(ch))) return `<div class="qr-card real-qr-svg"><span>${esc(text||'NO CODE')}</span></div>`;
  const m=qrMatrix(text), size=21, border=4, total=size+border*2, cell=5;
  let rects='';
  m.forEach((row,y)=>row.forEach((dark,x)=>{if(dark) rects+=`<rect x="${(x+border)*cell}" y="${(y+border)*cell}" width="${cell}" height="${cell}"/>`;}));
  return `<div class="qr-card real-qr-svg" title="${esc(text)}"><svg viewBox="0 0 ${total*cell} ${total*cell}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR ${esc(text)}"><rect width="100%" height="100%" fill="#fff"/><g fill="#0d1730">${rects}</g></svg></div>`;
}
function portalAssignmentQuestions(item){
  if(Array.isArray(item?.questions))return item.questions.map(value=>String(value||'').trim()).filter(Boolean);
  return String(item?.questionsText||'').split(/\n+/).map(value=>value.trim()).filter(Boolean);
}
function cairoPortalDateKey(value=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
  const get=type=>parts.find(part=>part.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function assignmentSubmissionOpenClient(item,now=new Date()){
  const resubmitUntil=Number(item?.resubmissionAllowedUntil?.toMillis?.()||new Date(item?.resubmissionAllowedUntil||0).getTime());
  if(item?.resubmissionAllowed===true&&resubmitUntil>now.getTime())return true;
  if(!assignmentIsReleasedClient(item,now.getTime())||item?.submissionClosed===true)return false;
  const due=String(item?.dueDate||'').trim();
  return !/^\d{4}-\d{2}-\d{2}$/.test(due)||cairoPortalDateKey(now)<=due;
}
function studentTransferStatusLabel(status){return status==='approved'?'تمت الموافقة على النقل':status==='rejected'?'تم رفض الطلب':'الطلب قيد مراجعة المدرس';}
function studentAssignmentDeadline(item,now=Date.now()){
  const reopen=Number(item.resubmissionAllowedUntil?.toMillis?.()||Date.parse(item.resubmissionAllowedUntil));
  if(item.resubmissionAllowed===true&&reopen>now)return cairoPortalDateKey(new Date(reopen));
  return /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate||'')?item.dueDate:'';
}
function studentExamTasks(response){
  const submitted=new Set((response.student?.examAttempts||[]).filter(attempt=>attempt.submittedAt||(attempt.status&&attempt.status!=='started')).map(attempt=>String(attempt.examId)));
  return response.exams.filter(exam=>['open','upcoming'].includes(exam.scheduleState)&&(exam.allowRetake||!submitted.has(String(exam.id))))
    .sort((a,b)=>{
      const openA=a.scheduleState==='open',openB=b.scheduleState==='open';
      if(openA!==openB)return openA?-1:1;
      return (Date.parse(openA?a.closeAt:a.openAt)||Infinity)-(Date.parse(openB?b.closeAt:b.openAt)||Infinity);
    });
}
function studentProfileHTML(raw, isParent=false){
  const st=normalizedStudent(raw); const c=calcStudent(st);
  const monthly=st.monthlyIncentive&&typeof st.monthlyIncentive==='object'?st.monthlyIncentive:{};
  const monthDate=/^\d{4}-\d{2}$/.test(String(monthly.monthKey||''))?new Date(`${monthly.monthKey}-01T12:00:00`):new Date();
  const monthlyLabel=monthDate.toLocaleDateString('ar-EG',{month:'long',year:'numeric'});
  const monthlyRank=Number(monthly.rank)>0?`المركز ${Number(monthly.rank)}`:'ابدأ نشاطك هذا الشهر';
  const pending=/انتظار|قيد التسجيل/.test(String(st.approvalStatus||''));
  const attempts=[...(st.examAttempts||[]),...(appData.examAttempts||[]).filter(a=>normalizeText(a.studentCode)===normalizeText(st.studentCode))];
  const gradeMap=new Map();
  [...(st.grades||[]),...attempts].forEach(item=>{const key=String(item.id||item.attemptId||`${item.examId||item.exam||item.examTitle||'exam'}:${String(item.submittedAt||item.date||'').slice(0,10)}`),current=gradeMap.get(key),hasScore=item.score!==null&&item.score!==undefined&&item.score!=='';if(!current||hasScore||current.score===null||current.score===undefined||current.score==='')gradeMap.set(key,{...(current||{}),...item});});
  const grades=[...gradeMap.values()].sort((a,b)=>String(a.submittedAt||a.date||'').localeCompare(String(b.submittedAt||b.date||''))).reverse();
  const attendance=getAttendanceRows(st);
  const submittedHomeworks=(st.homeworks||[]),submittedByAssignment=new Map(submittedHomeworks.map(item=>[String(item.assignmentId||item.id||''),item])),submittedIds=new Set(submittedHomeworks.filter(item=>item.resubmissionAllowed!==true).map(item=>String(item.assignmentId||item.id||'')));
  const assignedHomeworks=(st.assignments||[]).filter(item=>assignmentIsReleasedClient(item)).map(item=>{const previous=submittedByAssignment.get(String(item.id)),resubmissionAllowed=previous?.resubmissionAllowed===true,resubmissionAllowedUntil=previous?.resubmissionAllowedUntil||'',submitted=submittedIds.has(String(item.id)),open=assignmentSubmissionOpenClient({...item,resubmissionAllowed,resubmissionAllowedUntil});return {...item,assignmentId:item.id,resubmissionAllowed,resubmissionAllowedUntil,status:resubmissionAllowed?'مطلوب إعادة التسليم':submitted?'تم التسليم':open?'مطلوب':'انتهى موعد التسليم',completed:submitted,submissionClosed:!open};});
  const homeworks=[...assignedHomeworks.map(item=>submittedByAssignment.get(String(item.id))?{...item,...submittedByAssignment.get(String(item.id)),title:item.title||submittedByAssignment.get(String(item.id))?.title}:item),...submittedHomeworks.filter(item=>!assignedHomeworks.some(assignment=>String(assignment.id)===String(item.assignmentId||item.id||'')))].slice().reverse();
  const pendingAssignments=assignedHomeworks.filter(item=>!submittedIds.has(String(item.id))&&assignmentSubmissionOpenClient(item));
  const assignmentPicker=pendingAssignments.length?`<label class="homework-assignment-picker"><span>اختر الواجب</span><select name="assignmentId" required><option value="">اختر الواجب الذي ستسلمه</option>${pendingAssignments.map(item=>`<option value="${esc(item.id)}">${esc(item.title||'واجب')} ${item.dueDate?`— ${esc(item.dueDate)}`:''}</option>`).join('')}</select></label>`:'';
  const homeworkUploadForm=pendingAssignments.length?`<form class="homework-upload-form student-upload-card" data-student-code="${esc(st.studentCode)}">${assignmentPicker}<label><span data-icon="upload"></span><span><b>ارفع الواجب</b><small>صورة أو PDF بحد أقصى 10MB</small></span><input type="file" name="file" accept="image/*,application/pdf"></label><small class="homework-draft-status" aria-live="polite">يُحفظ اختيارك والملف تلقائيًا على جهازك حتى نجاح التسليم.</small><button class="btn primary" type="submit"><span data-icon="upload"></span> رفع الملف</button></form>`:'<div class="portal-empty compact-homework-empty"><span class="iconbox" data-icon="user-check"></span><h3>لا توجد واجبات مفتوحة للتسليم</h3><p>الواجبات المسلّمة أو التي انتهى موعدها ستظل ظاهرة في السجل بالأعلى.</p></div>';
  const transferOptions=Array.isArray(st.transferOptions)?st.transferOptions:[],transferRequest=st.transferRequest&&typeof st.transferRequest==='object'?st.transferRequest:null,transferPending=transferRequest?.status==='pending';
  const transferPanel=isParent?'':`<section class="student-tab-panel" data-student-panel="transfer"><div class="student-panel-title"><div><span class="kicker"><span data-icon="user-check"></span> طلب نقل</span><h3>الانتقال إلى مجموعة أخرى</h3></div>${transferRequest?`<span class="badge ${transferRequest.status==='approved'?'good':transferRequest.status==='rejected'?'danger':'warn'}">${studentTransferStatusLabel(transferRequest.status)}</span>`:''}</div>${transferRequest?`<article class="student-transfer-status-card ${esc(transferRequest.status)}"><div><small>آخر طلب</small><h4>${esc(transferRequest.currentGroup||st.group||'-')} ← ${esc(transferRequest.targetGroup||'-')}</h4><p>${esc(transferRequest.reason||'')}</p>${transferRequest.teacherNote?`<small>رد المدرس: ${esc(transferRequest.teacherNote)}</small>`:''}</div></article>`:''}${transferPending?'<div class="portal-empty"><span class="iconbox" data-icon="calendar"></span><h3>طلبك قيد المراجعة</h3><p>لا يمكن إرسال طلب جديد قبل أن يراجع المدرس الطلب الحالي.</p></div>':transferOptions.length?`<form class="student-transfer-form" data-student-code="${esc(st.studentCode)}"><label><span>المجموعة الجديدة</span><select name="targetScheduleId" required><option value="">اختر المجموعة</option>${transferOptions.map(item=>`<option value="${esc(item.id)}">${esc(item.name)} — ${esc(item.days||'')} ${item.startTime?`· ${esc(formatTime12(item.startTime))}`:''}</option>`).join('')}</select></label><label><span>سبب طلب النقل</span><textarea name="reason" rows="4" maxlength="800" required placeholder="مثال: الموعد الحالي يتعارض مع المدرسة أو التدريب"></textarea></label><button class="btn primary" type="submit">إرسال الطلب للمدرس</button></form>`:'<div class="portal-empty"><span class="iconbox" data-icon="calendar"></span><h3>لا توجد مجموعات أخرى متاحة</h3><p>تظهر هنا فقط المجموعات النشطة المطابقة لصفك ونوع دراستك والترم الحالي.</p></div>'}</section>`;
  const recitations=(st.recitations||[]).slice().reverse(),practicals=(st.practicals||[]).slice().reverse();
  const paymentHistory=(st.paymentHistory||[]).slice(0,12);
  const paymentMonth=cairoPortalDateKey().slice(0,7);
  const outstandingPayments=paymentHistory.filter(record=>record.paid===false&&/^\d{4}-\d{2}$/.test(record.monthKey)&&record.monthKey<=paymentMonth);
  const paymentCards=paymentHistory.length?paymentHistory.map(item=>`<article class="student-record-card"><div><span class="record-eyebrow">${esc(item.monthLabel||item.monthKey||'اشتراك')}</span><h4>${item.paid?'تم دفع الاشتراك':'لم يتم الدفع'}</h4><small>${esc(item.paymentDate||'')}${Number(item.amount||0)?` · ${esc(item.amount)} ج.م`:''}</small></div><span class="badge ${item.paid?'good':'warn'}">${item.paid?'مدفوع':'غير مدفوع'}</span></article>`).join(''):'<div class="portal-empty"><span class="iconbox" data-icon="clipboard"></span><h3>لا يوجد سجل اشتراكات بعد</h3><p>سيظهر كل شهر هنا بعد تسجيله من المدرس.</p></div>';
  const initials=String(st.name||'ط').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('');
  const gradeCards=grades.length?grades.slice(0,12).map(g=>{
    const hasScore=g.score!==null&&g.score!==undefined&&g.score!=='';
    const pct=gradePercentage(g),homeworkGrade=isHomeworkGradeClient(g),title=g.exam||g.examTitle||g.title||(homeworkGrade?'واجب':'امتحان');return `<article class="student-record-card grade-record-card"><div><span class="record-eyebrow">${homeworkGrade?'درجة واجب':esc(formatPortalDate(g.date||g.submittedAt))}</span><h4>${esc(title)}</h4><small>${hasScore?`مستوى الطالب ${esc(pct)}%`:'سيظهر التقييم بعد تصحيح المدرس'}</small></div><strong class="score-pill ${hasScore?scoreClass(pct):'warn'}">${hasScore?esc(gradeMark(g)):g.status==='absent'?'غائب':'قيد التصحيح'}</strong></article>`;
  }).join(''):'<div class="portal-empty"><span class="iconbox" data-icon="bar-chart"></span><h3>لا توجد درجات بعد</h3><p>ستظهر نتائج الامتحانات هنا فور تسجيلها.</p></div>';
  const attendanceMonths=[...new Set(attendance.map(r=>String(r.monthKey||r.date||'').slice(0,7)).filter(key=>/^\d{4}-\d{2}$/.test(key)))].sort().reverse();
  const selectedAttendanceMonth=attendanceMonths[0]||cairoPortalDateKey().slice(0,7);
  const attendanceCards=attendance.length?attendance.map(r=>`<article class="student-record-card" data-attendance-record data-month="${esc(String(r.monthKey||r.date||'').slice(0,7))}"><div><span class="record-eyebrow">${esc(formatTime12(r.time)||'موعد الحصة')}</span><h4>${esc(r.date||'-')}</h4><small>${esc(r.group||st.group||'-')}</small></div><span class="badge ${statusClass(r.status)}">${arStatus(r.status)}</span></article>`).join(''):'<div class="portal-empty"><span class="iconbox" data-icon="calendar"></span><h3>لا توجد سجلات حضور</h3><p>يضيف المدرس سجل الحضور، وسيظهر هنا تلقائيًا.</p></div>';
  const attendanceMonthOptions=attendanceMonths.length?attendanceMonths.map(key=>`<option value="${esc(key)}" ${key===selectedAttendanceMonth?'selected':''}>${esc(new Date(`${key}-01T12:00:00`).toLocaleDateString('ar-EG',{month:'long',year:'numeric'}))}</option>`).join(''):`<option value="${esc(selectedAttendanceMonth)}">الشهر الحالي</option>`;
  const homeworkCards=homeworks.length?homeworks.slice(0,12).map(h=>{const questions=portalAssignmentQuestions(h),hasScore=h.score!==null&&h.score!==undefined&&h.score!=='';return `<article class="student-record-card student-assignment-card"><div><span class="record-eyebrow">واجب دراسي</span><h4>${esc(h.title||h.homeworkTitle||'واجب')}</h4>${h.notes?`<small>${esc(h.notes)}</small>`:''}${h.dueDate?`<small>آخر موعد: ${esc(formatPortalDate(h.dueDate))}</small>`:''}${questions.length?`<ol class="student-assignment-questions">${questions.map(question=>`<li>${esc(question)}</li>`).join('')}</ol>`:''}${h.teacherComment?`<small>ملاحظة المدرس: ${esc(h.teacherComment)}</small>`:''}${h.fileUrl?`<a class="small-btn assignment-file-link" href="${esc(h.fileUrl)}" target="_blank" rel="noopener"><span data-icon="file-text"></span> فتح PDF / ملف الواجب</a>`:''}</div><div><span class="badge ${classRecordComplete(h)?'good':'warn'}">${esc(h.status||(classRecordComplete(h)?'تم عمل الواجب':'قيد المتابعة'))}</span>${hasScore?`<strong class="score-pill ${scoreClass(gradePercentage(h))}">${esc(gradeMark(h))}</strong>`:''}</div></article>`;}).join(''):'<div class="portal-empty"><span class="iconbox" data-icon="file-text"></span><h3>لا توجد واجبات مسجلة</h3><p>يمكنك رفع ملف الواجب من الزر الموجود بالأسفل.</p></div>';
  const recitationCards=recitations.length?recitations.slice(0,12).map(r=>`<article class="student-record-card"><div><span class="record-eyebrow">متابعة التسميع</span><h4>${esc(r.title||'تسميع الحصة')}</h4><small>${esc(formatPortalDate(r.date||r.createdAt))}</small></div><span class="badge ${classRecordComplete(r)?'good':'warn'}">${esc(r.status||(classRecordComplete(r)?'تم التسميع':'قيد المتابعة'))}</span></article>`).join(''):'<div class="portal-empty"><span class="iconbox" data-icon="book-open"></span><h3>لا يوجد تسميع مسجل</h3><p>عندما يعلّم المدرس على التسميع سيظهر هنا تلقائيًا.</p></div>';
  const practicalCards=practicals.length?practicals.slice(0,12).map(r=>`<article class="student-record-card"><div><span class="record-eyebrow">متابعة العملي</span><h4>${esc(r.title||'عملي العلوم')}</h4><small>${esc(formatPortalDate(r.date||r.createdAt))}</small></div><span class="badge ${classRecordComplete(r)?'good':'warn'}">${esc(r.status||(classRecordComplete(r)?'تم العملي':'قيد المتابعة'))}</span></article>`).join(''):'<div class="portal-empty"><span class="iconbox" data-icon="clipboard"></span><h3>لا توجد متابعة عملي</h3><p>عندما يسجل المدرس نشاط العملي سيظهر هنا تلقائيًا.</p></div>';
  const learningResources=st.learningResources&&typeof st.learningResources==='object'?st.learningResources:{materials:[],questions:[]},targetedMaterials=Array.isArray(learningResources.materials)?learningResources.materials:[],targetedQuestions=Array.isArray(learningResources.questions)?learningResources.questions:[],resourceCount=targetedMaterials.length+targetedQuestions.length;
  const studentResourceCards=resourceCount?`${targetedMaterials.length?`<div class="student-panel-title"><div><span class="kicker"><span data-icon="book-open"></span> المراجعات</span><h3>ملفات ومراجعات صفك</h3></div><span class="badge">${targetedMaterials.length}</span></div><div class="grid grid-3 resources-grid-v31">${targetedMaterials.map(item=>resourceCard(item,'material')).join('')}</div>`:''}${targetedQuestions.length?`<div class="student-panel-title"><div><span class="kicker"><span data-icon="help-circle"></span> بنك الأسئلة</span><h3>أسئلة مجموعتك</h3></div><span class="badge">${targetedQuestions.length}</span></div><div class="grid grid-3 resources-grid-v31">${targetedQuestions.map(item=>resourceCard(item,'question')).join('')}</div>`:''}`:'<div class="portal-empty"><span class="iconbox" data-icon="book-open"></span><h3>لا توجد مراجعات أو أسئلة مخصصة حاليًا</h3><p>أي محتوى ينشره المدرس لصفك ومجموعتك سيظهر هنا تلقائيًا.</p></div>';
  const onlineLessons=st.deliveryMode==='online'&&Array.isArray(st.onlineContent)?st.onlineContent:[];
  const now=Date.now();
  const nextOnlineLesson=onlineLessons.filter(item=>['upcoming','live'].includes(item.contentType)&&Date.parse(item.startAt)>now)
    .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt))[0];
  const latestRecording=onlineLessons.filter(item=>item.contentType==='recording'&&item.timeUnlocked!==false)
    .sort((a,b)=>(Date.parse(b.startAt)||0)-(Date.parse(a.startAt)||0)||Number(b.lessonOrder||0)-Number(a.lessonOrder||0))[0];
  const nextAssignment=pendingAssignments.map(item=>({item,deadline:studentAssignmentDeadline(item,now)}))
    .sort((a,b)=>(a.deadline||'9999').localeCompare(b.deadline||'9999'))[0];
  const recentCutoff=now-7*24*60*60*1000;
  const isRecent=item=>[item.publishedAt,item.updatedAt,item.createdAt,item.date].some(value=>{const date=Date.parse(value);return date>=recentCutoff&&date<=now;});
  const recentResource=[...targetedMaterials,...targetedQuestions].find(isRecent);
  const recentGrade=grades.find(isRecent);
  const onlineTask=(tab,lesson)=>`data-open-student-tab="lectures" data-lecture-tab="${tab}"${lesson?.id?` data-lecture-target="${esc(lesson.id)}"`:''}`;
  const todayCards=[
    nextAssignment?`<button class="science-today-priority" type="button" data-open-student-tab="homework" data-assignment-target="${esc(nextAssignment.item.id)}"><span data-icon="file-text" aria-hidden="true"></span><span><b>${esc(nextAssignment.item.title||'واجب')}</b><small>${nextAssignment.deadline?`آخر موعد · ${esc(formatPortalDate(nextAssignment.deadline+"T12:00:00"))}`:'واجب مطلوب · بدون موعد محدد'}</small></span><span class="science-today-action">سلّم الواجب</span></button>`:'<p class="science-today-empty">مفيش واجب مفتوح للتسليم حاليًا.</p>',
    '<div class="science-today-exam" data-student-exam-task aria-live="polite"><button type="button" data-open-student-tab="exams"><span data-icon="clipboard" aria-hidden="true"></span><span><b>اختبارات صفك</b><small>المواعيد والنتائج</small></span><span class="science-today-action">عرض</span></button></div>',
    st.deliveryMode==='online'?`<button type="button" ${onlineTask('upcoming',nextOnlineLesson)}><span data-icon="calendar" aria-hidden="true"></span><b>الحصة القادمة</b><small>${nextOnlineLesson?`${esc(nextOnlineLesson.title||'حصة أونلاين')} · ${esc(formatPortalDate(nextOnlineLesson.startAt))}`:'اعرض مواعيد حصص الأونلاين'}</small></button>`:'',
    st.deliveryMode==='online'?`<button type="button" ${onlineTask('recording',latestRecording)}><span data-icon="book-open" aria-hidden="true"></span><b>التسجيلات</b><small>${esc(latestRecording?.title||'اعرض تسجيلات حصصك')}</small></button>`:''
  ].filter(Boolean).join('');
  return `<div class="student-app-dashboard">
    ${pending?`<section class="portal-pending-banner"><span data-icon="calendar"></span><div><b>قيد التسجيل — في انتظار موافقة المدرس</b><small>بياناتك اتسجلت وتقدر تدخل بنفس الكود في أي وقت. الحضور والدرجات هتظهر تلقائيًا بعد الاعتماد.</small></div></section>`:''}
    <section class="student-app-header" tabindex="-1">
      <div class="student-identity"><span class="student-avatar">${esc(initials||'ط')}</span><div><span class="kicker"><span data-icon="user-check"></span> ${isParent?'تقرير ولي الأمر':'مرحبًا بك'}</span><h2>${esc(st.name)}</h2><p>${esc(st.grade||'-')} <span>•</span> ${esc(st.group||'-')}${st.scheduleDays?` <span>•</span> ${esc(st.scheduleDays)}`:''}${st.scheduleStartTime?` <span>•</span> ${esc(formatTime12(st.scheduleStartTime))}`:''}</p><code>${esc(st.studentCode)}</code></div></div>
      <div class="science-student-tools">
        ${isParent||pending?'':`<button class="science-bell" type="button" data-student-bell aria-haspopup="dialog" aria-controls="scienceStudentNotifications" aria-label="إشعارات الطالب"><span data-icon="bell" aria-hidden="true"></span><b hidden aria-hidden="true"></b></button>`}
        <details class="student-qr-details"><summary aria-label="عرض QR الطالب"><span data-icon="qr" aria-hidden="true"></span><span class="student-qr-label">رمز QR</span></summary><div class="real-qr-wrap">${makeQR(qrValue(st))}<small>${esc(qrValue(st))}</small></div></details>
      </div>
    </section>
    ${isParent||pending?'':`<dialog class="science-notification-dialog" id="scienceStudentNotifications" aria-labelledby="scienceStudentNotificationsTitle">
      <div class="science-notification-head"><h2 id="scienceStudentNotificationsTitle">إشعارات الطالب</h2><form method="dialog"><button type="submit" class="science-bell" aria-label="إغلاق الإشعارات">×</button></form></div>
      <div class="science-notification-heading"><h3>رسائل الحساب</h3><button type="button" class="small-btn" data-refresh-student-notices>تحديث</button></div>
      <div class="science-notification-list" data-student-inbox aria-live="polite"></div>
      <p class="science-notification-followup" data-student-followup-count></p>
      <h3>الواجبات المطلوبة</h3>
      <div class="science-notification-list">${pendingAssignments.map(item=>`<button type="button" data-open-student-tab="homework" data-assignment-target="${esc(item.id)}"><span data-icon="file-text" aria-hidden="true"></span><span><strong>${esc(item.title||'واجب')}</strong><small>${item.dueDate?esc('آخر موعد '+formatPortalDate(item.dueDate)):'بدون موعد تسليم محدد'}</small></span></button>`).join('')||'<p>مفيش واجبات مطلوبة حاليًا.</p>'}</div>
      <h3>الامتحانات المتاحة والقادمة</h3><div class="science-notification-list" data-student-next-exam aria-live="polite"></div>
      ${outstandingPayments.length?`<h3>متابعة الاشتراك</h3><div class="science-notification-list">${outstandingPayments.map(record=>`<button type="button" data-open-student-tab="payments" data-student-followup><span data-icon="database" aria-hidden="true"></span><span><strong>${record.monthKey<paymentMonth?'اشتراك متأخر':'اشتراك الشهر غير مدفوع'}</strong><small>${esc(record.monthLabel||record.monthKey)}</small></span></button>`).join('')}</div>`:''}
      ${recentResource||recentGrade?`<h3>آخر التحديثات</h3><div class="science-notification-list">
        ${recentResource?`<button type="button" data-open-student-tab="resources" data-student-followup><span data-icon="book-open" aria-hidden="true"></span><span><strong>محتوى جديد لصفك</strong><small>${esc(recentResource.title||'المراجعات وبنك الأسئلة')}</small></span></button>`:''}
        ${recentGrade?`<button type="button" data-open-student-tab="grades" data-student-followup><span data-icon="bar-chart" aria-hidden="true"></span><span><strong>نتيجة جديدة</strong><small>${esc(recentGrade.exam||recentGrade.examTitle||'الدرجات')}</small></span></button>`:''}
      </div>`:''}
    </dialog>`}
    <div class="science-student-navigation" id="scienceStudentNavigation">
    <nav class="student-tabbar" aria-label="أقسام ملف الطالب">
      <button class="active" type="button" data-student-tab="overview"><span data-icon="sparkles"></span><span>الملخص</span></button>
      ${isParent?'':`<button type="button" data-student-tab="exams"><span data-icon="clipboard"></span><span>الامتحانات</span></button>${st.deliveryMode==='online'?'<button type="button" data-student-tab="lectures"><span data-icon="book-open"></span><span>المحاضرات</span></button>':''}`}
      <button type="button" data-student-tab="homework"><span data-icon="file-text"></span><span>الواجبات</span></button>
      <button type="button" data-student-tab="grades"><span data-icon="bar-chart"></span><span>الدرجات</span></button>
      <button type="button" data-student-tab="attendance"><span data-icon="calendar"></span><span>الحضور</span></button>
      <button type="button" data-student-tab="recitation"><span data-icon="book-open"></span><span>التسميع</span></button>
      <button type="button" data-student-tab="practical"><span data-icon="clipboard"></span><span>العملي</span></button>
      <button type="button" data-student-tab="resources"><span data-icon="book-open"></span><span>المراجعات</span></button>
      ${isParent?'':'<button type="button" data-student-tab="payments"><span data-icon="database"></span><span>الاشتراكات</span></button>'}
      ${isParent?'':'<button type="button" data-student-tab="transfer"><span data-icon="user-check"></span><span>طلب نقل</span></button>'}
    </nav>
    </div>
    ${isParent?'':`<dialog class="science-student-drawer" id="scienceStudentMenu" aria-labelledby="scienceStudentMenuTitle"><div class="science-student-drawer-head"><div><h2 id="scienceStudentMenuTitle">أقسام حسابي</h2><p>${esc(st.name)} · ${esc(st.grade||'')}</p></div><form method="dialog"><button class="science-bell" type="submit" aria-label="إغلاق القائمة"><span data-icon="close" aria-hidden="true"></span></button></form></div><div class="science-student-drawer-foot"></div></dialog>`}
    <section class="student-tab-panel show" data-student-panel="overview">
      ${!isParent&&!pending?`<section class="science-today" aria-labelledby="scienceTodayTitle"><h3 id="scienceTodayTitle">المطلوب دلوقتي</h3><div class="science-today-grid">${todayCards}</div></section>`:''}
      ${!isParent?`<section class="student-kpi-grid science-student-primary-kpis" aria-label="ملخص تقدمك">
        <article><span data-icon="star"></span><b>${Number(monthly.score)||0}%</b><small>تحفيز الشهر</small></article>
        <article><span data-icon="calendar"></span><b>${c.attendancePct}%</b><small>نسبة الحضور</small></article>
        <article><span data-icon="bar-chart"></span><b>${c.avg}%</b><small>متوسط الامتحانات</small></article>
        <article><span data-icon="file-text"></span><b>${c.homeworkPct}%</b><small>انتظام الواجب</small></article>
      </section>`:''}
      ${!isParent&&(st.scheduleDays||st.scheduleStartTime)?`<article class="student-highlight-card"><span class="iconbox" data-icon="calendar"></span><div><small>جدولك الأسبوعي</small><h3>${esc(st.scheduleDays||st.group||'موعد المجموعة')}</h3>${st.scheduleStartTime?`<p>${esc(formatTime12(st.scheduleStartTime))}</p>`:''}</div></article>`:''}
    <section class="monthly-incentive-card ${Number(monthly.activity)>0?'is-active':'is-empty'}">
      <div class="monthly-incentive-title"><span class="iconbox" data-icon="star"></span><div><small>التحفيز الشهري — ${esc(monthlyLabel)}</small><h3>${esc(monthlyRank)}</h3><p>${Number(monthly.rank)>0?`من بين ${Number(monthly.participants||0)} طالب في ${esc(st.grade||'الصف')}`:'سجّل حضورك وحل واجبك وامتحاناتك ليبدأ ترتيبك.'}</p></div></div>
      <div class="monthly-incentive-score"><strong>${Math.max(0,Math.min(100,Number(monthly.score)||0))}%</strong><span>مجموع الشهر</span></div>
      <div class="monthly-incentive-metrics"><span>الحضور <b>${Number(monthly.attendancePct)||0}%</b></span><span>الامتحانات <b>${Number(monthly.gradePct)||0}%</b></span><span>تسليم الواجب <b>${Number(monthly.homeworkPct)||0}%</b></span><span>درجة الواجب <b>${Number(monthly.homeworkGradePct)||0}%</b></span><span>التسميع <b>${Number(monthly.recitationPct)||0}%</b></span></div>
    </section>
    <section class="student-kpi-grid">
      <article><span data-icon="bar-chart"></span><b>${c.final}%</b><small>المستوى العام</small></article>
      ${isParent?`<article><span data-icon="star"></span><b>${c.avg}%</b><small>متوسط الامتحانات</small></article><article><span data-icon="calendar"></span><b>${c.attendancePct}%</b><small>نسبة الحضور</small></article>`:''}
      <article><span data-icon="book-open"></span><b>${c.recitationPct}%</b><small>انتظام التسميع</small></article>
      ${isParent?`<article><span data-icon="file-text"></span><b>${c.homeworkPct}%</b><small>انتظام الواجب</small></article>`:''}
      <article><span data-icon="bar-chart"></span><b>${c.homeworkGradeAvg}%</b><small>متوسط درجة الواجب</small></article>
      <article class="${st.paid?'paid':'unpaid'}"><span data-icon="clipboard"></span><b>${st.paid?'تم الدفع':'لم يتم الدفع'}</b><small>حالة الدفع</small></article>
    </section>
      <div class="student-overview-grid">
        <article class="student-highlight-card"><span class="iconbox" data-icon="sparkles"></span><div><small>تقييمك الحالي</small><h3>${esc(c.level)}</h3><p>استمر في الحضور وحل الامتحانات والتسميع والواجبات لتحسين ترتيبك.</p></div></article>
        <article class="student-highlight-card"><span class="iconbox" data-icon="star"></span><div><small>آخر درجة</small><h3>${c.lastGrade?esc(gradeMark(c.lastGrade)):'لا توجد بعد'}</h3><p>${c.lastGrade?`${esc(c.lastGrade.exam||c.lastGrade.examTitle||'آخر امتحان')} · المستوى ${gradePercentage(c.lastGrade)}%`:'ستظهر آخر نتيجة هنا.'}</p></div></article>
      </div>
      <article class="teacher-note-card"><span data-icon="clipboard"></span><div><small>ملاحظات المدرس</small><p>${esc(st.notes||'لا توجد ملاحظات حالية. استمر في المذاكرة والمتابعة.')}</p></div></article>
      ${isParent?`<details class="student-payment-history"><summary><span data-icon="clipboard"></span><b>سجل الاشتراكات الشهرية</b><span class="badge">${paymentHistory.length}</span></summary><div class="student-record-list">${paymentCards}</div></details>`:''}
      <div class="student-quick-links"><button type="button" data-open-student-tab="resources"><span data-icon="book-open"></span><b>المراجعات وبنك الأسئلة</b><small>${resourceCount?`${resourceCount} محتوى مخصص ليك`:'يظهر محتوى صفك هنا'}</small></button>${isParent||pending?`<a href="exams.html?code=${esc(st.studentCode)}"><span data-icon="clipboard"></span><b>الامتحانات</b><small>عرض الاختبارات والنتائج</small></a>`:''}<a href="index.html#contact"><span data-icon="phone"></span><b>تواصل مع المدرس</b><small>للاستفسار والمتابعة</small></a></div>
    </section>
    <section class="student-tab-panel" data-student-panel="grades"><div class="student-panel-title"><div><span class="kicker"><span data-icon="bar-chart"></span> النتائج</span><h3>درجات الامتحانات</h3></div><span class="badge">${grades.length} نتيجة</span></div><div class="student-record-list">${gradeCards}</div></section>
    <section class="student-tab-panel" data-student-panel="attendance" data-attendance-panel><div class="student-panel-title"><div><span class="kicker"><span data-icon="calendar"></span> المتابعة</span><h3>سجل الحضور والغياب</h3></div><label class="attendance-month-filter"><span>اختر الشهر</span><select data-attendance-month>${attendanceMonthOptions}</select></label></div><div class="attendance-mini-kpis"><span><b data-attendance-total>0</b> إجمالي</span><span><b data-attendance-present>0</b> حاضر</span><span><b data-attendance-absent>0</b> غائب</span><span><b data-attendance-rate>0%</b> نسبة الحضور</span></div><div class="student-record-list">${attendanceCards}</div><div class="portal-empty" data-attendance-empty hidden><h3>لا توجد سجلات في هذا الشهر</h3></div></section>
    <section class="student-tab-panel" data-student-panel="recitation"><div class="student-panel-title"><div><span class="kicker"><span data-icon="book-open"></span> التسميع</span><h3>سجل تسميع الطالب</h3></div><span class="badge good">${c.recitationCount} مرة</span></div><div class="student-record-list">${recitationCards}</div></section>
    <section class="student-tab-panel" data-student-panel="practical"><div class="student-panel-title"><div><span class="kicker"><span data-icon="clipboard"></span> العملي</span><h3>متابعة عملي العلوم</h3></div><span class="badge good">${practicals.filter(classRecordComplete).length} مرة</span></div><div class="student-record-list">${practicalCards}</div></section>
    <section class="student-tab-panel" data-student-panel="homework"><div class="student-panel-title"><div><span class="kicker"><span data-icon="file-text"></span> الواجبات</span><h3>واجبات الطالب</h3></div></div><div class="student-record-list">${homeworkCards}</div>${homeworkUploadForm}</section>
    <section class="student-tab-panel" data-student-panel="resources" id="student-tab-resources">${studentResourceCards}</section>
    ${isParent?'':`<section class="student-tab-panel" data-student-panel="exams"><div class="student-panel-title"><h3>اختباراتي</h3></div><div id="examStudentResult" aria-live="polite"></div></section>
    ${st.deliveryMode==='online'?'<section class="student-tab-panel science-online" data-student-panel="lectures"><div class="student-panel-title"><h3>محاضراتي</h3></div><div data-student-lecture-mount></div></section>':''}`}
    ${isParent?'':`<section class="student-tab-panel" data-student-panel="payments"><div class="student-panel-title"><div><h3>الاشتراكات الشهرية</h3><p>${st.paid?'اشتراك الشهر مدفوع':'دفع الشهر الحالي غير مؤكد'}</p></div><span class="badge">${paymentHistory.length} سجل</span></div><div class="student-record-list">${paymentCards}</div></section>`}
    ${transferPanel}
  </div>`;
}
function bindStudentDashboard(studentCode,student){
  const dashboard=document.querySelector('.student-app-dashboard'); if(!dashboard)return;
  const buttons=[...dashboard.querySelectorAll('[data-student-tab]')];
  const panels=[...dashboard.querySelectorAll('[data-student-panel]')];
  const examBox=dashboard.querySelector('#examStudentResult');
  const lectureMount=dashboard.querySelector('[data-student-lecture-mount]');
  let examRequest,examData,examLoadedAt=0,examRendered,lectureMounted=false;
  function loadExamData(force=false){
    if(examRequest)return examRequest;
    if(!force&&examData&&Date.now()-examLoadedAt<60000)return Promise.resolve(examData);
    examRequest=Promise.resolve().then(()=>window.MFCloud?.getExamDashboard?.(studentCode)).then(response=>{
      if(!response?.student||!Array.isArray(response.exams))throw new Error('Exam schedule unavailable');
      examData=response;
      examLoadedAt=Date.now();
      return response;
    }).finally(()=>{examRequest=null;});
    return examRequest;
  }
  async function openExamPanel(examId){
    if(!examRendered)examBox.textContent='جاري تحميل اختباراتك…';
    try{
      const response=await loadExamData();
      if(!examBox.isConnected||!examBox.closest('[data-student-panel]').classList.contains('show'))return;
      if(examRendered!==response){
        renderExamPortal(response.student,response.exams);
        examRendered=response;
      }
      const card=examId&&document.getElementById(`exam-card-${examId}`);
      if(card){
        card.tabIndex=-1;
        card.focus({preventScroll:true});
        card.scrollIntoView({block:'start'});
      }
    }catch{
      if(!examRendered)examBox.textContent='تعذّر تحميل الاختبارات. افتح القسم تاني للمحاولة.';
    }
  }
  async function openLecturePanel(tab,lessonId){
    try{
      const version=document.querySelector('meta[name="science-online-version"]')?.content;
      await loadLazyScript('student-online-dashboard',version?`assets/online.js?v=${encodeURIComponent(version)}`:'assets/online.js',()=>Boolean(window.MFOnlineDashboard));
      if(!lectureMount.isConnected||!lectureMount.closest('[data-student-panel]').classList.contains('show'))return;
      if(!lectureMounted){
        window.MFOnlineDashboard.mount(lectureMount,student,tab||'upcoming',lessonId);
        lectureMounted=true;
      }else window.MFOnlineDashboard.select(tab,lessonId);
    }catch{lectureMount.textContent='تعذّر فتح المحاضرات. افتح القسم تاني للمحاولة.';lectureMounted=false;}
  }
  bindStudentAccountChrome(dashboard,bindStudentBell(dashboard,studentCode,loadExamData));
  buttons[0]?.setAttribute('aria-current','true');
  function selectPanel(btn,options={}){
    const key=btn.dataset.studentTab;
    buttons.forEach(x=>{x.classList.toggle('active',x===btn);if(x===btn)x.setAttribute('aria-current','true');else x.removeAttribute('aria-current');});
    panels.forEach(x=>x.classList.toggle('show',x.dataset.studentPanel===key));
    const target=dashboard.querySelector(`[data-student-panel="${key}"]`);
    const drawer=dashboard.querySelector('#scienceStudentMenu');
    const wasOpen=drawer?.open;
    if(wasOpen)drawer.close();
    if(window.innerWidth<=980){
      if(wasOpen){
        target?.setAttribute('tabindex','-1');
        target?.focus({preventScroll:true});
      }
      target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    }
    const url=new URL(location.href);
    url.hash=key==='overview'?'':key;
    if(url.searchParams.has('section'))url.searchParams.set('section',key);
    history.replaceState(history.state,'',url);
    if(key==='exams'&&examBox)openExamPanel(options.examTarget);
    if(key==='lectures'&&lectureMount)openLecturePanel(options.lectureTab,options.lectureTarget);
  }
  buttons.forEach(btn=>btn.addEventListener('click',()=>selectPanel(btn)));
  dashboard.addEventListener('click',event=>{
    const control=event.target.closest('[data-open-student-tab]');
    if(!control)return;
    control.closest('dialog')?.close();
    const button=buttons.find(btn=>btn.dataset.studentTab===control.dataset.openStudentTab);
    if(button)selectPanel(button,control.dataset);
    const assignmentId=control.dataset.assignmentTarget;
    if(!assignmentId)return;
    const picker=dashboard.querySelector('.homework-upload-form select[name="assignmentId"]');
    if(picker&&Array.from(picker.options).some(option=>option.value===assignmentId)){
      picker.value=assignmentId;
      picker.dispatchEvent(new Event('change',{bubbles:true}));
      if(control.closest('.science-today')){
        picker.focus({preventScroll:true});
        picker.scrollIntoView({block:'center'});
      }
    }
  });
  const requestedTab=location.hash.slice(1)||new URLSearchParams(location.search).get('section');
  if(requestedTab&&requestedTab!=='overview')buttons.find(button=>button.dataset.studentTab===requestedTab)?.click();
  const monthSelect=dashboard.querySelector('[data-attendance-month]');
  const updateAttendanceMonth=()=>{const panel=dashboard.querySelector('[data-attendance-panel]'),month=monthSelect?.value||'',records=[...panel?.querySelectorAll('[data-attendance-record]')||[]],visible=records.filter(row=>row.dataset.month===month);records.forEach(row=>{row.hidden=row.dataset.month!==month;});const present=visible.filter(row=>row.querySelector('.badge')?.textContent.trim()==='حاضر').length,absent=visible.filter(row=>row.querySelector('.badge')?.textContent.trim()==='غائب').length,total=visible.length,rate=total?Math.round(present/total*100):0;panel?.querySelector('[data-attendance-total]')?.replaceChildren(String(total));panel?.querySelector('[data-attendance-present]')?.replaceChildren(String(present));panel?.querySelector('[data-attendance-absent]')?.replaceChildren(String(absent));panel?.querySelector('[data-attendance-rate]')?.replaceChildren(`${rate}%`);const empty=panel?.querySelector('[data-attendance-empty]');if(empty)empty.hidden=total>0;};
  monthSelect?.addEventListener('change',updateAttendanceMonth);updateAttendanceMonth();
}
function bindStudentAccountChrome(dashboard,bell){
  const header=document.querySelector('.science-student .site-header');
  const actions=header?.querySelector('.header-actions');
  const navigation=dashboard.querySelector('#scienceStudentNavigation');
  const access=document.querySelector('.science-student-access');
  if(!actions||!navigation||!access)return;
  header.classList.add('science-account-header');
  let controls=actions.querySelector('.science-account-controls');
  if(!controls){
    controls=document.createElement('div');
    controls.className='science-account-controls';
    controls.innerHTML='<button type="button" class="science-bell" data-account-sections aria-label="أقسام حسابي" aria-haspopup="dialog" aria-controls="scienceStudentMenu" aria-expanded="false"><span data-icon="menu" aria-hidden="true"></span></button><button type="button" class="science-bell" data-account-code aria-label="الحساب وتغيير الكود"><span data-icon="user" aria-hidden="true"></span></button><button type="button" class="science-account-exit" data-student-logout><span data-icon="log-out" aria-hidden="true"></span>تسجيل الخروج</button>';
    actions.prepend(controls);
    controls.querySelector('[data-student-logout]').onclick=()=>{
      safeStorageRemove(LAST_STUDENT_CODE_KEY);
      safeStorageRemove(LAST_EXAM_CODE_KEY);
      try{
        sessionStorage.removeItem('saad_student_code');
        sessionStorage.removeItem(ADMIN_STUDENT_PREVIEW_KEY);
      }catch{}
      location.replace('student.html?login=1');
    };
    controls.querySelector('[data-account-code]').onclick=()=>{
      access.open=!access.open;
      if(access.open){
        access.scrollIntoView({block:'start'});
        access.querySelector('input[name="query"]')?.focus();
      }
    };
  }
  const sections=controls.querySelector('[data-account-sections]');
  const drawer=dashboard.querySelector('#scienceStudentMenu');
  const nav=navigation.querySelector('nav');
  const logout=controls.querySelector('[data-student-logout]');
  sections.setAttribute('aria-expanded','false');
  if(drawer&&nav){
    sections.onclick=()=>{
      const footer=drawer.querySelector('.science-student-drawer-foot');
      footer.before(nav);
      footer.append(logout);
      drawer.showModal();
      sections.setAttribute('aria-expanded','true');
      nav.querySelector('[aria-current]')?.focus({preventScroll:true});
    };
    drawer.addEventListener('close',()=>{
      navigation.append(nav);
      controls.append(logout);
      sections.setAttribute('aria-expanded','false');
    });
    drawer.addEventListener('click',event=>{if(event.target===drawer)drawer.close();});
  }
  controls.querySelector('[data-student-bell]')?.remove();
  if(bell)controls.insertBefore(bell,controls.querySelector('[data-account-code]'));
}
function bindStudentBell(dashboard,studentCode,loadExamData){
  const bell=dashboard.querySelector('[data-student-bell]');
  const dialog=dashboard.querySelector('#scienceStudentNotifications');
  if(!bell||!dialog)return;
  const examNotice=dialog.querySelector('[data-student-next-exam]');
  const examTask=dashboard.querySelector('[data-student-exam-task]');
  const inbox=dialog.querySelector('[data-student-inbox]');
  const refresh=dialog.querySelector('[data-refresh-student-notices]');
  const badge=bell.querySelector('b');
  const followupCount=dialog.querySelector('[data-student-followup-count]');
  const followups=dialog.querySelectorAll('[data-assignment-target],[data-student-followup]').length;
  let examCount=0;
  let messages=[], inboxLoaded=false;
  function updateBadge(){
    const count=messages.filter(row=>!row.read).length;
    badge.hidden=!count;
    badge.textContent=count>99?'99+':String(count);
    bell.setAttribute('aria-label',count?`إشعارات الطالب، ${count} غير مقروء`:'إشعارات الطالب');
    followupCount.textContent=followups+examCount?`المهام والمتابعات: ${followups+examCount}`:'مفيش مهام أو متابعات حاليًا.';
  }
  function renderInbox(){
    updateBadge();
    inbox.innerHTML=messages.map((row,index)=>`<article class="science-inbox-message" data-unread="${!row.read}">
      <strong>${esc(row.title)}</strong><p>${esc(row.body)}</p>
      <div><small>${esc(formatPortalDate(row.createdAt))}</small><button class="small-btn" type="button" data-notice-index="${index}">${row.read?'علّم كغير مقروء':'علّم كمقروء'}</button></div>
    </article>`).join('')||'<p>مفيش رسائل من المدرس حاليًا.</p>';
  }
  async function loadInbox(){
    if(refresh.disabled)return;
    refresh.disabled=true;
    try{
      const rows=await window.MFCloud?.getStudentAccountNotifications?.(studentCode);
      if(!Array.isArray(rows))throw new Error('Inbox unavailable');
      messages=rows;
      inboxLoaded=true;
      renderInbox();
    }catch{
      if(!inboxLoaded)inbox.textContent='تعذّر تحميل رسائل المدرس. جرّب تحديث.';
      else toast('تعذّر تحديث رسائل المدرس.');
    }finally{refresh.disabled=false;}
  }
  refresh.addEventListener('click',()=>{loadInbox();loadExamNotices(true);});
  inbox.addEventListener('click',async event=>{
    const button=event.target.closest('[data-notice-index]');
    const row=messages[Number(button?.dataset.noticeIndex)];
    if(!row||refresh.disabled)return;
    refresh.disabled=true;
    button.disabled=true;
    try{
      const result=await window.MFCloud?.setStudentAccountNotificationRead?.(studentCode,{id:row.id,audienceKey:row.audienceKey,read:!row.read});
      if(typeof result?.read!=='boolean')throw new Error('Inbox unavailable');
      row.read=result.read;
      renderInbox();
      inbox.querySelector(`[data-notice-index="${button.dataset.noticeIndex}"]`)?.focus();
    }catch{toast('تعذّر حفظ حالة الإشعار.');}
    finally{refresh.disabled=false;button.disabled=false;}
  });
  let loading=false, lastLoaded=0;
  async function loadExamNotices(force=false){
    if(loading||(!force&&Date.now()-lastLoaded<60000))return;
    loading=true;
    examNotice.textContent='جاري تحميل موعد الامتحان…';
    try{
      const response=await loadExamData(force);
      const exams=studentExamTasks(response);
      examCount=exams.length;
      examNotice.innerHTML=exams.map(exam=>`<button type="button" data-open-student-tab="exams" data-exam-target="${esc(exam.id)}"><span data-icon="clipboard" aria-hidden="true"></span><span><strong>${esc(exam.title||'امتحان')}</strong><small>${esc(examScheduleLabel(exam))}</small></span></button>`).join('')||'<p>مفيش امتحان متاح أو قادم حاليًا.</p>';
      if(examTask){
        const nextExam=exams[0],link=examTask.querySelector('button');
        const isOpen=nextExam?.scheduleState==='open';
        examTask.classList.toggle('is-open-exam',isOpen);
        if(isOpen&&examTask.previousElementSibling)examTask.parentElement.prepend(examTask);
        else if(!isOpen&&!examTask.previousElementSibling)examTask.nextElementSibling?.after(examTask);
        if(nextExam){
          link.dataset.examTarget=nextExam.id;
          link.querySelector('b').textContent=nextExam.title||'امتحان';
          link.querySelector('small').textContent=examScheduleLabel(nextExam);
          link.querySelector('.science-today-action').textContent=nextExam.scheduleState==='open'?'افتح الامتحان':'عرض الموعد';
        }else{
          delete link.dataset.examTarget;
          link.querySelector('b').textContent='اختبارات صفك';
          link.querySelector('small').textContent='مفيش امتحان متاح أو قادم حاليًا';
          link.querySelector('.science-today-action').textContent='عرض';
        }
      }
      updateBadge();
      hydrateIcons();
      lastLoaded=Date.now();
    }catch{
      examNotice.textContent='تعذّر تحميل الموعد. اقفل الإشعارات وافتحها تاني للمحاولة.';
    }finally{loading=false;}
  }
  bell.addEventListener('click',()=>{
    dialog.showModal();
    if(!inboxLoaded)loadInbox();
    loadExamNotices();
  });
  updateBadge();
  if(window.MFCloud?.getStudentAccountNotifications)loadInbox();
  if(examTask&&window.MFCloud?.getExamDashboard)loadExamNotices();
  return bell;
}
var portalStudentCache=new Map();
async function loadStudentForPortal(code){
  const key=normalizeText(code), cached=portalStudentCache.get(key);
  if(cached&&Date.now()-cached.time<5000)return cached.student;
  const staffPreview=readAdminStudentPreview(code);
  if(staffPreview){portalStudentCache.set(key,{student:staffPreview,time:Date.now()});return staffPreview;}
  if(window.MFCloud?.ready && window.MFCloud.getStudentByCode){
    const student=await window.MFCloud.getStudentByCode(code);
    if(student)portalStudentCache.set(key,{student,time:Date.now()});
    return student;
  }
  if(window.MF_FIREBASE_CONFIG?.useSecureFunctions===false){
    const student=findStudentByCode(code);if(student)portalStudentCache.set(key,{student,time:Date.now()});return student;
  }
  throw new Error('Secure student portal is unavailable');
}
var pendingStudentAttendanceToken='';
var scheduledAssignmentRefreshTimer=0;
function scheduleAssignmentReleaseRefresh(publishAt,form){
  clearTimeout(scheduledAssignmentRefreshTimer);scheduledAssignmentRefreshTimer=0;
  const millis=assignmentPublishMillis(publishAt);if(!millis||!form)return;
  const remaining=millis-Date.now()+1500,delay=Math.max(1500,Math.min(remaining,6*60*60*1000));
  const refresh=()=>{
    if(!form.isConnected)return;
    if(protectedStudentWorkflowActive()){
      scheduledAssignmentRefreshTimer=setTimeout(refresh,15000);
      return;
    }
    form.requestSubmit();
  };
  scheduledAssignmentRefreshTimer=setTimeout(refresh,delay);
}
function showStudentAttendanceBanner(message,success=false){const form=document.getElementById('studentSearchForm');if(!form)return;let banner=document.getElementById('attendanceClaimBanner');if(!banner){form.insertAdjacentHTML('beforebegin','<div class="card attendance-claim-banner" id="attendanceClaimBanner"></div>');banner=document.getElementById('attendanceClaimBanner');}banner.classList.toggle('success',success);banner.innerHTML=`<span class="iconbox" data-icon="${success?'user-check':'qr'}"></span><div><b>${success?'تم تسجيل حضورك بنجاح':'تسجيل حضور حصة الأونلاين'}</b><p>${esc(message)}</p></div>`;hydrateIcons();}
function installStudentNotificationButton(root,studentCode){
  if(!root||!('Notification'in window)||root.querySelector('.student-push-button'))return;
  const host=root.querySelector('#scienceStudentNotifications');if(!host||!window.MF_FIREBASE_CONFIG?.messagingVapidKey)return;
  host.insertAdjacentHTML('beforeend',`<button class="btn ghost student-push-button" type="button" onclick="enableStudentNotifications('${esc(studentCode)}')"><span data-icon="sparkles"></span> تفعيل تنبيهات الامتحانات والواجبات</button>`);hydrateIcons();
}
async function ensureStudentMessagingRuntime(){
  if(typeof firebase!=='undefined'&&typeof firebase.messaging==='function')return true;
  await loadLazyScript('firebase-messaging','assets/vendor/firebase-messaging-compat.js',()=>typeof firebase!=='undefined'&&typeof firebase.messaging==='function');return true;
}
window.enableStudentNotifications=async function(studentCode){
  const cfg=window.MF_FIREBASE_CONFIG||{};
  if(!cfg.messagingVapidKey)return toast('أضف Web Push VAPID Key في إعداد Firebase أولًا');
  if(!('Notification'in window)||!('serviceWorker'in navigator))return toast('المتصفح لا يدعم إشعارات الخلفية');
  try{
    const permission=await Notification.requestPermission();if(permission!=='granted')return toast('اسمح بالإشعارات من إعدادات المتصفح');
    await ensureStudentMessagingRuntime();let registration=await navigator.serviceWorker.getRegistration('/');if(!registration)registration=await navigator.serviceWorker.register('/service-worker.js',{scope:'/',updateViaCache:'none'});registration=registration.active?registration:await navigator.serviceWorker.ready;
    const token=await firebase.messaging().getToken({vapidKey:cfg.messagingVapidKey,serviceWorkerRegistration:registration});if(!token)throw new Error('TOKEN_UNAVAILABLE');
    await window.MFCloud?.registerStudentPushToken?.(studentCode,token);safeStorageSet(`mf_student_push_${studentCode}`,'1');toast('تم تفعيل تنبيهات الامتحانات والواجبات والمحاضرات');
  }catch(error){toast(firebaseFriendlyError(error,'تعذر تفعيل الإشعارات الآن'));}
};
async function setupStudent(){
  const form=document.getElementById('studentSearchForm'); if(!form) return;
  const input=form.querySelector('[name="query"],#studentQuery'),params=new URLSearchParams(location.search);
  const explicitLogin=params.get('login')==='1';
  pendingStudentAttendanceToken=String(params.get('attendance')||'').trim();
  const quickCode=explicitLogin?'':toEnglishDigits(params.get('code')||safeStorageGet(LAST_STUDENT_CODE_KEY)||'').trim().toUpperCase();
  if(pendingStudentAttendanceToken)showStudentAttendanceBanner('اكتب كود الطالب أو امسح QR الطالب لإتمام الحضور.');
  if(input && quickCode)input.value=quickCode;
  input?.addEventListener('input',()=>{input.value=toEnglishDigits(input.value).toUpperCase().replace(/\s+/g,'');});
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const code=toEnglishDigits(input?.value).trim().toUpperCase(),box=document.getElementById('studentResult'),button=form.querySelector('[type="submit"]');
    if(!code) return toast(pendingStudentAttendanceToken?'اكتب كودك أو امسح QR الطالب لتسجيل الحضور':'اكتب كود الطالب أولًا');
    button?.classList.add('is-loading'); if(button)button.disabled=true; form.setAttribute('aria-busy','true');
    document.querySelector('.science-account-controls [data-student-bell]')?.remove();
    box.innerHTML='<div class="portal-loading"><span></span><b>جاري تحميل ملف الطالب...</b><small>لحظات بسيطة</small></div>';
    try{
      const st=await loadStudentForPortal(code);
      if(!st){box.innerHTML=`<div class="portal-empty portal-empty-large"><span class="iconbox" data-icon="search"></span><h3>الكود غير صحيح</h3><p>راجع الكود المكتوب وحاول مرة أخرى، مع التأكد من الحروف والأرقام.</p><button class="btn ghost" type="button" onclick="document.getElementById('studentQuery')?.focus()">إعادة المحاولة</button></div>`; hydrateIcons(); return;}
      safeStorageSet(LAST_STUDENT_CODE_KEY,code);
      try{if(st.deliveryMode==='online')sessionStorage.setItem('saad_student_code',code);else sessionStorage.removeItem('saad_student_code');}catch(_){}
      let attendanceError=null;
      if(pendingStudentAttendanceToken){
        try{if(!window.MFCloud?.claimAttendanceSession)throw new Error('Attendance claim service is unavailable');const result=await window.MFCloud.claimAttendanceSession(pendingStudentAttendanceToken,code);showStudentAttendanceBanner(result?.alreadyPresent?'أنت مسجل حضور بالفعل في هذه الحصة.':`${result?.studentName||st.name||''} · ${result?.time||'الآن'}`,true);pendingStudentAttendanceToken='';const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('attendance');cleanUrl.searchParams.set('code',code);history.replaceState({},'',cleanUrl);}
        catch(error){attendanceError=error;showStudentAttendanceBanner(firebaseFriendlyError(error,'تعذر تسجيل الحضور. تأكد أن الباركود خاص بموعدك.'));}
      }
      if(explicitLogin){
        const accountUrl=new URL(location.href);
        accountUrl.searchParams.delete('login');
        accountUrl.searchParams.delete('code');
        history.replaceState(history.state,'',accountUrl);
      }
      box.innerHTML=studentProfileHTML(st,false); applyStudentModeVisibility(box,st); installStudentNotificationButton(box,code); bindStudentDashboard(code,st); bindHomeworkForms(); bindStudentTransferForms(form,code); scheduleAssignmentReleaseRefresh(st.nextAssignmentPublishAt,form); hydrateIcons();
      const access=form.closest('.science-student-access');
      if(access){
        access.dataset.accountReady='true';
        if(!params.has('attendance')){
          if(access.contains(document.activeElement))box.querySelector('.student-app-header')?.focus({preventScroll:true});
          access.open=false;
        }
      }
      if(attendanceError)toast('فتحت البوابة، لكن تعذر تسجيل الحضور');
      box.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){const raw=String(err?.code||'')+' '+String(err?.message||'');const message=/not-found/i.test(raw)?'كود الطالب غير موجود أو لم يُعتمد بعد':/internal|unavailable|failed-precondition|function.*unavailable/i.test(raw)?'خدمة بوابة الطالب غير متاحة حاليًا':firebaseFriendlyError(err,'تعذر تحميل بيانات الطالب');box.innerHTML=dataErrorHTML(message);hydrateIcons();}
    finally{button?.classList.remove('is-loading'); if(button)button.disabled=false; form.removeAttribute('aria-busy');}
  });
  if(quickCode&&!form.dataset.autoLoaded){form.dataset.autoLoaded='true';setTimeout(()=>form.requestSubmit(),120);}
}
function applyStudentModeVisibility(root,student){
  if(!root||!student)return;
  const mode=student.deliveryMode==='online'?'online':'center';
  root.dataset.studentMode=mode;
  if(mode==='center'){
    root.querySelectorAll('a[href*="online.html"],.next-class-card').forEach(node=>node.remove());
    root.querySelectorAll('.student-home-grid > section').forEach(section=>{
      if(section.querySelector('.student-widget-title h3')?.textContent.trim()==='أحدث التسجيلات')section.remove();
    });
  }
  const settings=appData.settings||{};
  if(student.paid!==true&&(settings.vodafoneCashNumber||settings.instapayAccount)){
    const methods=[settings.vodafoneCashNumber?`<span><b>Vodafone Cash</b><code>${esc(settings.vodafoneCashNumber)}</code></span>`:'',settings.instapayAccount?`<span><b>InstaPay</b><code dir="ltr">${esc(settings.instapayAccount)}</code></span>`:''].join('');
    (root.querySelector('[data-student-panel="payments"]')||root.querySelector('.student-profile'))?.insertAdjacentHTML('beforeend',`<section class="student-payment-guide"><div><span class="kicker">طرق دفع الاشتراك</span><h3>${esc(settings.paymentReceiverName||'تحويل الاشتراك')}</h3><p>${esc(settings.paymentInstructions||'أرسل صورة التحويل على واتساب مع اسم الطالب والكود.')}</p></div><div class="student-payment-methods">${methods}</div></section>`);
  }
}
var parentQrScanner = null;
var lastParentStudent = null;

async function preferredQrCameraSource(){
  if(typeof window.Html5Qrcode?.getCameras!=='function')return {facingMode:{ideal:'environment'}};
  try{
    const cameras=await window.Html5Qrcode.getCameras();
    if(!Array.isArray(cameras)||!cameras.length)return {facingMode:{ideal:'environment'}};
    const rear=cameras.find(camera=>/back|rear|environment|خلف/i.test(String(camera.label||'')));
    return String((rear||cameras[cameras.length-1]).id||'')||{facingMode:{ideal:'environment'}};
  }catch(error){return {facingMode:{ideal:'environment'}};}
}
async function startHtml5QrCamera(scanner,config,onDecoded,onError=()=>{}){
  const source=await preferredQrCameraSource();
  try{return await scanner.start(source,config,onDecoded,onError);}
  catch(error){
    if(typeof source==='string')return scanner.start({facingMode:{ideal:'environment'}},config,onDecoded,onError);
    throw error;
  }
}

async function parentQrDecoded(rawValue){
  const payload=parseUnifiedStudentQr(rawValue);
  if(!payload)throw new Error('unknown-qr');
  if(payload.type!=='student')throw new Error('attendance-qr');
  await closeParentQrScanner();
  await showParentReportByCode(payload.code);
}

function studentReportRows(st){
  const monthKey=/^\d{4}-\d{2}$/.test(String(st?.monthlyIncentive?.monthKey||''))?String(st.monthlyIncentive.monthKey):cairoPortalDateKey().slice(0,7);
  const recordMonth=row=>String(row?.monthKey||row?.date||row?.submittedAt||row?.gradedAt||row?.createdAt||'').slice(0,7);
  const inMonth=rows=>(Array.isArray(rows)?rows:[]).filter(row=>recordMonth(row)===monthKey);
  const allGradeMap=new Map();
  [...(st.grades||[]),...(st.examAttempts||[])].forEach(item=>{const key=String(item.id||item.attemptId||item.sourceId||`${item.examId||item.assignmentId||item.title||'grade'}:${item.submittedAt||item.date||''}`),current=allGradeMap.get(key),hasScore=item.score!==null&&item.score!==undefined&&item.score!=='';if(!current||hasScore)allGradeMap.set(key,{...(current||{}),...item});});
  const allGrades=[...allGradeMap.values()].sort((a,b)=>String(a.submittedAt||a.date||'').localeCompare(String(b.submittedAt||b.date||'')));
  return {
    monthKey,
    attendance:inMonth(getAttendanceRows(st)),
    grades:inMonth(allGrades),
    homeworks:inMonth(st.homeworks),
    recitations:inMonth(st.recitations),
    practicals:inMonth(st.practicals),
    latestExams:allGrades.filter(row=>!isHomeworkGradeClient(row)&&row.type!=='practical').slice(-6).reverse()
  };
}

function parentReportText(raw){
  const st = normalizedStudent(raw);
  const rows = studentReportRows(st);
  const c = calcStudent({...st,attendance:rows.attendance,grades:rows.grades,homeworks:rows.homeworks,recitations:rows.recitations});
  const list=(items,format,empty)=>items.length?items.map(item=>`- ${format(item)}`).join('\n'):`- ${empty}`;
  const grades=list(rows.grades,g=>`${g.title||g.exam||g.examTitle||(isHomeworkGradeClient(g)?'واجب':'امتحان')}: ${g.status==='absent'?'غائب':g.score===null||g.score===undefined?'قيد التصحيح':gradeMark(g)+' ('+gradePercentage(g)+'%)'}`,'لا توجد درجات خلال الشهر');
  const attendance=list(rows.attendance,r=>`${r.date||'-'}: ${arStatus(r.status)}${r.time?' ('+formatTime12(r.time)+')':''}`,'لا توجد سجلات حضور خلال الشهر');
  const homeworks=list(rows.homeworks,h=>`${h.title||h.assignmentTitle||'واجب'}: ${h.status||(classRecordComplete(h)?'تم التسليم':'مطلوب')}${h.score!==null&&h.score!==undefined?' — الدرجة '+gradeMark(h):''}`,'لا توجد واجبات خلال الشهر');
  const recitations=list(rows.recitations,r=>`${r.date||formatPortalDate(r.createdAt)||'-'}: ${r.status||'تم التسميع'}`,'لا يوجد تسميع خلال الشهر');
  const practicals=list(rows.practicals,r=>`${r.title||'عملي العلوم'}: ${r.status||'تم العملي'}${r.score!==null&&r.score!==undefined?' — '+gradeMark(r):''}`,'لا توجد متابعة عملي خلال الشهر');
  return `أهلًا بحضرتك، مع حضرتك المستر سعد عويضة، مدرس الأحياء والعلوم والعلوم المتكاملة. ده تقرير المتابعة الشهري للطالب/ة ${st.name||'-'} عن شهر ${monthLabel(st)}.\n\nبيانات الطالب:\n- الكود الموحد: ${st.studentCode||'-'}\n- الصف: ${st.grade||'-'}\n- المجموعة: ${st.group||'-'}\n\nملخص الشهر:\n- المستوى العام: ${c.final}% — ${c.level}\n- نسبة الحضور: ${c.attendancePct}%\n- متوسط الامتحانات: ${c.avg}%\n- نسبة تسليم الواجب: ${c.homeworkPct}%\n- متوسط درجة الواجب: ${c.homeworkGradeAvg}%\n- انتظام التسميع: ${c.recitationPct}%\n- التحفيز الشهري: ${Number(st.monthlyIncentive?.score)||0}%${Number(st.monthlyIncentive?.rank)>0?` — المركز ${Number(st.monthlyIncentive.rank)}`:''}\n- حالة الاشتراك: ${st.paymentRecorded===false?'مفيش سجل دفع للشهر ده':st.paid?'تم الدفع':'لم يتم الدفع'}\n\nكل درجات الشهر:\n${grades}\n\nآخر الامتحانات:\n${list(rows.latestExams,g=>`${g.exam||g.examTitle||'امتحان'}: ${g.status==='absent'?'غائب':g.score===null||g.score===undefined?'قيد التصحيح':gradeMark(g)+' ('+gradePercentage(g)+'%)'}`,'لا توجد امتحانات سابقة')}\n\nالواجبات:\n${homeworks}\n\nالحضور والغياب:\n${attendance}\n\nالتسميع:\n${recitations}\n\nالعملي:\n${practicals}\n\nملاحظات المدرس:\n${st.notes||'لا توجد ملاحظات حالية.'}\n\nمع تحيات المستر سعد عويضة`;
}

let reportFontBase64='';
async function loadReportFont(){
  if(reportFontBase64)return reportFontBase64;
  const buffer=await fetch('assets/vendor/DejaVuSans.ttf').then(response=>{if(!response.ok)throw new Error('تعذر تحميل خط التقرير');return response.arrayBuffer();});
  const bytes=new Uint8Array(buffer);let binary='';for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
  reportFontBase64=btoa(binary);return reportFontBase64;
}
window.createParentReportPdf=async function(raw){
  await loadLazyScript('jspdf','assets/vendor/jspdf.umd.min.js',()=>Boolean(window.jspdf?.jsPDF));
  const st=normalizedStudent(raw),jsPDF=window.jspdf?.jsPDF;
  if(!jsPDF)throw new Error('مكتبة PDF غير جاهزة');
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  doc.addFileToVFS('DejaVuSans.ttf',await loadReportFont());doc.addFont('DejaVuSans.ttf','DejaVu','normal');doc.setFont('DejaVu');doc.setR2L(true);
  const right=195,center=105;
  const drawHeader=()=>{doc.setFillColor(12,87,96);doc.rect(0,0,210,34,'F');doc.setTextColor(255,255,255);doc.setFontSize(17);doc.text('منصة المستر سعد عويضة',center,14,{align:'center'});doc.setFontSize(12);doc.text(`تقرير ولي الأمر الشهري — ${monthLabel(st)}`,center,25,{align:'center'});doc.setTextColor(20,35,45);};
  drawHeader();doc.setFontSize(10.5);let y=43;
  const reportLines=parentReportText(st).split('\n');
  reportLines.forEach(rawLine=>{const line=String(rawLine||' '),wrapped=doc.splitTextToSize(line,178);if(y+wrapped.length*6>282){doc.addPage();drawHeader();doc.setFontSize(10.5);y=43;}doc.text(wrapped,right,y,{align:'right',maxWidth:178});y+=Math.max(5.5,wrapped.length*5.5);});
  const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page+=1){doc.setPage(page);doc.setFontSize(8);doc.setTextColor(90,105,110);doc.text(`صفحة ${page} من ${pages} — ${new Date().toLocaleDateString('ar-EG')}`,center,291,{align:'center'});}
  return doc.output('blob');
};
window.shareParentReportPdf=async function(raw,phone){
  const st=normalizedStudent(raw),blob=await createParentReportPdf(st),file=new File([blob],`تقرير-${String(st.name||st.studentCode).replace(/[\\/:*?"<>|]/g,'-')}.pdf`,{type:'application/pdf'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:`تقرير ${st.name}`,text:'تقرير المتابعة الشهري من منصة المستر سعد عويضة'});return 'shared';}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  if(phone)window.open(whatsappLink(phone,'تم تجهيز تقرير المتابعة الشهري بصيغة PDF. أرفق الملف الذي تم تنزيله في هذه المحادثة.'),'_blank');
  return 'downloaded';
};

function parentReportHTML(raw){
  const st = normalizedStudent(raw);
  const rows = studentReportRows(st);
  const c = calcStudent({...st,attendance:rows.attendance,grades:rows.grades,homeworks:rows.homeworks,recitations:rows.recitations});
  const grades = rows.grades.slice().reverse();
  const hw = rows.homeworks.slice().reverse();
  const recitations = rows.recitations.slice().reverse();
  const practicals = rows.practicals.slice().reverse();
  const latestExams = rows.latestExams;
  const latestScored = grades.find(item=>item.score!==null&&item.score!==undefined&&item.score!=='');
  const payClass = st.paid ? 'good' : 'danger';
  const teacherName = appData.settings?.teacherName || 'المستر سعد عويضة';
  const today = new Date().toLocaleDateString('ar-EG');
  return `<div class="parent-monthly-report-v40" id="parentMonthlyReport">
    <div class="parent-report-cover-v40">
      <div class="parent-report-brand-v40">
        <span class="teacher-name-v40">${esc(teacherName)}</span>
        <span class="report-date-v40">${esc(today)}</span>
      </div>
      <div class="parent-report-cover-content-v40">
        <div class="parent-report-main-v40">
          <span class="kicker"><span data-icon="file-text"></span> تقرير ولي الأمر الشهري</span>
          <h2>${esc(st.name || '-')}</h2>
          <p>تقرير متابعة شهر <b>${esc(monthLabel(st))}</b> · كود الطالب: <b>${esc(st.studentCode)}</b></p>
          <div class="parent-report-tags-v40">
            <span>${esc(st.grade || '-')}</span>
            <span>${esc(st.group || '-')}</span>
            <span class="badge ${payClass}">${st.paymentRecorded===false?'مفيش سجل دفع للشهر ده':st.paid?'تم الدفع':'لم يتم الدفع'}</span>
          </div>
        </div>
        <div class="parent-report-qr-v40"><b>QR الطالب</b>${makeQR(qrValue(st))}<small>${esc(qrValue(st))}</small></div>
      </div>
    </div>
    <div class="parent-status-card-v40 good"><p>أهلًا بحضرتك، مع حضرتك المستر سعد عويضة، مدرس الأحياء والعلوم والعلوم المتكاملة. ده تقرير المتابعة الشهري للطالب/ة <b>${esc(st.name||'-')}</b> عن شهر <b>${esc(monthLabel(st))}</b>.</p></div>
    <div class="parent-actions-v38 no-print">
      <button class="btn primary" onclick="printParentReport()"><span data-icon="file-text"></span> طباعة / حفظ PDF</button>
      <button class="btn ghost" onclick="copyParentReport('${esc(st.studentCode)}')"><span data-icon="clipboard"></span> نسخ التقرير</button>
      ${st.parentPhone?`<button class="btn whatsapp-report-btn" onclick="openParentWhatsApp('${esc(st.studentCode)}')"><span data-icon="phone"></span> إرسال واتساب</button>`:''}
    </div>
    <section aria-label="ملخص متابعة الشهر">
      <h3>ملخص المتابعة</h3>
      <div class="science-parent-summary">
        <div><small>الغياب المسجّل الشهر ده</small><b>${rows.attendance.filter(item=>item.status==='absent'||item.status==='غائب'||item.status===false).length} حصة</b></div>
        <div><small>أحدث درجة مسجّلة الشهر ده</small><b>${latestScored?esc(gradeMark(latestScored)):'مفيش درجة مسجّلة'}</b></div>
        <div><small>تسليمات الواجب الشهر ده</small><b>${hw.length} تسليم</b></div>
      </div>
    </section>
    <div class="metric-grid parent-report-metrics-v40">
      <div class="metric main-metric-v40"><b>${c.final}%</b><small>المستوى العام</small></div>
      <div class="metric"><b>${c.attendancePct}%</b><small>نسبة الحضور</small></div>
      <div class="metric"><b>${c.avg}%</b><small>متوسط الدرجات</small></div>
      <div class="metric"><b>${c.homeworkGradeAvg}%</b><small>متوسط درجة الواجب</small></div>
      <div class="metric"><b>${c.recitationPct}%</b><small>انتظام التسميع</small></div>
      <div class="metric"><b>${c.homeworkPct}%</b><small>انتظام الواجب</small></div>
      <div class="metric"><b>${c.totalAttendance}</b><small>إجمالي الحصص</small></div>
    </div>
    <div class="parent-status-card-v40 ${c.final>=75?'good':'warn'}">
      <div><span>الحالة العامة</span><h3>${esc(c.level)}</h3></div>
      <p>${c.final>=75?'المستوى مطمئن، حافظوا على نفس الالتزام.':'محتاج متابعة منتظمة في الحضور والتسميع والواجبات والدرجات.'}</p>
    </div>
    <div class="monthly-incentive-card ${Number(st.monthlyIncentive?.activity)>0?'is-active':'is-empty'}"><div class="monthly-incentive-title"><span class="iconbox" data-icon="star"></span><div><small>التحفيز الشهري</small><h3>${Number(st.monthlyIncentive?.rank)>0?`المركز ${Number(st.monthlyIncentive.rank)}`:'لم يبدأ الترتيب بعد'}</h3></div></div><div class="monthly-incentive-score"><strong>${Number(st.monthlyIncentive?.score)||0}%</strong><span>مجموع الشهر</span></div><div class="monthly-incentive-metrics"><span>الحضور <b>${Number(st.monthlyIncentive?.attendancePct)||0}%</b></span><span>الامتحانات <b>${Number(st.monthlyIncentive?.gradePct)||0}%</b></span><span>تسليم الواجب <b>${Number(st.monthlyIncentive?.homeworkPct)||0}%</b></span><span>درجة الواجب <b>${Number(st.monthlyIncentive?.homeworkGradePct)||0}%</b></span><span>التسميع <b>${Number(st.monthlyIncentive?.recitationPct)||0}%</b></span></div></div>
    ${attendanceSummaryHTML({...st,attendance:rows.attendance})}
    <div class="parent-detail-grid-v40">
      <div class="mini-panel parent-panel-v40">
        <h3>الدرجات والامتحانات</h3>
        ${grades.length?grades.map(g=>`<div class="report-list-row-v40"><div><b>${esc(g.title||g.exam||g.examTitle||(isHomeworkGradeClient(g)?'واجب':'امتحان'))}</b><small>${esc(g.date||g.submittedAt||'')} · المستوى ${gradePercentage(g)??'-'}%</small></div><span class="badge ${g.score!==null&&g.score!==undefined?'good':'warn'}">${g.score!==null&&g.score!==undefined?esc(gradeMark(g)):g.status==='absent'?'غائب':'بانتظار التصحيح'}</span></div>`).join(''):'<p class="section-desc">لا توجد درجات خلال هذا الشهر.</p>'}
      </div>
      <div class="mini-panel parent-panel-v40"><h3>آخر الامتحانات</h3>${latestExams.length?latestExams.map(g=>`<div class="report-list-row-v40"><div><b>${esc(g.exam||g.examTitle||'امتحان')}</b><small>${esc(formatPortalDate(g.date||g.submittedAt))}</small></div><span class="badge ${g.score!==null&&g.score!==undefined?'good':'warn'}">${g.score!==null&&g.score!==undefined?esc(gradeMark(g)):g.status==='absent'?'غائب':'قيد التصحيح'}</span></div>`).join(''):'<p class="section-desc">لا توجد امتحانات سابقة.</p>'}</div>
      <div class="mini-panel parent-panel-v40">
        <h3>الواجبات والمتابعة</h3>
        ${hw.length?hw.map(h=>`<div class="report-list-row-v40"><div><b>${esc(h.title||h.homeworkTitle||'واجب')}</b><small>${esc(formatPortalDate(h.date||h.submittedAt))}${h.teacherComment?` · ${esc(h.teacherComment)}`:''}</small></div><span class="badge ${classRecordComplete(h)?'good':'warn'}">${h.score!==null&&h.score!==undefined?esc(gradeMark(h)):esc(h.status||(classRecordComplete(h)?'تم عمل الواجب':'قيد المتابعة'))}</span></div>`).join(''):'<p class="section-desc">لا توجد واجبات خلال هذا الشهر.</p>'}
      </div>
      <div class="mini-panel parent-panel-v40">
        <h3>التسميع</h3>
        ${recitations.length?recitations.map(r=>`<div class="report-list-row-v40"><div><b>${esc(r.title||'تسميع الحصة')}</b><small>${esc(formatPortalDate(r.date||r.createdAt))}</small></div><span class="badge ${classRecordComplete(r)?'good':'warn'}">${esc(r.status||(classRecordComplete(r)?'تم التسميع':'قيد المتابعة'))}</span></div>`).join(''):'<p class="section-desc">لا يوجد تسميع مسجل بعد.</p>'}
      </div>
      <div class="mini-panel parent-panel-v40"><h3>العملي</h3>${practicals.length?practicals.map(r=>`<div class="report-list-row-v40"><div><b>${esc(r.title||'عملي العلوم')}</b><small>${esc(formatPortalDate(r.date||r.createdAt))}</small></div><span class="badge ${classRecordComplete(r)?'good':'warn'}">${r.score!==null&&r.score!==undefined?esc(gradeMark(r)):esc(r.status||'تم العملي')}</span></div>`).join(''):'<p class="section-desc">لا توجد متابعة عملي خلال هذا الشهر.</p>'}</div>
      <div class="mini-panel parent-panel-v40 parent-notes-v40">
        <h3>ملاحظات ${esc(teacherName)}</h3>
        <p>${esc(st.notes||'لا توجد ملاحظات حالية.')}</p>
      </div>
      <div class="mini-panel parent-panel-v40 parent-pay-v40">
        <h3>الدفع والشهر</h3>
        <p><b>الشهر:</b> ${esc(monthLabel(st))}</p>
        <p><b>حالة الدفع:</b> <span class="badge ${payClass}">${st.paymentRecorded===false?'مفيش سجل دفع للشهر ده':st.paid?'تم الدفع':'لم يتم الدفع'}</span></p>
        ${st.paymentDate?`<p><b>تاريخ التسجيل:</b> ${esc(st.paymentDate)}</p>`:''}
      </div>
    </div>
    <div class="report-footer-v40">مع تحيات ${esc(teacherName)}</div>
  </div>`;
}

async function showParentReportByCode(code){
  const box=document.getElementById('parentResult');
  if(!code){toast('اكتب كود الحساب الموحد'); return;}
  if(box) box.innerHTML='<div class="skeleton" style="height:160px"></div>';
  let st=null,lookupError=null;
  if(window.MFCloud?.ready && window.MFCloud.getParentStudent){
    try{st=await window.MFCloud.getParentStudent(code);}catch(error){lookupError=error;}
  }
  if(!st && window.MF_FIREBASE_CONFIG?.useSecureFunctions===false) st=findStudentByCode(code);
  if(!st&&lookupError){
    const raw=String(lookupError?.code||'')+' '+String(lookupError?.message||'');
    const message=/not-found|invalid-argument/i.test(raw)?'كود الحساب غير صحيح أو غير موجود.':firebaseFriendlyError(lookupError,'تعذر تحميل تقرير ولي الأمر. تحقق من الإنترنت وحاول مرة أخرى.');
    if(box)box.innerHTML=dataErrorHTML(message);
    hydrateIcons();
    return;
  }
  if(!st){
    if(box) box.innerHTML=`<div class="empty-state compact-empty-v29"><span class="iconbox" data-icon="search"></span><h3>كود الحساب غير صحيح.</h3><p>اكتب نفس الكود الموحّد الموجود مع الطالب أو امسح الباركود.</p></div>`;
    hydrateIcons();
    return;
  }
  lastParentStudent = normalizedStudent(st);
  const input=document.querySelector('#parentSearchForm [name="parentCode"]'); if(input) input.value=code;
  if(box) renderParentArchiveChoice(box,code,lastParentStudent);
  const access=document.querySelector('.science-parent-access');
  if(access)access.hidden=true;
  hydrateIcons();
  const heading=box?.querySelector('.science-parent-session h2');
  heading?.focus({preventScroll:true});
  box?.scrollIntoView({block:'start'});
}

function renderParentArchiveChoice(box,code,currentReport){
  const month=cairoPortalDateKey().slice(0,7);
  box.innerHTML=`<div class="science-parent-session"><h2 tabindex="-1">تقرير الطالب</h2><button type="button" class="science-account-exit" data-parent-logout><span data-icon="log-out" aria-hidden="true"></span>تسجيل الخروج</button></div><form class="card science-admin-tool science-parent-archive" data-parent-archive>
    <label>شهر التقرير <input type="month" name="monthKey" value="${month}" max="${month}" required></label>
    <button type="submit" class="btn ghost">عرض تقرير الشهر</button><p role="status"></p>
    </form><div data-parent-archive-result>${parentReportHTML(currentReport)}</div>`;
  const form=box.querySelector('[data-parent-archive]');
  const result=box.querySelector('[data-parent-archive-result]');
  const status=form.querySelector('[role="status"]');
  box.querySelector('[data-parent-logout]').addEventListener('click',()=>{
    lastParentStudent=null;
    location.replace('parent.html');
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('button');
    if(button.disabled)return;
    button.disabled=true;
    const selected=form.elements.monthKey.value;
    try{
      const saved=selected===month?{report:currentReport}:await window.MFCloud.getArchivedParentReport(code,selected);
      if(!form.isConnected)return;
      if(!saved?.report){status.textContent='لسه مفيش تقرير محفوظ للشهر ده.';return;}
      lastParentStudent=normalizedStudent({...saved.report,parentPhone:currentReport.parentPhone});
      result.innerHTML=parentReportHTML(lastParentStudent);
      status.textContent=selected===month?'ده تقرير الشهر الحالي.':'تم عرض التقرير المحفوظ.';
      hydrateIcons();
    }catch{status.textContent='تعذّر تحميل تقرير الشهر. حاول مرة تانية.';}
    finally{button.disabled=false;}
  });
}

async function setupParent(){
  const form=document.getElementById('parentSearchForm'); if(!form) return;
  const input=form.querySelector('[name="parentCode"],[name="code"],[name="query"]');
  const quickCode=toEnglishDigits(new URLSearchParams(location.search).get('code')||'').trim().toUpperCase();
  if(input&&quickCode)input.value=quickCode;
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const code=toEnglishDigits(form.querySelector('[name="parentCode"],[name="code"],[name="query"]')?.value).trim().toUpperCase();
    const button=form.querySelector('[type="submit"]');
    button?.classList.add('is-loading');if(button)button.disabled=true;form.setAttribute('aria-busy','true');
    try{await showParentReportByCode(code);}
    finally{button?.classList.remove('is-loading');if(button)button.disabled=false;form.removeAttribute('aria-busy');}
  });
  if(quickCode&&!form.dataset.autoLoaded){form.dataset.autoLoaded='true';setTimeout(()=>form.requestSubmit(),120);}
}

window.copyParentReport = async function(code){
  const st = (lastParentStudent && lastParentStudent.studentCode===code) ? lastParentStudent : (window.MF_FIREBASE_CONFIG?.useSecureFunctions===false ? findStudentByCode(code) : null);
  if(!st) return toast('لم يتم العثور على الطالب');
  try{await navigator.clipboard.writeText(parentReportText(st)); toast('تم نسخ التقرير');}
  catch(e){toast('تعذر النسخ، جرّب من متصفح أحدث');}
};

window.openParentWhatsApp = async function(code){
  const st = (lastParentStudent && lastParentStudent.studentCode===code) ? lastParentStudent : (window.MF_FIREBASE_CONFIG?.useSecureFunctions===false ? findStudentByCode(code) : null);
  if(!st) return toast('لم يتم العثور على الطالب');
  const phone = whatsappPhone(st.parentPhone);
  if(!phone) return toast('رقم ولي الأمر غير موجود في بيانات الطالب');
  try{await shareParentReportPdf(st,phone);toast('تم تجهيز تقرير PDF للمشاركة على واتساب');}catch(error){console.error(error);toast('تعذر إنشاء ملف PDF. استخدم زر طباعة / حفظ PDF.');}
};

window.printParentReport = function(){
  const result=document.getElementById('parentResult'),root=result?.closest('main');
  if(!result||!result.querySelector('#parentMonthlyReport'))return toast('اعرض تقرير الطالب أولًا');
  document.body.classList.add('printing-parent-report');
  root?.classList.add('print-root');
  const cleanup=()=>{document.body.classList.remove('printing-parent-report');root?.classList.remove('print-root');window.removeEventListener('afterprint',cleanup);};
  window.addEventListener('afterprint',cleanup,{once:true});
  setTimeout(()=>{window.print();setTimeout(cleanup,1500);},50);
};

window.openParentQrScanner = async function(){
  const modal=document.getElementById('parentQrModal'); const reader=document.getElementById('parentQrReader');
  if(!modal || !reader) return;
  modal.hidden=false; reader.innerHTML='<p class="section-desc">جاري تجهيز الكاميرا…</p>';
  try{
    const onDecoded = async decoded => {
      try{await parentQrDecoded(decoded);}
      catch(error){toast(error?.message==='attendance-qr'?'هذا QR حضور. اختر QR الطالب لفتح تقرير ولي الأمر.':'صورة QR غير معروفة أو غير واضحة.');}
    };
    if(!window.Html5Qrcode)await window.MFAssets?.loadQrScanner?.();
    reader.innerHTML='';
    if(window.Html5Qrcode){
      parentQrScanner = new Html5Qrcode('parentQrReader');
      await startHtml5QrCamera(parentQrScanner,{fps:12,qrbox:{width:250,height:250},aspectRatio:1},onDecoded);
    } else if('BarcodeDetector' in window){
      reader.innerHTML='<video id="parentQrVideo" autoplay playsinline></video>';
      const video=document.getElementById('parentQrVideo');
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      video.srcObject=stream;
      const detector=new BarcodeDetector({formats:['qr_code']});
      const loop=async()=>{ if(modal.hidden) return; const codes=await detector.detect(video).catch(()=>[]); if(codes.length) return onDecoded(codes[0].rawValue); setTimeout(loop,700); };
      loop();
    } else {
      reader.innerHTML='<p class="section-desc">المتصفح لا يدعم ماسح QR. استخدم إدخال الكود اليدوي.</p>';
    }
  }catch(e){
    reader.innerHTML='<p class="section-desc">تعذر فتح الكاميرا. افتح الموقع من HTTPS واسمح باستخدام الكاميرا.</p>';
  }
};

window.scanParentQrImage=async function(event){
  const input=event?.target,file=input?.files?.[0],modal=document.getElementById('parentQrModal'),reader=document.getElementById('parentQrReader');
  if(!file||!modal||!reader)return;
  try{
    await window.closeParentQrScanner();modal.hidden=false;
    if(!window.Html5Qrcode)await window.MFAssets?.loadQrScanner?.();
    if(!window.Html5Qrcode)throw new Error('scanner-unavailable');
    reader.innerHTML='';parentQrScanner=new Html5Qrcode('parentQrReader');
    const decoded=await parentQrScanner.scanFile(file,true);
    await parentQrDecoded(decoded);
  }catch(error){
    reader.innerHTML='<p class="qr-file-status">تعذر قراءة QR من الصورة. استخدم صورة واضحة يظهر فيها الباركود كاملًا.</p>';
    toast(error?.message==='attendance-qr'?'هذه صورة QR حضور وليست QR طالب':'لم يتم العثور على QR صالح داخل الصورة');
  }finally{if(input)input.value='';}
};

window.closeParentQrScanner = async function(){
  try{ if(parentQrScanner){ await parentQrScanner.stop(); parentQrScanner.clear(); parentQrScanner=null; } }catch(e){}
  const v=document.getElementById('parentQrVideo'); if(v?.srcObject) v.srcObject.getTracks().forEach(t=>t.stop());
  const modal=document.getElementById('parentQrModal'); if(modal) modal.hidden=true;
};
const HOMEWORK_DRAFT_DB='mf-homework-drafts-v1';
function openHomeworkDraftDb(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('INDEXEDDB_UNAVAILABLE'));const request=indexedDB.open(HOMEWORK_DRAFT_DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('drafts'))request.result.createObjectStore('drafts',{keyPath:'studentCode'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('INDEXEDDB_OPEN_FAILED'));});}
async function homeworkDraftOperation(mode,studentCode,value){const db=await openHomeworkDraftDb();return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode==='get'?'readonly':'readwrite'),store=tx.objectStore('drafts'),request=mode==='get'?store.get(studentCode):mode==='delete'?store.delete(studentCode):store.put(value);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||new Error('HOMEWORK_DRAFT_FAILED'));tx.oncomplete=()=>db.close();});}
const getHomeworkDraft=studentCode=>homeworkDraftOperation('get',studentCode);
const deleteHomeworkDraft=studentCode=>homeworkDraftOperation('delete',studentCode);
async function bindHomeworkForms(){document.querySelectorAll('.homework-upload-form').forEach(async form=>{
  const input=form.querySelector('input[type=file]'),assignment=form.querySelector('[name=assignmentId]'),button=form.querySelector('button[type=submit]'),status=form.querySelector('.homework-draft-status'),code=form.dataset.studentCode;
  let recoveredDraft=null;
  const markOpen=()=>{if(assignment?.value||input?.files?.length||recoveredDraft?.file)document.body.classList.add('homework-open');};
  const saveDraft=async()=>{const selected=input?.files?.[0]||recoveredDraft?.file||null;if(!assignment?.value&&!selected)return;recoveredDraft={studentCode:code,assignmentId:assignment?.value||'',file:selected,savedAt:Date.now()};try{await homeworkDraftOperation('put',code,recoveredDraft);if(status)status.textContent=selected?`تم حفظ مسودة ${selected.name||'ملف الواجب'} على جهازك.`:'تم حفظ اختيار الواجب على جهازك.';}catch(_){if(status)status.textContent='سيظل الملف محددًا ما دامت الصفحة مفتوحة.';}markOpen();};
  try{recoveredDraft=await getHomeworkDraft(code);if(recoveredDraft){if(assignment&&[...assignment.options].some(option=>option.value===recoveredDraft.assignmentId))assignment.value=recoveredDraft.assignmentId;if(status)status.textContent=recoveredDraft.file?`تمت استعادة مسودة ${recoveredDraft.file.name||'ملف الواجب'}. اضغط رفع الملف لإكمال التسليم.`:'تمت استعادة اختيار الواجب.';markOpen();}}catch(_){}
  assignment?.addEventListener('change',saveDraft);
  input?.addEventListener('change',()=>{recoveredDraft=null;saveDraft();});
  form.onsubmit=async event=>{
    event.preventDefault();const file=input?.files?.[0]||recoveredDraft?.file||null;
    if(assignment&&!assignment.value)return toast('اختر الواجب الذي تريد تسليمه');if(!file)return toast('اختار ملف الواجب أولًا');if(file.size>10*1024*1024)return toast('حجم الملف أكبر من 10MB');
    form.classList.add('is-uploading');document.body.classList.add('homework-open');button?.classList.add('is-loading');if(button)button.disabled=true;const original=button?.innerHTML||'';
    try{
      if(!window.MFCloud?.uploadHomework)throw new Error('Homework upload service unavailable');
      await measurePlatformAction('homework-submit',()=>window.MFCloud.uploadHomework(file,code,assignment?.value||'',progress=>{if(button)button.textContent=`جاري الرفع ${progress}%`;if(status)status.textContent=`تم رفع ${progress}% — لا تغلق الصفحة حتى اكتمال التسجيل.`;}));
      await deleteHomeworkDraft(code).catch(()=>{});recoveredDraft=null;if(input)input.value='';if(assignment)assignment.value='';document.body.classList.remove('homework-open');
      if(status)status.textContent='تم تسجيل الواجب بنجاح ومسح المسودة من الجهاز.';toast('تم رفع الواجب وتسجيله بنجاح');portalStudentCache.delete(normalizeText(code));setTimeout(()=>document.getElementById('studentSearchForm')?.requestSubmit(),150);
    }catch(error){await saveDraft();toast(firebaseFriendlyError(error,'تعذر رفع الواجب. المسودة ما زالت محفوظة ويمكنك المحاولة مرة أخرى.'));}
    finally{form.classList.remove('is-uploading');button?.classList.remove('is-loading');if(button){button.disabled=false;button.innerHTML=original;}hydrateIcons();}
  };
});}
function bindStudentTransferForms(portalForm,studentCode){
  document.querySelectorAll('.student-transfer-form').forEach(form=>{form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector('[type=submit]'),payload=Object.fromEntries(new FormData(form).entries());
    if(!payload.targetScheduleId)return toast('اختر المجموعة الجديدة');
    if(String(payload.reason||'').trim().length<3)return toast('اكتب سبب طلب النقل');
    button?.classList.add('is-loading');if(button)button.disabled=true;
    try{
      if(!window.MFCloud?.createStudentTransferRequest)throw new Error('Student transfer service is unavailable');
      await window.MFCloud.createStudentTransferRequest({studentCode,targetScheduleId:payload.targetScheduleId,reason:String(payload.reason||'').trim()});
      portalStudentCache.delete(normalizeText(studentCode));toast('تم إرسال طلب النقل للمدرس');
      if(portalForm?.isConnected)portalForm.requestSubmit();
    }catch(error){toast(firebaseFriendlyError(error,'تعذر إرسال طلب النقل. حاول مرة أخرى.'));}
    finally{button?.classList.remove('is-loading');if(button)button.disabled=false;}
  };});
}
function setupBookingSteps(form){if(!form)return;const steps=[...form.querySelectorAll('[data-booking-step]')],indicators=[...form.querySelectorAll('[data-booking-indicator]')];const show=number=>{steps.forEach(step=>step.classList.toggle('active',Number(step.dataset.bookingStep)===number));indicators.forEach(item=>{const value=Number(item.dataset.bookingIndicator);item.classList.toggle('active',value===number);item.classList.toggle('done',value<number);});};form.querySelector('[data-booking-next]')?.addEventListener('click',()=>{const first=steps[0],required=[...first.querySelectorAll('[required]')];for(const input of required){if(!input.checkValidity()){input.reportValidity();return;}}show(2);steps[1]?.scrollIntoView({behavior:'smooth',block:'center'});});form.querySelector('[data-booking-back]')?.addEventListener('click',()=>show(1));form.addEventListener('booking-success',()=>{show(3);form.scrollIntoView({behavior:'smooth',block:'center'});});show(1);}
function setupBooking(){
  const form=document.getElementById('bookingForm');
  if(form){
    const paymentSelect=document.getElementById('bookingPaymentMethod'),receiptField=document.getElementById('bookingReceiptField'),receiptInput=document.getElementById('bookingReceipt'),paymentHint=document.getElementById('bookingPaymentHint');
    const updatePaymentFields=()=>{const method=paymentSelect?.value||'center',online=method!=='center';if(receiptField)receiptField.hidden=!online;if(receiptInput)receiptInput.required=online;if(paymentHint)paymentHint.textContent=method==='vodafone_cash'?`حوّل على فودافون كاش: ${appData.settings?.vodafoneCashNumber||'الرقم يظهر بعد تحديث إعدادات الدفع'}`:method==='instapay'?`حوّل عبر إنستا باي: ${appData.settings?.instapayAccount||'الحساب يظهر بعد تحديث إعدادات الدفع'}`:'يمكنك إتمام الحجز الآن والدفع عند الحضور إلى السنتر.';};
    paymentSelect?.addEventListener('change',updatePaymentFields);updatePaymentFields();
    setupBookingSteps(form);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=form.querySelector('button[type="submit"]');
      const b=Object.fromEntries(new FormData(form).entries());
      const selectedSchedule=document.getElementById('bookingGroup')?.selectedOptions?.[0];
      b.studentPhone=phoneDigits(b.studentPhone);
      b.parentPhone=phoneDigits(b.parentPhone);
      if(String(b.name||'').trim().split(/\s+/).filter(Boolean).length<3)return toast('اكتب اسم الطالب ثلاثيًا على الأقل، وإذا تكرر الاسم الثلاثي اكتب الاسم الرباعي.');
      b.deliveryMode=b.deliveryMode==='online'?'online':'center';
      b.scheduleId=selectedSchedule?.dataset?.scheduleId||'';
      b.group=selectedSchedule?.value||b.group||'في انتظار تحديد المجموعة';
      b.academicYear=typeof currentAcademicContext==='function'?currentAcademicContext().academicYear:'';
      const receipt=receiptInput?.files?.[0];
      if(b.paymentMethod!=='center'&&!receipt)return toast('ارفع صورة إيصال التحويل أولًا');
      if(receipt&&receipt.size>4*1024*1024)return toast('حجم الإيصال أكبر من 4MB');
      if(!window.MFCloud?.ready && window.MFLoadFirebase){try{await window.MFLoadFirebase();}catch(_){}}
      if(!window.MFCloud?.ready || !window.MFCloud?.createBooking) return toast('خدمة الحجز غير متاحة حاليًا. حاول لاحقًا.');
      button?.classList.add('is-loading'); if(button)button.disabled=true;
      try{
        b.requestId=bookingRequestId(b);
        const result=await window.MFCloud.createBooking(b);
        Object.assign(b,result||{}); b.id=b.code; b.date=isoDate(); b.status=b.status||'بانتظار الموافقة';
        if(receipt){
          const uploaded=await window.MFCloud.uploadBookingReceipt(b.code,receipt);
          Object.assign(b,uploaded||{});
        }
        appData.bookings=Array.isArray(appData.bookings)?appData.bookings:[];
        appData.bookings.push(b); saveData(appData);
        renderBookingSuccess(b);
        form.dispatchEvent(new Event('booking-success'));
        toast(receipt?'تم تسجيل الحجز ورفع الإيصال للمراجعة':'تم تسجيل الحجز بنجاح — الدفع في السنتر');
        clearBookingRequest();
        form.reset(); fillSelects(); updatePaymentFields();
      }catch(err){
        console.error(err); toast(firebaseFriendlyError(err,'تعذر إرسال الحجز. حاول مرة أخرى بعد قليل.'));
      }finally{button?.classList.remove('is-loading');if(button)button.disabled=false;}
    });
  }
}
function portalUrl(file,code){const url=new URL(file,document.baseURI);url.searchParams.set('code',String(code||''));return url.href;}
function renderBookingSuccess(b){
  const box=document.getElementById('bookingSuccess');if(!box)return;
  const code=b.studentCode||b.code;
  box.hidden=false;
  box.innerHTML=`<div class="booking-success-card booking-student-pass compact-booking-pass">
    <span class="badge warn">تم التسجيل وينتظر الاعتماد</span>
    <h3>كود الطالب وولي الأمر</h3>
    <div class="booking-code-spotlight student-code"><small>الكود الموحّد</small><code>${esc(code)}</code><button class="small-btn primary" type="button" onclick="copyBookingCode('${esc(code)}')">نسخ الكود</button></div>
    <div class="booking-result-qr"><div class="real-qr-wrap">${makeQR(code)}<small>باركود الحساب الموحّد</small></div></div>
    <div class="hero-cta compact-portal-links"><a class="btn primary" href="${esc(portalUrl('student.html',code))}"><span data-icon="user-check"></span> بوابة الطالب</a><a class="btn ghost" href="${esc(portalUrl('parent.html',code))}"><span data-icon="users"></span> بوابة ولي الأمر</a></div>
    <p class="section-desc booking-approval-note">${b.paymentMethod==='center'?'طريقة الدفع: في السنتر.':`حالة الإيصال: ${esc(b.receiptStatus||'بانتظار المراجعة')}.`} احتفظ بصورة للكود؛ الدخول متاح من الزرين مباشرة.</p>
  </div>`;
  hydrateIcons();
}
window.copyBookingCode=function(code){navigator.clipboard?.writeText(code); toast('تم نسخ الكود');};
function renderHomeCounts(){const el=document.getElementById('liveCounts'); if(!el)return; el.innerHTML=`<div class="stat"><b>${GRADES.length}</b><small>صفوف دراسية</small></div><div class="stat"><b>متاحة</b><small>بوابة الطالب</small></div><div class="stat"><b>QR</b><small>حضور وامتحانات</small></div>`;}
let publicLeaderboardState={rows:null,expiresAt:0,promise:null,grade:''};
let publicLeaderboardRenderId=0;
function selectedLeaderboardGrade(){return document.getElementById('leaderboardGrade')?.value||GRADES[0];}
function setupLeaderboardGradePicker(){
  const select=document.getElementById('leaderboardGrade');if(!select)return;
  const saved=sessionStorage.getItem('mf_leaderboard_grade');if(saved&&GRADES.includes(saved))select.value=saved;
  select.addEventListener('change',()=>{sessionStorage.setItem('mf_leaderboard_grade',select.value);publicLeaderboardState={rows:null,expiresAt:0,promise:null,grade:select.value};renderPublicLeaderboard(true);});
}
async function renderPublicLeaderboard(force=false){
  const box=document.getElementById('publicLeaderboard');if(!box)return;
  const selectedGrade=selectedLeaderboardGrade();
  const renderId=++publicLeaderboardRenderId;
  box.innerHTML='<div class="skeleton" style="height:90px"></div>';
  let rows=[];
  try{
    if(!force&&publicLeaderboardState.grade===selectedGrade&&publicLeaderboardState.rows&&Date.now()<publicLeaderboardState.expiresAt)rows=publicLeaderboardState.rows;
    else{
      if(!publicLeaderboardState.promise)publicLeaderboardState.promise=Promise.resolve(window.MFCloud?.getPublicLeaderboard?.(selectedGrade)||[]).finally(()=>{publicLeaderboardState.promise=null;});
      rows=await publicLeaderboardState.promise||[];
      publicLeaderboardState.rows=rows;publicLeaderboardState.grade=selectedGrade;publicLeaderboardState.expiresAt=Date.now()+5*60*1000;
    }
  }catch(_){rows=[];}
  if(renderId!==publicLeaderboardRenderId||selectedGrade!==selectedLeaderboardGrade())return;
  rows=(rows||[]).filter(row=>String(row.grade||'').trim()===selectedGrade);
  box.className='leaderboard-five';
  box.innerHTML=rows.length?rows.map((x,i)=>{
    const name=String(x.name||'طالب متميز').trim();
    const score=Math.max(0,Math.min(100,Number(x.score)||0));
    return `<article class="leaderboard-row rank-${i+1}">
      <span class="leaderboard-rank" aria-label="المركز ${i+1}">${i+1}</span>
      <div class="leaderboard-student-info">
        <div class="leaderboard-name-line"><span class="leaderboard-avatar" aria-hidden="true">${esc(name.charAt(0)||'★')}</span><div><small class="leaderboard-name-label">اسم الطالب</small><h3>${esc(name)}</h3></div></div>
        <span class="leaderboard-grade">${esc(x.grade||'الصف غير محدد')}</span>
        <div class="leaderboard-metrics"><span>الحضور <b>${esc(x.attendancePct||0)}%</b></span><span>الدرجات <b>${esc(x.gradePct||0)}%</b></span><span>التسميع <b>${esc(x.recitationPct||0)}%</b></span><span>الواجب <b>${esc(x.homeworkPct||0)}%</b></span></div>
        <div class="progress" aria-label="المجموع ${score}%"><span style="width:${score}%"></span></div>
      </div>
      <div class="leaderboard-score"><small>المجموع</small><b>${score}%</b></div>
    </article>`;
  }).join(''):`<div class="empty-state compact-empty-v29"><span class="iconbox" data-icon="star"></span><h3>لا يوجد ترتيب لصف ${esc(selectedGrade)} بعد</h3><p>سيظهر أفضل خمسة طلاب من هذا الصف تلقائيًا بعد تسجيل نشاطهم خلال الشهر الحالي.</p></div>`;
  hydrateIcons();
}
window.refreshPublicLeaderboard=async function(){
  const button=document.getElementById('refreshLeaderboardButton');
  publicLeaderboardState={rows:null,expiresAt:0,promise:null,grade:selectedLeaderboardGrade()};
  if(button){button.disabled=true;button.classList.add('is-loading');}
  try{await renderPublicLeaderboard(true);}
  finally{if(button){button.disabled=false;button.classList.remove('is-loading');}}
};
function setupReviews(){
  const form=document.getElementById('reviewForm'); if(!form)return; setupStarInputs();
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const button=form.querySelector('button[type="submit"]');
    const review={...Object.fromEntries(new FormData(form).entries()),brand:'saad-ewida'};
    button?.classList.add('is-loading');if(button)button.disabled=true;
    try{
      if(!window.MFCloud?.saveReview)throw new Error('Review service unavailable');
      await window.MFCloud.saveReview(review);
      toast('تم إرسال التقييم وينتظر مراجعة المدرس'); form.reset(); setupStarInputs();
    }catch(err){console.error(err);toast(firebaseFriendlyError(err,'تعذر إرسال التقييم، حاول لاحقًا.'));}
    finally{button?.classList.remove('is-loading');if(button)button.disabled=false;}
  });
}
function setupStarInputs(){document.querySelectorAll('[data-star-input]').forEach(w=>{const input=w.querySelector('input'); const label=w.querySelector('span'); const buttons=[...w.querySelectorAll('button')]; const paint=n=>{buttons.forEach(b=>b.classList.toggle('active',Number(b.dataset.rate)<=n)); if(label) label.textContent=n+' نجوم';}; buttons.forEach(b=>b.onclick=()=>{input.value=b.dataset.rate; paint(Number(b.dataset.rate));}); paint(Number(input?.value||5));});}
function renderReviews(){const box=document.getElementById('reviewsList');if(!box)return;const rows=(appData.reviews||[]).filter(r=>r.approved!==false&&r.brand==='saad-ewida').slice(-8).reverse();box.innerHTML=rows.length?rows.map(r=>{const name=String(r.name||'طالب').trim(),initials=name.split(/\s+/).slice(0,2).map(part=>part[0]||'').join('');return `<article class="review-display-card"><header><span class="review-avatar">${esc(initials||'ط')}</span><div><h3>${esc(name)}</h3><small>${esc(r.role||'طالب')}</small></div><div class="review-stars">${'★'.repeat(Number(r.rating||5))}</div></header><p>${esc(r.text||'')}</p><footer><span data-icon="user-check"></span> تقييم خاص بمنصة المستر سعد</footer></article>`;}).join(''):`<div class="empty-state compact-empty-v29"><span class="iconbox" data-icon="star"></span><h3>لا توجد تقييمات منشورة بعد</h3><p>التقييمات الجديدة تظهر بعد مراجعة المستر سعد.</p></div>`;hydrateIcons();}
function attachmentHtml(item){const url=item.fileData||item.fileUrl||item.linkUrl||item.driveUrl||item.liveUrl;if(url){if(String(item.fileType||item.type||'').includes('image')||/\.(png|jpe?g|webp|gif)$/i.test(url)) return `<img class="attach-preview" src="${esc(url)}" alt="${esc(item.title||'ملف')}">`;const label=item.contentType==='live'?'دخول المحاضرة الآن':item.contentType==='recording'?'مشاهدة التسجيل':'فتح المحتوى';return `<a class="btn primary" target="_blank" rel="noreferrer" href="${esc(url)}"><span data-icon="external-link"></span> ${label}</a>`;} return '';}
function resourceCard(x, kind){return `<div class="card resource-card"><div class="resource-top"><span class="iconbox" data-icon="${kind==='question'?'help-circle':'book-open'}"></span><span class="badge">${esc(x.grade||'كل الصفوف')}</span></div><h3>${esc(x.title||'بدون عنوان')}</h3><p>${esc(x.desc||x.content||'')}</p>${attachmentHtml(x)}${x.answer?`<div class="written-box">الإجابة: ${esc(x.answer)}</div>`:''}</div>`;}
let activeResourceGrade=sessionStorage.getItem('saad_resource_grade')||'all';
let activeResourceMode=sessionStorage.getItem('saad_resource_mode')||'all';
function resourceMatchesGrade(item,grade){return grade==='all'||item.grade===grade;}
function resourceMatchesMode(item,mode){return mode==='all'||!item.deliveryMode||item.deliveryMode==='all'||item.deliveryMode===mode;}
function setupResourceGradeFilters(){
  const box=document.getElementById('materialsFilters');if(!box)return;
  const choices=['all',...GRADES];
  box.innerHTML=`<div class="resource-mode-filter" role="group" aria-label="نوع الدراسة"><button type="button" class="resource-mode-btn ${activeResourceMode==='all'?'active':''}" data-resource-mode="all">السنتر والأونلاين</button><button type="button" class="resource-mode-btn ${activeResourceMode==='center'?'active':''}" data-resource-mode="center">السنتر</button><button type="button" class="resource-mode-btn ${activeResourceMode==='online'?'active':''}" data-resource-mode="online">الأونلاين</button></div><div class="grade-filter" role="group" aria-label="اختيار الصف">${choices.map(grade=>`<button type="button" class="resource-grade-btn ${grade===activeResourceGrade?'active':''}" data-resource-grade="${esc(grade)}" aria-pressed="${grade===activeResourceGrade}">${grade==='all'?'كل الصفوف':esc(grade)}</button>`).join('')}</div>`;
  box.querySelectorAll('[data-resource-mode]').forEach(button=>button.addEventListener('click',()=>{activeResourceMode=button.dataset.resourceMode||'all';sessionStorage.setItem('saad_resource_mode',activeResourceMode);renderUnifiedResourcesPage();}));
  box.querySelectorAll('[data-resource-grade]').forEach(button=>button.addEventListener('click',()=>{activeResourceGrade=button.dataset.resourceGrade||'all';sessionStorage.setItem('saad_resource_grade',activeResourceGrade);renderUnifiedResourcesPage();setPageVerse(activeResourceGrade);}));
}
function renderUnifiedResourcesPage(){
  const m=document.getElementById('materialsPageGrid'),q=document.getElementById('questionsPageGrid');setupResourceGradeFilters();
  const materials=(appData.materials||[]).filter(x=>!['live','upcoming','recording'].includes(x.contentType)).filter(x=>resourceMatchesGrade(x,activeResourceGrade)&&resourceMatchesMode(x,activeResourceMode));
  const questions=(appData.questions||[]).filter(x=>resourceMatchesGrade(x,activeResourceGrade)&&resourceMatchesMode(x,activeResourceMode));
  if(m)m.innerHTML=materials.length?materials.map(x=>resourceCard(x,'material')).join(''):'<div class="empty-state"><h3>لا يوجد محتوى لهذا الصف حاليًا</h3><p>سيظهر هنا فور إضافته من لوحة المدرس.</p></div>';
  if(q)q.innerHTML=questions.length?questions.map(x=>resourceCard(x,'question')).join(''):'<div class="empty-state"><h3>لا توجد أسئلة لهذا الصف حاليًا</h3><p>اختَر صفًا آخر أو ارجع لاحقًا.</p></div>';
  hydrateIcons();
}
function renderExamQuestionHtml(q,i){
  return `<article class="exam-question-card" data-question-index="${i}"><div class="exam-question-number">السؤال ${i+1}</div><h3>${esc(q.question)}</h3>${q.type==='essay'?`<label class="exam-essay-field"><span>اكتب إجابتك بوضوح</span><textarea name="q${i}" rows="6" placeholder="اكتب إجابتك هنا..."></textarea></label>`:`<div class="exam-options">${q.options.map((o,oi)=>`<label class="exam-option"><input type="radio" name="q${i}" value="${oi}"><span class="exam-option-marker">${esc(q.optionLabels?.[oi]||String(oi+1))}</span><span>${esc(o)}</span></label>`).join('')}</div>`}</article>`;
}
function cleanAnswerLine(line){return String(line||'').replace(/^(answer|correct|الإجابة|الاجابة|الإجابة الصحيحة|الاجابة الصحيحة)\s*[:=：-]?\s*/i,'').trim();}
function parseOptionLine(line){
  const raw=toEnglishDigits(line).trim();
  let m=raw.match(/^([A-Da-dأإابجدهـه]|[1-4])\s*[\)\.\-:：]\s*(.+)$/);
  if(m) return {label:m[1].replace('إ','أ').replace('هـ','ه'), text:m[2].trim()};
  m=raw.match(/^-\s*(.+)$/);
  if(m) return {label:'', text:m[1].trim()};
  return null;
}
function parseExamQuestions(text){
  const blocks=toEnglishDigits(text).split(/\n\s*\n/).map(b=>b.trim()).filter(Boolean);
  return blocks.map(block=>{
    const lines=block.split('\n').map(x=>x.trim()).filter(Boolean);
    const answerLine=lines.find(l=>/^(answer|correct|الإجابة|الاجابة|الإجابة الصحيحة|الاجابة الصحيحة)\s*[:=：-]?/i.test(l));
    const pointsLine=lines.find(l=>/^(points?|marks?|score|الدرجة|درجات)\s*[:=：-]?/i.test(l));
    const answer=answerLine?cleanAnswerLine(answerLine):'';
    const points=pointsLine?Number(toEnglishDigits(pointsLine).replace(/^[^:=：\-]*[:=：-]?\s*/i,'')):null;
    const optionObjs=[];
    const questionLines=[];
    lines.forEach(l=>{
      if(l===answerLine||l===pointsLine) return;
      const opt=parseOptionLine(l);
      if(opt) optionObjs.push(opt); else questionLines.push(l.replace(/^س\d*\s*[:\-]?\s*/,'').trim());
    });
    const q=(questionLines[0]||lines[0]||'سؤال').replace(/^س\d*\s*[:\-]?\s*/,'').trim();
    if(optionObjs.length){
      return {type:'mcq',question:q,options:optionObjs.map(o=>o.text),optionLabels:optionObjs.map(o=>o.label),answer,points};
    }
    return {type:'essay',question:q,answer:'',points};
  });
}
function hasSubmitted(examId, code){
  const attempts=[...(currentExamStudent?.examAttempts||[]),...(appData.examAttempts||[])];
  return attempts.some(a=>String(a.examId)===String(examId)&&normalizeText(a.studentCode||code)===normalizeText(code)&&a.status!=='started');
}
var currentExamStudent=null;
var currentSecureExams=[];
var examDashboardRefreshTimer=0;
var examDashboardRefreshBusy=false;
var examDashboardLastRefreshAt=0;
var activeExamDashboardCode='';
async function refreshExamDashboardSilently(code,force=false){
  if(!code||examDashboardRefreshBusy||document.body.classList.contains('exam-open')||document.hidden||(!force&&Date.now()-examDashboardLastRefreshAt<15000))return;
  examDashboardRefreshBusy=true;
  examDashboardLastRefreshAt=Date.now();
  try{
    const dashboard=await window.MFCloud?.getExamDashboard?.(code);
    if(dashboard?.student&&normalizeText(currentExamStudent?.studentCode)===normalizeText(code)){renderExamPortal(dashboard.student,dashboard.exams||[]);}
  }catch(error){if(navigator.onLine===false)console.warn('exam-dashboard-offline');}
  finally{examDashboardRefreshBusy=false;}
}
function startExamDashboardAutoRefresh(code){
  activeExamDashboardCode=String(code||'').trim().toUpperCase();
  clearInterval(examDashboardRefreshTimer);
  if(!activeExamDashboardCode)return;
  examDashboardLastRefreshAt=Date.now();
  examDashboardRefreshTimer=setInterval(()=>refreshExamDashboardSilently(activeExamDashboardCode),60000);
}
function examScheduleLabel(exam){const options={timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'};if(exam.scheduleState==='upcoming'&&exam.openAt)return `يفتح ${new Date(exam.openAt).toLocaleString('ar-EG',options)}`;if(exam.scheduleState==='closed')return 'انتهى موعد الامتحان';if(exam.closeAt)return `متاح حتى ${new Date(exam.closeAt).toLocaleString('ar-EG',options)}`;return 'متاح الآن';}
function renderExamPortal(st,exams){
  const box=document.getElementById('examStudentResult');if(!box)return;
  currentExamStudent=normalizedStudent(st);currentSecureExams=Array.isArray(exams)?exams:currentSecureExams;
  const attempts=(st.examAttempts||[]).slice().reverse();
  const visibleExams=currentSecureExams.filter(ex=>ex.scheduleState!=='closed'||attempts.some(a=>String(a.examId)===String(ex.id)));
  const available=visibleExams.map(ex=>{
    const done=attempts.some(a=>String(a.examId)===String(ex.id)&&a.status!=='started')&&!ex.allowRetake;
    const draft=readExamDraft(ex.id,st.studentCode);
    const pdfOnly=ex.examFormat==='pdf'||(ex.pdfUrl&&Number(ex.questionCount||0)===0);
    const open=ex.scheduleState==='open',statusClassName=open?'good':ex.scheduleState==='upcoming'?'warn':'danger';
    return `<article id="exam-card-${esc(ex.id)}" class="exam-portal-card ${done?'completed':''}"><div class="exam-card-top"><span class="iconbox" data-icon="clipboard"></span><div class="exam-card-badges"><span class="badge">${esc(ex.duration||20)} دقيقة</span>${pdfOnly?'<span class="badge">امتحان PDF</span>':`<span class="badge">${esc(ex.questionCount||'-')} سؤال</span>`}<span class="badge ${statusClassName}">${esc(examScheduleLabel(ex))}</span>${ex.pdfUrl?'<span class="badge good">ملف PDF</span>':''}${draft&&!done?'<span class="badge warn">محاولة محفوظة</span>':''}</div></div><h3>${esc(ex.title)}</h3><p>${esc(ex.instructions||'اقرأ كل سؤال جيدًا قبل بدء الامتحان.')}</p>${open&&ex.pdfUrl?`<a class="btn ${pdfOnly?'primary':'ghost'} exam-pdf-link" href="${esc(ex.pdfUrl)}" target="_blank" rel="noopener noreferrer"><span data-icon="file-text"></span> ${pdfOnly?'فتح امتحان PDF':'فتح ملف الامتحان PDF'}</a>`:''}${!open?`<button class="btn ghost" type="button" disabled>${esc(examScheduleLabel(ex))}</button>`:pdfOnly?'':`<button class="btn ${done?'ghost':'primary'} exam-start-btn" type="button" data-exam-id="${esc(ex.id)}" data-student-code="${esc(st.studentCode)}" ${done?'disabled':''}><span data-icon="${done?'user-check':'clipboard'}"></span>${done?'تم تسليم الامتحان':draft?'متابعة الامتحان':'بدء الامتحان'}</button>`}</article>`;
  }).join('');
  const resultCards=attempts.length?attempts.map(a=>{const ready=a.score!==null&&a.score!==undefined&&a.score!=='';return `<article class="exam-result-card"><div><span class="record-eyebrow">${esc(formatPortalDate(a.submittedAt))}</span><h4>${esc(a.examTitle||'امتحان')}</h4><small>${a.needsManualReview?'ينتظر تصحيح الأسئلة المقالية':'تم التصحيح الآمن على الخادم'}</small></div><strong class="score-pill ${ready?scoreClass(a.score):'warn'}">${ready?esc(a.score)+'%':'قيد التصحيح'}</strong></article>`;}).join(''):'<div class="portal-empty"><span class="iconbox" data-icon="bar-chart"></span><h3>لا توجد محاولات بعد</h3><p>ستظهر نتائجك هنا بعد التسليم.</p></div>';
  box.innerHTML=`<section class="exam-student-banner"><span class="student-avatar">${esc(String(st.name||'ط').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join(''))}</span><div><small>امتحانات الطالب</small><h2>${esc(st.name)}</h2><p>${esc(st.grade||'')} <span>•</span> ${esc(st.studentCode)}</p></div></section><div class="exam-security-note"><span data-icon="user-check"></span><div><b>التصحيح مؤمّن</b><small>الإجابات النموذجية تظل محمية، ويتم التصحيح تلقائيًا وبأمان بعد التسليم.</small></div></div><div class="exam-portal-section"><div class="student-panel-title"><div><span class="kicker"><span data-icon="clipboard"></span> امتحانات صفك</span><h3>المتاح والقادم</h3></div><span class="badge">${visibleExams.length} امتحان</span></div><div class="exam-portal-grid">${available||'<div class="portal-empty"><span class="iconbox" data-icon="clipboard"></span><h3>لا توجد امتحانات حاليًا</h3><p>ستظهر امتحانات صفك هنا فور نشرها.</p></div>'}</div></div><div class="exam-portal-section"><div class="student-panel-title"><div><span class="kicker"><span data-icon="bar-chart"></span> النتائج</span><h3>سجل الامتحانات</h3></div><span class="badge good">${attempts.length} محاولة</span></div><div class="exam-results-grid">${resultCards}</div></div>`;
  box.querySelectorAll('.exam-start-btn').forEach(btn=>btn.addEventListener('click',()=>window.startExam(btn.dataset.examId,btn.dataset.studentCode)));
  hydrateIcons();
}
function setupExamsPage(){
  const form=document.getElementById('examCodeForm');if(!form)return;
  const input=form.querySelector('[name="query"]');const remember=form.querySelector('[name="rememberCode"]');const params=new URLSearchParams(location.search);
  const studentCode=safeStorageGet(LAST_STUDENT_CODE_KEY);
  const saved=params.get('from')==='student'?studentCode:(safeStorageGet(LAST_EXAM_CODE_KEY)||studentCode);
  if(saved&&input){input.value=saved;if(remember)remember.checked=true;}
  form.addEventListener('submit',async e=>{
    e.preventDefault();const code=toEnglishDigits(input.value).trim().toUpperCase();const box=document.getElementById('examStudentResult');const button=form.querySelector('button[type="submit"]');
    if(!code)return;if(remember?.checked){safeStorageSet(LAST_EXAM_CODE_KEY,code);safeStorageSet(LAST_STUDENT_CODE_KEY,code);}else safeStorageRemove(LAST_EXAM_CODE_KEY);
    box.innerHTML='<div class="skeleton" style="height:180px"></div>';button?.classList.add('is-loading');if(button)button.disabled=true;
    try{
      const dashboard=await window.MFCloud?.getExamDashboard?.(code);
      if(!dashboard?.student)throw new Error('not-found');
      renderExamPortal(dashboard.student,dashboard.exams||[]);
      const requestedExam=params.get('exam');
      const card=requestedExam&&document.getElementById(`exam-card-${requestedExam}`);
      if(card&&params.get('from')==='student'){
        card.setAttribute('tabindex','-1');
        card.focus({preventScroll:true});
        card.scrollIntoView({block:'start'});
      }
      startExamDashboardAutoRefresh(code);
    }catch(err){box.innerHTML=`<div class="portal-empty"><span class="iconbox" data-icon="search"></span><h3>تعذر فتح الامتحانات</h3><p>${esc(firebaseFriendlyError(err,'تأكد من كود الطالب واتصال الإنترنت ثم حاول مرة أخرى.'))}</p></div>`;hydrateIcons();}
    finally{button?.classList.remove('is-loading');if(button)button.disabled=false;}
  });
  const quickCode=toEnglishDigits(new URLSearchParams(location.search).get('code')||saved).trim().toUpperCase();
  if(!window.__mfExamDashboardRefreshBound){window.__mfExamDashboardRefreshBound=true;document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshExamDashboardSilently(activeExamDashboardCode);});window.addEventListener('online',()=>refreshExamDashboardSilently(activeExamDashboardCode,true));}
  if(quickCode&&!form.dataset.autoLoaded){form.dataset.autoLoaded='true';input.value=quickCode;setTimeout(()=>form.requestSubmit(),120);}
}
function examDraftKey(examId,studentCode){return `${EXAM_DRAFT_PREFIX}${String(examId).replace(/[^\w-]/g,'_')}_${String(studentCode).replace(/[^\w-]/g,'_')}`;}
function readExamDraft(examId,studentCode){try{return JSON.parse(safeStorageGet(examDraftKey(examId,studentCode))||'null');}catch(e){return null;}}
function saveExamDraft(examId,studentCode,draft){safeStorageSet(examDraftKey(examId,studentCode),JSON.stringify(draft));}
function clearExamDraft(examId,studentCode){safeStorageRemove(examDraftKey(examId,studentCode));}
window.startExam=async function(examId,studentCode){
  const metadata=currentSecureExams.find(e=>String(e.id)===String(examId));
  const st=(currentExamStudent&&normalizeText(currentExamStudent.studentCode)===normalizeText(studentCode)?currentExamStudent:null)||{studentCode};
  if(!metadata)return toast('الامتحان غير متاح. أعد إدخال كود الطالب.');
  let draft=readExamDraft(examId,studentCode);
  const validDraft=draft&&draft.sessionId&&Array.isArray(draft.questions)&&Number(draft.expiresAt)>Date.now();
  if(!validDraft){
    toast('جاري تجهيز جلسة الامتحان الآمنة...');
    try{
      const session=await measurePlatformAction('exam-start',()=>window.MFCloud?.startSecureExam?.(examId,studentCode));
      if(!session?.sessionId||!Array.isArray(session.questions))throw new Error('Secure session unavailable');
      draft={examId:String(examId),studentCode:String(studentCode),sessionId:session.sessionId,questions:session.questions,exam:session.exam||metadata,answers:session.answers&&typeof session.answers==='object'?session.answers:{},startedAt:session.startedAt,expiresAt:Number(session.expiresAt),current:Number(session.current)||0,revision:Number(session.draftRevision)||0,serverRevision:Number(session.draftRevision)||0,serverSavedAt:Number(session.draftSavedAt)||0,updatedAt:Date.now()};
      saveExamDraft(examId,studentCode,draft);
    }catch(err){return toast(firebaseFriendlyError(err,'تعذر بدء الامتحان الآن. حدّث الصفحة وحاول مرة أخرى.'));}
  }
  const ex=draft.exam||metadata,qs=draft.questions;
  if(!qs.length)return toast('الامتحان لا يحتوي على أسئلة صالحة');
  if(!document.getElementById('examOverlay')){
    document.body.insertAdjacentHTML('beforeend','<div class="exam-overlay" id="examOverlay"><div class="exam-box card" id="examBox"></div></div>');
  }
  const overlay=document.getElementById('examOverlay'),box=document.getElementById('examBox');overlay.classList.add('show');document.body.classList.add('exam-open');
  box.innerHTML=`<div class="exam-app-shell"><header class="exam-app-header"><div><span class="record-eyebrow">${esc(st.name||'الطالب')}</span><h2>${esc(ex.title)}</h2>${ex.pdfUrl?`<a class="exam-live-pdf" href="${esc(ex.pdfUrl)}" target="_blank" rel="noopener noreferrer"><span data-icon="file-text"></span> فتح PDF</a>`:''}</div><div class="exam-timer" id="examTimer"><span data-icon="calendar"></span><b>--:--</b></div></header><div class="exam-progress-wrap"><div><b id="examProgressLabel">السؤال 1 من ${qs.length}</b><small id="examSaveStatus">يتم حفظ الإجابات تلقائيًا على جهازك والخادم</small></div><div class="progress"><span id="examProgressBar" style="width:${100/qs.length}%"></span></div></div><form id="liveExamForm" novalidate><div id="examQuestionStage"></div><footer class="exam-navigation"><button class="btn ghost" id="examExitBtn" type="button"><span data-icon="external-link"></span> حفظ وخروج</button><div><button class="btn ghost" id="examPrevBtn" type="button">السابق</button><button class="btn primary" id="examNextBtn" type="button">التالي</button><button class="btn primary" id="examSubmitBtn" type="submit"><span data-icon="send"></span> تسليم الامتحان</button></div></footer></form></div>`;
  hydrateIcons();
  const stage=box.querySelector('#examQuestionStage'),form=box.querySelector('#liveExamForm'),next=box.querySelector('#examNextBtn'),prev=box.querySelector('#examPrevBtn'),submit=box.querySelector('#examSubmitBtn'),exit=box.querySelector('#examExitBtn');
  let current=Math.min(Math.max(Number(draft.current||0),0),qs.length-1),finished=false,timer=null,syncTimer=null,serverClockOffset=0,syncBusy=false,serverSaveTimer=null,serverSaveBusy=false,serverSaveQueued=false,lastServerFingerprint='',autoSubmitQueued=false;
  const onExamOnline=()=>{serverSaveQueued=true;flushServerDraft();};
  const onExamVisibility=()=>{if(document.hidden)flushServerDraft();};
  const stopExamClocks=()=>{clearInterval(timer);clearInterval(syncTimer);clearTimeout(serverSaveTimer);window.removeEventListener('online',onExamOnline);document.removeEventListener('visibilitychange',onExamVisibility);};
  const answeredCount=()=>Object.values(draft.answers||{}).filter(v=>String(v??'').trim()!=='').length;
  const flushServerDraft=async()=>{if(serverSaveBusy||!window.MFCloud?.saveSecureExamProgress)return;if(navigator.onLine===false){serverSaveQueued=true;return;}const fingerprint=JSON.stringify({answers:draft.answers||{},current});if(fingerprint===lastServerFingerprint&&!serverSaveQueued)return;serverSaveBusy=true;serverSaveQueued=false;const revision=Math.max(Number(draft.revision)||0,Number(draft.serverRevision)||0)+1;draft.revision=revision;saveExamDraft(examId,studentCode,draft);try{const result=await window.MFCloud.saveSecureExamProgress(draft.sessionId,studentCode,draft.answers||{},current,revision);draft.serverRevision=Math.max(Number(result?.revision)||revision,Number(draft.serverRevision)||0);draft.serverSavedAt=Number(result?.savedAt)||Date.now();lastServerFingerprint=fingerprint;saveExamDraft(examId,studentCode,draft);const status=box.querySelector('#examSaveStatus');if(status)status.textContent=`محفوظ على الجهاز والخادم • ${answeredCount()} من ${qs.length}`;}catch(error){serverSaveQueued=true;const status=box.querySelector('#examSaveStatus');if(status)status.textContent=`محفوظ على الجهاز، وسيُرفع عند عودة الإنترنت • ${answeredCount()} من ${qs.length}`;if(!/unavailable|network|fetch|offline/i.test(`${error?.code||''} ${error?.message||''}`))console.warn('exam-progress-save',error);}finally{serverSaveBusy=false;if(serverSaveQueued&&navigator.onLine!==false&&!finished)serverSaveTimer=setTimeout(flushServerDraft,1800);}};
  const queueServerDraft=()=>{clearTimeout(serverSaveTimer);serverSaveTimer=setTimeout(flushServerDraft,1200);};
  const persistDraft=()=>{draft.current=current;draft.updatedAt=Date.now();saveExamDraft(examId,studentCode,draft);queueServerDraft();const status=box.querySelector('#examSaveStatus');if(status){status.textContent=`محفوظ على الجهاز • ${answeredCount()} من ${qs.length}`;status.classList.add('saved');setTimeout(()=>status?.classList.remove('saved'),700);}};
  const saveVisibleAnswer=()=>{const q=qs[current];if(q.type==='mcq'){const checked=form.querySelector(`input[name="q${current}"]:checked`);draft.answers[String(current)]=checked?checked.value:'';}else{draft.answers[String(current)]=form.elements[`q${current}`]?.value||'';}persistDraft();};
  const renderCurrent=()=>{stage.innerHTML=renderExamQuestionHtml(qs[current],current);const stored=draft.answers[String(current)];if(qs[current].type==='mcq'&&stored!==undefined&&stored!==''){const radio=stage.querySelector(`input[value="${CSS.escape(String(stored))}"]`);if(radio)radio.checked=true;}else if(qs[current].type==='essay'&&stored!==undefined){const area=stage.querySelector('textarea');if(area)area.value=stored;}stage.querySelectorAll('input').forEach(el=>el.addEventListener('change',saveVisibleAnswer));stage.querySelectorAll('textarea').forEach(el=>el.addEventListener('input',saveVisibleAnswer));box.querySelector('#examProgressLabel').textContent=`السؤال ${current+1} من ${qs.length}`;box.querySelector('#examProgressBar').style.width=`${Math.round((current+1)/qs.length*100)}%`;prev.disabled=current===0;next.hidden=current===qs.length-1;submit.hidden=current!==qs.length-1;persistDraft();};
  const currentAnswered=()=>String(draft.answers[String(current)]??'').trim()!=='';
  next.addEventListener('click',()=>{saveVisibleAnswer();if(!currentAnswered())return toast('اختر أو اكتب إجابة السؤال أولًا');current++;renderCurrent();stage.scrollIntoView({behavior:'smooth',block:'start'});});
  prev.addEventListener('click',()=>{saveVisibleAnswer();if(current>0){current--;renderCurrent();}});
  exit.addEventListener('click',()=>{
    saveVisibleAnswer();
    if(!confirm('سيتم حفظ إجاباتك والوقت سيستمر. هل تريد الخروج؟'))return;
    stopExamClocks();
    void flushServerDraft();
    overlay.classList.remove('show');
    document.body.classList.remove('exam-open');
    if(currentExamStudent)renderExamPortal(currentExamStudent,currentSecureExams);
    const card=document.getElementById(`exam-card-${examId}`);
    card?.querySelector('.exam-start-btn:not([disabled])')?.focus({preventScroll:true});
    toast('المحاولة محفوظة على الجهاز. اضغط «متابعة الامتحان» للرجوع.');
  });
  const finish=async(force=false)=>{if(finished||(force&&autoSubmitQueued))return;if(force)autoSubmitQueued=true;saveVisibleAnswer();const firstMissing=qs.findIndex((q,i)=>String(draft.answers[String(i)]??'').trim()==='');if(firstMissing>=0&&!force){current=firstMissing;renderCurrent();return toast(`أجب عن السؤال ${firstMissing+1} قبل التسليم`);}if(!force&&!confirm('هل أنت متأكد من تسليم الامتحان؟ لن تستطيع تعديل الإجابات بعد التسليم.'))return;finished=true;await flushServerDraft();stopExamClocks();submit.disabled=true;submit.classList.add('is-loading');try{const result=await measurePlatformAction('exam-submit',()=>submitExamAttempt(draft.sessionId,st,draft.answers));clearExamDraft(examId,studentCode);submit.classList.remove('is-loading');submit.textContent='تم التسليم بنجاح';overlay.classList.remove('show');document.body.classList.remove('exam-open');currentExamStudent.examAttempts=[...(currentExamStudent.examAttempts||[]),result];requestAnimationFrame(()=>setTimeout(()=>renderExamPortal(currentExamStudent,currentSecureExams),0));}catch(err){finished=false;submit.disabled=false;submit.classList.remove('is-loading');submit.textContent='إعادة محاولة التسليم';if(force){const retry=()=>{autoSubmitQueued=false;finish(true);};if(navigator.onLine===false)window.addEventListener('online',retry,{once:true});toast('انتهى الوقت. إجاباتك محفوظة وسيتم التسليم مرة واحدة عند عودة الإنترنت.');}else{autoSubmitQueued=false;window.addEventListener('online',onExamOnline);document.addEventListener('visibilitychange',onExamVisibility);timer=setInterval(updateTimer,1000);syncTimer=setInterval(syncSession,12000);toast(firebaseFriendlyError(err,'تعذر تسليم الامتحان. إجاباتك ما زالت محفوظة.'));}}};
  form.addEventListener('submit',e=>{e.preventDefault();finish(false);});
  const syncSession=async()=>{if(syncBusy||finished||document.hidden||!window.MFCloud?.syncSecureExam)return;syncBusy=true;try{const state=await window.MFCloud.syncSecureExam(draft.sessionId,studentCode);if(Number(state?.serverNow))serverClockOffset=Number(state.serverNow)-Date.now();const serverRevision=Number(state?.draftRevision)||0;if(state?.answers&&serverRevision>Number(draft.serverRevision||0)){const localNewer=Number(draft.updatedAt||0)>Number(state.draftSavedAt||0);draft.answers=localNewer?{...state.answers,...(draft.answers||{})}:{...(draft.answers||{}),...state.answers};draft.serverRevision=serverRevision;draft.serverSavedAt=Number(state.draftSavedAt)||Date.now();if(!localNewer&&Number.isFinite(Number(state.current)))current=Math.max(0,Math.min(qs.length-1,Number(state.current)));saveExamDraft(examId,studentCode,draft);}if(Number(state?.expiresAt)&&Number(state.expiresAt)!==Number(draft.expiresAt)){const old=Number(draft.expiresAt);draft.expiresAt=Number(state.expiresAt);if(Number(state.duration))draft.exam={...(draft.exam||{}),duration:Number(state.duration)};saveExamDraft(examId,studentCode,draft);if(old&&Number(state.expiresAt)>old)toast('تم تحديث وقت الامتحان وإضافة الوقت الجديد');else if(old&&Number(state.expiresAt)<old)toast('تم تحديث موعد انتهاء الامتحان');}if(state?.status&&state.status!=='started'){stopExamClocks();finished=true;overlay.classList.remove('show');document.body.classList.remove('exam-open');clearExamDraft(examId,studentCode);refreshExamDashboardSilently(studentCode,true);}}catch(error){if(!/unavailable|network|fetch|offline/i.test(`${error?.code||''} ${error?.message||''}`))console.warn('exam-session-sync',error);}finally{syncBusy=false;}};
  const updateTimer=()=>{const left=Math.max(0,Number(draft.expiresAt)-(Date.now()+serverClockOffset));const total=Math.ceil(left/1000),m=Math.floor(total/60),sec=total%60;const timerEl=box.querySelector('#examTimer b');if(timerEl)timerEl.textContent=`${m}:${String(sec).padStart(2,'0')}`;box.querySelector('#examTimer')?.classList.toggle('danger',total<=60);if(left<=0)finish(true);};
  window.addEventListener('online',onExamOnline);document.addEventListener('visibilitychange',onExamVisibility);timer=setInterval(updateTimer,1000);syncTimer=setInterval(syncSession,12000);syncSession();updateTimer();renderCurrent();
};
async function submitExamAttempt(sessionId,st,answers){
  if(!window.MFCloud?.submitSecureExam)throw new Error('Secure submit function unavailable');
  const result=await window.MFCloud.submitSecureExam(sessionId,st.studentCode||st.code,answers);
  toast(result?.needsManualReview?'تم التسليم وينتظر تصحيح المدرس':'تم التسليم والتصحيح بأمان');
  return result;
}

function setupContact(){
  const raw=appData.settings?.teacherPhone||TEACHER_WHATSAPP;
  const local=String(raw||'').replace(/\D/g,'').replace(/^20(?=1)/,'0');
  const whatsapp=String(raw||'').replace(/\D/g,'').replace(/^0/,'20');
  const facebook=appData.settings?.facebookUrl||'https://www.facebook.com/saad.abomoaz';
  document.querySelectorAll('a[href^="tel:"]').forEach(link=>{link.href=`tel:${local}`;});
  document.querySelectorAll('a[href*="wa.me"]:not(.engineer-only-name):not(.engineer-only-whatsapp),#teacherWhatsapp').forEach(link=>{link.href=whatsappLink(whatsapp,'مرحبًا مستر سعد، أريد الاستفسار عن الحجز.');});
  document.querySelectorAll('.engineer-only-name,.engineer-only-whatsapp').forEach(link=>{link.href=whatsappLink(ENGINEER_WHATSAPP,'مرحبًا باشمهندس عمرو، أريد الاستفسار عن المنصة.');});
  document.querySelectorAll('a[href*="facebook.com"]').forEach(link=>{link.href=facebook;});
  document.querySelectorAll('.site-header .header-actions').forEach(actions=>{if(actions.querySelector('.header-call-button'))return;actions.insertAdjacentHTML('afterbegin',`<a class="header-call-button" href="tel:${esc(local)}" aria-label="اتصل الآن بالمستر سعد"><span data-icon="phone"></span><span>اتصل الآن</span></a>`);});
  hydrateIcons();
}
function setupHomeNotice(){
  const message=String(appData.settings?.homeNotice||'').trim();let notice=document.getElementById('platformHomeNotice');
  if(!message){notice?.remove();return;}if(!notice){notice=document.createElement('aside');notice.id='platformHomeNotice';notice.className='platform-home-notice';document.querySelector('.site-header')?.insertAdjacentElement('afterend',notice);}
  notice.innerHTML=`<span data-icon="sparkles"></span><p>${esc(message)}</p><button type="button" aria-label="إغلاق التنبيه">×</button>`;notice.querySelector('button').onclick=()=>notice.remove();hydrateIcons();
}
function setupAdminLink(){document.querySelectorAll('a[href="teacher-login.html"]').forEach(a=>a.remove());}
function parseUnifiedStudentQr(rawValue){const raw=toEnglishDigits(String(rawValue||'')).trim();if(!raw)return null;let attendanceToken='',studentCode='';try{const url=new URL(raw,location.href);attendanceToken=String(url.searchParams.get('attendance')||'').trim();studentCode=toEnglishDigits(url.searchParams.get('code')||'').trim().toUpperCase();}catch(error){}if(!attendanceToken){const match=raw.match(/^(?:ATTENDANCE|حضور)[:\s-]+([a-f0-9]{48})$/i);if(match)attendanceToken=match[1];}if(attendanceToken&&/^[a-f0-9]{48}$/i.test(attendanceToken))return {type:'attendance',token:attendanceToken.toLowerCase()};if(!studentCode){const match=raw.match(/^(?:STUDENT|طالب)[:\s-]+([A-Z0-9_-]{6,40})$/i);studentCode=match?match[1]:raw.toUpperCase().replace(/\s+/g,'');}if(/^[A-Z0-9_-]{6,40}$/.test(studentCode))return {type:'student',code:studentCode};return null;}
var studentQrScanner=null,studentQrStream=null,studentQrScanBusy=false;
async function handleStudentQrDecoded(value){
  if(studentQrScanBusy)return;
  studentQrScanBusy=true;
  const payload=parseUnifiedStudentQr(value),input=document.getElementById('studentQuery'),form=document.getElementById('studentSearchForm');
  if(!payload){await window.stopStudentScanner();studentQrScanBusy=false;toast('هذا الـ QR غير معروف. امسح QR الطالب أو QR حصة المدرس.');return;}
  if(payload.type==='attendance'){
    pendingStudentAttendanceToken=payload.token;
    const saved=toEnglishDigits(input?.value||safeStorageGet(LAST_STUDENT_CODE_KEY)).trim().toUpperCase();
    if(input&&saved)input.value=saved;
    await window.stopStudentScanner();studentQrScanBusy=false;
    showStudentAttendanceBanner(saved?'تم قراءة QR الحصة، جاري تسجيل حضورك…':'تم قراءة QR الحصة. اكتب كودك أو امسح QR الطالب.');
    if(saved)form?.requestSubmit();else input?.focus();
    return;
  }
  if(input)input.value=payload.code;
  await window.stopStudentScanner();studentQrScanBusy=false;form?.requestSubmit();
}
window.startStudentScanner=async function(){
  const box=document.getElementById('qrScannerBox'),reader=document.getElementById('studentQrReader'),video=document.getElementById('qrScannerVideo');
  if(!box||!reader||!video)return;
  if(!window.isSecureContext&&!/^(localhost|127\.0\.0\.1)$/.test(location.hostname))return toast('الكاميرا تحتاج فتح الموقع من رابط HTTPS الآمن');
  await window.stopStudentScanner();studentQrScanBusy=false;box.hidden=false;reader.innerHTML='<p class="section-desc">جاري تجهيز الكاميرا…</p>';
  const decoded=value=>handleStudentQrDecoded(value);
  try{
    if(!window.Html5Qrcode)await window.MFAssets?.loadQrScanner?.();
    reader.innerHTML='';
    if(window.Html5Qrcode){
      video.hidden=true;reader.hidden=false;studentQrScanner=new Html5Qrcode('studentQrReader');
      await startHtml5QrCamera(studentQrScanner,{fps:12,qrbox:{width:240,height:240},aspectRatio:1},decoded,()=>{});
      toast('امسح QR الطالب لفتح البوابة أو QR المدرس لتسجيل الحضور');return;
    }
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('camera-unavailable');
    reader.hidden=true;video.hidden=false;studentQrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=studentQrStream;await video.play();
    if(!('BarcodeDetector' in window))throw new Error('scanner-unavailable');
    const detector=new BarcodeDetector({formats:['qr_code']});
    const loop=async()=>{if(box.hidden||studentQrScanBusy)return;const codes=await detector.detect(video).catch(()=>[]);if(codes.length)return decoded(codes[0].rawValue);setTimeout(loop,250);};
    toast('امسح QR الطالب أو QR حصة المدرس');loop();
  }catch(error){
    await window.stopStudentScanner();box.hidden=false;reader.hidden=false;reader.innerHTML='<p class="section-desc">تعذر تشغيل ماسح QR. اسمح للمتصفح باستخدام الكاميرا أو اكتب الكود يدويًا.</p>';toast('تعذر فتح الكاميرا أو قراءة QR');
  }
};
window.scanStudentQrImage=async function(event){
  const input=event?.target,file=input?.files?.[0],box=document.getElementById('qrScannerBox'),reader=document.getElementById('studentQrReader');
  if(!file||!box||!reader)return;
  try{
    await window.stopStudentScanner();studentQrScanBusy=false;box.hidden=false;reader.hidden=false;
    if(!window.Html5Qrcode)await window.MFAssets?.loadQrScanner?.();
    if(!window.Html5Qrcode)throw new Error('scanner-unavailable');
    reader.innerHTML='';studentQrScanner=new Html5Qrcode('studentQrReader');
    const decoded=await studentQrScanner.scanFile(file,true);
    await handleStudentQrDecoded(decoded);
  }catch(error){
    studentQrScanBusy=false;box.hidden=false;reader.hidden=false;
    reader.innerHTML='<p class="qr-file-status">تعذر قراءة QR من الصورة. اختَر صورة واضحة يظهر فيها الباركود كاملًا.</p>';
    toast('لم يتم العثور على QR صالح داخل الصورة');
  }finally{if(input)input.value='';}
};
window.stopStudentScanner=async function(){
  const box=document.getElementById('qrScannerBox'),video=document.getElementById('qrScannerVideo'),reader=document.getElementById('studentQrReader');
  try{if(studentQrScanner){await studentQrScanner.stop();studentQrScanner.clear();}}catch(error){}
  studentQrScanner=null;(studentQrStream?.getTracks?.()||[]).forEach(track=>track.stop());studentQrStream=null;
  if(video?.srcObject)video.srcObject.getTracks().forEach(track=>track.stop());if(video){video.srcObject=null;video.hidden=true;}if(reader)reader.innerHTML='';if(box)box.hidden=true;
};
function setupActiveNavigation(){
  const mobileNav=document.querySelector('.mobile-bottom');
  document.body.classList.toggle('mobile-nav-active',!!mobileNav);
  const update=()=>{
    const currentFile=location.pathname.split('/').pop()||'index.html';
    const currentHash=location.hash||'';
    document.querySelectorAll('.navlinks a,.mobile-bottom a').forEach(a=>{
      const url=new URL(a.getAttribute('href')||'',location.href);
      const linkFile=url.pathname.split('/').pop()||'index.html';
      const sameFile=linkFile===currentFile;
      const active=sameFile&&(url.hash?url.hash===currentHash:!currentHash);
      a.classList.toggle('active',active);
      if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    });
  };
  update();
  window.addEventListener('hashchange',update);
}
function setupUnifiedPublicHeader(){
  const header=document.querySelector('body:not(.admin-page) .site-header');
  if(!header)return;
  header.innerHTML=`<div class="container navbar">
    <a aria-label="المستر سعد عويضة" class="logo" href="index.html"><img class="site-brand-logo" src="assets/icon-192.png" width="52" height="52" alt="لوجو منصة المستر سعد عويضة"><span>المستر سعد عويضة<small>أحياء • علوم • علوم متكاملة</small></span></a>
    <nav aria-label="روابط الموقع" class="navlinks">
      <a href="index.html">الرئيسية</a><a href="online.html">المحاضرات</a><a href="exams.html">الاختبارات</a><a href="materials.html">المراجعات وبنك الأسئلة</a><a href="parent.html">ولي الأمر</a><a href="services.html">الخدمات</a>
    </nav>
    <div class="header-actions"><button aria-label="تغيير الوضع" class="theme-toggle" id="themeToggle"></button><a class="btn primary science-header-entry" href="student.html?login=1"><span data-icon="user" aria-hidden="true"></span> دخول الطالب</a><a class="btn ghost header-booking-btn" href="index.html#booking">احجز الآن</a></div>
  </div>`;
}
function bindLocalizedDigits(){
  if(window.__mfLocalizedDigitsBound)return;window.__mfLocalizedDigitsBound=true;
  document.addEventListener('beforeinput',event=>{const input=event.target;if(!(input instanceof HTMLInputElement)||!event.data)return;const converted=toEnglishDigits(event.data);if(converted===event.data)return;if(input.type==='number'){event.preventDefault();input.value=`${input.value||''}${converted}`;input.dispatchEvent(new Event('input',{bubbles:true}));return;}if(typeof input.setRangeText!=='function')return;try{event.preventDefault();const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;input.setRangeText(converted,start,end,'end');input.dispatchEvent(new Event('input',{bubbles:true}));}catch(_){ }});
  document.addEventListener('input',event=>{const input=event.target;if(!(input instanceof HTMLInputElement))return;const converted=toEnglishDigits(input.value);if(converted!==input.value)input.value=converted;});
}
function registerServiceWorker(){
  if(!('serviceWorker' in navigator)||location.protocol==='file:')return;
  const localDevelopment=['localhost','127.0.0.1','0.0.0.0'].includes(location.hostname);
  if(localDevelopment){
    // A worker left by an older local preview can serve offline.html for valid
    // student/parent links. Development does not need offline caching.
    Promise.all([
      navigator.serviceWorker.getRegistrations().then(rows=>Promise.all(rows.map(row=>row.unregister()))),
      'caches' in window?caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))):Promise.resolve()
    ]).finally(()=>{
      if(navigator.serviceWorker.controller&&!sessionStorage.getItem('mf_local_sw_cleaned')){
        sessionStorage.setItem('mf_local_sw_cleaned','1');location.reload();
      }
    });
    return;
  }
  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('/service-worker.js',{updateViaCache:'none'});
      await registration.update().catch(()=>{});
      const activateWaiting=worker=>{if(!worker)return;if(protectedStudentWorkflowActive()){sessionStorage.setItem('mf_sw_update_waiting','1');return;}worker.postMessage({type:'SKIP_WAITING'});};
      if(registration.waiting)activateWaiting(registration.waiting);
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)activateWaiting(worker);});});
    }catch(_){ }
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{try{if(protectedStudentWorkflowActive()){sessionStorage.setItem('mf_sw_reload_deferred','1');toast('تم تجهيز تحديث جديد، وسيُطبق بعد إنهاء الامتحان أو الواجب.');return;}if(sessionStorage.getItem('mf_sw_reloaded_v7000'))return;sessionStorage.setItem('mf_sw_reloaded_v7000','1');location.reload();}catch(_){ }});
}
function setupPWAInstall(){
  const button=document.getElementById('installAppButton');if(!button)return;let installPrompt=null;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;button.hidden=false;});
  button.addEventListener('click',async()=>{if(!installPrompt)return toast('يمكنك تثبيت الموقع من قائمة المتصفح');installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;button.hidden=true;});
  window.addEventListener('appinstalled',()=>{button.hidden=true;toast('تم تثبيت المنصة على الهاتف');});
}
function setupClientErrorReporting(){window.addEventListener('error',event=>{window.MFCloud?.reportClientError?.({message:String(event.message||'خطأ JavaScript'),page:location.href,userAgent:navigator.userAgent}).catch(()=>{});});window.addEventListener('unhandledrejection',event=>{window.MFCloud?.reportClientError?.({message:String(event.reason?.message||event.reason||'Promise rejection'),page:location.href,userAgent:navigator.userAgent}).catch(()=>{});});}
const GRADE_VERSES={
  'رابعة ابتدائي':'وَقُلْ رَبِّ زِدْنِي عِلْمًا','خامسة ابتدائي':'إِنَّ مَعَ الْعُسْرِ يُسْرًا','سادسة ابتدائي':'وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَى',
  'أولى إعدادي':'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا','تانية إعدادي':'وَمَنْ يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ','تالتة إعدادي':'إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ',
  'أولى ثانوي':'قُلْ هَلْ يَسْتَوِي الَّذِينَ يَعْلَمُونَ وَالَّذِينَ لَا يَعْلَمُونَ','تانية ثانوي':'يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنْكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ','تالتة ثانوي':'وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا'
};
const PAGE_VERSES={'index.html':'وَقُلْ رَبِّ زِدْنِي عِلْمًا','services.html':'وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ','online.html':'قُلْ هَلْ يَسْتَوِي الَّذِينَ يَعْلَمُونَ وَالَّذِينَ لَا يَعْلَمُونَ','materials.html':'يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنْكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ','exams.html':'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا','student.html':'وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَى','parent.html':'إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ','reviews.html':'وَمَنْ يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ','privacy.html':'إِنَّ اللَّهَ كَانَ عَلَيْكُمْ رَقِيبًا','terms.html':'وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى','offline.html':'إِنَّ مَعَ الْعُسْرِ يُسْرًا'};
function currentPageName(){return location.pathname.split('/').pop()||'index.html';}
function setPageVerse(grade){const text=document.querySelector('[data-page-verse]');if(!text)return;const normalized=grade&&grade!=='all'&&grade!=='كل الصفوف'?grade:'';text.textContent=GRADE_VERSES[normalized]||PAGE_VERSES[currentPageName()]||'وَقُلْ رَبِّ زِدْنِي عِلْمًا';}
function setupSpiritualIdentity(){
  if(document.getElementById('adminRoot')||currentPageName()==='teacher-login.html')return;const main=document.querySelector('main');if(!main)return;
  const header=document.querySelector('.site-header');
  document.querySelectorAll('.logo small').forEach(label=>label.textContent='أحياء • علوم • علوم متكاملة');
  let banner=document.querySelector('.quran-opening');if(banner){banner.innerHTML='<span data-page-verse></span>';}else{banner=document.createElement('div');banner.className='quran-opening';banner.innerHTML='<span data-page-verse></span>';}
  if(header&&header.nextElementSibling!==banner)header.insertAdjacentElement('afterend',banner);else if(!header&&!banner.isConnected)main.prepend(banner);
  const footer=document.querySelector('.footer.engineer-only-footer');
  if(footer){
    const motto=footer.querySelector('.footer-brand-motto strong')?.textContent||'نسعى للإبداع والتفوق';
    footer.querySelector('.footer-brand-motto')?.remove();
    footer.querySelector('.footer-main-row > span:not(.footer-legal-links)')?.remove();
    footer.classList.add('science-site-footer');
    footer.insertAdjacentHTML('afterbegin',`<div class="container science-footer-main">
      <a class="science-footer-brand" href="index.html"><img src="assets/icon-192.png" width="44" height="44" alt="" loading="lazy"><span><strong>المستر سعد عويضة</strong><small>${esc(motto)}</small></span></a>
        <nav class="science-footer-nav" aria-label="روابط الفوتر"><a href="student.html?login=1">بوابة الطالب</a><a href="parent.html">ولي الأمر</a><a href="index.html#contact">التواصل</a></nav>
    </div>`);
  }
  setPageVerse(activeResourceGrade);document.addEventListener('change',event=>{const field=event.target;if(field instanceof HTMLSelectElement&&(field.name==='grade'||/grade/i.test(field.id)))setPageVerse(field.value);});
}
const saadParentReportText=parentReportText;
parentReportText=function(raw){return saadParentReportText(raw).replaceAll('المستر سعد عويضة','المستر سعد عويضة');};
function init(){setupUnifiedPublicHeader(); setupTheme(); setupActiveNavigation(); bindLocalizedDigits(); registerServiceWorker(); setupPWAInstall(); setupClientErrorReporting(); hydrateIcons(); fillSelects(); setupBooking(); setupStudent(); setupParent(); setupExamsPage(); setupReviews(); setupContact(); setupHomeNotice(); setupAdminLink(); setupLeaderboardGradePicker(); setupSpiritualIdentity(); renderHomeCounts(); renderPublicLeaderboard(); renderReviews(); renderUnifiedResourcesPage(); initFirebaseData();}
document.addEventListener('DOMContentLoaded',init);
