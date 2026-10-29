// Remédios em uso, por grupo. Mudança de dose ou posologia entra no diário (ver store.salvarRemedio).
import { h, setKids, vazio, toast, dataBR } from "../util.js";
import * as store from "../store.js";
import { estado } from "../store.js";
import { botaoConfirmar } from "./comum.js";

const CAMPOS = [["nome", "Nome"], ["principio", "Princípio ativo"], ["dose", "Dose"], ["posologia", "Como toma"], ["grupo", "Grupo"], ["para", "Para quê"], ["observar", "O que observar"]];
let editando = null, dados = null, box = null;

export function sair() { editando = null; dados = null; }
function redesenhar() { if (box) render(box); window.scrollTo(0, 0); }

export function ordenados() { return estado.remedios.slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0)); }
export function porGrupo() {
  const grupos = [];
  ordenados().forEach((m) => {
    const nome = m.grupo || "Outros";
    let g = grupos.find((x) => x.nome === nome);
    if (!g) { g = { nome, itens: [] }; grupos.push(g); }
    g.itens.push(m);
  });
  return grupos;
}

export function render(alvo) {
  box = alvo;
  if (editando) { setKids(box, formulario()); return; }
  const grupos = porGrupo();
  setKids(box, h("div", { class: "view" },
    h("section", { class: "panel" },
      h("h2", {}, "Remédios em uso"),
      h("p", { class: "small" }, "Como está na receita. Quando uma dose mudar, edite aqui: a mudança entra no diário com a data e aparece no resumo da próxima consulta.")),
    grupos.length ? grupos.map((g) => h("div", { class: "grupo" }, h("p", { class: "eyebrow" }, g.nome), h("ul", { class: "meds" }, g.itens.map(card))))
      : vazio("Nenhum remédio cadastrado ainda."),
    h("div", { class: "actions" }, h("button", { class: "btn ghost", type: "button", onclick: () => abrir(null) }, "Adicionar remédio"))));
}
function card(m) {
  return h("li", { class: "med" },
    h("div", { class: "med-head" },
      h("h3", {}, m.nome, m.principio ? h("span", { class: "principio" }, " " + m.principio) : null),
      h("span", { class: "dose" }, m.dose)),
    m.posologia ? h("p", { class: "posologia" }, m.posologia) : null,
    m.para ? h("p", { class: "small" }, h("b", {}, "Para: "), m.para) : null,
    m.observar ? h("p", { class: "small" }, h("b", {}, "Observar: "), m.observar) : null,
    h("div", { class: "meta" },
      m.atualizadoEm ? h("span", {}, "Atualizado em " + dataBR(m.atualizadoEm)) : null,
      h("button", { class: "linkbtn", type: "button", "aria-label": "Editar " + m.nome, onclick: () => abrir(m) }, "Editar")));
}
function abrir(m) {
  editando = m ? m.id : "novo";
  dados = {};
  CAMPOS.forEach(([k]) => { dados[k] = m ? m[k] || "" : ""; });
  redesenhar();
}
function formulario() {
  const antigo = editando === "novo" ? null : estado.remedios.find((x) => x.id === editando);
  const grupos = porGrupo().map((g) => g.nome).filter((n) => n !== "Outros");
  const campo = (k, rotulo, area) => {
    const el = h(area ? "textarea" : "input", area ? { id: "med-" + k, rows: "2" } : { id: "med-" + k, type: "text", list: k === "grupo" ? "med-grupos" : null });
    el.value = dados[k];
    el.addEventListener("input", () => { dados[k] = el.value; });
    return h("label", { class: "field" }, h("span", {}, rotulo), el);
  };
  const rot = {};
  CAMPOS.forEach(([k, r]) => { rot[k] = r; });
  return h("form", { class: "panel form", novalidate: true, onsubmit: (ev) => { ev.preventDefault(); salvar(antigo); } },
    h("button", { class: "voltar", type: "button", onclick: () => { sair(); redesenhar(); } }, "← Remédios"),
    h("h2", {}, antigo ? "Editar " + antigo.nome : "Novo remédio"),
    h("div", { class: "row" }, campo("nome", rot.nome), campo("principio", rot.principio)),
    h("div", { class: "row" }, campo("dose", rot.dose), campo("posologia", rot.posologia)),
    h("div", { class: "row" }, campo("grupo", rot.grupo), campo("para", rot.para)),
    h("datalist", { id: "med-grupos" }, grupos.map((g) => h("option", { value: g }))),
    campo("observar", rot.observar, true),
    h("div", { class: "actions" },
      h("button", { class: "btn", type: "submit" }, "Salvar"),
      h("button", { class: "btn ghost", type: "button", onclick: () => { sair(); redesenhar(); } }, "Cancelar")),
    antigo ? h("div", { class: "actions" }, botaoConfirmar("med:" + antigo.id, "Suspenso? Tirar da lista", "Tirar da lista", () => {
      store.tirarRemedio(antigo).then(() => { sair(); redesenhar(); toast("Remédio tirado da lista. O registro ficou no diário."); });
    }, "Manter")) : null);
}
function salvar(antigo) {
  const limpo = {};
  CAMPOS.forEach(([k]) => { limpo[k] = (dados[k] || "").trim(); });
  if (!limpo.nome) { toast("Escreva o nome do remédio."); return; }
  store.salvarRemedio(antigo, limpo).then((mudou) => {
    sair(); redesenhar();
    toast(mudou ? "Remédio salvo. A mudança entrou no diário." : "Remédio salvo.");
  });
}
