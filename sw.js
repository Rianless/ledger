// 배포 시마다 CACHE_VERSION을 바꿔야 자동 갱신됨
const CACHE_VERSION = 'v8';
const CACHE = 'ledger-' + CACHE_VERSION;
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // HTML과 핵심 에셋은 네트워크 우선 (최신 버전 받기)
  const isCore = url.pathname.endsWith('/') || 
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('.css') ||
                 url.pathname.endsWith('.js') ||
                 url.pathname.endsWith('.json');
  if(isCore && url.origin === self.location.origin){
    e.respondWith(
      fetch(e.request).then(res=>{
        if(res && res.status===200){
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(e.request, copy));
        }
        return res;
      }).catch(()=>caches.match(e.request).then(hit=>hit || caches.match('./index.html')))
    );
    return;
  }
  // 그 외(이미지, CDN)는 캐시 우선
  e.respondWith(
    caches.match(e.request).then(hit=>{
      if(hit) return hit;
      return fetch(e.request).then(res=>{
        if(res && res.status===200){
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(e.request, copy));
        }
        return res;
      }).catch(()=>caches.match('./index.html'));
    })
  );
});
