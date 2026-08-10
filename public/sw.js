// Minimal service worker: no offline caching, just enough presence for
// browsers to treat this as an installable PWA.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
