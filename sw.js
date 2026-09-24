/* sorgente: c18706e6d5 */
const APP = 'copilota-app-v324';
const DATA_PREFIX = 'copilota-data-';
const SHELL = ['./', './manifest.webmanifest', './manifest-a.webmanifest', './regions.json',
               './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const dataId = url => {
  const m = new URL(url).pathname.match(/\/data-([a-z_]+)\.json$/);
  return m ? m[1] : null;
};
self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP)
    .then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks
      .filter(k => k.startsWith('copilota-app-') && k !== APP)
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
  avvisaLePagine();
});
function chiediVersione(c) {
  return new Promise(fatto => {
    let finito = false;
    const ch = new MessageChannel();
    const t = setTimeout(() => { if (!finito) { finito = true; fatto(null); } }, 8000);
    ch.port1.onmessage = ev => { if (!finito) { finito = true; clearTimeout(t); fatto((ev.data && ev.data.v) || '?'); } };
    try { c.postMessage({ tipo: 'versione-nuova', v: APP }, [ch.port2]); }
    catch (err) { clearTimeout(t); fatto(null); }
  });
}
function avvisaLePagine() {
  return self.clients.matchAll({ type: 'window' }).then(cs => Promise.all(cs.map(c =>
    chiediVersione(c).then(v => {
      if (v) return;
      if (c.navigate) return c.navigate(c.url).catch(() => {});
    })))).catch(() => {});
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  { const p = new URL(req.url).pathname;
     if (p.endsWith('/beta.html') || p.endsWith('/beta')) return; }
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const copia = (await caches.match(req)) || (await caches.match('./'));
      if (copia && self.navigator && self.navigator.onLine === false) return copia;
      const rete = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(r => (r.ok && !r.redirected) ? r : Promise.reject(new Error('risposta non usabile')));
      if (!copia) return rete;
      try {
        return await Promise.race([rete, new Promise((_, no) => setTimeout(() => no(new Error('rete lenta')), 2500))]);
      } catch (err) { return copia; }
    })());
    return;
  }
  const id = dataId(req.url);
  if (id) {
    e.respondWith(caches.open(DATA_PREFIX + id).then(c => c.match(req).then(hit => hit ||
      fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(c.keys()
            .then(ks => Promise.all(ks.filter(k => k.url !== req.url).map(k => c.delete(k))))
            .then(() => c.put(req, copy)));
        }
        return res;
      }))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(APP).then(c => c.put(req, copy)).catch(()=>{});
    }
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('./')
                                          : Promise.reject(new Error('offline')))));
});
