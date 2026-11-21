// Service worker do Ludo Supreme.
// - Página (navegação): rede primeiro, cache se estiver offline → atualizações chegam na hora.
// - Demais arquivos (ícones, bibliotecas das CDNs, fontes): cache primeiro e atualiza em segundo plano.
// Troque a versão quando mudar a lista de arquivos pré-carregados.
const VERSION = 'ludo-v2';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
];
const CDN = [
  'https://cdn.tailwindcss.com/3.4.16',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js',
  'https://fonts.googleapis.com/css2?family=Bangers&family=Bungee&family=Permanent+Marker&family=Special+Elite&display=swap',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
];
// Nunca passa pelo cache: estatísticas e servidor de salas
const BYPASS = /goatcounter\.com|gc\.zgo\.at|peerjs\.com/;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    // CDNs: melhor esforço, uma falha não impede a instalação
    await Promise.allSettled(CDN.map(url => cache.add(new Request(url, { mode: 'no-cors' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || BYPASS.test(req.url) || !req.url.startsWith('http')) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', res.clone());
        return res;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreVary: true });
    const update = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(update); return cached; }
    return (await update) || Response.error();
  })());
});
