// Início: quem é a pessoa, atalhos, próxima consulta e alertas.
import { APP_NOME } from "../config.js";
import { h, setKids, vazio, ir, hojeYMD, plural, MESES, ymdParts } from "../util.js";
import * as store from "../store.js";
import { estado } from "../store.js";
import { consultasAbertas, docPorId, quandoConsulta } from "./comum.js";

export function render(box) {
  if (!estado.iniciado) { setKids(box, boasVindas()); return; }
  const p = estado.pessoa;
  setKids(box, h("div", { class: "view" },
    h("section", { class: "panel ola" },
      h("p", { class: "eyebrow" }, "Caderno de"),
      h("h2", {}, p.nome || "Sem nome ainda"),
      !p.nome ? h("a", { href: "#ajustes", class: "linkbtn" }, "Escrever o nome em Ajustes") : null,
      p.sobre && p.sobre.length ? h("dl", { class: "sobre" }, p.sobre.map((s) => [h("dt", {}, s.rotulo), h("dd", {}, s.texto)])) : null),
    h("div", { class: "atalhos" },
      h("button", { class: "btn grande", type: "button", onclick: () => ir("diario") }, "Registrar no diário"),
      h("button", { class: "btn ghost grande", type: "button", onclick: () => ir("pasta") }, "Guardar arquivo")),
    proxima(),
    estado.alertas.map(alerta),
    equipe()));
}

/* Contato vira link de ligar quando parece telefone. */
function contato(t) {
  const digitos = t.replace(/\D/g, "");
  if (/^[\d\s()+.-]+$/.test(t) && digitos.length >= 8) return h("a", { href: "tel:" + (t.trim()[0] === "+" ? "+" : "") + digitos, class: "linkbtn" }, t);
  return h("span", {}, t);
}
function equipe() {
  const lista = (estado.pessoa.equipe || []).filter((e) => e.especialidade || e.nome || e.contato);
  if (!lista.length) return null;
  return h("section", { class: "panel" },
    h("p", { class: "eyebrow" }, "Contatos"),
    h("h2", {}, "Equipe"),
    h("ul", { class: "equipe" }, lista.map((e) => h("li", {},
      h("b", {}, e.especialidade || "Profissional"),
      e.nome ? h("span", {}, e.nome) : null,
      e.contato ? contato(e.contato) : null))));
}

function boasVindas() {
  return h("div", { class: "view" },
    h("section", { class: "panel" },
      h("h2", {}, "Boas-vindas ao " + APP_NOME),
      h("p", {}, "Aqui ficam juntos o diário, os remédios, os documentos e o que levar para cada consulta."),
      h("p", { class: "small" }, "Tudo fica guardado só neste aparelho. Ninguém mais vê."),
      h("p", {}, "Recebeu um arquivo de um profissional, ou tem um backup? Comece importando. Se não, comece do zero."),
      h("div", { class: "bloco" },
        h("button", { class: "btn grande", type: "button", onclick: () => ir("importar") }, "Importar arquivo"),
        h("button", { class: "btn ghost grande", type: "button", onclick: () => store.setMeta("iniciado", true).then(() => ir("ajustes")) }, "Começar do zero"))));
}

function proxima() {
  const abertas = consultasAbertas();
  const c = abertas.find((x) => x.data && x.data >= hojeYMD()) || abertas[0];
  if (!c) {
    return h("section", { class: "panel" },
      h("p", { class: "eyebrow" }, "Próxima consulta"),
      vazio("Nenhuma consulta marcada."),
      h("a", { href: "#consultas", class: "linkbtn" }, "Criar consulta"));
  }
  const perguntas = (c.perguntas || []).filter((q) => !q.respondida);
  const docs = (c.documentos || []).map(docPorId).filter(Boolean);
  const dp = c.data ? ymdParts(c.data) : null;
  return h("section", { class: "panel" },
    h("p", { class: "eyebrow" }, "Próxima consulta"),
    h("a", { class: "consulta-card", href: "#consulta/" + c.id },
      h("div", { class: "cc-data", "aria-hidden": "true" },
        dp ? [h("span", { class: "cc-mes" }, MESES[dp.m - 1]), h("span", { class: "cc-dia" }, String(dp.d))] : h("span", { class: "cc-mes" }, "a marcar")),
      h("div", { class: "cc-info" },
        h("h3", {}, c.especialidade || "Consulta"),
        h("p", { class: "small" }, [quandoConsulta(c), c.hora, c.profissional].filter(Boolean).join(" · ")))),
    h("div", { class: "bloco" },
      h("h3", {}, perguntas.length ? plural(perguntas.length, "pergunta em aberto", "perguntas em aberto") : "Nenhuma pergunta em aberto"),
      perguntas.length ? h("ul", { class: "clean" }, perguntas.map((q) => h("li", {}, q.texto))) : null),
    h("div", { class: "bloco" },
      h("h3", {}, docs.length ? plural(docs.length, "documento separado", "documentos separados") : "Nenhum documento separado"),
      docs.length ? h("ul", { class: "clean" }, docs.map((d) => h("li", {}, d.titulo || "Documento sem título"))) : null));
}

function alerta(a) {
  return h("section", { class: "panel alerta" },
    h("p", { class: "eyebrow" }, "Alerta"),
    h("h3", {}, a.titulo),
    a.texto ? h("p", {}, a.texto) : null,
    a.agir ? h("p", { class: "agir" }, h("b", {}, "O que fazer: "), a.agir) : null,
    a.emergencia ? h("p", { class: "emergencia" }, "Emergência: " + a.emergencia) : null);
}
