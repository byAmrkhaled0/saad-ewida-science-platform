(function(){
  'use strict';
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal=()=>{
    const items=[...document.querySelectorAll('main section, .card, .app-service-card')];
    if(reduceMotion||!('IntersectionObserver' in window)){items.forEach(el=>el.classList.add('is-visible'));return;}
    document.documentElement.classList.add('reveal-enabled');
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
    }),{rootMargin:'100px 0px',threshold:.04});
    items.forEach(el=>{el.classList.add('reveal-ready');observer.observe(el);});
    // Never leave content invisible if a mobile browser pauses or drops the
    // observer while the page is being restored from cache.
    setTimeout(()=>items.forEach(el=>el.classList.add('is-visible')),1400);
  };
  const lazyMedia=()=>document.querySelectorAll('img:not([fetchpriority="high"])').forEach(img=>{
    img.loading='lazy';img.decoding='async';
  });
  document.addEventListener('DOMContentLoaded',()=>{lazyMedia();reveal();});
})();
