// Ajustes: dados da pessoa, importar, backup e apagar tudo.
import { APP_NOME, DIAS_AVISO_BACKUP } from "../config.js";
import { h, setKids, toast, ir, hojeYMD, dataBR, tsDia, DIA } from "../util.js";
import * as store from "../store.js";
import { estado } from "../store.js";
import { exportar } from "../formato.js";
import { compartilharArquivos } from "../arquivos.js";

let rascunho = null, preparando = false, apagando = false, palavra = "", box = null;
const PALAVRA = "APAGAR";

export function sair() { rascunho = null; preparando = false; apagando = false; palavra = ""; }
function redesenhar() { if (box) render(box); }

/* campo ligado direto ao rascunho */
function campo(id, rotulo, obj, chave, area) {
  const el = h(area ? "textarea" : "input", area ? { id, rows: "2" } : { id, type: "text" });
  el.value = obj[chave] || "";
  el.addEventListener("input", () => { obj[chave] = el.value; });
  return h("label", { class: "field" }, h("span", {}, rotulo), el);
}

export function render(alvo) {
  box = alvo;
  if (!rascunho) rascunho = JSON.parse(JSON.stringify(estado.pessoa));
  setKids(box, h("div", { class: "view" },
    h("h2", {}, "Ajustes"),
    painelPessoa(), painelArquivos(), painelApagar(),
    h("p", { class: "rodape" }, APP_NOME + " organiza as informações de saúde para a família e a equipe. Não substitui consulta nem avaliação médica. Os dados ficam só neste aparelho.")));
}

function painelPessoa() {
  const r = rascunho;
  return h("form", { class: "panel form", novalidate: true, onsubmit: (ev) => {
      ev.preventDefault();
      const limpo = {
        nome: (r.nome || "").trim(),
        sobre: r.sobre.filter((s) => s.rotulo.trim() || s.texto.trim()),
        equipe: r.equipe.filter((e) => e.especialidade.trim() || e.nome.trim() || e.contato.trim())
      };
      store.setMeta("pessoa", limpo).then(() => store.setMeta("iniciado", true)).then(() => { rascunho = null; toast("Dados salvos."); });
    } },
    h("h2", {}, "Sobre a pessoa"),
    campo("aj-nome", "Nome", r, "nome"),
    h("fieldset", { class: "field" }, h("legend", {}, "Sobre"),
      h("p", { class: "small" }, "Diagnóstico, o que ajuda, o que evitar. Aparece no Início."),
      h("ul", { class: "lista-edit" }, r.sobre.map((s, i) => h("li", {},
        campo("aj-sobre-rot-" + i, "Título", s, "rotulo"),
        campo("aj-sobre-txt-" + i, "Texto", s, "texto", true),
        h("button", { class: "linkbtn perigo", type: "button", onclick: () => { r.sobre.splice(i, 1); redesenhar(); } }, "Tirar este item")))),
      h("button", { class: "btn ghost small", type: "button", onclick: () => { r.sobre.push({ rotulo: "", texto: "" }); redesenhar(); } }, "Acrescentar item")),
    h("fieldset", { class: "field" }, h("legend", {}, "Equipe"),
      h("p", { class: "small" }, "Só uma lista de contatos, que aparece no Início. Ninguém recebe acesso ao app."),
      h("ul", { class: "lista-edit" }, r.equipe.map((e, i) => h("li", {},
        campo("aj-eq-esp-" + i, "Especialidade", e, "especialidade"),
        h("div", { class: "row" }, campo("aj-eq-nome-" + i, "Nome", e, "nome"), campo("aj-eq-cont-" + i, "Contato", e, "contato")),
        h("button", { class: "linkbtn perigo", type: "button", onclick: () => { r.equipe.splice(i, 1); redesenhar(); } }, "Tirar da equipe")))),
      h("button", { class: "btn ghost small", type: "button", onclick: () => { r.equipe.push({ especialidade: "", nome: "", contato: "" }); redesenhar(); } }, "Acrescentar profissional")),
    h("div", { class: "actions" }, h("button", { class: "btn", type: "submit" }, "Salvar")));
}

function painelArquivos() {
  const ult = estado.ultimoBackup;
  const atrasado = !ult || (tsDia(hojeYMD()) - tsDia(ult)) / DIA > DIAS_AVISO_BACKUP;
  const temDados = estado.diario.length || estado.pasta.length || estado.remedios.length || estado.consultas.length;
  return h("section", { class: "panel" },
    h("h2", {}, "Arquivos e backup"),
    h("p", {}, "O backup junta tudo (registros, remédios, consultas e arquivos) num arquivo .zip. Guarde no iCloud Drive ou mande para alguém de confiança."),
    h("p", { class: atrasado && temDados ? "destaque" : "small", id: "ultimo-backup" },
      ult ? "Último backup: " + dataBR(ult) + (atrasado ? ". Já passou de " + DIAS_AVISO_BACKUP + " dias: faça um novo." : "") : "Nenhum backup feito ainda."),
    h("div", { class: "bloco" },
      h("button", { class: "btn grande", type: "button", disabled: preparando, onclick: fazerBackup }, preparando ? "Preparando backup…" : "Exportar backup"),
      h("button", { class: "btn ghost grande", type: "button", onclick: () => ir("importar") }, "Importar arquivo")));
}
async function fazerBackup() {
  preparando = true; redesenhar();
  try {
    const f = await exportar();
    preparando = false; redesenhar();
    if (await compartilharArquivos([f], "Backup do " + APP_NOME)) {
      await store.setMeta("ultimoBackup", hojeYMD());
      toast("Backup pronto.");
    }
  } catch (e) {
    preparando = false; redesenhar();
    toast("Não foi possível gerar o backup. Tente de novo.");
  }
}

function painelApagar() {
  if (!apagando) {
    return h("section", { class: "panel" },
      h("h2", {}, "Apagar todos os dados"),
      h("p", { class: "small" }, "Tira tudo deste aparelho. Faça um backup antes."),
      h("button", { class: "btn ghost small", type: "button", onclick: () => { apagando = true; palavra = ""; redesenhar(); } }, "Apagar todos os dados"));
  }
  const input = h("input", { type: "text", id: "aj-palavra", autocomplete: "off", autocapitalize: "characters", spellcheck: "false" });
  input.value = palavra;
  const btn = h("button", { class: "btn danger", type: "button", disabled: palavra.trim().toUpperCase() !== PALAVRA, onclick: async () => {
    await store.apagarTudo();
    sair();
    toast("Todos os dados foram apagados deste aparelho.");
    ir("inicio");
  } }, "Apagar tudo agora");
  input.addEventListener("input", () => { palavra = input.value; btn.disabled = palavra.trim().toUpperCase() !== PALAVRA; });
  return h("section", { class: "panel" },
    h("h2", {}, "Apagar todos os dados"),
    h("p", { class: "erro" }, "Isso apaga registros, remédios, consultas, documentos e fotos deste aparelho. Não dá para desfazer."),
    h("label", { class: "field" }, h("span", {}, "Para confirmar, escreva " + PALAVRA), input),
    h("div", { class: "actions" }, btn,
      h("button", { class: "btn ghost", type: "button", onclick: () => { apagando = false; palavra = ""; redesenhar(); } }, "Cancelar")));
}
