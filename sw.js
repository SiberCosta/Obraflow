/* ObraFlow · service worker
   - a app (html, css, js) vem da rede quando há ligação e fica guardada para abrir sem rede
   - bibliotecas e tipos de letra (CDN) ficam guardados depois da primeira vez
   - nada do Supabase (dados e ficheiros) passa por aqui: isso é tratado pela app */
const VERSION = "v19";
const SHELL = "obra-shell-" + VERSION, LIBS = "obra-libs-" + VERSION;
const CORE = ["./", "index.html", "styles.css", "app.js", "config.js", "manifest.webmanifest",
  "vendor/pdf.js", "vendor/pdf.worker.js", "vendor/jszip.min.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const LIB_HOSTS = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com", "tessdata.projectnaptha.com", "unpkg.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== LIBS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // rede primeiro (para receber atualizações), guardado se não houver rede
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(SHELL).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
    return;
  }
  if (LIB_HOSTS.includes(url.hostname)) {
    // guardado primeiro (as versões estão fixas no endereço)
    e.respondWith(caches.open(LIBS).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") c.put(req, r.clone());
      return r;
    }))));
  }
});
