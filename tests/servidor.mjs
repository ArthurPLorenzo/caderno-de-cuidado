// Servidor estático simples para rodar o app no computador: npm start (porta 8080)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const porta = Number(process.env.PORT) || 8080;
const tipos = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".pdf": "application/pdf"
};

http.createServer(async (req, res) => {
  let caminho = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (caminho.endsWith("/")) caminho += "index.html";
  const arq = normalize(join(raiz, caminho));
  if (!arq.startsWith(normalize(raiz)) || /[\/](node_modules|referencia|dados)[\/]/.test(arq)) { res.writeHead(403).end(); return; }
  try {
    const corpo = await readFile(arq);
    res.writeHead(200, { "Content-Type": tipos[extname(arq)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(corpo);
  } catch {
    res.writeHead(404).end("não encontrado");
  }
}).listen(porta, () => console.log("Caderno de Cuidado em http://localhost:" + porta + "/?dev=1"));
