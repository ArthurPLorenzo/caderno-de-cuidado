// Estado em memória, espelhado no IndexedDB. Toda mudança passa por aqui e avisa a tela.
import * as db from "./db.js";
import { todasCategorias } from "./categorias.js";
import { agoraLocal, hojeYMD, novoId, getPref, tsQuando, DIA } from "./util.js";

export const estado = {
  pessoa: { nome: "", sobre: [], equipe: [] },
  alertas: [],
  categoriasPerfil: [],
  remedios: [], diario: [], consultas: [], pasta: [],
  iniciado: false,
  ultimoBackup: ""
};
const META = ["pessoa", "alertas", "categoriasPerfil", "iniciado", "ultimoBackup"];
const META_PADRAO = { pessoa: { nome: "", sobre: [], equipe: [] }, alertas: [], categoriasPerfil: [], iniciado: false, ultimoBackup: "" };

const ouvintes = [];
export function ouvir(fn) { ouvintes.push(fn); }
export function emitir() { ouvintes.forEach((fn) => fn()); }

export async function carregar() {
  const metas = await db.todos("meta");
  META.forEach((k) => {
    const m = metas.find((x) => x.chave === k);
    estado[k] = m ? m.valor : JSON.parse(JSON.stringify(META_PADRAO[k]));
  });
  for (const c of db.COLECOES) estado[c] = await db.todos(c);
}

export function categorias() { return todasCategorias(estado.categoriasPerfil); }
export function tsRegistro(e) { return tsQuando(e.quando); }
export function tsDoc(d) { return tsQuando(d.data) + DIA / 2; }

/* ---------- gravação ---------- */
export async function setMeta(chave, valor) {
  await db.gravar("meta", { chave, valor });
  estado[chave] = valor;
  emitir();
}
export async function salvar(colecao, obj) {
  await db.gravar(colecao, obj);
  const lista = estado[colecao], i = lista.findIndex((x) => x.id === obj.id);
  if (i >= 0) lista[i] = obj; else lista.push(obj);
  emitir();
  return obj;
}
export async function remover(colecao, item) {
  await db.apagar(colecao, item.id);
  estado[colecao] = estado[colecao].filter((x) => x.id !== item.id);
  const blobs = colecao === "pasta" ? (item.arquivos || []).map((a) => a.id) : colecao === "diario" ? (item.fotos || []) : [];
  const usados = blobs.filter(Boolean);
  if (usados.length) await db.apagar("arquivos", usados);
  if (colecao === "pasta") {
    // tira o documento das consultas onde estava separado
    const afetadas = estado.consultas.filter((c) => (c.documentos || []).indexOf(item.id) >= 0)
      .map((c) => Object.assign({}, c, { documentos: c.documentos.filter((x) => x !== item.id) }));
    if (afetadas.length) {
      await db.gravar("consultas", afetadas);
      afetadas.forEach((c) => { estado.consultas[estado.consultas.findIndex((x) => x.id === c.id)] = c; });
    }
  }
  emitir();
}
export async function apagarTudo() {
  await db.limparTudo();
  Object.keys(urls).forEach((k) => { URL.revokeObjectURL(urls[k]); delete urls[k]; });
  await carregar();
  emitir();
}

/* ---------- arquivos (fotos e PDFs) ---------- */
export async function guardarArquivo(blob, mime) {
  const id = novoId("a");
  const dados = await blob.arrayBuffer();
  await db.gravar("arquivos", { id, dados, mime: mime || blob.type || "application/octet-stream" });
  return id;
}
export async function lerArquivo(id) {
  if (!id) return null;
  const a = await db.pegar("arquivos", id);
  return a ? new Blob([a.dados], { type: a.mime }) : null;
}
const urls = {};
/* URL para mostrar a imagem; null se o arquivo não estiver no aparelho. */
export async function urlArquivo(id) {
  if (urls[id]) return urls[id];
  const b = await lerArquivo(id);
  if (!b) return null;
  urls[id] = URL.createObjectURL(b);
  return urls[id];
}

/* ---------- remédios: toda mudança vai para o diário ---------- */
export function quemRegistra() { return getPref("quem", ""); }
export function novoRegistroMedicacao(texto, quando) {
  return { id: novoId("d"), categoria: "medicacao", quando: quando || agoraLocal(), horaDesconhecida: false, texto, campos: {}, quem: quemRegistra(), fotos: [] };
}
export function descreveDose(m) { return [m.dose, m.posologia].filter(Boolean).join(", "); }
export function mudouDose(antigo, novo) {
  return (antigo.dose || "") !== (novo.dose || "") || (antigo.posologia || "") !== (novo.posologia || "");
}
export function textoMudanca(antigo, novo) {
  return novo.nome + ": " + (descreveDose(antigo) || "sem dose") + " → " + (descreveDose(novo) || "sem dose");
}
export async function salvarRemedio(antigo, dados) {
  const novo = !antigo;
  const m = Object.assign({}, antigo || { id: novoId("r"), ordem: estado.remedios.reduce((mx, x) => Math.max(mx, x.ordem || 0), 0) + 1 }, dados);
  const mudou = novo || mudouDose(antigo, m);
  if (mudou || !m.atualizadoEm) m.atualizadoEm = hojeYMD();
  await db.gravar("remedios", m);
  if (mudou) {
    const texto = novo ? m.nome + " incluído: " + (descreveDose(m) || "sem dose informada") : textoMudanca(antigo, m);
    const r = novoRegistroMedicacao(texto);
    await db.gravar("diario", r);
    estado.diario.push(r);
  }
  const i = estado.remedios.findIndex((x) => x.id === m.id);
  if (i >= 0) estado.remedios[i] = m; else estado.remedios.push(m);
  emitir();
  return mudou;
}
export async function tirarRemedio(m) {
  await db.apagar("remedios", m.id);
  const r = novoRegistroMedicacao(m.nome + (m.dose ? " " + m.dose : "") + " saiu da lista de remédios em uso.");
  await db.gravar("diario", r);
  estado.remedios = estado.remedios.filter((x) => x.id !== m.id);
  estado.diario.push(r);
  emitir();
}
