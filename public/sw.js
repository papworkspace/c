const CACHE_NAME = 'thairoute-pwa-v9';
const STATIC_ICON_ASSETS = [
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ICON_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      let deletedOldCache = false;
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          if (key !== CACHE_NAME) {
            await caches.delete(key);
            deletedOldCache = true;
          }
        }
      } catch {
        // ignore
      }

      await self.clients.claim();

      // หากมีการล้าง Cache เวอร์ชันเก่า ให้สั่งหน้าเว็บที่เปิดค้างอยู่โหลดใหม่ทันทีเพื่อไม่ให้ติดหน้าจอเก่า
      if (deletedOldCache) {
        try {
          const windowClients = await self.clients.matchAll({ type: 'window' });
          for (const client of windowClients) {
            client.postMessage({ type: 'SW_FORCE_RELOAD', version: CACHE_NAME });
            if ('navigate' in client) {
              client.navigate(client.url).catch(() => {});
            }
          }
        } catch {
          // ignore
        }
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ห้ามแคชไฟล์ HTML, JS, TS, CSS ของหน้าเว็บเด็ดขาด เพื่อให้ผู้ใช้เห็นโค้ดและดีไซน์ล่าสุดเสมอ 100%
  if (url.origin === self.location.origin) {
    const isStaticIcon = STATIC_ICON_ASSETS.includes(url.pathname);
    if (!isStaticIcon) {
      event.respondWith(
        fetch(request, { cache: 'no-store' }).catch(() => caches.match(request))
      );
      return;
    }
  }

  // สำหรับ API ข้อมูลน้ำและสภาพอากาศ ใช้ Network-first พร้อมสำรองข้อมูลเมื่อออฟไลน์
  if (
    url.hostname.includes('thaiwater.net') ||
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('openstreetmap.org')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
