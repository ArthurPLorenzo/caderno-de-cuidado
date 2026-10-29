// Pasta: fotos e PDFs com tipo, data, origem e observação; separar para consulta.
import { h, setKids, keepFocus, vazio, toast, ir, nav, hojeYMD, cap, normaliza, tsQuando, novoId } from "../util.js";
import * as store from "../store.js";
import { estado } from "../store.js";
import { DOC_TIPOS, docTipo } from "../categorias.js";
import { comprimir, ehPDF, ehImagem } from "../arquivos.js";
import { docCard, consultasAbertas, consultaPorId, rotuloConsulta, sairDocs } from "./comum.js";

const MAX_ARQ = 10, MAX_PDF = 30 * 1024 * 1024;
let form = null, filtro = "todos", busca = "", enviando = "", previas = [], box = null;

function novoForm() { return { arquivos: [], tipo: "foto", data: hojeYMD(), titulo: "", origem: "", obs: "", consulta: "", volta: "" }; }
export function sair() { form = null; enviando = ""; sairDocs(); }
function redesenhar() { if (box) keepFocus(() => render(box)); }

export function render(alvo) {
  box = alvo;
  if (!form) form = novoForm();
  if (nav.extra) {
    if (nav.extra.tipo) form.tipo = nav.extra.tipo;
    if (nav.extra.consulta) { form.consulta = nav.extra.consulta; form.volta = "consulta/" + nav.extra.consulta; }
    nav.extra = null;
  }
  setKids(box, h("div", { class: "view" }, formulario(), filtros(), lista()));
}

/* ---------- guardar ---------- */
function escolher(ev) {
  const novos = Array.prototype.slice.call(ev.target.files || []).filter((f) => ehImagem(f) || ehPDF(f));
  ev.target.value = "";
  if (form.arquivos.length + novos.length > MAX_ARQ) toast("Até " + MAX_ARQ + " arquivos por vez.");
  form.arquivos = form.arquivos.concat(novos).slice(0, MAX_ARQ);
  redesenhar();
}
function previa() {
  previas.forEach((u) => URL.revokeObjectURL(u));
  previas = [];
  return h("div", { class: "thumbs", id: "pasta-previa" }, form.arquivos.map((f, i) => {
    let conteudo;
    if (ehPDF(f)) conteudo = h("span", { class: "pdf" }, "PDF");
    else { const u = URL.createObjectURL(f); previas.push(u); conteudo = h("img", { src: u, alt: "Arquivo " + (i + 1) + " para guardar" }); }
    return h("div", { class: "thumb" }, conteudo,
      h("button", { class: "x", type: "button", "aria-label": "Tirar o arquivo " + (i + 1), onclick: () => { form.arquivos.splice(i, 1); redesenhar(); } }, "×"));
  }));
}
function ligado(el, chave) {
  el.value = form[chave];
  el.addEventListener("input", () => { form[chave] = el.value; });
  el.addEventListener("change", () => { form[chave] = el.value; });
  return el;
}
function formulario() {
  const input = h("input", { type: "file", id: "pasta-input", accept: "image/*,application/pdf", multiple: true, class: "sr-only" });
  input.addEventListener("change", escolher);
  const abertas = consultasAbertas();
  if (form.consulta && !abertas.some((c) => c.id === form.consulta)) form.consulta = "";
  return h("form", { class: "panel form", novalidate: true, onsubmit: guardar },
    h("h2", {}, "Guardar na pasta"),
    h("p", { class: "small" }, "Laudos, exames, receitas, análises, páginas do caderno, prints de conversa. Foto ou PDF."),
    input,
    h("label", { for: "pasta-input", class: "btn ghost file-btn" }, form.arquivos.length ? "Escolher mais" : "Tirar foto ou escolher arquivo"),
    form.arquivos.length ? previa() : null,
    h("div", { class: "row" },
      h("label", { class: "field" }, h("span", {}, "O que é"), ligado(h("select", { id: "pasta-tipo" }, DOC_TIPOS.map((t) => h("option", { value: t.id }, t.rotulo))), "tipo")),
      h("label", { class: "field" }, h("span", {}, "Data do documento"), ligado(h("input", { type: "date", id: "pasta-data" }), "data"))),
    h("div", { class: "row" },
      h("label", { class: "field" }, h("span", {}, "Título (opcional)"), ligado(h("input", { type: "text", id: "pasta-titulo", placeholder: "ex.: Exame de sangue" }), "titulo")),
      h("label", { class: "field" }, h("span", {}, "De quem veio (opcional)"), ligado(h("input", { type: "text", id: "pasta-origem", placeholder: "ex.: laboratório, escola" }), "origem"))),
    h("label", { class: "field" }, h("span", {}, "Separar para consulta (opcional)"),
      ligado(h("select", { id: "pasta-consulta" }, [h("option", { value: "" }, "Nenhuma por enquanto")].concat(abertas.map((c) => h("option", { value: c.id }, rotuloConsulta(c))))), "consulta")),
    h("label", { class: "field" }, h("span", {}, "Observação (opcional)"), ligado(h("input", { type: "text", id: "pasta-obs" }), "obs")),
    h("div", { class: "actions" }, h("button", { class: "btn grande", type: "submit", id: "pasta-enviar", disabled: !!enviando }, enviando || "Guardar na pasta")));
}
async function guardar(ev) {
  ev.preventDefault();
  if (enviando) return;
  if (!form.arquivos.length) { toast("Escolha pelo menos um arquivo."); return; }
  if (form.arquivos.some((f) => ehPDF(f) && f.size > MAX_PDF)) { toast("Um dos PDFs é grande demais (máximo 30 MB)."); return; }
  const f = form, arquivos = [];
  try {
    for (let i = 0; i < f.arquivos.length; i++) {
      enviando = "Guardando " + (i + 1) + " de " + f.arquivos.length + "…"; redesenhar();
      const a = f.arquivos[i];
      if (ehPDF(a)) arquivos.push({ id: await store.guardarArquivo(a, "application/pdf"), mime: "application/pdf", nome: a.name || "" });
      else { const b = await comprimir(a); const mime = b.type || "image/jpeg"; arquivos.push({ id: await store.guardarArquivo(b, mime), mime, nome: a.name || "" }); }
    }
  } catch (e) {
    enviando = ""; redesenhar();
    toast("Não foi possível guardar. Pode faltar espaço no aparelho.");
    return;
  }
  const doc = { id: novoId("doc"), tipo: f.tipo, titulo: f.titulo.trim(), data: f.data || hojeYMD(), origem: f.origem.trim(), obs: f.obs.trim(), arquivos };
  form = null; enviando = "";
  await store.salvar("pasta", doc);
  const c = f.consulta ? consultaPorId(f.consulta) : null;
  if (c) await store.salvar("consultas", Object.assign({}, c, { documentos: (c.documentos || []).concat([doc.id]) }));
  toast(c ? "Guardado na pasta e separado para " + rotuloConsulta(c) + "." : "Guardado na pasta.");
  if (f.volta) ir(f.volta);
}

/* ---------- lista ---------- */
function filtros() {
  const usados = DOC_TIPOS.filter((t) => estado.pasta.some((d) => d.tipo === t.id));
  if (filtro !== "todos" && !usados.some((t) => t.id === filtro)) filtro = "todos";
  const campoBusca = h("input", { type: "search", id: "busca-pasta", placeholder: "Buscar na pasta", "aria-label": "Buscar na pasta" });
  campoBusca.value = busca;
  campoBusca.addEventListener("input", () => { busca = campoBusca.value; redesenhar(); });
  return [
    estado.pasta.length >= 4 ? campoBusca : null,
    usados.length >= 2 ? h("div", { class: "filtros", role: "group", "aria-label": "Filtrar a pasta" },
      [{ id: "todos", rotulo: "Tudo" }].concat(usados).map((o) =>
        h("button", { type: "button", "aria-pressed": String(filtro === o.id), onclick: () => { filtro = o.id; redesenhar(); } }, o.rotulo))) : null
  ];
}
function lista() {
  const q = normaliza(busca.trim());
  const itens = estado.pasta.filter((d) => {
    if (filtro !== "todos" && d.tipo !== filtro) return false;
    return !q || normaliza([d.titulo, d.obs, d.origem, docTipo(d.tipo).rotulo].join(" ")).indexOf(q) >= 0;
  }).sort((a, b) => b.data.localeCompare(a.data));
  if (!itens.length) {
    return vazio(estado.pasta.length ? "Nada encontrado." : "A pasta está vazia. Comece pelo que você mais leva às consultas: o último laudo, a receita atual, as páginas do caderno.");
  }
  const grupos = [];
  itens.forEach((d) => {
    const k = d.data.slice(0, 7), g = grupos[grupos.length - 1];
    if (g && g.k === k) g.itens.push(d);
    else grupos.push({ k, rot: cap(new Date(tsQuando(d.data)).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })), itens: [d] });
  });
  return h("div", { class: "view", id: "lista-pasta" }, grupos.map((g) =>
    h("div", { class: "grupo" }, h("h3", { class: "mes" }, g.rot), h("ul", { class: "docs" }, g.itens.map((d) => docCard(d))))));
}
