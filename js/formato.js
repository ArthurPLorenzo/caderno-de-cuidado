// Formato de arquivo único e versionado: .json (perfil) ou .zip (backup com dados.json + arquivos/).
import { APP_NOME, FORMATO, VERSAO_FORMATO } from "./config.js";
import * as db from "./db.js";
import * as store from "./store.js";
import { estado } from "./store.js";
import { CORES, TIPOS_CAMPO, DOC_TIPOS } from "./categorias.js";
import { jszip, extensao } from "./arquivos.js";
import { isoComFuso, hojeYMD, slug } from "./util.js";

export class ErroArquivo extends Error {}
const erro = (m) => new ErroArquivo(m);

/* ---------- ler o arquivo escolhido ---------- */
export async function ler(file) {
  const nome = (file.name || "").toLowerCase();
  const ehZip = /\.zip$/.test(nome) || /zip/.test(file.type || "");
  if (ehZip) {
    const JSZip = await jszip();
    let zip;
    try { zip = await JSZip.loadAsync(file); } catch (e) { throw erro("Não foi possível abrir este .zip. Ele pode estar incompleto ou danificado."); }
    const dj = zip.file("dados.json");
    if (!dj) throw erro("Este .zip não é um backup do " + APP_NOME + ": falta o arquivo dados.json dentro dele.");
    const dados = validar(parseJSON(await dj.async("string")));
    const blobs = new Map();
    const caminhos = Object.keys(zip.files).filter((k) => k.indexOf("arquivos/") === 0 && !zip.files[k].dir);
    for (const k of caminhos) blobs.set(k, await zip.files[k].async("blob"));
    return { tipo: "zip", dados, blobs };
  }
  if (!/\.json$/.test(nome) && !/json|text/.test(file.type || "")) {
    throw erro("Este tipo de arquivo não serve. Escolha um arquivo .json (perfil) ou .zip (backup).");
  }
  return { tipo: "json", dados: validar(parseJSON(await file.text())), blobs: new Map() };
}
function parseJSON(t) {
  try { return JSON.parse(t.replace(/^﻿/, "")); } catch (e) {
    throw erro("O arquivo está com um erro de escrita e não pode ser lido. Se foi escrito à mão, confira vírgulas, aspas e chaves.");
  }
}

/* ---------- validar e completar o que falta ---------- */
const txt = (v) => (v == null ? "" : String(v));
const lista = (o, k) => {
  const v = o[k];
  if (v == null) return [];
  if (!Array.isArray(v)) throw erro("A parte “" + k + "” do arquivo deveria ser uma lista (entre colchetes [ ]).");
  return v.filter((x) => x && typeof x === "object");
};
function hash(o) {
  const s = JSON.stringify(o);
  let x = 5381;
  for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0;
  return x.toString(36);
}
const DATA = /^\d{4}-\d{2}-\d{2}$/, QUANDO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function validar(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) throw erro("Este arquivo não é do " + APP_NOME + ".");
  if (o.formato !== FORMATO) throw erro("Este arquivo não é do " + APP_NOME + ". Falta a linha \"formato\": \"" + FORMATO + "\".");
  if (typeof o.versao !== "number") throw erro("O arquivo não diz qual é a versão do formato (\"versao\": 1).");
  if (o.versao > VERSAO_FORMATO) throw erro("Este arquivo foi feito por uma versão mais nova do app. Atualize o app e tente de novo.");
  if (o.versao < 1) throw erro("A versão do formato deste arquivo não é reconhecida.");

  const p = o.pessoa && typeof o.pessoa === "object" ? o.pessoa : null;
  const pessoa = p ? {
    nome: txt(p.nome),
    sobre: lista(p, "sobre").map((s) => ({ rotulo: txt(s.rotulo), texto: txt(s.texto) })),
    equipe: lista(p, "equipe").map((e) => ({ especialidade: txt(e.especialidade), nome: txt(e.nome), contato: txt(e.contato) }))
  } : null;

  const alertas = lista(o, "alertas").map((a) => ({
    id: txt(a.id) || "a-" + (slug(a.titulo) || hash(a)), titulo: txt(a.titulo), texto: txt(a.texto), agir: txt(a.agir), emergencia: txt(a.emergencia)
  }));

  const categorias = lista(o, "categorias").map((c) => {
    if (!c.id) throw erro("Uma categoria do diário (“" + txt(c.rotulo) + "”) está sem \"id\".");
    const campos = lista(c, "campos").map((f) => {
      if (!f.id) throw erro("Um campo da categoria “" + txt(c.rotulo || c.id) + "” está sem \"id\".");
      return {
        id: txt(f.id), rotulo: txt(f.rotulo || f.id), tipo: TIPOS_CAMPO.indexOf(f.tipo) >= 0 ? f.tipo : "texto", dica: txt(f.dica),
        opcoes: Array.isArray(f.opcoes) ? f.opcoes.map(txt) : []
      };
    });
    const avisos = lista(c, "avisos").map((a) => ({ quando: a.quando && typeof a.quando === "object" ? a.quando : {}, texto: txt(a.texto) }));
    return { id: txt(c.id), rotulo: txt(c.rotulo || c.id), cor: CORES.indexOf(c.cor) >= 0 ? c.cor : "cinza", campos, avisos };
  });

  const remedios = lista(o, "remedios").map((m) => {
    if (!m.nome) throw erro("Um remédio da lista está sem nome.");
    return {
      id: txt(m.id) || "r-" + slug(m.nome), nome: txt(m.nome), principio: txt(m.principio), dose: txt(m.dose), posologia: txt(m.posologia),
      grupo: txt(m.grupo), para: txt(m.para), observar: txt(m.observar), atualizadoEm: DATA.test(m.atualizadoEm || "") ? m.atualizadoEm : ""
    };
  });

  const diario = lista(o, "diario").map((e) => {
    let quando = txt(e.quando), semHora = !!e.horaDesconhecida;
    if (DATA.test(quando)) { quando += "T12:00"; semHora = true; }
    if (!QUANDO.test(quando)) throw erro("Um registro do diário está com a data “" + quando + "” fora do formato AAAA-MM-DDTHH:MM.");
    const campos = e.campos && typeof e.campos === "object" ? e.campos : {};
    return {
      id: txt(e.id) || "d-" + hash(e), categoria: txt(e.categoria) || "outro", quando, horaDesconhecida: semHora, texto: txt(e.texto),
      campos, quem: txt(e.quem), fotos: Array.isArray(e.fotos) ? e.fotos.map(txt) : []
    };
  });

  const consultas = lista(o, "consultas").map((c) => ({
    id: txt(c.id) || "c-" + hash(c), especialidade: txt(c.especialidade), profissional: txt(c.profissional),
    data: DATA.test(c.data || "") ? c.data : "", hora: txt(c.hora), local: txt(c.local),
    perguntas: lista(c, "perguntas").map((q) => ({ id: txt(q.id) || "p-" + hash(q), texto: txt(q.texto), origem: txt(q.origem), resposta: txt(q.resposta), respondida: !!q.respondida })),
    documentos: (Array.isArray(c.documentos) ? c.documentos : []).map(txt), anotacoes: txt(c.anotacoes), feita: !!c.feita
  }));

  const tipos = DOC_TIPOS.map((t) => t.id);
  const pasta = lista(o, "pasta").map((d) => ({
    id: txt(d.id) || "doc-" + hash(d), tipo: tipos.indexOf(d.tipo) >= 0 ? d.tipo : "outro", titulo: txt(d.titulo),
    data: DATA.test(d.data || "") ? d.data : hojeYMD(), origem: txt(d.origem), obs: txt(d.obs),
    arquivos: lista(d, "arquivos").map((a) => ({ caminho: txt(a.caminho), mime: txt(a.mime), nome: txt(a.nome) }))
  }));

  return { conteudo: txt(o.conteudo), geradoEm: txt(o.geradoEm), pessoa, alertas, categorias, remedios, diario, consultas, pasta };
}

export function previa(dados) {
  return {
    nome: dados.pessoa ? dados.pessoa.nome : "",
    remedios: dados.remedios.length, registros: dados.diario.length,
    consultas: dados.consultas.length, documentos: dados.pasta.length
  };
}

/* ---------- importar ---------- */
function porId(lista) { const m = {}; lista.forEach((x) => { m[x.id] = x; }); return m; }

/* modo: "juntar" (padrão) ou "substituir" (só para backup .zip). */
export async function importar(lido, modo) {
  const d = lido.dados;
  if (modo === "substituir") {
    if (lido.tipo !== "zip") throw erro("“Substituir tudo” só vale para um backup .zip.");
    await db.limparTudo();
    await store.carregar();
  }
  const guardar = async (caminho, mime) => {
    const b = lido.blobs.get(caminho);
    return b ? store.guardarArquivo(b, mime || b.type) : null;
  };

  // perfil: pessoa, alertas, categorias e remédios do arquivo substituem os de mesmo id
  if (d.pessoa) await db.gravar("meta", { chave: "pessoa", valor: d.pessoa });
  const juntaPorId = (atuais, novos) => {
    const ids = novos.map((x) => x.id);
    return atuais.filter((x) => ids.indexOf(x.id) < 0).concat(novos);
  };
  if (d.alertas.length) await db.gravar("meta", { chave: "alertas", valor: juntaPorId(estado.alertas, d.alertas) });
  if (d.categorias.length) await db.gravar("meta", { chave: "categoriasPerfil", valor: juntaPorId(estado.categoriasPerfil, d.categorias) });

  const atuais = porId(estado.remedios);
  let ordem = estado.remedios.reduce((mx, x) => Math.max(mx, x.ordem || 0), 0);
  const remedios = [], logs = [];
  d.remedios.forEach((m) => {
    const antigo = atuais[m.id];
    if (antigo && store.mudouDose(antigo, m)) logs.push(store.novoRegistroMedicacao(store.textoMudanca(antigo, m)));
    remedios.push(Object.assign({}, m, { ordem: antigo ? antigo.ordem : ++ordem }));
  });
  if (remedios.length) await db.gravar("remedios", remedios);

  // diário, consultas e pasta: só entra o que ainda não existe
  const existe = (col) => { const m = porId(estado[col]); return (x) => !!m[x.id]; };
  const jaDiario = existe("diario"), jaConsulta = existe("consultas"), jaDoc = existe("pasta");
  const diario = [];
  for (const e of d.diario.filter((x) => !jaDiario(x))) {
    const fotos = [];
    for (const c of e.fotos) { const id = await guardar(c, "image/jpeg"); if (id) fotos.push(id); }
    diario.push(Object.assign({}, e, { fotos }));
  }
  const pasta = [];
  for (const doc of d.pasta.filter((x) => !jaDoc(x))) {
    const arquivos = [];
    for (const a of doc.arquivos) arquivos.push({ id: await guardar(a.caminho, a.mime), mime: a.mime, nome: a.nome });
    pasta.push(Object.assign({}, doc, { arquivos }));
  }
  const agora = Date.now();
  const consultas = d.consultas.filter((x) => !jaConsulta(x)).map((c, i) => Object.assign({}, c, { criadoEm: agora + i }));
  if (diario.length || logs.length) await db.gravar("diario", diario.concat(logs));
  if (pasta.length) await db.gravar("pasta", pasta);
  if (consultas.length) await db.gravar("consultas", consultas);

  await db.gravar("meta", { chave: "iniciado", valor: true });
  if (modo === "substituir" && d.geradoEm) await db.gravar("meta", { chave: "ultimoBackup", valor: d.geradoEm.slice(0, 10) });
  await store.carregar();
  store.emitir();
  return { registros: diario.length, consultas: consultas.length, documentos: pasta.length, remedios: remedios.length, mudancas: logs.length };
}

/* ---------- exportar backup ---------- */
export function nomeBackup() { return slug(APP_NOME) + "-backup-" + hojeYMD() + ".zip"; }

export async function exportar() {
  const JSZip = await jszip();
  const zip = new JSZip();
  const pasta = zip.folder("arquivos");
  const incluir = async (id, base) => {
    const b = await store.lerArquivo(id);
    if (!b) return null;
    const caminho = "arquivos/" + base + "." + extensao(b.type);
    pasta.file(caminho.slice("arquivos/".length), b);
    return caminho;
  };

  const diario = [];
  for (const e of estado.diario) {
    const fotos = [];
    for (let i = 0; i < (e.fotos || []).length; i++) { const c = await incluir(e.fotos[i], e.id + "-" + (i + 1)); if (c) fotos.push(c); }
    diario.push({ id: e.id, categoria: e.categoria, quando: e.quando, horaDesconhecida: !!e.horaDesconhecida, texto: e.texto, campos: e.campos || {}, quem: e.quem, fotos });
  }
  const docs = [];
  for (const d of estado.pasta) {
    const arquivos = [];
    for (let i = 0; i < (d.arquivos || []).length; i++) {
      const a = d.arquivos[i];
      const c = await incluir(a.id, d.id + "-" + (i + 1));
      if (c) arquivos.push({ caminho: c, mime: a.mime, nome: a.nome });
    }
    docs.push({ id: d.id, tipo: d.tipo, titulo: d.titulo, data: d.data, origem: d.origem, obs: d.obs, arquivos });
  }
  const dados = {
    formato: FORMATO, versao: VERSAO_FORMATO, conteudo: "backup", geradoEm: isoComFuso(),
    pessoa: estado.pessoa, alertas: estado.alertas, categorias: estado.categoriasPerfil,
    remedios: estado.remedios.slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((m) => ({
      id: m.id, nome: m.nome, principio: m.principio, dose: m.dose, posologia: m.posologia, grupo: m.grupo, para: m.para, observar: m.observar, atualizadoEm: m.atualizadoEm
    })),
    diario: diario.sort((a, b) => a.quando.localeCompare(b.quando)),
    consultas: estado.consultas.slice().sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0)).map((c) => ({
      id: c.id, especialidade: c.especialidade, profissional: c.profissional, data: c.data, hora: c.hora, local: c.local,
      perguntas: c.perguntas || [], documentos: c.documentos || [], anotacoes: c.anotacoes, feita: !!c.feita
    })),
    pasta: docs
  };
  zip.file("dados.json", JSON.stringify(dados, null, 2));
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE", mimeType: "application/zip" });
  return new File([blob], nomeBackup(), { type: "application/zip" });
}
