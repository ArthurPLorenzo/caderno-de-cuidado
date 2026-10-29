// Gera os ícones PNG a partir de um SVG (rodar uma vez: node tests/gerar-icones.mjs)
import { webkit } from "@playwright/test";

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1B5B62"/>
  <g transform="translate(256 256) scale(${pad}) translate(-256 -256)">
    <rect x="132" y="92" width="268" height="332" rx="22" fill="#FFFFFF"/>
    <rect x="132" y="92" width="268" height="332" rx="22" fill="none" stroke="#DCEBEB" stroke-width="6"/>
    <line x1="196" y1="92" x2="196" y2="424" stroke="#D0524B" stroke-width="8"/>
    <g stroke="#9DB7B4" stroke-width="7" stroke-linecap="round">
      <line x1="222" y1="178" x2="362" y2="178"/><line x1="222" y1="236" x2="362" y2="236"/>
      <line x1="222" y1="294" x2="334" y2="294"/><line x1="222" y1="352" x2="348" y2="352"/>
    </g>
    <g fill="#1B5B62"><circle cx="160" cy="150" r="9"/><circle cx="160" cy="258" r="9"/><circle cx="160" cy="366" r="9"/></g>
  </g>
</svg>`;

const alvos = [
  ["icons/apple-touch-icon.png", 180, 1],
  ["icons/icone-192.png", 192, 1],
  ["icons/icone-512.png", 512, 1],
  ["icons/icone-maskable-512.png", 512, 0.78]
];
const b = await webkit.launch();
for (const [arq, lado, pad] of alvos) {
  const p = await b.newPage({ viewport: { width: lado, height: lado } });
  await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg(pad)}`);
  await p.screenshot({ path: arq });
  await p.close();
}
await b.close();
console.log("ícones gerados");
