const CACHE_NAME = "mf-science-v6336-production";
const APP_SHELL = [
  "/", "/index.html", "/student.html", "/online.html", "/exams.html", "/materials.html",
  "/services.html", "/parent.html", "/reviews.html", "/privacy.html",
  "/terms.html", "/offline.html", "/assets/platform.css", "/assets/platform.js",
  "/assets/online.js", "/assets/firebase-sync.js", "/assets/firebase-config.js",
  "/assets/logo-icon.svg", "/assets/icon-192.png",
  "/assets/icon-512.png", "/assets/icon-maskable-512.png",
  "/assets/teacher.webp", "/assets/saad-promo.webp", "/site.webmanifest"
];

// This same-origin bundle is built from firebase/app and firebase/messaging/sw,
// so it targets WorkerGlobalScope and never expects a browser window object.
try {
  importScripts('/assets/vendor/firebase-messaging-worker-10.12.5.min.js');
  MFFirebaseMessagingWorker.start({
    apiKey: 'AIzaSyDG5LHrXBeyKFaN1Tmq5HjOX-nOv2z_BBA',
    authDomain: 'saad-ewida-science-platform.firebaseapp.com',
    projectId: 'saad-ewida-science-platform',
    storageBucket: 'saad-ewida-science-platform.firebasestorage.app',
    messagingSenderId: '459812644202',
    appId: '1:459812644202:web:0b02982aab7f74fdcf7113'
  });
} catch (error) {
  console.warn('firebase-background-messaging-unavailable', error && error.message ? error.message : error);
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/teacher-login.html?section=bookings';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(openClients => {
    const existing = openClients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      existing.navigate(target);
      return existing.focus();
    }
    return clients.openWindow(target);
  }));
});

self.addEventListener("install", event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(url=>cache.add(new Request(url,{cache:"reload"}))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if(event.data && event.data.type==="SKIP_WAITING") self.skipWaiting();
  if(event.data && event.data.type==="CLEAR_OLD_CACHES") event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));
});

self.addEventListener("fetch", event => {
  const request=event.request;
  if(request.method!=="GET") return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}
        return response;
      }catch(_){
        // Query strings such as ?code=12345678 must fall back to the cached
        // HTML page, not to offline.html.
        return (await caches.match(url.pathname,{ignoreSearch:true})) ||
          (await caches.match(request,{ignoreSearch:true})) ||
          (await caches.match("/offline.html"));
      }
    })());
    return;
  }

  if(url.pathname==="/assets/firebase-config.js"){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:"no-store"});
        if(response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}
        return response;
      }catch(_){return caches.match(request,{ignoreSearch:true});}
    })());
    return;
  }

  if(url.pathname.startsWith("/assets/") || url.pathname.endsWith(".webmanifest")){
    // Versioned static assets are returned from cache immediately on repeat
    // visits while a background request refreshes them. Large QR and Excel
    // bundles enter this cache only after the user actually opens that tool.
    const network=fetch(request).then(async response=>{
      if(response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone());}
      return response;
    });
    event.respondWith(caches.match(request,{ignoreSearch:true}).then(cached=>{
      if(cached){event.waitUntil(network.catch(()=>null));return cached;}
      return network.catch(()=>caches.match(request,{ignoreSearch:true}));
    }));
  }
});
