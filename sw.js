/* Spool Delivery Tracking – offline cache. The app opens from this cache when there is no signal,
   and quietly refreshes itself from the website whenever there is. */
var CACHE = "sd-app-4";
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

/* ---------- notifications: a delivery was sent to this person ---------- */
self.addEventListener("push", function (e) {
  e.waitUntil(caches.open("sd-meta").then(function (c) { return c.match("me.json"); })
    .then(function (r) { return r ? r.json() : null; })
    .then(function (me) {
      if (!me || !me.api) return null;
      return fetch(me.api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ fn: "myPending", args: [me.email] }) })
        .then(function (r) { return r.json(); }).then(function (j) { return (j && j.ok) || []; }).catch(function () { return null; });
    })
    .then(function (list) {
      var t = list && list.length ? list[0] : null;
      var title = t ? "New delivery to receive · " + t.dn : "Spool delivery for you";
      var body = t ? t.count + " spools · " + t.from + " → " + t.to + " · from " + t.senderName + (list.length > 1 ? " (" + list.length + " waiting in total)" : "")
        : "A delivery has been sent to you. Open the app to receive it.";
      if (self.navigator && self.navigator.setAppBadge && list) { try { self.navigator.setAppBadge(list.length); } catch (x) {} }
      return self.registration.showNotification(title, { body: body, icon: "icon-192.png", badge: "icon-192.png", tag: t ? t.dn : "spool-delivery",
        renotify: true, data: { url: "./" + (t ? "?dn=" + encodeURIComponent(t.dn) : "") } });
    }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf(self.registration.scope) === 0 && "navigate" in list[i]) return list[i].navigate(url).then(function (c) { return c && c.focus(); }); }
    return self.clients.openWindow(url);
  }));
});
