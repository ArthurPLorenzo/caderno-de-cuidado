// Visualizador em tela cheia: fotos e PDFs (pdf.js), com anterior e próximo.
import { $, h, setKids } from "../util.js";
import * as store from "../store.js";
import { ehPDF, pdfjs } from "../arquivos.js";

const lb = { arqs: [], i: 0, tok: 0, foco: null };

export function montar() {
  $("#lb-fechar").addEventListener("click", fechar);
  $("#lb-ant").addEventListener("click", () => mover(-1));
  $("#lb-prox").addEventListener("click", () => mover(1));
  document.addEventListener("keydown", (e) => {
    if ($("#lightbox").hidden) return;
    if (e.key === "Escape") fechar();
    else if (e.key === "ArrowLeft") mover(-1);
    else if (e.key === "ArrowRight") mover(1);
  });
}
export function abrir(arqs, i) {
  lb.arqs = arqs; lb.i = i || 0; lb.foco = document.activeElement;
  $("#lightbox").hidden = false;
  document.body.style.overflow = "hidden";
  desenhar();
  $("#lb-fechar").focus();
}
function fechar() {
  $("#lightbox").hidden = true;
  document.body.style.overflow = "";
  lb.tok++;
  $("#lb-corpo").replaceChildren();
  if (lb.foco && lb.foco.focus && document.contains(lb.foco)) lb.foco.focus();
}
function mover(d) {
  const n = lb.arqs.length;
  if (n < 2) return;
  lb.i = (lb.i + d + n) % n;
  desenhar();
}
function msg(t) { return h("p", { class: "lb-msg" }, t); }
async function desenhar() {
  const a = lb.arqs[lb.i], corpo = $("#lb-corpo"), tok = ++lb.tok, n = lb.arqs.length;
  $("#lb-conta").textContent = n > 1 ? (lb.i + 1) + " de " + n : "";
  $("#lb-ant").hidden = n < 2;
  $("#lb-prox").hidden = n < 2;
  corpo.scrollTop = 0;
  if (ehPDF(a)) { mostraPDF(a.id, corpo, tok); return; }
  const url = await store.urlArquivo(a.id);
  if (tok !== lb.tok) return;
  setKids(corpo, url ? h("img", { src: url, alt: "Arquivo " + (lb.i + 1) }) : msg("Este arquivo não está neste aparelho."));
}
async function mostraPDF(id, corpo, tok) {
  setKids(corpo, msg("Abrindo o PDF…"));
  try {
    const [L, blob] = await Promise.all([pdfjs(), store.lerArquivo(id)]);
    if (!blob) { if (tok === lb.tok) setKids(corpo, msg("Este arquivo não está neste aparelho.")); return; }
    const pdf = await L.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    if (tok !== lb.tok) return;
    corpo.replaceChildren();
    const total = Math.min(pdf.numPages, 30);
    const largura = Math.min((corpo.clientWidth || 800) - 24, 1000);
    for (let p = 1; p <= total; p++) {
      const page = await pdf.getPage(p);
      if (tok !== lb.tok) return;
      const base = page.getViewport({ scale: 1 }), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: (largura / base.width) * dpr });
      const cv = h("canvas", { class: "pdf-page", "aria-label": "Página " + p });
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      cv.style.width = Math.floor(vp.width / dpr) + "px";
      corpo.append(cv);
      await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
    }
    if (tok === lb.tok && pdf.numPages > total) corpo.append(msg("Mostrando " + total + " de " + pdf.numPages + " páginas."));
  } catch (e) {
    if (tok === lb.tok) setKids(corpo, msg("Não foi possível mostrar este PDF aqui. Use “Compartilhar” para abrir em outro app."));
  }
}
