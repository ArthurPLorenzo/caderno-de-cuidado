import { APP_NOME } from "./config.js";
import { $, $$, setKids, keepFocus, toast } from "./util.js";
import * as store from "./store.js";
import { persistir } from "./db.js";
import * as inicio from "./telas/inicio.js";
import * as consultas from "./telas/consultas.js";
import * as pasta from "./telas/pasta.js";
import * as diario from "./telas/diario.js";
import * as remedios from "./telas/remedios.js";
import * as ajustes from "./telas/ajustes.js";
import * as importar from "./telas/importar.js";
import * as visualizador from "./telas/visualizador.js";

const TELAS = { inicio, consultas, consulta: consultas, pasta, diario, remedios, ajustes, importar };
const ABA = { consulta: "consultas", importar: "ajustes" };
const dev = new URLSearchParams(location.search).has("dev");

let rota = { tela: "inicio" };
function lerRota() {
  const v = decodeURIComponent((location.hash || "").slice(1));
  const m = /^consulta\/(.+)$/.exec(v);
  if (m) return { tela: "consulta", id: m[1] };
  return { tela: TELAS[v] ? v : "inicio" };
}
function desenhar() {
  const t = TELAS[rota.tela];
  keepFocus(() => t.render($("#tela"), rota));
}
function navegar() {
  const anterior = rota;
  rota = lerRota();
  if (TELAS[anterior.tela].sair && (anterior.tela !== rota.tela || anterior.id !== rota.id)) TELAS[anterior.tela].sair();
  const aba = ABA[rota.tela] || rota.tela;
  $$(".abas a").forEach((a) => { if (a.dataset.aba === aba) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  if (aba === "ajustes") $("#link-ajustes").setAttribute("aria-current", "page"); else $("#link-ajustes").removeAttribute("aria-current");
  setKids($("#tela"), []);
  desenhar();
  window.scrollTo(0, 0);
}

/* ---------- iPhone: instalar antes de tudo ---------- */
function precisaInstalar() {
  if (dev) return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let pulou = false;
  try { pulou = sessionStorage.getItem("continuar-no-navegador") === "1"; } catch (e) { /* sem armazenamento */ }
  return ios && navigator.standalone === false && !pulou;
}
function telaInstalar() {
  const el = $("#instalar");
  el.hidden = false;
  $("#continuar-navegador").addEventListener("click", (ev) => {
    ev.preventDefault();
    try { sessionStorage.setItem("continuar-no-navegador", "1"); } catch (e) { /* sem armazenamento */ }
    el.hidden = true;
  });
}

/* ---------- versão nova: avisa em vez de trocar sozinho ---------- */
function registrarSW() {
  if (!("serviceWorker" in navigator) || dev) return;
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const avisar = (w) => {
      $("#atualizar").hidden = false;
      $("#btn-atualizar").onclick = () => { $("#btn-atualizar").disabled = true; w.postMessage("atualizar"); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) avisar(w);
      });
    });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
  let recarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregou) return;
    recarregou = true;
    location.reload();
  });
}

async function iniciar() {
  document.title = APP_NOME;
  $$("[data-app-nome]").forEach((el) => { el.textContent = APP_NOME; });
  if (precisaInstalar()) telaInstalar();
  visualizador.montar();
  registrarSW();
  try {
    await store.carregar();
  } catch (e) {
    setKids($("#tela"), "Não foi possível abrir os dados deste aparelho. Feche o app e abra de novo.");
    return;
  }
  persistir();
  store.ouvir(desenhar);
  window.addEventListener("hashchange", navegar);
  navegar();
}

window.addEventListener("unhandledrejection", (e) => {
  console.error(e.reason);
  toast("Algo deu errado ao salvar. Tente de novo.");
});

iniciar();
