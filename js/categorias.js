// Categorias do diário, tipos de documento da pasta e regras dos avisos.
export const CORES = ["roxo", "vermelho", "laranja", "ambar", "verde", "azul", "petroleo", "marrom", "cinza"];

export const CATEGORIAS_PADRAO = [
  { id: "sintoma", rotulo: "Sintoma", cor: "vermelho", campos: [], avisos: [] },
  { id: "comportamento", rotulo: "Comportamento", cor: "roxo", campos: [], avisos: [] },
  { id: "sono", rotulo: "Sono", cor: "azul", campos: [], avisos: [] },
  { id: "alimentacao", rotulo: "Alimentação", cor: "verde", campos: [], avisos: [] },
  { id: "dor", rotulo: "Dor ou saúde", cor: "laranja", campos: [], avisos: [] },
  { id: "medicacao", rotulo: "Medicação", cor: "petroleo", campos: [], avisos: [] },
  { id: "outro", rotulo: "Outro", cor: "cinza", campos: [], avisos: [] }
];

export const DOC_TIPOS = [
  { id: "caderno", rotulo: "Página do caderno", cor: "marrom" },
  { id: "laudo", rotulo: "Laudo", cor: "azul" },
  { id: "exame", rotulo: "Exame", cor: "azul" },
  { id: "receita", rotulo: "Receita", cor: "petroleo" },
  { id: "analise", rotulo: "Análise funcional", cor: "roxo" },
  { id: "relatorio", rotulo: "Relatório", cor: "verde" },
  { id: "print", rotulo: "Print de conversa", cor: "laranja" },
  { id: "foto", rotulo: "Foto", cor: "cinza" },
  { id: "outro", rotulo: "Outro", cor: "cinza" }
];
export function docTipo(id) { return DOC_TIPOS.find((t) => t.id === id) || DOC_TIPOS[DOC_TIPOS.length - 1]; }

export const TIPOS_CAMPO = ["texto", "texto_longo", "uma", "varias"];

/* Categorias do perfil substituem as padrão de mesmo id; as novas vêm primeiro. */
export function todasCategorias(doPerfil) {
  const perfil = doPerfil || [];
  const porId = {};
  perfil.forEach((c) => { porId[c.id] = c; });
  const ids = CATEGORIAS_PADRAO.map((c) => c.id);
  return perfil.filter((c) => ids.indexOf(c.id) < 0).concat(CATEGORIAS_PADRAO.map((c) => porId[c.id] || c));
}
export function categoria(lista, id) {
  return lista.find((c) => c.id === id) || { id, rotulo: id || "Outro", cor: "cinza", campos: [], avisos: [] };
}

/* Um aviso dispara quando todas as chaves de "quando" batem com as respostas. */
export function avisosAtivos(cat, respostas) {
  const campos = cat.campos || [];
  return (cat.avisos || []).filter((a) => {
    const cond = a.quando || {};
    const chaves = Object.keys(cond);
    return chaves.length > 0 && chaves.every((k) => {
      const campo = campos.find((c) => c.id === k);
      const v = respostas[k];
      if (campo && campo.tipo === "varias") return Array.isArray(v) && v.indexOf(cond[k]) >= 0;
      return v != null && String(v).trim() === String(cond[k]);
    });
  });
}

/* Lista [rótulo, valor em texto] para mostrar as respostas de um registro. */
export function respostasTexto(cat, campos) {
  const out = [];
  const vals = campos || {};
  (cat.campos || []).forEach((c) => {
    const v = vals[c.id];
    if (Array.isArray(v) ? v.length : v) out.push([c.rotulo, Array.isArray(v) ? v.join(", ") : String(v)]);
  });
  // respostas de campos que não existem mais na categoria
  Object.keys(vals).forEach((k) => {
    if ((cat.campos || []).some((c) => c.id === k)) return;
    const v = vals[k];
    if (Array.isArray(v) ? v.length : v) out.push([k, Array.isArray(v) ? v.join(", ") : String(v)]);
  });
  return out;
}
