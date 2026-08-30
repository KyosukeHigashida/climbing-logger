const CACHE_VERSION = "self.__CACHE_VERSION__";
const CACHE_PREFIX = "self.__CACHE_PREFIX__";
const APP_SCOPE = "self.__APP_SCOPE__";
const DEV_SCOPE = "self.__DEV_SCOPE__";
const OWNS_DEV_SCOPE = self.__OWNS_DEV_SCOPE__;
const PRECACHE_ASSETS = self.__APP_ASSETS__ || [];
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", ...PRECACHE_ASSETS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("climbing-logger-") && key !== CACHE_VERSION)
            .filter((key) => key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (!shouldHandleRequest(requestUrl)) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match("./index.html"));
    }),
  );
});

function shouldHandleRequest(requestUrl) {
  if (requestUrl.origin !== self.location.origin) {
    return false;
  }

  if (!requestUrl.pathname.startsWith(APP_SCOPE)) {
    return false;
  }

  if (!OWNS_DEV_SCOPE && DEV_SCOPE.startsWith(APP_SCOPE) && requestUrl.pathname.startsWith(DEV_SCOPE)) {
    return false;
  }

  return true;
}
