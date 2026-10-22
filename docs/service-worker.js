const PREFIX = "tv-nba-shell-" + self.registration.scope + "-";
const CACHE = PREFIX + "v1-real-20261022";
const FILES = ["./","./assets/index-BekZuGRV.css","./assets/index-CEYixTWm.js","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/maskable-512.png","./images/hero-jokic.png","./index.html","./manifest.webmanifest"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== location.origin ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  // JSON is fetched atomically by the app; its last valid pair lives in localStorage.
  if (url.pathname.includes("/data/")) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (event.request.mode === "navigate") {
        try {
          return await fetch(event.request);
        } catch {
          return (await cache.match("./index.html")) || Response.error();
        }
      }
      return (await cache.match(event.request)) || fetch(event.request);
    })(),
  );
});
