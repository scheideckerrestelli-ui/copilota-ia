/* Copilota IA - cache offline, multi-regione.
   Una cache per la shell (cambia a ogni build) e una per ogni regione scaricata
   (cambia solo col dataset), cosi' "elimina la mappa X" e' selettivo e un fix di
   codice non fa riscaricare niente. */
/* sorgente: 449a968ae3 +NON-COMMITTATO */
const APP = 'copilota-app-v247';
const DATA_PREFIX = 'copilota-data-';
// niente './index.html' nella SHELL: su Cloudflare Pages risponde 308 (pretty URL)
// e cache.addAll rifiuta le risposte redirette — l'install del SW fallirebbe intera.
const SHELL = ['./', './manifest.webmanifest', './regions.json',
               './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const dataId = url => {
  const m = new URL(url).pathname.match(/\/data-([a-z_]+)\.json$/);
  return m ? m[1] : null;
};
self.addEventListener('install', e => {
  // `cache:'reload'` obbliga a ripescare dalla rete: senza, addAll puo' prendere
  // dalla cache HTTP del browser e reinstallare la shell VECCHIA in una cache nuova
  e.waitUntil(caches.open(APP)
    .then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  /* Si buttano solo le shell vecchie. Le cache delle regioni sono ROBA DELL'UTENTE:
     prima venivano confrontate con l'elenco della build e cancellate se non c'erano
     — una build parziale, o una regione tolta dal sito, spazzava via mappe che
     qualcuno aveva scaricato e magari si stava portando in montagna. Le regioni si
     eliminano solo dal pannello Mappe. */
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks
      .filter(k => k.startsWith('copilota-app-') && k !== APP)
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // la pagina beta NON passa dal service worker. E' un file statico che cambia
  // spesso durante la beta: in cache-first chi l'ha aperta una volta si terrebbe
  // la versione vecchia fino alla build successiva dell'app. Senza respondWith
  // la prende dalla rete come una pagina qualunque.
  // Vale per TUTTE le forme dell'indirizzo: su Cloudflare Pages la pagina vive su
  // /beta (pretty URL, /beta.html risponde 308) — coprire solo /beta.html vuol dire
  // congelare /beta nella cache generica per chi ha l'app installata.
  { const p = new URL(req.url).pathname;
     if (p.endsWith('/beta.html') || p.endsWith('/beta')) return; }
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
    // solo le risposte buone: mettere in cache un 404 o un 500 e poi servirlo
    // cache-first vuol dire tenersi l'errore finche' non cambia la versione
    if (res.ok) {
      const copy = res.clone();
      caches.open(APP).then(c => c.put(req, copy)).catch(()=>{});
    }
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('./')
                                          : Promise.reject(new Error('offline')))));
});
