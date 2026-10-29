// Service worker: guarda todos os arquivos do app para funcionar sem internet.
// Ao publicar mudanças, aumente VERSAO: o app mostra "Nova versão disponível · Atualizar".
const VERSAO = "v2";
const CACHE = "caderno-" + VERSAO;

const ARQUIVOS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/tokens.css",
  "css/app.css",
  "js/config.js",
  "js/util.js",
  "js/db.js",
  "js/store.js",
  "js/categorias.js",
  "js/formato.js",
  "js/arquivos.js",
  "js/main.js",
  "js/telas/inicio.js",
  "js/telas/consultas.js",
  "js/telas/pasta.js",
  "js/telas/diario.js",
  "js/telas/remedios.js",
  "js/telas/ajustes.js",
  "js/telas/importar.js",
  "js/telas/visualizador.js",
  "js/telas/comum.js",
  "fonts/atkinson-hyperlegible-latin-400-normal.woff2",
  "fonts/atkinson-hyperlegible-latin-400-italic.woff2",
  "fonts/atkinson-hyperlegible-latin-700-normal.woff2",
  "fonts/literata-latin-wght-normal.woff2",
  "fonts/ibm-plex-mono-latin-400-normal.woff2",
  "fonts/ibm-plex-mono-latin-500-normal.woff2",
  "icons/apple-touch-icon.png",
  "icons/icone-192.png",
  "icons/icone-512.png",
  "icons/icone-maskable-512.png",
  "vendor/pdfjs-3.11.174/pdf.min.js",
  "vendor/pdfjs-3.11.174/pdf.worker.min.js",
  "vendor/jszip-3.10.1/jszip.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((nomes) =>
    Promise.all(nomes.filter((n) => n.startsWith("caderno-") && n !== CACHE).map((n) => caches.delete(n)))
  ).then(() => self.clients.claim()));
});

// A página pede para trocar de versão quando a pessoa toca em "Atualizar".
self.addEventListener("message", (e) => {
  if (e.data === "atualizar") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req, { ignoreSearch: true }).then((r) => r || fetch(req))
    )
  );
});
