// Peças usadas em mais de uma tela: miniaturas, cartão de documento, item do diário, confirmações.
import { h, pill, dataBR, cap, falta, fmtHora, toast } from "../util.js";
import * as store from "../store.js";
import { estado } from "../store.js";
import { categoria, docTipo, respostasTexto } from "../categorias.js";
import { ehPDF, extensao, compartilharArquivos } from "../arquivos.js";
import { abrir } from "./visualizador.js";

/* ---------- confirmação na própria tela (o app não usa confirm()) ---------- */
let confirmando = null;
export function limparConfirmacao() { confirmando = null; }
export function botaoConfirmar(chave, rotulo, rotuloSim, acao, rotuloNao) {
  if (confirmando === chave) {
    return h("span", { class: "confirm" },
      h("button", { class: "btn small danger", type: "button", onclick: () => { confirmando = null; acao(); } }, rotuloSim),
      h("button", { class: "btn small ghost", type: "button", onclick: () => { confirmando = null; store.emitir(); } }, rotuloNao || "Cancelar"));
  }
  return h("button", { class: "linkbtn perigo", type: "button", onclick: () => { confirmando = chave; store.emitir(); } }, rotulo);
}

/* ---------- consultas ---------- */
export function consultaPorId(id) { return estado.consultas.find((c) => c.id === id); }
export function docPorId(id) { return estado.pasta.find((d) => d.id === id); }
export function rotuloConsulta(c) { return (c.data ? dataBR(c.data) : "A marcar") + " · " + (c.especialidade || "Consulta"); }
export function ordemConsulta(a, b) {
  if (!a.data && !b.data) return (a.criadoEm || 0) - (b.criadoEm || 0);
  if (!a.data) return 1;
  if (!b.data) return -1;
  return a.data.localeCompare(b.data) || (a.hora || "").localeCompare(b.hora || "");
}
export function consultasAbertas() { return estado.consultas.filter((c) => !c.feita).sort(ordemConsulta); }
export function quandoConsulta(c) {
  return c.data ? (c.feita ? dataBR(c.data) : cap(falta(c.data)) + " · " + dataBR(c.data)) : "Data a marcar";
}

/* ---------- arquivos ---------- */
export function thumbArquivo(a, onclick, alt) {
  if (ehPDF(a)) return h("button", { class: "thumb", type: "button", "aria-label": "Abrir PDF" + (alt ? ": " + alt : ""), onclick }, h("span", { class: "pdf" }, "PDF"));
  const b = h("button", { class: "thumb", type: "button", "aria-label": "Ampliar" + (alt ? ": " + alt : ""), onclick });
  store.urlArquivo(a.id).then((url) => {
    if (url) b.append(h("img", { src: url, alt: alt || "Arquivo" }));
    else b.append(h("span", { class: "falta" }, "Arquivo não está neste aparelho"));
  });
  return b;
}
export async function compartilharDoc(d) {
  const arqs = d.arquivos || [];
  const files = [];
  for (let i = 0; i < arqs.length; i++) {
    const b = await store.lerArquivo(arqs[i].id);
    if (!b) continue;
    const base = (d.titulo || docTipo(d.tipo).rotulo).replace(/[\\/:*?"<>|]+/g, " ").trim();
    const nome = base + (arqs.length > 1 ? " " + (i + 1) : "") + "." + extensao(b.type);
    files.push(new File([b], nome, { type: b.type }));
  }
  if (!files.length) { toast("Os arquivos deste documento não estão neste aparelho."); return; }
  await compartilharArquivos(files, d.titulo || docTipo(d.tipo).rotulo);
}

/* ---------- cartão de documento da pasta ---------- */
let levando = null;
export function docCard(d, opts) {
  opts = opts || {};
  const t = docTipo(d.tipo), arqs = d.arquivos || [], titulo = d.titulo || t.rotulo;
  const acoes = [];
  if (arqs.length) {
    acoes.push(h("button", { class: "linkbtn", type: "button", onclick: () => abrir(arqs, 0) }, arqs.length > 1 ? "Ver os " + arqs.length + " arquivos" : "Ver"));
    acoes.push(h("button", { class: "linkbtn", type: "button", onclick: () => compartilharDoc(d) }, "Compartilhar"));
  }
  let em = null;
  if (opts.consulta) {
    acoes.push(h("button", { class: "linkbtn", type: "button", onclick: () => {
      const c = opts.consulta;
      store.salvar("consultas", Object.assign({}, c, { documentos: (c.documentos || []).filter((x) => x !== d.id) }));
    } }, "Tirar desta consulta"));
  } else {
    acoes.push(levando === d.id ? levarEm(d)
      : h("button", { class: "linkbtn", type: "button", onclick: () => { levando = d.id; store.emitir(); } }, "Separar para consulta"));
    acoes.push(botaoConfirmar("doc:" + d.id, "Apagar", "Apagar de vez", () => store.remover("pasta", d).then(() => toast("Documento apagado."))));
    em = consultasAbertas().filter((c) => (c.documentos || []).indexOf(d.id) >= 0);
  }
  return h("li", { class: "doc" },
    arqs.length ? thumbArquivo(arqs[0], () => abrir(arqs, 0), titulo) : h("div", { class: "thumb vazio-thumb", "aria-hidden": "true" }),
    h("div", { class: "doc-body" },
      h("div", { class: "entry-head" }, pill(t.rotulo, t.cor), h("span", { class: "meta" }, dataBR(d.data))),
      h("h3", {}, titulo),
      d.origem ? h("p", { class: "small" }, "De: " + d.origem) : null,
      d.obs ? h("p", { class: "entry-text" }, d.obs) : null,
      em && em.length ? h("p", { class: "small separado" }, "Separado para: " + em.map(rotuloConsulta).join("; ")) : null,
      h("div", { class: "meta" }, acoes)));
}
function levarEm(d) {
  const abertas = consultasAbertas().filter((c) => (c.documentos || []).indexOf(d.id) < 0);
  const fechar = h("button", { class: "btn small ghost", type: "button", onclick: () => { levando = null; store.emitir(); } }, "Cancelar");
  if (!abertas.length) {
    return h("span", { class: "levar" }, h("span", { class: "small" }, "Nenhuma consulta em aberto. Crie uma na aba Consultas."), fechar);
  }
  const s = h("select", { id: "levar-" + d.id, "aria-label": "Escolha a consulta" }, abertas.map((c) => h("option", { value: c.id }, rotuloConsulta(c))));
  return h("span", { class: "levar" }, s,
    h("button", { class: "btn small", type: "button", onclick: () => {
      const c = consultaPorId(s.value);
      if (!c) return;
      levando = null;
      store.salvar("consultas", Object.assign({}, c, { documentos: (c.documentos || []).concat([d.id]) }))
        .then(() => toast("Separado para " + rotuloConsulta(c) + "."));
    } }, "Separar"), fechar);
}
export function sairDocs() { levando = null; }

/* ---------- item do diário ---------- */
export function itemDiario(e, opts) {
  opts = opts || {};
  const cat = categoria(store.categorias(), e.categoria), det = respostasTexto(cat, e.campos);
  const fotos = (e.fotos || []).map((id) => ({ id, mime: "image/jpeg" }));
  return h("li", { class: "entry" },
    h("time", { datetime: e.quando || "" }, e.horaDesconhecida ? "—" : fmtHora(store.tsRegistro(e))),
    h("div", { class: "entry-body" },
      h("div", { class: "entry-head" }, pill(cat.rotulo, cat.cor), e.horaDesconhecida ? h("span", { class: "meta" }, "horário não informado") : null),
      e.texto ? h("p", { class: "entry-text" }, e.texto) : null,
      fotos.length ? h("div", { class: "thumbs" }, fotos.map((a, i) => thumbArquivo(a, () => abrir(fotos, i), "Foto " + (i + 1)))) : null,
      det.length ? h("ul", { class: "det" }, det.map((x) => h("li", {}, h("b", {}, x[0] + ": "), x[1]))) : null,
      h("div", { class: "meta" },
        e.quem ? h("span", {}, e.quem) : null,
        opts.apagar ? botaoConfirmar("reg:" + e.id, "Apagar", "Apagar de vez", () => store.remover("diario", e).then(() => toast("Registro apagado."))) : null)));
}

