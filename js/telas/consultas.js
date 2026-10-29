// Consultas: lista, detalhe com perguntas, documentos, resumo do período, remédios e anotações.
import { h, setKids, vazio, toast, ir, dv, setDraft, inp, limpaDrafts, campoTxt, cap, falta, dataBR, dataLonga, fmtDiaCurto, fmtHora,
  tsDia, plural, MESES, ymdParts, novoId, DIA } from "../util.js";
import * as store from "../store.js";
import { estado } from "../store.js";
import { categoria, respostasTexto } from "../categorias.js";
import { compartilharTexto } from "../arquivos.js";
import { abrir } from "./visualizador.js";
import { botaoConfirmar, limparConfirmacao, consultaPorId, docPorId, ordemConsulta, consultasAbertas, quandoConsulta,
  docCard, itemDiario, thumbArquivo } from "./comum.js";
import { ordenados } from "./remedios.js";

const ESPECIALIDADES = ["Psiquiatria", "Neurologia", "Endocrinologia", "Pediatria", "Clínico geral", "Psicologia", "Acompanhante terapêutico"];
const OUTRA = "Outra";
let novaAberta = false, editando = false, pickerAberto = false, pickSel = {}, verRegistros = false, respondendo = null, box = null, rotaAtual = null;

export function sair() {
  novaAberta = false; editando = false; pickerAberto = false; pickSel = {}; verRegistros = false; respondendo = null;
  limparConfirmacao();
}
function redesenhar() { if (box) render(box, rotaAtual); }

export function render(alvo, rota) {
  box = alvo; rotaAtual = rota;
  if (rota.tela === "consulta") detalhe(rota.id); else listaConsultas();
}

function especialidades() {
  const eq = (estado.pessoa.equipe || []).map((e) => e.especialidade).filter(Boolean);
  return eq.concat(ESPECIALIDADES).filter((v, i, a) => a.indexOf(v) === i);
}
/* Especialidade: lista + "Outra" com campo livre. */
function campoEspecialidade(pre, atual) {
  const lista = especialidades();
  const escolha = dv(pre + "esp", atual ? (lista.indexOf(atual) >= 0 ? atual : OUTRA) : lista[0]);
  const s = h("select", { id: pre + "esp" }, lista.concat([OUTRA]).map((o) => h("option", { value: o }, o)));
  s.value = escolha;
  s.addEventListener("change", () => { setDraft(pre + "esp", s.value); redesenhar(); });
  return [
    h("label", { class: "field" }, h("span", {}, "Especialidade"), s),
    escolha === OUTRA ? campoTxt(pre + "outra", "Qual especialidade", lista.indexOf(atual) < 0 ? atual : "") : null
  ];
}
function lerEspecialidade(pre, atual) {
  const lista = especialidades();
  const e = dv(pre + "esp", atual ? (lista.indexOf(atual) >= 0 ? atual : OUTRA) : lista[0]);
  return e === OUTRA ? dv(pre + "outra", lista.indexOf(atual) < 0 ? atual : "").trim() : e;
}

/* ---------- lista ---------- */
function cardConsulta(c) {
  const nd = (c.documentos || []).filter(docPorId).length;
  const np = (c.perguntas || []).filter((p) => !p.respondida).length;
  const p = c.data ? ymdParts(c.data) : null;
  return h("a", { class: "consulta-card", href: "#consulta/" + c.id },
    h("div", { class: "cc-data", "aria-hidden": "true" },
      p ? [h("span", { class: "cc-mes" }, MESES[p.m - 1]), h("span", { class: "cc-dia" }, String(p.d))] : h("span", { class: "cc-mes" }, "a marcar")),
    h("div", { class: "cc-info" },
      h("h3", {}, c.especialidade || "Consulta"),
      h("p", { class: "small" }, [quandoConsulta(c), c.hora, c.profissional].filter(Boolean).join(" · ")),
      h("p", { class: "cc-conta" }, plural(np, "pergunta", "perguntas") + " em aberto · " + plural(nd, "documento", "documentos"))));
}
function listaConsultas() {
  const abertas = consultasAbertas();
  const feitas = estado.consultas.filter((c) => c.feita).sort((a, b) => -ordemConsulta(a, b));
  let anteriores = null;
  if (feitas.length) {
    anteriores = h("details", { class: "anteriores" },
      h("summary", {}, "Consultas anteriores (" + feitas.length + ")"),
      h("ul", { class: "lista-cards" }, feitas.map((c) => h("li", {}, cardConsulta(c)))));
  }
  setKids(box, h("div", { class: "view" },
    h("div", { class: "actions", style: "justify-content:space-between" },
      h("h2", {}, "Próximas consultas"),
      novaAberta ? null : h("button", { class: "btn", type: "button", onclick: () => { novaAberta = true; redesenhar(); } }, "Nova consulta")),
    novaAberta ? formNova() : null,
    abertas.length ? h("ul", { class: "lista-cards" }, abertas.map((c) => h("li", {}, cardConsulta(c))))
      : vazio("Nenhuma consulta marcada. Crie a próxima e vá separando o que levar: perguntas, documentos, páginas do caderno."),
    anteriores));
}
function formNova() {
  const pre = "nc-";
  return h("form", { class: "panel form", novalidate: true, onsubmit: (ev) => {
      ev.preventDefault();
      const esp = lerEspecialidade(pre, "");
      if (!esp) { toast("Escreva a especialidade."); return; }
      const c = { id: novoId("c"), especialidade: esp, profissional: dv(pre + "nome").trim(), data: dv(pre + "data"), hora: dv(pre + "hora"),
        local: dv(pre + "local").trim(), perguntas: [], documentos: [], anotacoes: "", feita: false, criadoEm: Date.now() };
      novaAberta = false; limpaDrafts(pre);
      store.salvar("consultas", c).then(() => { toast("Consulta criada."); ir("consulta/" + c.id); });
    } },
    h("h2", {}, "Nova consulta"),
    h("div", { class: "row" }, campoEspecialidade(pre, ""), campoTxt(pre + "nome", "Nome do profissional (opcional)")),
    h("div", { class: "row" }, campoTxt(pre + "data", "Data", "", "date"), campoTxt(pre + "hora", "Horário (opcional)", "", "time")),
    campoTxt(pre + "local", "Local (opcional)"),
    h("p", { class: "small" }, "Ainda sem data? Deixe em branco: ela fica como “a marcar” e você já pode ir separando o que levar."),
    h("div", { class: "actions" },
      h("button", { class: "btn", type: "submit" }, "Criar consulta"),
      h("button", { class: "btn ghost", type: "button", onclick: () => { novaAberta = false; limpaDrafts(pre); redesenhar(); } }, "Cancelar")));
}

/* ---------- detalhe ---------- */
function atualiza(c, campos) { return store.salvar("consultas", Object.assign({}, c, campos)); }

function detalhe(id) {
  const voltar = h("a", { href: "#consultas", class: "voltar" }, "← Todas as consultas");
  const c = consultaPorId(id);
  if (!c) { setKids(box, h("div", { class: "view" }, voltar, vazio("Essa consulta não existe mais."))); return; }
  setKids(box, h("div", { class: "view" }, voltar, cabecalho(c), painelPerguntas(c), painelDocs(c), painelPeriodo(c), painelRemedios(), painelNotas(c)));
}
function cabecalho(c) {
  if (editando) return formEditar(c);
  const linha = [c.hora, c.profissional, c.local].filter(Boolean).join(" · ");
  const status = c.feita ? "Consulta feita" : (c.data ? cap(falta(c.data)) : "Data a marcar");
  return h("div", { class: "panel" },
    h("p", { class: "eyebrow" }, status),
    h("h2", { class: "titulo-consulta" }, (c.especialidade || "Consulta") + (c.data ? " · " + dataLonga(c.data) : "")),
    linha ? h("p", { class: "small" }, linha) : null,
    h("div", { class: "actions" },
      h("button", { class: "btn small", type: "button", onclick: () => atualiza(c, { feita: !c.feita })
        .then(() => toast(c.feita ? "Consulta reaberta." : "Consulta marcada como feita. Ela foi para “Consultas anteriores”.")) }, c.feita ? "Reabrir" : "Marcar como feita"),
      h("button", { class: "btn small ghost", type: "button", onclick: () => compartilharTexto("Resumo da consulta", resumoTexto(c)) }, "Compartilhar resumo"),
      h("button", { class: "btn small ghost", type: "button", onclick: () => { editando = true; redesenhar(); } }, "Editar"),
      botaoConfirmar("consulta:" + c.id, "Apagar", "Apagar consulta", () => store.remover("consultas", c).then(() => {
        toast("Consulta apagada. Os documentos continuam na pasta."); ir("consultas");
      }))));
}
function formEditar(c) {
  const pre = "ec-" + c.id + "-";
  const fechar = () => { editando = false; limpaDrafts(pre); redesenhar(); };
  return h("form", { class: "panel form", novalidate: true, onsubmit: (ev) => {
      ev.preventDefault();
      const esp = lerEspecialidade(pre, c.especialidade);
      if (!esp) { toast("Escreva a especialidade."); return; }
      const campos = { especialidade: esp, profissional: dv(pre + "nome", c.profissional).trim(), data: dv(pre + "data", c.data),
        hora: dv(pre + "hora", c.hora), local: dv(pre + "local", c.local).trim() };
      editando = false; limpaDrafts(pre);
      atualiza(c, campos).then(() => toast("Consulta atualizada."));
    } },
    h("h2", {}, "Editar consulta"),
    h("div", { class: "row" }, campoEspecialidade(pre, c.especialidade), campoTxt(pre + "nome", "Nome do profissional", c.profissional)),
    h("div", { class: "row" }, campoTxt(pre + "data", "Data", c.data, "date"), campoTxt(pre + "hora", "Horário", c.hora, "time")),
    campoTxt(pre + "local", "Local", c.local),
    h("div", { class: "actions" },
      h("button", { class: "btn", type: "submit" }, "Salvar"),
      h("button", { class: "btn ghost", type: "button", onclick: fechar }, "Cancelar")));
}

function painelPerguntas(c) {
  const ps = (c.perguntas || []).slice().sort((a, b) => (a.respondida ? 1 : 0) - (b.respondida ? 1 : 0));
  const abertas = ps.filter((p) => !p.respondida).length;
  const pre = "np-" + c.id + "-";
  const form = h("form", { class: "nova-pergunta", novalidate: true, onsubmit: (ev) => {
      ev.preventDefault();
      const texto = dv(pre + "texto").trim();
      if (!texto) { toast("Escreva a pergunta."); return; }
      const nova = { id: novoId("p"), texto, origem: dv(pre + "origem").trim(), resposta: "", respondida: false };
      limpaDrafts(pre);
      atualiza(c, { perguntas: (c.perguntas || []).concat([nova]) }).then(() => toast("Pergunta anotada."));
    } },
    h("label", { class: "field" }, h("span", {}, "Nova pergunta"), inp("textarea", pre + "texto", "", { rows: "2", placeholder: "O que você quer perguntar?" })),
    h("label", { class: "field" }, h("span", {}, "Quem pediu para perguntar (opcional)"), inp("input", pre + "origem", "", { type: "text", placeholder: "ex.: eu, outro profissional, escola" })),
    h("div", { class: "actions" }, h("button", { class: "btn", type: "submit" }, "Anotar pergunta")));
  return h("section", { class: "panel" },
    h("p", { class: "eyebrow" }, abertas ? abertas + " em aberto" : "Perguntas"),
    h("h2", {}, "Perguntas para levar"),
    ps.length ? h("ol", { class: "perguntas" }, ps.map((p) => itemPergunta(c, p)))
      : vazio("Nenhuma pergunta ainda. Anote o que você quer perguntar e o que outros profissionais pediram para perguntar."),
    form);
}
function itemPergunta(c, p) {
  const id = "rp-" + c.id + "-" + p.id;
  const acoes = [];
  if (respondendo !== p.id) {
    acoes.push(h("button", { class: "linkbtn", type: "button", onclick: () => { respondendo = p.id; redesenhar(); const t = document.getElementById(id); if (t) t.focus(); } },
      p.resposta ? "Editar resposta" : "Anotar resposta"));
  }
  acoes.push(botaoConfirmar("perg:" + p.id, "Apagar", "Apagar pergunta", () => atualiza(c, { perguntas: (c.perguntas || []).filter((x) => x.id !== p.id) })));
  let resp = null;
  if (respondendo === p.id) {
    resp = h("form", { class: "reply", novalidate: true, onsubmit: (ev) => {
        ev.preventDefault();
        const t = dv(id, p.resposta).trim();
        respondendo = null; limpaDrafts(id);
        atualiza(c, { perguntas: (c.perguntas || []).map((x) => x.id === p.id ? Object.assign({}, x, { resposta: t, respondida: !!t }) : x) })
          .then(() => toast("Resposta anotada."));
      } },
      inp("textarea", id, p.resposta || "", { rows: "2", "aria-label": "Resposta" }),
      h("div", { class: "actions" },
        h("button", { class: "btn small", type: "submit" }, "Salvar resposta"),
        h("button", { class: "btn small ghost", type: "button", onclick: () => { respondendo = null; limpaDrafts(id); redesenhar(); } }, "Cancelar")));
  } else if (p.resposta) {
    resp = h("p", { class: "resposta" }, h("b", {}, "Resposta: "), p.resposta);
  }
  return h("li", {},
    h("p", { class: "pergunta-texto" }, p.texto),
    p.origem ? h("p", { class: "small" }, "Pedido por: " + p.origem) : null,
    resp,
    h("div", { class: "meta" }, acoes));
}

function painelDocs(c) {
  const docs = (c.documentos || []).map(docPorId).filter(Boolean).sort((a, b) => b.data.localeCompare(a.data));
  return h("section", { class: "panel" },
    h("p", { class: "eyebrow" }, plural(docs.length, "separado", "separados")),
    h("h2", {}, "Documentos para levar"),
    docs.length ? h("ul", { class: "docs" }, docs.map((d) => docCard(d, { consulta: c }))) : vazio("Nenhum documento separado ainda."),
    h("div", { class: "actions" },
      h("button", { class: "btn small ghost", type: "button", "aria-expanded": String(pickerAberto), onclick: () => { pickerAberto = !pickerAberto; pickSel = {}; redesenhar(); } },
        pickerAberto ? "Fechar a pasta" : "Escolher da pasta"),
      h("button", { class: "btn small ghost", type: "button", onclick: () => ir("pasta", { consulta: c.id }) }, "Guardar arquivo novo")),
    pickerAberto ? picker(c) : null);
}
function picker(c) {
  const ja = c.documentos || [];
  const livres = estado.pasta.filter((d) => ja.indexOf(d.id) < 0).sort((a, b) => b.data.localeCompare(a.data));
  if (!livres.length) return h("div", { class: "picker" }, vazio(estado.pasta.length ? "Tudo o que está na pasta já foi separado para esta consulta." : "A pasta está vazia. Use “Guardar arquivo novo”."));
  const sel = Object.keys(pickSel).filter((k) => pickSel[k]);
  return h("div", { class: "picker" },
    livres.map((d) => {
      const cb = h("input", { type: "checkbox", id: "pk-" + d.id });
      cb.checked = !!pickSel[d.id];
      cb.addEventListener("change", () => { pickSel[d.id] = cb.checked; redesenhar(); });
      return h("label", { class: "pick" }, cb, h("span", {}, h("b", {}, d.titulo || "Sem título"), " ", h("span", { class: "small" }, dataBR(d.data))));
    }),
    h("div", { class: "actions" }, h("button", { class: "btn small", type: "button", disabled: !sel.length, onclick: () => {
      pickerAberto = false; pickSel = {};
      atualiza(c, { documentos: ja.concat(sel) }).then(() => toast(sel.length === 1 ? "Documento separado." : sel.length + " documentos separados."));
    } }, sel.length ? "Separar " + sel.length : "Separar")));
}

/* Período: desde a última consulta da mesma especialidade (ou 30 dias) até a data desta consulta (ou hoje). */
function periodo(c) {
  const agora = Date.now();
  const fim = c.data ? Math.min(tsDia(c.data, true), agora) : agora;
  const ref = c.data ? tsDia(c.data) : agora;
  const prev = estado.consultas.filter((x) => x.id !== c.id && x.data && (x.especialidade || "") === (c.especialidade || "") && tsDia(x.data, true) < ref)
    .sort((a, b) => b.data.localeCompare(a.data))[0];
  return { inicio: prev ? tsDia(prev.data, true) : fim - 30 * DIA, fim, prev, ateHoje: fim === agora };
}
function dadosPeriodo(c) {
  const p = periodo(c);
  const dentro = (t) => t > p.inicio && t <= p.fim;
  const regs = estado.diario.filter((e) => dentro(store.tsRegistro(e))).sort((a, b) => store.tsRegistro(b) - store.tsRegistro(a));
  const paginas = estado.pasta.filter((d) => d.tipo === "caderno" && dentro(store.tsDoc(d))).sort((a, b) => a.data.localeCompare(b.data));
  const cats = store.categorias(), contagem = {};
  regs.forEach((e) => { if (e.categoria !== "medicacao") contagem[e.categoria] = (contagem[e.categoria] || 0) + 1; });
  const contados = Object.keys(contagem).map((id) => ({ cat: categoria(cats, id), n: contagem[id] }));
  return { p, regs, paginas, contados, mudancas: regs.filter((e) => e.categoria === "medicacao").reverse(), outros: regs.filter((e) => e.categoria !== "medicacao") };
}
function rotuloPeriodo(p) {
  return (p.prev ? "Desde a consulta de " + dataBR(p.prev.data) : "Últimos 30 dias") + (p.ateHoje ? " até hoje" : " até " + fmtDiaCurto(p.fim));
}
function painelPeriodo(c) {
  const d = dadosPeriodo(c), corpo = [];
  if (d.contados.length) corpo.push(h("div", { class: "contagens" }, d.contados.map((x) =>
    h("span", { class: "pill", style: "--c:var(--c-" + x.cat.cor + ")" }, h("i", { "aria-hidden": "true" }), x.cat.rotulo + ": " + x.n))));
  if (d.mudancas.length) corpo.push(h("div", { class: "bloco" }, h("h3", {}, "Mudanças nos remédios"),
    h("ul", { class: "clean" }, d.mudancas.map((e) => h("li", {}, e.texto + " ", h("span", { class: "small" }, "(" + fmtDiaCurto(store.tsRegistro(e)) + ")"))))));
  if (d.paginas.length) {
    const arqs = [];
    d.paginas.forEach((doc) => (doc.arquivos || []).forEach((a) => arqs.push(a)));
    corpo.push(h("div", { class: "bloco" }, h("h3", {}, "Páginas do caderno (" + arqs.length + ")"),
      h("div", { class: "thumbs" }, arqs.map((a, i) => thumbArquivo(a, () => abrir(arqs, i), "Página do caderno " + (i + 1))))));
  }
  if (d.outros.length) {
    corpo.push(h("button", { class: "linkbtn", type: "button", "aria-expanded": String(verRegistros), onclick: () => { verRegistros = !verRegistros; redesenhar(); } },
      verRegistros ? "Esconder os registros" : (d.outros.length === 1 ? "Ver o registro do diário" : "Ver os " + d.outros.length + " registros do diário")));
    if (verRegistros) corpo.push(h("ol", { class: "entries" }, d.outros.map((e) => itemDiario(e))));
  }
  if (!corpo.length) corpo.push(vazio("Nada registrado no diário nem na pasta neste período."));
  return h("section", { class: "panel" },
    h("p", { class: "eyebrow" }, rotuloPeriodo(d.p)),
    h("h2", {}, "Desde a última consulta" + (c.especialidade ? " de " + c.especialidade : "")),
    corpo);
}
function painelRemedios() {
  const meds = ordenados();
  return h("section", { class: "panel" },
    h("p", { class: "eyebrow" }, "Em uso hoje"),
    h("h2", {}, "Remédios"),
    meds.length ? h("ul", { class: "med-compacta" }, meds.map((m) =>
      h("li", {}, h("b", {}, m.nome), h("span", { class: "dose" }, m.dose), m.posologia ? h("span", { class: "small" }, m.posologia) : null)))
      : vazio("Nenhum remédio cadastrado."),
    h("a", { href: "#remedios", class: "linkbtn" }, "Ver detalhes ou editar"));
}
function painelNotas(c) {
  const id = "notas-" + c.id;
  return h("form", { class: "panel", novalidate: true, onsubmit: (ev) => {
      ev.preventDefault();
      const t = dv(id, c.anotacoes).trim();
      limpaDrafts(id);
      atualiza(c, { anotacoes: t }).then(() => toast("Anotações salvas."));
    } },
    h("p", { class: "eyebrow" }, c.feita ? "Depois da consulta" : "Durante ou depois"),
    h("h2", {}, "O que foi conversado"),
    inp("textarea", id, c.anotacoes || "", { rows: "4", "aria-label": "O que foi conversado", placeholder: "O que foi dito, o que mudou, o que fazer até a próxima." }),
    h("div", { class: "actions" }, h("button", { class: "btn small", type: "submit" }, "Salvar anotações")));
}

/* ---------- texto do "Compartilhar resumo" ---------- */
export function resumoTexto(c) {
  const L = [];
  const quando = c.data ? c.data.split("-").reverse().join("/") : "data a marcar";
  L.push("Consulta de " + (c.especialidade || "—") + " · " + [quando, c.hora, c.profissional].filter(Boolean).join(" · "));
  if (estado.pessoa.nome) L.push("Paciente: " + estado.pessoa.nome);

  const ps = c.perguntas || [];
  L.push("", "PERGUNTAS");
  if (!ps.length) L.push("Nenhuma pergunta anotada.");
  ps.forEach((p, i) => {
    L.push((i + 1) + ". " + p.texto + (p.origem ? " (pedido por: " + p.origem + ")" : ""));
    if (p.resposta) L.push("   Resposta: " + p.resposta);
  });

  const meds = ordenados();
  L.push("", "REMÉDIOS EM USO");
  if (!meds.length) L.push("Nenhum remédio cadastrado.");
  meds.forEach((m) => L.push("- " + m.nome + (m.dose ? " " + m.dose : "") + (m.posologia ? " — " + m.posologia : "")));

  const d = dadosPeriodo(c);
  L.push("", rotuloPeriodo(d.p).toUpperCase());
  if (d.contados.length) L.push(d.contados.map((x) => x.cat.rotulo + ": " + x.n).join(" · "));
  if (d.mudancas.length) {
    L.push("Mudanças nos remédios:");
    d.mudancas.forEach((e) => L.push("- " + e.texto + " (" + fmtDiaCurto(store.tsRegistro(e)) + ")"));
  }
  if (d.paginas.length) L.push("Páginas do caderno: " + d.paginas.reduce((n, doc) => n + (doc.arquivos || []).length, 0));
  if (d.outros.length) {
    L.push("Registros:");
    d.outros.slice().reverse().forEach((e) => {
      const cat = categoria(store.categorias(), e.categoria), t = store.tsRegistro(e);
      const det = respostasTexto(cat, e.campos).map((x) => x[0] + ": " + x[1]).join("; ");
      L.push("- " + fmtDiaCurto(t) + (e.horaDesconhecida ? "" : " " + fmtHora(t)) + " · " + cat.rotulo + (e.texto ? ": " + e.texto : "") + (det ? " (" + det + ")" : ""));
    });
  }
  if (!d.contados.length && !d.mudancas.length && !d.paginas.length) L.push("Nada registrado neste período.");

  const docs = (c.documentos || []).map(docPorId).filter(Boolean);
  if (docs.length) {
    L.push("", "DOCUMENTOS SEPARADOS");
    docs.forEach((doc) => L.push("- " + (doc.titulo || "Documento") + " (" + dataBR(doc.data) + ")"));
  }
  return L.join("\n");
}
