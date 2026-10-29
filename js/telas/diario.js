// Diário: registro rápido por categoria, lista por dia com a margem do caderno e filtro.
import { h, setKids, vazio, toast, ir, agoraLocal, cap, fmtDiaLongo, getPref, setPref, novoId } from "../util.js";
import * as store from "../store.js";
import { estado } from "../store.js";
import { categoria, avisosAtivos } from "../categorias.js";
import { itemDiario } from "./comum.js";

const QUEM_PADRAO = ["Mãe", "Pai", "Outro familiar", "Acompanhante terapêutico"];
let form = null, filtro = "todos", box = null;

function novoForm() {
  return { categoria: getPref("categoria", ""), quando: agoraLocal(), semHora: false, texto: "", respostas: {} };
}
export function sair() { form = null; }
function redesenhar() { if (box) render(box); }

export function render(alvo) {
  box = alvo;
  if (!form) form = novoForm();
  const cats = store.categorias();
  if (!cats.some((c) => c.id === form.categoria)) form.categoria = cats[0].id;
  setKids(box, h("div", { class: "view" },
    h("section", { class: "panel" },
      h("p", {}, "Escreveu no caderno de papel? Fotografe a página e guarde na pasta. Ela entra no resumo de cada consulta."),
      h("button", { class: "btn ghost small", type: "button", onclick: () => ir("pasta", { tipo: "caderno" }) }, "Guardar foto do caderno")),
    formulario(cats),
    filtros(cats),
    lista()));
}

/* ---------- formulário ---------- */
function opcoesQuem() {
  const eq = (estado.pessoa.equipe || []).map((e) => e.especialidade).filter(Boolean);
  return QUEM_PADRAO.concat(eq, ["Outro"]).filter((v, i, a) => a.indexOf(v) === i);
}
function formulario(cats) {
  const cat = categoria(cats, form.categoria);
  const chips = h("div", { class: "chips" }, cats.map((c) => {
    const r = h("input", { type: "radio", name: "categoria", id: "d-cat-" + c.id, value: c.id });
    r.checked = c.id === form.categoria;
    r.addEventListener("change", () => { form.categoria = c.id; form.respostas = {}; setPref("categoria", c.id); redesenhar(); });
    return h("label", { class: "chip" }, r, h("span", { style: "--c:var(--c-" + c.cor + ")" }, h("i", { "aria-hidden": "true" }), c.rotulo));
  }));

  const quando = h("input", { type: "datetime-local", id: "d-quando" });
  quando.value = form.quando;
  quando.addEventListener("change", () => { form.quando = quando.value; });
  const semHora = h("input", { type: "checkbox", id: "d-semhora" });
  semHora.checked = form.semHora;
  semHora.addEventListener("change", () => { form.semHora = semHora.checked; });

  const quem = h("select", { id: "d-quem" }, [h("option", { value: "" }, "Escolha…")].concat(opcoesQuem().map((q) => h("option", { value: q }, q))));
  quem.value = store.quemRegistra();
  quem.addEventListener("change", () => setPref("quem", quem.value));

  const avisos = h("div", { class: "bloco", "aria-live": "polite" });
  const atualizaAvisos = () => setKids(avisos, avisosAtivos(cat, form.respostas).map((a) => h("p", { class: "aviso" }, a.texto)));
  atualizaAvisos();

  const texto = h("textarea", { id: "d-texto", rows: "3", placeholder: "Pode ser curto: o que você viu e por quanto tempo." });
  texto.value = form.texto;
  texto.addEventListener("input", () => { form.texto = texto.value; });

  const campos = (cat.campos || []).map((c) => campoCategoria(c, atualizaAvisos));

  return h("form", { class: "panel form", novalidate: true, onsubmit: salvar },
    h("h2", {}, "Registro rápido"),
    h("fieldset", { class: "field" }, h("legend", {}, "O que aconteceu"), chips),
    h("div", { class: "row" },
      h("label", { class: "field" }, h("span", {}, "Quando"), quando),
      h("label", { class: "field" }, h("span", {}, "Quem registra"), quem)),
    h("label", { class: "check" }, semHora, h("span", {}, "Não sei a hora certa")),
    campos.length ? h("div", { class: "extra" }, campos) : null,
    avisos,
    h("label", { class: "field" }, h("span", {}, "Descrição"), texto),
    h("div", { class: "actions" }, h("button", { class: "btn grande", type: "submit" }, "Salvar no diário")));
}
function campoCategoria(c, mudou) {
  const id = "d-campo-" + c.id, r = form.respostas;
  const dica = c.dica ? h("span", { class: "dica" }, c.dica) : null;
  if (c.tipo === "uma" || c.tipo === "varias") {
    const multi = c.tipo === "varias";
    return h("fieldset", { class: "field" }, h("legend", {}, c.rotulo), dica,
      h("div", { class: "chips" }, (c.opcoes || []).map((o, i) => {
        const inp = h("input", { type: multi ? "checkbox" : "radio", name: id, id: id + "-" + i, value: o });
        inp.checked = multi ? (r[c.id] || []).indexOf(o) >= 0 : r[c.id] === o;
        inp.addEventListener("change", () => {
          if (multi) {
            const atual = (r[c.id] || []).filter((x) => x !== o);
            r[c.id] = inp.checked ? atual.concat([o]) : atual;
          } else r[c.id] = o;
          mudou();
        });
        return h("label", { class: "chip" }, inp, h("span", {}, o));
      })));
  }
  const el = c.tipo === "texto_longo" ? h("textarea", { id, rows: "2" }) : h("input", { type: "text", id });
  el.value = r[c.id] || "";
  el.addEventListener("input", () => { r[c.id] = el.value; mudou(); });
  return h("label", { class: "field" }, h("span", {}, c.rotulo), dica, el);
}
function salvar(ev) {
  ev.preventDefault();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(form.quando)) { toast("Confira a data e a hora."); return; }
  const campos = {};
  Object.keys(form.respostas).forEach((k) => {
    const v = form.respostas[k];
    if (Array.isArray(v) ? v.length : String(v || "").trim()) campos[k] = Array.isArray(v) ? v : String(v).trim();
  });
  const texto = form.texto.trim();
  if (!texto && !Object.keys(campos).length) { toast("Escreva o que aconteceu."); return; }
  const r = { id: novoId("d"), categoria: form.categoria, quando: form.quando.slice(0, 16), horaDesconhecida: form.semHora, texto, campos, quem: store.quemRegistra(), fotos: [] };
  form = null;
  store.salvar("diario", r).then(() => toast("Registro salvo no diário."));
}

/* ---------- lista ---------- */
function filtros(cats) {
  const usados = cats.filter((c) => estado.diario.some((e) => e.categoria === c.id));
  if (filtro !== "todos" && !usados.some((c) => c.id === filtro)) filtro = "todos";
  if (usados.length < 2) return null;
  return h("div", { class: "filtros", role: "group", "aria-label": "Filtrar registros" },
    [{ id: "todos", rotulo: "Tudo" }].concat(usados).map((o) =>
      h("button", { type: "button", "aria-pressed": String(filtro === o.id), onclick: () => { filtro = o.id; redesenhar(); } }, o.rotulo)));
}
function lista() {
  const itens = estado.diario.filter((e) => filtro === "todos" || e.categoria === filtro)
    .sort((a, b) => store.tsRegistro(b) - store.tsRegistro(a));
  if (!itens.length) return vazio("Nenhum registro ainda.");
  const grupos = [];
  itens.forEach((e) => {
    const k = e.quando.slice(0, 10), g = grupos[grupos.length - 1];
    if (g && g.k === k) g.itens.push(e); else grupos.push({ k, ts: store.tsRegistro(e), itens: [e] });
  });
  return h("div", { class: "view", id: "lista-diario" }, grupos.map((g) => h("div", { class: "dia" },
    h("h3", { class: "dia-titulo" }, cap(fmtDiaLongo(g.ts))),
    h("ol", { class: "entries" }, g.itens.map((e) => itemDiario(e, { apagar: true }))))));
}
