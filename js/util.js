import { PREFIXO } from "./config.js";

export const DIA = 86400000;
export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/* ---------- DOM ---------- */
export function $(s, r) { return (r || document).querySelector(s); }
export function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  props = props || {};
  Object.keys(props).forEach((k) => {
    const v = props[k];
    if (v == null || v === false) return;
    if (k === "class") el.className = v;
    else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  });
  kids.forEach((k) => add(el, k));
  return el;
}
export function add(el, kid) {
  if (kid == null || kid === false || kid === "") return;
  if (Array.isArray(kid)) { kid.forEach((k) => add(el, k)); return; }
  el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
}
export function setKids(el, kids) { el.replaceChildren(); add(el, kids); }
export function vazio(t) { return h("p", { class: "vazio" }, t); }
export function pill(rotulo, cor) {
  return h("span", { class: "pill", style: "--c:var(--c-" + (cor || "cinza") + ")" }, h("i", { "aria-hidden": "true" }), rotulo);
}
/* Mantém o foco no mesmo campo quando a tela é redesenhada. */
export function keepFocus(fn) {
  const a = document.activeElement, id = a && a.id;
  let pos = null;
  try { pos = a && typeof a.selectionStart === "number" ? a.selectionStart : null; } catch (e) { /* campo sem seleção */ }
  fn();
  if (!id) return;
  const n = document.getElementById(id);
  if (n && n !== a) {
    n.focus();
    if (pos != null && n.setSelectionRange) { try { n.setSelectionRange(pos, pos); } catch (e) { /* campo sem seleção */ } }
  }
}

/* ---------- rascunhos: campos que sobrevivem a um redesenho ---------- */
const drafts = {};
export function dv(id, def) { return Object.prototype.hasOwnProperty.call(drafts, id) ? drafts[id] : (def == null ? "" : def); }
export function setDraft(id, v) { drafts[id] = v; }
export function inp(tag, id, def, attrs) {
  attrs = Object.assign({}, attrs, { id });
  const el = h(tag, attrs);
  el.value = dv(id, def);
  const guarda = () => { drafts[id] = el.value; };
  el.addEventListener("input", guarda);
  el.addEventListener("change", guarda);
  return el;
}
export function limpaDrafts(prefixo) { Object.keys(drafts).forEach((k) => { if (k.indexOf(prefixo) === 0) delete drafts[k]; }); }
export function campoTxt(id, rotulo, def, type, attrs) {
  return h("label", { class: "field" }, h("span", {}, rotulo), inp("input", id, def, Object.assign({ type: type || "text" }, attrs)));
}
export function campoArea(id, rotulo, def, attrs) {
  return h("label", { class: "field" }, h("span", {}, rotulo), inp("textarea", id, def, Object.assign({ rows: "3" }, attrs)));
}
export function campoSel(id, rotulo, opcoes, def) {
  const s = h("select", { id }, opcoes.map((o) => typeof o === "string" ? h("option", { value: o }, o) : h("option", { value: o.valor }, o.rotulo)));
  s.value = dv(id, def == null ? "" : def);
  if (s.selectedIndex < 0) s.selectedIndex = 0;
  s.addEventListener("change", () => { drafts[id] = s.value; });
  return h("label", { class: "field" }, h("span", {}, rotulo), s);
}

/* ---------- navegação ---------- */
/* "extra" leva informação para a próxima tela (ex.: Pasta já com o tipo "caderno"). */
export const nav = { extra: null };
export function ir(hash, extra) {
  nav.extra = extra || null;
  if (location.hash === "#" + hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = hash;
}

/* ---------- avisos rápidos ---------- */
let tt;
export function toast(m) {
  const el = $("#toast");
  el.textContent = m; el.hidden = false;
  clearTimeout(tt);
  tt = setTimeout(() => { el.hidden = true; }, 3600);
}

/* ---------- preferências pequenas (localStorage) ---------- */
export function getPref(k, d) { try { const v = localStorage.getItem(PREFIXO + k); return v == null ? d : v; } catch (e) { return d; } }
export function setPref(k, v) { try { localStorage.setItem(PREFIXO + k, v); } catch (e) { /* sem armazenamento: ignora */ } }

/* ---------- textos ---------- */
export function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
export function novoId(p) { return p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export function normaliza(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
export function slug(s) { return normaliza(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40); }
export function plural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }

/* ---------- datas ---------- */
const p2 = (n) => String(n).padStart(2, "0");
export function agoraLocal() {
  const d = new Date();
  return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + "T" + p2(d.getHours()) + ":" + p2(d.getMinutes());
}
export function hojeYMD() { return agoraLocal().slice(0, 10); }
/* "AAAA-MM-DD" ou "AAAA-MM-DDTHH:MM", sempre hora local. */
export function tsQuando(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s || "");
  if (!m) return NaN;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
}
export function tsDia(ymd, fim) {
  const t = tsQuando(ymd);
  return fim ? t + DIA - 1 : t;
}
export function ymdParts(s) { const p = (s || "").split("-"); return { y: +p[0], m: +p[1], d: +p[2] }; }
export function dataBR(s) {
  if (!s) return "a marcar";
  const p = ymdParts(s);
  return p2(p.d) + "/" + p2(p.m) + (p.y !== new Date().getFullYear() ? "/" + p.y : "");
}
export function dataLonga(s) { return new Date(tsQuando(s)).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }); }
export function falta(s) {
  const n = Math.round((tsDia(s) - tsDia(hojeYMD())) / DIA);
  return n === 0 ? "hoje" : n === 1 ? "amanhã" : n > 1 ? "em " + n + " dias" : n === -1 ? "ontem" : "há " + (-n) + " dias";
}
export function fmtDiaLongo(ts) { return new Date(ts).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }); }
export function fmtDiaCurto(ts) { return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
export function fmtHora(ts) { return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
/* "2026-10-29T12:40:00-03:00" */
export function isoComFuso(d) {
  d = d || new Date();
  const off = -d.getTimezoneOffset(), s = off >= 0 ? "+" : "-", a = Math.abs(off);
  return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + "T" + p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()) +
    s + p2(Math.floor(a / 60)) + ":" + p2(a % 60);
}
