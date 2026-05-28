const CACHE_NAME = "nizamkitchen-offline-v3";
const OFFLINE_URL = "/offline";
const NETWORK_ONLY_PREFIXES = [
  "/admin",
  "/api",
  "/settings",
  "/dashboard",
  "/billing",
  "/notifications",
  "/support",
  "/profile",
  "/orders",
  "/catering",
  "/restaurant",
  "/chef",
  "/household",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.mode !== "navigate") {
    return;
  }

  const url = new URL(request.url);
  if (NETWORK_ONLY_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return cache.match(OFFLINE_URL);
    }),
  );
});
