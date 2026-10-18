// TecFlow — guarda a plataforma no aparelho para funcionar sem rede
const VERSION = "tf43";
const SHELL = "tecflow-" + VERSION, LIBS = "tecflow-libs";
const CORE = ["./", "index.html", "styles.css", "tecnico.js", "tecflow.js", "tfdata.js", "tfapp.js", "tf.css", "manifest.webmanifest", "logo.svg",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const LIB_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("tecflow-") && k !== SHELL && k !== LIBS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(SHELL).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
    return;
  }
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(LIBS).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") c.put(req, r.clone());
      return r;
    }))));
  }
});
