# Caderno de Cuidado

App web instalável (PWA) para quem cuida de alguém com acompanhamento de saúde em várias especialidades. Junta num lugar só o diário, os remédios, os documentos e o que levar para cada consulta.

- **Endereço:** https://arthurplorenzo.github.io/caderno-de-cuidado/
- **Para quem vai usar no iPhone:** veja [INSTALAR.md](INSTALAR.md).

## Privacidade

- Os dados ficam **só no aparelho**, no IndexedDB do navegador. O app não tem servidor, login nem analytics.
- Depois de aberto, o app não faz nenhuma requisição externa. Fontes e bibliotecas são servidas da própria pasta.
- Este repositório é público. **Nunca coloque dados reais aqui.** O `.gitignore` bloqueia `*.json` fora de `exemplos/`, `*.zip`, `dados/` e `referencia/`.
- O exemplo em `exemplos/perfil-exemplo.json` é inteiramente fictício.

## Rodar no computador

Não tem etapa de build. Basta servir a pasta por HTTP:

```sh
npm start                      # http://localhost:8080/?dev=1
# ou, sem Node:
python -m http.server 8080
```

O `?dev=1` pula a tela de instalação do iPhone e desliga o service worker, para que as mudanças nos arquivos apareçam na hora.

## Testes

Os testes usam Playwright em WebKit, com tela de iPhone 13.

```sh
npm install
npx playwright install webkit
npm test
```

Eles cobrem: importar o exemplo, criar consulta, anotar pergunta, guardar uma imagem e um PDF, separar documento para a consulta, registrar no diário disparando um aviso, mudar a dose de um remédio (gerando o registro), exportar backup e restaurar num banco vazio. Também cobrem as mensagens de arquivo inválido e a tela de instalação.

## Publicar no GitHub Pages

1. No GitHub, abra **Settings → Pages**.
2. Em *Build and deployment*, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Depois de cada `git push` na `main`, o Pages publica sozinho em um ou dois minutos.

**Ao publicar mudanças:** aumente `VERSAO` em `sw.js` (por exemplo, `v1` → `v2`). Quem estiver com o app aberto verá o aviso “Nova versão disponível · Atualizar”. Se criar um arquivo novo em `js/`, `css/`, `fonts/` ou `vendor/`, acrescente-o à lista `ARQUIVOS` do `sw.js`.

## Estrutura

```
index.html            casca: topo, abas, tela de instalação, aviso de nova versão
manifest.webmanifest  sw.js (cache offline)
css/                  tokens.css (cores claro/escuro, fontes) · app.css
fonts/                Atkinson Hyperlegible, Literata, IBM Plex Mono (OFL)
icons/                ícones do app (gerados por tests/gerar-icones.mjs)
vendor/               pdfjs-3.11.174 (build legacy UMD) · jszip-3.10.1
js/
  config.js           nome do app e versão do formato
  main.js             rotas, tela de instalação, service worker
  db.js · store.js    IndexedDB e estado em memória
  formato.js          validar, importar e exportar
  categorias.js       categorias do diário, tipos de documento, avisos
  arquivos.js         fotos, compartilhamento, carregar pdf.js/JSZip
  telas/              inicio, consultas, pasta, diario, remedios, ajustes, importar, visualizador, comum
exemplos/             perfil fictício
tests/                Playwright, servidor local, geradores de arquivos de teste
```

Para trocar o nome do app, mude `APP_NOME` em `js/config.js` e, junto, o `<title>` do `index.html` e o `name` do `manifest.webmanifest`.

## Formato de arquivo

Há um formato só, versionado (`"formato": "caderno-de-cuidado"`, `"versao": 1`).

- Um **`.json`** é um perfil, escrito à mão ou enviado por um profissional.
- Um **`.zip`** é um backup gerado pelo app, com `dados.json` e os arquivos dentro de `arquivos/`.

Campos ausentes valem como vazios. Datas: `quando` em `AAAA-MM-DDTHH:MM` (hora local, sem fuso) e `data` em `AAAA-MM-DD`. Veja um exemplo completo em [`exemplos/perfil-exemplo.json`](exemplos/perfil-exemplo.json).

- **Categorias do diário:** as padrão são `sintoma`, `comportamento`, `sono`, `alimentacao`, `dor`, `medicacao` e `outro`. Uma categoria do perfil com o mesmo `id` substitui a padrão.
- **Tipos de campo:** `texto`, `texto_longo`, `uma` (o valor é o texto da opção) e `varias` (lista de textos).
- **Avisos:** um aviso dispara quando todas as chaves de `quando` batem. Para `uma` e `texto`, a resposta precisa ser igual; para `varias`, a lista precisa conter o valor.
- **Cores:** `roxo`, `vermelho`, `laranja`, `ambar`, `verde`, `azul`, `petroleo`, `marrom`, `cinza`.

**Ao importar:**

- **Juntar com o que já tenho** (padrão): `pessoa`, `alertas`, `categorias` e `remedios` substituem os de mesmo `id`. `diario`, `consultas` e `pasta` entram só se o `id` ainda não existir. Se um remédio mudar de dose ou posologia, o app cria um registro de Medicação.
- **Substituir tudo:** só para backup `.zip`, com confirmação na tela.

## Licenças de terceiros

- pdf.js: Apache 2.0 (`vendor/pdfjs-3.11.174/LICENSE`)
- JSZip: MIT ou GPLv3 (`vendor/jszip-3.10.1/LICENSE.markdown`)
- Fontes: SIL Open Font License 1.1 (`fonts/OFL-*.txt`)
