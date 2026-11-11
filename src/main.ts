import './style.css';
import { mountAnimatedLogo } from './logo';
import { renderSimulation } from './simulation';
import { renderImport } from './import-grid';
import { renderStudio } from './studio';
import { renderCustomBuild } from './custom-build';
import { TECHS, ALL_TECHS, DISABLED_FAMILIES, DISABLED_TECHNIQUES } from '../vendor/sudokui/engine/ratings';

const app = document.querySelector<HTMLDivElement>('#app')!;
const base = import.meta.env.BASE_URL;
const isSimulation = location.pathname.startsWith(`${base}simulation`);
const isImport = location.pathname.startsWith(`${base}import-grid`);
const isCustom = location.pathname.startsWith(`${base}custom-build`);
const isGuide = location.pathname.startsWith(`${base}techniques`);
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
app.innerHTML = `<header><a class="brand" href="/" aria-label="Irregular Sudoku home"><span class="brand-icon animated-logo" aria-hidden="true"><img src="${base}irregular-colored-grid.svg" width="38" height="38" alt=""/><span id="logo-animation"></span></span> irregular<span class="brand-dot">.</span></a><nav aria-label="Main navigation"><a href="/" ${!isGuide && !isCustom && !isImport && !isSimulation ? 'aria-current="page"' : ''}>Generate</a><a href="/custom-build" ${isCustom ? 'aria-current="page"' : ''}>Custom build</a><a href="/import-grid" ${isImport ? 'aria-current="page"' : ''}>Import grid</a><a href="/simulation" ${isSimulation ? 'aria-current="page"' : ''}>Simulation</a><a href="/techniques" ${isGuide ? 'aria-current="page"' : ''}>Techniques <span class="nav-count">${ALL_TECHS.length}</span></a></nav><button id="about" class="about-button">About</button></header><dialog id="about-dialog" aria-labelledby="about-title"><h2 id="about-title">The rules</h2><p>Place the digits 1 through 9 in the grid so that each digit appears exactly once in each row, column and irregularly shaped region.</p><form method="dialog"><button>Close</button></form></dialog><main id="main"></main><footer><span>Nine digits. Nine regions. A different perspective.</span><span>Built with TypeScript · <a href="/techniques#attribution">Open-source credits</a> · <a href="/source.tar.gz" download>Source code</a></span></footer>`;
mountAnimatedLogo(document.querySelector<HTMLElement>('#logo-animation')!, base);
const aboutDialog = document.querySelector<HTMLDialogElement>('#about-dialog')!;
document.querySelector<HTMLButtonElement>('#about')!.onclick = () => aboutDialog.showModal();
aboutDialog.addEventListener('click', event => { if (event.target === aboutDialog) { const rect = aboutDialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) aboutDialog.close(); } });
const main = document.querySelector<HTMLElement>('#main')!;

if (isSimulation) renderSimulation(main); else if (isImport) renderImport(main); else if (isGuide) renderGuide(); else if (isCustom) renderCustomBuild(main, base); else renderStudio(main);
// Keep navigation and downloads within either the site root or a Pages project path.
document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach(a => {
  const path = a.getAttribute('href')!.slice(1).replace(/^(techniques|custom-build|import-grid|simulation)(?=#|$)/, '$1/');
  a.href = base + path;
});

function renderGuide() {
  document.title = 'Techniques — Irregular Sudoku';
  const rows = ALL_TECHS.map(k => {
    const t = TECHS[k], disabled = DISABLED_FAMILIES.has(t.category) || DISABLED_TECHNIQUES.has(t.name);
    return '<li class="technique-row' + (disabled ? ' technique-disabled' : '') + '"><span class="tech-title">' + esc(t.name) + '</span><span class="badge">' + t.level + '</span><span class="tech-availability">' + (disabled ? 'Temporarily disabled' : !t.implemented ? 'Reference only' : !t.enabled ? 'Disabled' : '') + '</span></li>';
  }).join('');
  main.innerHTML = '<h1 class="page-title">Techniques</h1><section class="library"><ul id="techniques" class="technique-list">' + rows + '</ul></section><aside id="attribution" class="attribution"><p>Licensed under <a href="/sudokui-LICENSE.txt">GPL-3.0</a>. <a href="/source.tar.gz" download>Download the complete source</a>, including the imported techniques and attribution.</p></aside>';
}
