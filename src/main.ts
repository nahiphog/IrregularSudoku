import './style.css';
import { candidates, classicRegions, conflicts, validRegions, type Puzzle } from './sudoku';
import { TECHS, ALL_TECHS } from '../vendor/sudokui/engine/ratings';
import { TECH_DOCS } from '../vendor/sudokui/content/techniqueDocs';

const app = document.querySelector<HTMLDivElement>('#app')!;
const isGuide = location.pathname.startsWith('/techniques');
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
app.innerHTML = `<header><a class="brand" href="/" aria-label="Irregular Sudoku home"><span class="brand-icon">▦</span> irregular<span class="brand-dot">.</span></a><nav aria-label="Main navigation"><a href="/" ${!isGuide ? 'aria-current="page"' : ''}>Puzzle studio</a><a href="/techniques" ${isGuide ? 'aria-current="page"' : ''}>Techniques <span class="nav-count">${ALL_TECHS.length}</span></a></nav><span class="header-note">A little outside the box.</span></header><main id="main"></main><footer><span>Nine digits. Nine regions. A different perspective.</span><span>Built with TypeScript · <a href="/techniques#attribution">Open-source credits</a> · <a href="/source.zip" download>Source code</a></span></footer>`;
const main = document.querySelector<HTMLElement>('#main')!;

if (isGuide) renderGuide(); else renderStudio();

function renderGuide() {
  document.title = 'Techniques — Irregular Sudoku';
  main.innerHTML = `<section class="intro"><p class="eyebrow">THE SOLVER’S BOOKSHELF</p><h1>A little logic goes a long way.</h1><p class="lede">Explore the complete sudokUI technique library, from your first single to the most intricate chains.</p></section><div class="guide-note"><strong>Classic foundations. Irregular possibilities.</strong><p>This is the original classic Sudoku reference. Singles, subsets and peer-based logic can use irregular regions as houses. Patterns relying on 3 × 3 boxes, bands or stacks need separate verification; uniqueness techniques require a proven unique solution. The studio uses its own region-aware search solver, not these classic finders.</p></div><section class="library"><div class="filters"><label>Find a technique<input id="search" type="search" placeholder="Try ‘pair’, ‘wing’ or ‘chain’…"/></label><label>Difficulty<select id="level"><option value="">All levels</option>${['Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'].map(s => `<option>${s}</option>`).join('')}</select></label><label>Family<select id="family"><option value="">All families</option>${[...new Set(ALL_TECHS.map(k => TECHS[k].category))].map(s => `<option>${s}</option>`).join('')}</select></label></div><p id="result-count" class="muted" role="status"></p><div id="techniques"></div></section><aside id="attribution" class="attribution"><h2>Made possible by open source.</h2><p>All ${ALL_TECHS.length} technique descriptions and the original classic engine are imported from <a href="https://github.com/AImenes/sudokUI">AImenes/sudokUI</a>, commit <code>cf7ce55</code>. Original text and implementation status are preserved. “Implemented” refers to the upstream classic engine, not an irregular hint engine.</p><p>Licensed under <a href="/sudokui-LICENSE.txt">GPL-3.0</a>. <a href="/source.zip" download>Download the complete source</a>, including the imported techniques and attribution.</p></aside>`;
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

function renderStudio() {
  let puzzle: Puzzle = { regions: classicRegions(), values: Array(81).fill(0) };
  let selected = -1, busy = false, showCandidates = false, colors = true;
  let worker: Worker | null = null;
  const history: Puzzle[] = [];
  const clone = (): Puzzle => ({ regions: [...puzzle.regions], values: [...puzzle.values] });
  try { const saved = JSON.parse(localStorage.getItem('irregular-studio') || 'null'); if (validPuzzle(saved)) puzzle = saved; } catch { /* Storage is optional. */ }
  main.innerHTML = `<section class="intro"><p class="eyebrow">THE IRREGULAR SUDOKU STUDIO</p><h1>Same digits.<br class="mobile-break"/> Different boundaries.</h1><p class="lede">A familiar puzzle with a wonderfully unfamiliar shape.<br/>Create a grid, explore its regions, and find your way through.</p></section><div class="studio"><section class="board-panel" aria-label="Sudoku board"><div class="board-heading"><span><span class="live-dot"></span> YOUR CANVAS</span><span id="filled">0 / 81 filled</span></div><div class="board" id="board" role="group" aria-label="Editable 9 by 9 Sudoku grid"></div><div class="board-bottom"><span id="selection">Select a cell to begin</span><button id="undo" class="text-button" disabled>↶ Undo</button></div><div class="keypad" aria-label="Digit input">${Array.from({ length: 9 }, (_, i) => `<button data-digit="${i + 1}" aria-label="Enter ${i + 1}">${i + 1}</button>`).join('')}<button data-digit="0" aria-label="Erase selected cell">⌫</button></div><p class="keyboard-hint">Use 1–9 to enter · Backspace to erase · Arrow keys to move</p></section><aside class="controls"><div class="control-card"><p class="eyebrow">A NEW KIND OF GRID</p><h2>Let the shapes surprise you.</h2><p>Generate nine connected regions, then fill the grid with a valid solution. Every click brings a new arrangement.</p><button id="generate" class="primary"><span>✧</span> Generate <span class="button-arrow">↗</span></button><div class="secondary-actions"><button id="blank">Clear digits</button><button id="solve">Solve grid</button></div><button id="cancel" hidden>Cancel generation</button><div id="status" class="status" role="status" aria-live="polite">Ready when you are. Generate your first irregular grid.</div></div><div class="rules"><span class="rule-icon">↳</span><div><h3>The rules are simple.</h3><p>Place the digits 1 through 9 in the grid so that each digit appears exactly once in each row, column and irregularly shaped region.</p></div></div><div class="options"><label><span>Region colors</span><input id="colors" type="checkbox" checked/></label><label><span>Show candidates</span><input id="candidates" type="checkbox"/></label></div><div class="file-actions"><button id="export" class="text-button">↓ Export grid</button><button id="import" class="text-button">↑ Import grid</button><input id="file" type="file" accept="application/json,.json" hidden/></div><a class="learn-link" href="/techniques"><span>STUCK? GET CURIOUS.<strong>Explore ${ALL_TECHS.length} solving techniques</strong></span><span>↗</span></a></aside></div><section class="principles"><div><span>01</span><h3>Nine connected regions</h3><p>Each shape contains exactly nine cells, joined edge to edge.</p></div><div><span>02</span><h3>One consistent rule</h3><p>Every row, column and region contains the digits 1 through 9.</p></div><div><span>03</span><h3>Room to experiment</h3><p>Clear the digits to make your own grid. Enter clues and let the solver help.</p></div></section>`;
  const board = document.querySelector<HTMLDivElement>('#board')!;
  const status = (s: string, error = false) => { const el = document.querySelector('#status')!; el.textContent = s; el.classList.toggle('error', error); };
  const save = () => { try { localStorage.setItem('irregular-studio', JSON.stringify(puzzle)); } catch { /* Storage is optional. */ } };
  function draw() {
    const bad = conflicts(puzzle.values, puzzle.regions);
    board.classList.toggle('no-colors', !colors);
    board.innerHTML = puzzle.values.map((v, i) => {
      const region = puzzle.regions[i], row = Math.floor(i / 9), col = i % 9;
      const peer = selected >= 0 && (puzzle.regions[selected] === region || Math.floor(selected / 9) === row || selected % 9 === col);
      const classes = ['cell', `region-${region}`, selected === i ? 'selected' : '', peer ? 'peer' : '', bad.has(i) ? 'conflict' : ''].join(' ');
      const borders = `border-top-width:${row === 0 || puzzle.regions[i - 9] !== region ? 2 : 0}px;border-left-width:${col === 0 || puzzle.regions[i - 1] !== region ? 2 : 0}px;border-right-width:${col === 8 ? 2 : 1}px;border-bottom-width:${row === 8 ? 2 : 1}px;`;
      const notes = !v && showCandidates ? candidates(puzzle.values, puzzle.regions, i) : [];
      return `<button class="${classes}" style="${borders}" data-cell="${i}" ${busy ? 'disabled' : ''} tabindex="${selected === i || (selected < 0 && i === 0) ? 0 : -1}" aria-label="Row ${row + 1}, column ${col + 1}, region ${region + 1}, ${v || 'empty'}${bad.has(i) ? ', conflict' : ''}" aria-pressed="${selected === i}">${v || (notes.length ? `<span class="notes">${Array.from({ length: 9 }, (_, n) => `<span>${notes.includes(n + 1) ? n + 1 : ''}</span>`).join('')}</span>` : '')}</button>`;
    }).join('');
    document.querySelector('#filled')!.textContent = `${puzzle.values.filter(Boolean).length} / 81 filled`;
    document.querySelector('#selection')!.textContent = selected < 0 ? 'Select a cell to begin' : `Row ${Math.floor(selected / 9) + 1} · Column ${selected % 9 + 1} · Region ${puzzle.regions[selected] + 1}`;
    for (const id of ['generate', 'blank', 'solve', 'import', 'export']) (document.getElementById(id) as HTMLButtonElement).disabled = busy;
    (document.querySelector('#undo') as HTMLButtonElement).disabled = busy || !history.length;
    document.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach(b => b.disabled = busy || selected < 0);
    (document.querySelector('#cancel') as HTMLButtonElement).hidden = !busy;
  }
  function checkpoint() { history.push(clone()); if (history.length > 100) history.shift(); }
  function select(i: number) { selected = i; draw(); board.querySelector<HTMLButtonElement>(`[data-cell="${i}"]`)?.focus(); }
  function enter(d: number) {
    if (busy || selected < 0 || puzzle.values[selected] === d) return;
    checkpoint(); puzzle.values[selected] = d; save(); draw();
    const bad = conflicts(puzzle.values, puzzle.regions);
    status(bad.size ? 'Repeated digit: check the highlighted cells.' : puzzle.values.every(Boolean) ? 'Complete! Every row, column and region contains 1–9.' : 'Grid updated. Enter more digits or use Solve grid.', bad.size > 0);
    board.querySelector<HTMLButtonElement>(`[data-cell="${selected}"]`)?.focus();
  }
  board.addEventListener('click', e => { const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]'); if (el && !busy) select(Number(el.dataset.cell)); });
  board.addEventListener('keydown', e => {
    if (busy) return;
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); enter(Number(e.key)); }
    else if (['Backspace', 'Delete', '0'].includes(e.key)) { e.preventDefault(); enter(0); }
    else if (e.key.startsWith('Arrow')) { e.preventDefault(); const i = Math.max(0, selected); select(e.key === 'ArrowLeft' ? Math.max(i - 1, Math.floor(i / 9) * 9) : e.key === 'ArrowRight' ? Math.min(i + 1, Math.floor(i / 9) * 9 + 8) : e.key === 'ArrowUp' ? Math.max(0, i - 9) : Math.min(80, i + 9)); }
  });
  document.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach(b => b.onclick = () => enter(Number(b.dataset.digit)));
  function run(type: 'generate' | 'solve') {
    const previous = clone(); busy = true; selected = -1; draw();
    status(type === 'generate' ? 'Creating nine connected regions…' : 'Finding a solution for your digits…');
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { busy = false; worker?.terminate(); worker = null; draw(); };
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') { puzzle = { regions: data.regions, values: Array(81).fill(0) }; draw(); status(`Filling a new region layout… attempt ${data.attempt}`); return; }
      if (data.type === 'error' || (data.type === 'solved' && !data.values)) { puzzle = previous; finish(); status(data.message || 'No solution exists for these digits. Check your entries and try again.', true); return; }
      history.push(previous); puzzle = { regions: data.regions || previous.regions, values: data.values }; save(); finish();
      status(type === 'generate' ? 'A fresh grid, fully solved. All 27 houses verified. Clear digits to start creating.' : 'Solved! Every row, column and region contains 1–9.');
    };
    worker.onerror = () => { puzzle = previous; finish(); status('The solver could not start. Please try again.', true); };
    document.querySelector<HTMLButtonElement>('#cancel')!.onclick = () => { puzzle = previous; finish(); status('Cancelled. Your previous grid is restored.'); };
    worker.postMessage({ type, ...previous });
  }
  document.querySelector<HTMLButtonElement>('#generate')!.onclick = () => run('generate');
  document.querySelector<HTMLButtonElement>('#solve')!.onclick = () => run('solve');
  document.querySelector<HTMLButtonElement>('#blank')!.onclick = () => { checkpoint(); puzzle.values.fill(0); save(); draw(); status('Digits cleared. The regions are ready for your clues. This blank grid can have multiple solutions.'); };
  document.querySelector<HTMLButtonElement>('#undo')!.onclick = () => { const old = history.pop(); if (old) { puzzle = old; save(); draw(); status('Previous grid restored.'); } };
  document.querySelector<HTMLInputElement>('#colors')!.onchange = e => { colors = (e.target as HTMLInputElement).checked; draw(); };
  document.querySelector<HTMLInputElement>('#candidates')!.onchange = e => { showCandidates = (e.target as HTMLInputElement).checked; draw(); };
  document.querySelector<HTMLButtonElement>('#export')!.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...puzzle, format: 'irregular-sudoku-v1' }, null, 2)], { type: 'application/json' })); a.download = 'irregular-sudoku.json'; a.click(); URL.revokeObjectURL(a.href); status('Grid exported with all region boundaries and digits.'); };
  const file = document.querySelector<HTMLInputElement>('#file')!;
  document.querySelector<HTMLButtonElement>('#import')!.onclick = () => file.click();
  file.onchange = async () => {
    try { const chosen = file.files?.[0]; if (!chosen) return; if (chosen.size > 50_000) throw new Error('File too large. Choose an exported Sudoku JSON file.'); const imported = JSON.parse(await chosen.text()); if (!validPuzzle(imported)) throw new Error('Invalid grid. Expected 81 digits (0–9) and nine connected regions (IDs 0–8), each containing nine cells.'); checkpoint(); puzzle = { values: [...imported.values], regions: [...imported.regions] }; selected = -1; save(); draw(); status('Grid imported. You can edit the digits or solve it.'); }
    catch (e) { status(e instanceof Error ? e.message : 'Could not import this file.', true); }
    finally { file.value = ''; }
  };
  draw();
  if (puzzle.values.some(Boolean)) status('Your previous grid is restored. Continue exploring or generate a new one.');
}
function validPuzzle(p: unknown): p is Puzzle {
  if (!p || typeof p !== 'object') return false;
  const x = p as Puzzle;
  return Array.isArray(x.regions) && validRegions(x.regions) && Array.isArray(x.values) && x.values.length === 81 && x.values.every(v => Number.isInteger(v) && v >= 0 && v <= 9);
}
