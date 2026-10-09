/* Spool Delivery Tracking – offline cache. The app opens from this cache when there is no signal,
   and quietly refreshes itself from the website whenever there is. */
var CACHE = "sd-app-2";
var SHELL = ["./", "index.html", "jsQR.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("sd-app-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // server calls go straight to the network
  var key = req.mode === "navigate" ? "index.html" : req;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(key, { ignoreSearch: true }).then(function (hit) {
      var fresh = fetch(req).then(function (r) {
        if (r && r.ok) c.put(key, r.clone());
        return r;
      }).catch(function () { return hit; });
      return hit || fresh; // saved copy at once; the newer copy is used next time
    });
  }));
});
