// Importar arquivo: perfil .json ou backup .zip, com prévia antes de gravar.
import { h, setKids, toast, ir, plural } from "../util.js";
import { estado } from "../store.js";
import * as formato from "../formato.js";

let lido = null, erro = "", nomeArq = "", confirmaSubst = false, ocupado = false, box = null;

export function sair() { lido = null; erro = ""; nomeArq = ""; confirmaSubst = false; ocupado = false; }

async function escolher(ev) {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!f) return;
  sair();
  nomeArq = f.name;
  ocupado = true; redesenhar();
  try {
    lido = await formato.ler(f);
  } catch (e) {
    erro = e instanceof formato.ErroArquivo ? e.message : "Não foi possível ler este arquivo.";
  }
  ocupado = false; redesenhar();
}
async function aplicar(modo) {
  ocupado = true; redesenhar();
  try {
    const r = await formato.importar(lido, modo);
    const partes = [];
    if (r.remedios) partes.push(plural(r.remedios, "remédio", "remédios"));
    if (r.registros) partes.push(plural(r.registros, "registro novo", "registros novos"));
    if (r.consultas) partes.push(plural(r.consultas, "consulta nova", "consultas novas"));
    if (r.documentos) partes.push(plural(r.documentos, "documento novo", "documentos novos"));
    sair();
    toast(partes.length ? "Importado: " + partes.join(", ") + "." : "Importado. Nada novo para acrescentar.");
    ir("inicio");
  } catch (e) {
    ocupado = false;
    erro = e instanceof formato.ErroArquivo ? e.message : "Não foi possível gravar os dados. Tente de novo.";
    lido = null;
    redesenhar();
  }
}
function redesenhar() { if (box) render(box); }

export function render(alvo) {
  box = alvo;
  const input = h("input", { type: "file", id: "importar-input", class: "sr-only", accept: ".json,.zip,application/json,application/zip" });
  input.addEventListener("change", escolher);
  const partes = [
    h("button", { class: "voltar", type: "button", onclick: () => history.back() }, "← Voltar"),
    h("section", { class: "panel" },
      h("h2", {}, "Importar arquivo"),
      h("p", {}, "Use o arquivo que um profissional enviou (perfil, termina em .json) ou um backup feito por este app (termina em .zip)."),
      h("p", { class: "small" }, "Recebeu pelo WhatsApp? Abra o arquivo, toque em Compartilhar e escolha “Salvar em Arquivos”. Depois escolha o arquivo aqui."),
      input,
      h("label", { for: "importar-input", class: "btn file-btn" }, lido || erro ? "Escolher outro arquivo" : "Escolher arquivo"),
      ocupado ? h("p", { class: "small", role: "status" }, "Lendo…") : null,
      erro ? h("p", { class: "erro", role: "alert" }, erro) : null)
  ];
  if (lido && !ocupado) partes.push(painelPrevia());
  setKids(box, h("div", { class: "view" }, partes));
}

function painelPrevia() {
  const p = formato.previa(lido.dados), zip = lido.tipo === "zip";
  const temDados = estado.iniciado || estado.diario.length || estado.remedios.length || estado.pasta.length || estado.consultas.length;
  const acoes = [h("button", { class: "btn grande", type: "button", onclick: () => aplicar("juntar") }, "Juntar com o que já tenho")];
  if (zip) {
    acoes.push(confirmaSubst
      ? h("div", { class: "bloco" },
          h("p", { class: "erro" }, "Isso apaga tudo o que está neste aparelho e coloca o conteúdo do backup no lugar. Não dá para desfazer."),
          h("button", { class: "btn danger grande", type: "button", onclick: () => aplicar("substituir") }, "Sim, substituir tudo"),
          h("button", { class: "btn ghost grande", type: "button", onclick: () => { confirmaSubst = false; redesenhar(); } }, "Cancelar"))
      : h("button", { class: "btn ghost grande", type: "button", onclick: () => { confirmaSubst = true; redesenhar(); } }, "Substituir tudo"));
  }
  return h("section", { class: "panel previa", "aria-labelledby": "previa-titulo" },
    h("p", { class: "eyebrow" }, zip ? "Backup" : "Perfil"),
    h("h2", { id: "previa-titulo" }, "O que vem no arquivo"),
    h("p", { class: "small" }, nomeArq),
    h("dl", {},
      h("dt", {}, "Nome"), h("dd", {}, p.nome || "—"),
      h("dt", {}, "Remédios"), h("dd", {}, String(p.remedios)),
      h("dt", {}, "Registros do diário"), h("dd", {}, String(p.registros)),
      h("dt", {}, "Consultas"), h("dd", {}, String(p.consultas)),
      h("dt", {}, "Documentos"), h("dd", {}, String(p.documentos))),
    temDados ? h("p", { class: "small" }, "“Juntar” atualiza o nome, os alertas, as categorias e os remédios com os do arquivo, e acrescenta registros, consultas e documentos que ainda não estão aqui. Nada é apagado.") : null,
    h("div", { class: "bloco" }, acoes));
}
