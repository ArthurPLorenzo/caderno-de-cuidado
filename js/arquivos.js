// Fotos, PDFs, compartilhamento e bibliotecas carregadas sob demanda (vendor/).
import { h, toast } from "./util.js";

export const MAX_LADO = 2000;

export function ehPDF(a) { return !!a && (a.mime === "application/pdf" || a.type === "application/pdf" || /\.pdf$/i.test(a.nome || a.name || "")); }
export function ehImagem(f) { return /^image\//.test(f.type || "") || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name || ""); }

/* Reduz a foto para no máximo 2000 px no lado maior e grava em JPEG. */
export function comprimir(file) {
  return new Promise((res) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, hh = img.naturalHeight, s = Math.min(1, MAX_LADO / Math.max(w, hh));
      const c = document.createElement("canvas");
      c.width = Math.round(w * s); c.height = Math.round(hh * s);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      try { c.toBlob((b) => res(b && b.size ? b : file), "image/jpeg", 0.85); } catch (e) { res(file); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}

export function extensao(mime) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "application/pdf": "pdf" }[mime] || "bin";
}

/* ---------- baixar e compartilhar ---------- */
export function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: nome });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function podeCompartilhar(files) {
  try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; }
}
/* Abre o compartilhamento do iPhone com os arquivos. Se o iPhone recusar porque
   demorou para preparar, mostra uma folha com o botão para tocar de novo. Sem
   compartilhamento (computador), baixa o arquivo. Resolve true se enviou ou baixou. */
export async function compartilharArquivos(files, titulo) {
  if (!podeCompartilhar(files)) {
    files.forEach((f) => baixar(f, f.name));
    return true;
  }
  try {
    await navigator.share({ files, title: titulo });
    return true;
  } catch (e) {
    if (e && e.name === "AbortError") return false;
    return folhaCompartilhar(files, titulo);
  }
}
function folhaCompartilhar(files, titulo) {
  return new Promise((res) => {
    const fechar = (ok) => { fundo.remove(); res(ok); };
    const fundo = h("div", { class: "folha-fundo", role: "dialog", "aria-modal": "true", "aria-label": "Arquivo pronto" },
      h("div", { class: "folha" },
        h("h2", {}, "Arquivo pronto"),
        h("p", {}, files.length === 1 ? files[0].name : files.length + " arquivos"),
        h("button", { class: "btn grande", type: "button", onclick: () => {
          navigator.share({ files, title: titulo }).then(() => fechar(true), (e) => { if (!e || e.name !== "AbortError") toast("Não deu para compartilhar. Use “Baixar”."); });
        } }, "Compartilhar"),
        h("button", { class: "btn ghost grande", type: "button", onclick: () => { files.forEach((f) => baixar(f, f.name)); fechar(true); } }, "Baixar"),
        h("button", { class: "linkbtn", type: "button", onclick: () => fechar(false) }, "Fechar")));
    document.body.append(fundo);
    fundo.querySelector(".btn").focus();
  });
}
/* Compartilha um texto; sem compartilhamento, copia para a área de transferência. */
export async function compartilharTexto(titulo, texto) {
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: texto }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(texto);
    toast("Resumo copiado. Cole na conversa ou no e-mail.");
  } catch (e) {
    toast("Não foi possível compartilhar nem copiar o resumo.");
  }
}

/* ---------- bibliotecas (servidas de vendor/, sem internet) ---------- */
const scripts = {};
function carregaScript(src) {
  if (!scripts[src]) {
    scripts[src] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => { delete scripts[src]; rej(new Error("script")); };
      document.head.appendChild(s);
    });
  }
  return scripts[src];
}
export async function pdfjs() {
  await carregaScript("vendor/pdfjs-3.11.174/pdf.min.js");
  const L = window.pdfjsLib;
  L.GlobalWorkerOptions.workerSrc = "vendor/pdfjs-3.11.174/pdf.worker.min.js";
  return L;
}
export async function jszip() {
  await carregaScript("vendor/jszip-3.10.1/jszip.min.js");
  return window.JSZip;
}
