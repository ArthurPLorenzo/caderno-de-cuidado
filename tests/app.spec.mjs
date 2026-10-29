// Testes ponta a ponta no WebKit com tela de iPhone. ?dev=1 pula a tela de instalação.
import { test, expect } from "@playwright/test";
import { png, pdf } from "./arquivos-teste.mjs";

const EXEMPLO = "exemplos/perfil-exemplo.json";

async function importarExemplo(page) {
  await page.goto("./?dev=1#importar");
  await page.setInputFiles("#importar-input", EXEMPLO);
  await expect(page.locator(".previa")).toContainText("Tomás Exemplo");
  await page.getByRole("button", { name: "Juntar com o que já tenho" }).click();
  await expect(page.locator(".ola h2")).toHaveText("Tomás Exemplo");
}
function aba(page, nome) { return page.locator(".abas").getByRole("link", { name: nome }).click(); }

test("fluxo completo: importar, consulta, pasta, diário, remédio, backup e restauração", async ({ page, browser }, info) => {
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));

  // importar o exemplo
  await importarExemplo(page);
  await expect(page.getByText("Febre alta")).toBeVisible();
  const equipe = page.locator(".equipe");
  await expect(equipe).toContainText("Dra. Helena Fictícia");
  await expect(equipe.getByRole("link", { name: "(00) 0000-0000" })).toHaveAttribute("href", "tel:0000000000");

  // criar consulta
  await aba(page, "Consultas");
  await page.getByRole("button", { name: "Nova consulta" }).click();
  await page.selectOption("#nc-esp", "Psiquiatria");
  await page.fill("#nc-data", "2026-12-10");
  await page.fill("#nc-hora", "09:30");
  await page.getByRole("button", { name: "Criar consulta" }).click();
  await expect(page.locator("h2.titulo-consulta")).toContainText("Psiquiatria");
  const urlConsulta = page.url();

  // anotar pergunta
  await page.fill("textarea[id^=np-]", "Podemos ajustar o horário do remédio da manhã?");
  await page.fill("input[id^=np-]", "escola");
  await page.getByRole("button", { name: "Anotar pergunta" }).click();
  await expect(page.locator(".perguntas")).toContainText("Podemos ajustar o horário");
  await expect(page.locator(".perguntas")).toContainText("Pedido por: escola");

  // guardar uma imagem (maior que 2000 px) e um PDF
  await aba(page, "Pasta");
  await page.setInputFiles("#pasta-input", { name: "receita.png", mimeType: "image/png", buffer: png(2400, 1600) });
  await page.selectOption("#pasta-tipo", "receita");
  await page.fill("#pasta-titulo", "Receita de teste");
  await page.getByRole("button", { name: "Guardar na pasta" }).click();
  await expect(page.locator("#toast")).toHaveText("Guardado na pasta.");
  await page.setInputFiles("#pasta-input", { name: "exame.pdf", mimeType: "application/pdf", buffer: pdf("Exame de teste") });
  await page.selectOption("#pasta-tipo", "exame");
  await page.fill("#pasta-titulo", "Exame de teste");
  await page.getByRole("button", { name: "Guardar na pasta" }).click();
  await expect(page.locator(".doc", { hasText: "Exame de teste" })).toBeVisible();

  // a foto foi reduzida para no máximo 2000 px, em JPEG
  const imagens = await page.evaluate(async () => {
    const req = indexedDB.open("caderno-de-cuidado");
    const db = await new Promise((r) => { req.onsuccess = () => r(req.result); });
    const todos = await new Promise((r) => { const q = db.transaction("arquivos").objectStore("arquivos").getAll(); q.onsuccess = () => r(q.result); });
    const out = [];
    for (const a of todos.filter((x) => x.mime.startsWith("image/"))) {
      const bm = await createImageBitmap(new Blob([a.dados], { type: a.mime }));
      out.push({ mime: a.mime, lado: Math.max(bm.width, bm.height) });
    }
    return out;
  });
  expect(imagens).toEqual([{ mime: "image/jpeg", lado: 2000 }]);

  // o PDF abre no visualizador (pdf.js)
  await page.getByRole("button", { name: "Abrir PDF: Exame de teste" }).click();
  await expect(page.locator("canvas.pdf-page")).toHaveCount(1);
  await page.getByRole("button", { name: "Fechar" }).click();

  // separar o documento para a consulta
  const cartao = page.locator(".doc", { hasText: "Receita de teste" });
  await cartao.getByRole("button", { name: "Separar para consulta" }).click();
  await cartao.locator("select").selectOption({ label: "10/12 · Psiquiatria" });
  await cartao.getByRole("button", { name: "Separar", exact: true }).click();
  await expect(cartao).toContainText("Separado para: 10/12 · Psiquiatria");
  await page.goto(urlConsulta);
  await expect(page.locator(".panel", { hasText: "Documentos para levar" })).toContainText("Receita de teste");

  // registrar no diário disparando um aviso
  await aba(page, "Diário");
  await page.locator("label.chip", { hasText: "Agitação" }).click();
  await expect(page.locator(".aviso")).toHaveCount(0);
  await page.locator("label.chip", { hasText: "Se machucou" }).click();
  await expect(page.locator(".aviso")).toContainText("Se houver ferimento");
  await page.fill("#d-campo-duracao", "uns 5 minutos");
  await page.fill("#d-texto", "Registro de teste.");
  await page.getByRole("button", { name: "Salvar no diário" }).click();
  await expect(page.locator("#lista-diario")).toContainText("Registro de teste.");

  // mudar a dose de um remédio gera o registro de Medicação
  await aba(page, "Remédios");
  await page.getByRole("button", { name: "Editar Atentol" }).click();
  await page.fill("#med-dose", "15 mg");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".med", { hasText: "Atentol" })).toContainText("15 mg");
  await aba(page, "Diário");
  await expect(page.locator(".entry", { hasText: "Medicação" })).toContainText("Atentol: 10 mg, 1 comprimido de manhã → 15 mg, 1 comprimido de manhã");

  // exportar backup (sem compartilhamento no teste: vira download)
  await page.locator("#link-ajustes").click();
  await expect(page.locator("#ultimo-backup")).toHaveText("Nenhum backup feito ainda.");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar backup" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^caderno-de-cuidado-backup-\d{4}-\d{2}-\d{2}\.zip$/);
  const zip = info.outputPath("backup.zip");
  await download.saveAs(zip);
  await expect(page.locator("#ultimo-backup")).toContainText("Último backup:");
  expect(erros).toEqual([]);

  // restaurar num banco vazio (outro contexto = outro armazenamento)
  const ctx = await browser.newContext({ ...info.project.use, baseURL: "http://localhost:4173/" });
  const nova = await ctx.newPage();
  await nova.goto("./?dev=1");
  await expect(nova.getByRole("heading", { name: /Boas-vindas/ })).toBeVisible();
  await nova.getByRole("button", { name: "Importar arquivo" }).click();
  await nova.setInputFiles("#importar-input", zip);
  await expect(nova.locator(".previa")).toContainText("Backup");
  await expect(nova.locator(".previa dl")).toContainText("Tomás Exemplo");
  await nova.getByRole("button", { name: "Substituir tudo" }).click();
  await nova.getByRole("button", { name: "Sim, substituir tudo" }).click();
  await expect(nova.locator(".ola h2")).toHaveText("Tomás Exemplo");

  await aba(nova, "Remédios");
  await expect(nova.locator(".med", { hasText: "Atentol" })).toContainText("15 mg");
  await aba(nova, "Pasta");
  await expect(nova.locator(".doc", { hasText: "Receita de teste" }).locator("img")).toBeVisible();
  await expect(nova.locator(".doc", { hasText: "Exame de teste" })).toBeVisible();
  await aba(nova, "Diário");
  await expect(nova.locator("#lista-diario")).toContainText("Registro de teste.");
  await expect(nova.locator("#lista-diario")).toContainText("Atentol: 10 mg");
  await aba(nova, "Consultas");
  await nova.locator(".consulta-card", { hasText: "Psiquiatria" }).click();
  await expect(nova.locator(".perguntas")).toContainText("Podemos ajustar o horário");
  await expect(nova.locator(".panel", { hasText: "Documentos para levar" })).toContainText("Receita de teste");
  await ctx.close();
});

test("arquivo que não serve mostra o motivo em português", async ({ page }) => {
  await page.goto("./?dev=1#importar");
  await page.setInputFiles("#importar-input", { name: "outro.json", mimeType: "application/json", buffer: Buffer.from('{"formato":"outro","versao":1}') });
  await expect(page.locator(".erro")).toContainText("não é do Caderno de Cuidado");
  await page.setInputFiles("#importar-input", { name: "quebrado.json", mimeType: "application/json", buffer: Buffer.from("{ isto não é json") });
  await expect(page.locator(".erro")).toContainText("erro de escrita");
  await page.setInputFiles("#importar-input", { name: "perfil.json", mimeType: "application/json", buffer: Buffer.from('{"formato":"caderno-de-cuidado","versao":1}') });
  await expect(page.locator(".previa")).toBeVisible();
  await expect(page.getByRole("button", { name: "Substituir tudo" })).toHaveCount(0);
});

test("iPhone fora do app instalado mostra a tela de instalação", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: false }));
  await page.goto("./");
  await expect(page.locator("#instalar")).toBeVisible();
  await expect(page.locator("#instalar")).toContainText("Adicionar à Tela de Início");
  await page.getByRole("link", { name: "Continuar no navegador" }).click();
  await expect(page.locator("#instalar")).toBeHidden();

  await page.goto("./?dev=1");
  await expect(page.locator("#instalar")).toBeHidden();
});

test("aberto pelo ícone (standalone) não mostra a tela de instalação", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
  await page.goto("./");
  await expect(page.locator("#instalar")).toBeHidden();
  await expect(page.getByRole("heading", { name: /Boas-vindas/ })).toBeVisible();
});
