import './style.css';
import { renderStudio } from './studio';
import { renderCustomBuild } from './custom-build';
import { TECHS, ALL_TECHS } from '../vendor/sudokui/engine/ratings';
import { TECH_DOCS } from '../vendor/sudokui/content/techniqueDocs';

const app = document.querySelector<HTMLDivElement>('#app')!;
const base = import.meta.env.BASE_URL;
const isCustom = location.pathname.startsWith(`${base}custom-build`);
const isGuide = location.pathname.startsWith(`${base}techniques`);
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
app.innerHTML = `<header><a class="brand" href="/" aria-label="Irregular Sudoku home"><span class="brand-icon">▦</span> irregular<span class="brand-dot">.</span></a><nav aria-label="Main navigation"><a href="/" ${!isGuide && !isCustom ? 'aria-current="page"' : ''}>Puzzle studio</a><a href="/custom-build" ${isCustom ? 'aria-current="page"' : ''}>Custom build</a><a href="/techniques" ${isGuide ? 'aria-current="page"' : ''}>Techniques <span class="nav-count">${ALL_TECHS.length}</span></a></nav><span class="header-note">A little outside the box.</span></header><main id="main"></main><footer><span>Nine digits. Nine regions. A different perspective.</span><span>Built with TypeScript · <a href="/techniques#attribution">Open-source credits</a> · <a href="/source.tar.gz" download>Source code</a></span></footer>`;
const main = document.querySelector<HTMLElement>('#main')!;

if (isGuide) renderGuide(); else if (isCustom) renderCustomBuild(main, base); else renderStudio(main);
// Keep navigation and downloads within either the site root or a Pages project path.
document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach(a => {
  const path = a.getAttribute('href')!.slice(1).replace(/^(techniques|custom-build)(?=#|$)/, '$1/');
  a.href = base + path;
});

function renderGuide() {
  document.title = 'Techniques — Irregular Sudoku';
  main.innerHTML = `<section class="intro"><p class="eyebrow">THE SOLVER’S BOOKSHELF</p><h1>A little logic goes a long way.</h1><p class="lede">Explore the complete sudokUI technique library, from your first single to the most intricate chains.</p></section><div class="guide-note"><strong>Classic foundations. Irregular possibilities.</strong><p>This is the original classic Sudoku reference. Singles, subsets and peer-based logic can use irregular regions as houses. Patterns relying on 3 × 3 boxes, bands or stacks need separate verification; uniqueness techniques require a proven unique solution. The studio uses its own region-aware search solver, not these classic finders.</p></div><section class="library"><div class="filters"><label>Find a technique<input id="search" type="search" placeholder="Try ‘pair’, ‘wing’ or ‘chain’…"/></label><label>Difficulty<select id="level"><option value="">All levels</option>${['Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'].map(s => `<option>${s}</option>`).join('')}</select></label><label>Family<select id="family"><option value="">All families</option>${[...new Set(ALL_TECHS.map(k => TECHS[k].category))].map(s => `<option>${s}</option>`).join('')}</select></label></div><p id="result-count" class="muted" role="status"></p><div id="techniques"></div></section><aside id="attribution" class="attribution"><h2>Made possible by open source.</h2><p>All ${ALL_TECHS.length} technique descriptions and the original classic engine are imported from <a href="https://github.com/AImenes/sudokUI">AImenes/sudokUI</a>, commit <code>cf7ce55</code>. Original text and implementation status are preserved. “Implemented” refers to the upstream classic engine, not an irregular hint engine.</p><p>Licensed under <a href="/sudokui-LICENSE.txt">GPL-3.0</a>. <a href="/source.tar.gz" download>Download the complete source</a>, including the imported techniques and attribution.</p></aside>`;
  function filter() {
    const query = document.querySelector<HTMLInputElement>('#search')!.value.toLowerCase();
    const level = document.querySelector<HTMLSelectElement>('#level')!.value;
    const family = document.querySelector<HTMLSelectElement>('#family')!.value;
    const keys = ALL_TECHS.filter(k => (!level || TECHS[k].level === level) && (!family || TECHS[k].category === family) && `${TECHS[k].name} ${TECH_DOCS[k].aka.join(' ')} ${TECH_DOCS[k].what}`.toLowerCase().includes(query));
    document.querySelector('#result-count')!.textContent = `${keys.length} of ${ALL_TECHS.length} techniques`;
    document.querySelector('#techniques')!.innerHTML = keys.length ? keys.map(k => {
      const t = TECHS[k], d = TECH_DOCS[k];
      return `<details class="technique"><summary><span class="tech-title">${esc(t.name)}<small>${t.category}</small></span><span class="badge">${t.level}</span><span class="tech-status">${t.implemented ? 'Implemented' : 'Reference only'}</span><span class="plus">+</span></summary><div class="tech-body">${[['The pattern', d.what], ['Why it works', d.why], ['How to spot it', d.spot]].map(([h, p]) => `<div><h3>${h}</h3><p>${esc(p)}</p></div>`).join('')}${d.aka.length ? `<p class="muted">Also known as: ${d.aka.map(esc).join(', ')}</p>` : ''}<p class="muted">Upstream HoDoKu-style score: ${t.score}</p></div></details>`;
    }).join('') : '<div class="empty-results">No matching techniques. Try a different search or filter.</div>';
  }
  for (const id of ['search', 'level', 'family']) document.getElementById(id)!.addEventListener('input', filter);
  filter();
}
