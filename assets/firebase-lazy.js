(function(){
  'use strict';
  var release=(document.currentScript&&document.currentScript.dataset.version)||'69.0.0';
  var promise=null;
  function load(src){
    return new Promise(function(resolve,reject){
      var existing=document.querySelector('script[data-lazy-firebase="'+src+'"]');
      if(existing){if(existing.dataset.loaded==='true')return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      var script=document.createElement('script');
      script.src=src;script.async=true;script.dataset.lazyFirebase=src;
      script.onload=function(){script.dataset.loaded='true';resolve();};
      script.onerror=function(){reject(new Error('تعذر تحميل خدمة Firebase'));};
      document.head.appendChild(script);
    });
  }
  function start(){
    if(promise)return promise;
    promise=(async function(){
      await load('assets/firebase-config.js?v='+release);
      await load('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
      await Promise.all([
        load('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js'),
        load('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js'),
        load('https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js'),
        load('https://www.gstatic.com/firebasejs/10.12.5/firebase-functions-compat.js')
      ]);
      await load('assets/firebase-sync.js?v='+release);
      window.dispatchEvent(new CustomEvent('mfcloudready'));
      return window.MFCloud;
    })().catch(function(error){promise=null;console.error(error);throw error;});
    return promise;
  }
  window.MFLoadFirebase=start;
  ['pointerdown','focusin','keydown','touchstart'].forEach(function(type){
    window.addEventListener(type,start,{once:true,passive:true,capture:true});
  });
  function observeDataSections(){
    if(!('IntersectionObserver' in window))return;
    var targets=['booking','publicLeaderboard','reviewsList'].map(function(id){return document.getElementById(id);}).filter(Boolean);
    if(!targets.length)return;
    var observer=new IntersectionObserver(function(entries){
      if(entries.some(function(entry){return entry.isIntersecting;})){observer.disconnect();start();}
    },{rootMargin:'240px 0px'});
    targets.forEach(function(target){observer.observe(target);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeDataSections,{once:true});
  else observeDataSections();
})();
