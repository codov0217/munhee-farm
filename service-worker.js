const CACHE_NAME='munhui-farm-pwa-v1.2.4';
const APP_SHELL=[
 './',
 './index.html',
 './manifest.webmanifest',
 './style.css',
 './database.js',
 './app.js',
 './pwa.js',
 './icons/icon-192.png',
 './icons/icon-512.png'
];

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
});

self.addEventListener('activate',event=>{
 event.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
   .then(()=>self.clients.claim())
 );
});

self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const request=event.request;

 // 화면과 핵심 파일은 인터넷의 최신 버전을 우선합니다.
 if(request.mode==='navigate' || request.url.includes('index.html') || request.url.includes('manifest.webmanifest') || request.url.endsWith('.js') || request.url.endsWith('.css')){
  event.respondWith(
   fetch(request,{cache:'no-store'})
    .then(response=>{
     const copy=response.clone();
     caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
     return response;
    })
    .catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html')))
  );
  return;
 }

 event.respondWith(
  caches.match(request).then(hit=>hit||fetch(request).then(response=>{
   const copy=response.clone();
   caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
   return response;
  }))
 );
});

self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
