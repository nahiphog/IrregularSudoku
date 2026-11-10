import './style.css';
import { renderStudio } from './studio';
import { renderCustomBuild } from './custom-build';
import { TECHS, ALL_TECHS, DISABLED_FAMILIES } from '../vendor/sudokui/engine/ratings';

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
  main.innerHTML = `<h1 class="page-title">Techniques</h1><section class="library"><div class="filters"><label>Find a technique<input id="search" type="search" placeholder="Try ‘pair’, ‘wing’ or ‘chain’…"/></label><label>Difficulty<select id="level"><option value="">All levels</option>${['Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'].map(s => `<option>${s}</option>`).join('')}</select></label><label>Family<select id="family"><option value="">All families</option>${[...new Set(ALL_TECHS.map(k => TECHS[k].category))].map(s => `<option>${s}</option>`).join('')}</select></label></div><p id="result-count" class="muted" role="status"></p><ul id="techniques" class="technique-list"></ul></section><aside id="attribution" class="attribution"><p>Licensed under <a href="/sudokui-LICENSE.txt">GPL-3.0</a>. <a href="/source.tar.gz" download>Download the complete source</a>, including the imported techniques and attribution.</p></aside>`;
  function filter() {
    const query = document.querySelector<HTMLInputElement>('#search')!.value.toLowerCase();
    const level = document.querySelector<HTMLSelectElement>('#level')!.value;
    const family = document.querySelector<HTMLSelectElement>('#family')!.value;
    const keys = ALL_TECHS.filter(k => (!level || TECHS[k].level === level) && (!family || TECHS[k].category === family) && `${TECHS[k].name} ${TECHS[k].category}`.toLowerCase().includes(query));
    document.querySelector('#result-count')!.textContent = `${keys.length} of ${ALL_TECHS.length} techniques`;
    document.querySelector('#techniques')!.innerHTML = keys.length ? keys.map(k => {
      const t = TECHS[k], disabled = DISABLED_FAMILIES.has(t.category);
      return `<li class="technique-row${disabled ? ' technique-disabled' : ''}"><span class="tech-title">${esc(t.name)}<small>${t.category}</small></span><span class="badge">${t.level}</span><span class="tech-score">${t.score} pts</span><span class="tech-availability">${disabled ? 'Temporarily disabled' : !t.implemented ? 'Reference only' : !t.enabled ? 'Disabled' : ''}</span></li>`;
    }).join('') : '<li class="empty-results">No matching techniques. Try a different search or filter.</li>';
  }
  for (const id of ['search', 'level', 'family']) document.getElementById(id)!.addEventListener('input', filter);
  filter();
}
