/* Copilota IA - cache offline.
   Due cache: la shell cambia a ogni build, i dati solo quando cambia il dataset,
   cosi' un fix di codice non fa riscaricare la mappa della regione. */
const APP = 'copilota-app-v15';
const DATA = 'copilota-data-9f5737f647';
const SHELL = ['./', './index.html', './manifest.webmanifest',
               './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== APP && k !== DATA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).pathname.endsWith('/data.json')) {
    e.respondWith(caches.open(DATA).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    const copy = res.clone();
    caches.open(APP).then(c => c.put(req, copy)).catch(()=>{});
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('./index.html')
                                          : Promise.reject(new Error('offline')))));
});
