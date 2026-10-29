// IndexedDB: registros e arquivos ficam só no aparelho.
// Os arquivos são guardados como ArrayBuffer + tipo (mais confiável no Safari do que Blob direto).
const NOME = "caderno-de-cuidado";
const VERSAO = 1;
export const COLECOES = ["remedios", "diario", "consultas", "pasta"];
const STORES = ["meta", "arquivos"].concat(COLECOES);

let dbp = null;
export function abrir() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(NOME, VERSAO);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "chave" });
        ["arquivos"].concat(COLECOES).forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" }); });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function fim(tx) { return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); }

export async function todos(store) {
  const db = await abrir();
  return req(db.transaction(store).objectStore(store).getAll());
}
export async function pegar(store, chave) {
  const db = await abrir();
  return req(db.transaction(store).objectStore(store).get(chave));
}
/* Grava um objeto ou uma lista, numa transação só. */
export async function gravar(store, objs) {
  const db = await abrir();
  const tx = db.transaction(store, "readwrite"), s = tx.objectStore(store);
  (Array.isArray(objs) ? objs : [objs]).forEach((o) => s.put(o));
  return fim(tx);
}
export async function apagar(store, chaves) {
  const db = await abrir();
  const tx = db.transaction(store, "readwrite"), s = tx.objectStore(store);
  (Array.isArray(chaves) ? chaves : [chaves]).forEach((k) => s.delete(k));
  return fim(tx);
}
export async function limparTudo() {
  const db = await abrir();
  const tx = db.transaction(STORES, "readwrite");
  STORES.forEach((s) => tx.objectStore(s).clear());
  return fim(tx);
}

/* Pede ao navegador para não apagar os dados quando faltar espaço. */
export function persistir() {
  try { if (navigator.storage && navigator.storage.persist) return navigator.storage.persist().catch(() => false); } catch (e) { /* sem suporte */ }
  return Promise.resolve(false);
}
