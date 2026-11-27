const SHELL = 'louvre-shell-v105';
const AUDIO = 'louvre-audio-v3';
const IMAGES = 'louvre-images-v1';

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './src/app-config.js',
  './src/supabase-config.js',
  './src/i18n.js',
  './src/locales/ja.js',
  './src/locales/en.js',
  './src/locales/fr.js',
  './src/locales/zh.js',
  './src/locales/ko.js',
  './src/locales/es.js',
  './src/locales/works.en.json',
  './src/my-plan.js',
  './src/main.js',
  './src/app/state.js',
  './src/app/cloud-sync.js',
  './src/app/plan-share.js',
  './src/app/ui-helpers.js',
  './src/app/route-loader.js',
  './src/app/audio-controller.js',
  './src/app/plan-actions.js',
  './src/views/auth-gate.js',
  './src/views/course-select.js',
  './src/views/map-tab.js',
  './src/views/plan-tab.js',
  './src/views/plan-share-modal.js',
  './src/views/onboarding-tour.js',
  './src/views/audio-tab.js',
  './src/views/settings-tab.js',
  './src/views/work-detail-sheet.js',
  './src/views/mini-player.js',
  './src/catalog.js',
  './src/floor-map.js',
  './src/floor-map-geo.js',
  './src/navigation.js',
  './src/route-progress.js',
  './src/location-support.js',
  './src/navigation-graph.json',
  './src/artwork-images.json',
  './src/image-credits.json',
  './src/works.json',
  './src/routes.json',
  './src/provenance.json',
  './src/style.css',
  './src/update.css',
  './src/selection.css',
  './images/mona.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => (key.startsWith('louvre-shell-') && key !== SHELL) || (key.startsWith('louvre-audio-') && key !== AUDIO)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function serveAudioWithRange(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) return cachedResponse;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2])) return cachedResponse;
  const buffer = await cachedResponse.clone().arrayBuffer();
  const total = buffer.byteLength;
  if (total === 0) return cachedResponse;
  let start;
  let end;
  if (match[1]) {
    start = Number(match[1]);
    end = match[2] ? Math.min(total - 1, Number(match[2])) : total - 1;
  } else {
    const suffixLen = Number(match[2]);
    start = Math.max(0, total - suffixLen);
    end = total - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
    return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${total}`}});
  }
  const chunk = buffer.slice(start, end + 1);
  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Length': String(chunk.byteLength),
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/audio/')) {
    event.respondWith(
      caches.open(AUDIO).then(async cache => {
        const cached = await cache.match(event.request.url);
        if (cached) return serveAudioWithRange(event.request, cached);
        return fetch(event.request);
      })
    );
    return;
  }
  if (url.pathname.includes('/images/')) {
    event.respondWith(
      caches.open(IMAGES).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
