/* Copilota IA - cache offline, multi-regione.
   Una cache per la shell (cambia a ogni build) e una per ogni regione scaricata
   (cambia solo col dataset), cosi' "elimina la mappa X" e' selettivo e un fix di
   codice non fa riscaricare niente. */
const APP = 'copilota-app-v47';
const REGIONS = ["valle_aosta", "liguria", "trentino_alto_adige", "friuli_venezia_giulia", "emilia_romagna", "umbria", "marche", "lazio", "abruzzo"];
const DATA_PREFIX = 'copilota-data-';
const SHELL = ['./', './index.html', './manifest.webmanifest', './regions.json',
               './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const dataId = url => {
  const m = new URL(url).pathname.match(/\/data-([a-z_]+)\.json$/);
  return m ? m[1] : null;
};
self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  const keep = new Set([APP, ...REGIONS.map(r => DATA_PREFIX + r)]);
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => !keep.has(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const id = dataId(req.url);
  if (id) {
    // cache-first sull'URL completo (?v=<hash>): quando il dataset cambia, l'URL
    // cambia, si scarica il nuovo e si buttano le versioni vecchie della regione.
    e.respondWith(caches.open(DATA_PREFIX + id).then(c => c.match(req).then(hit => hit ||
      fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();          // clonare SUBITO: fra un tick il body e' gia' letto
          e.waitUntil(c.keys()
            .then(ks => Promise.all(ks.filter(k => k.url !== req.url).map(k => c.delete(k))))
            .then(() => c.put(req, copy)));
        }
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
