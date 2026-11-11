import { gridImage, serializeGrid } from './clipboard';
import { mountWalkthrough } from './walkthrough-view';
import type { Walkthrough } from './walkthrough';
import { classicRegions, validRegions, type Puzzle } from './sudoku';
import { gridMarkup } from './grid-view';

export function renderStudio(main: HTMLElement) {
  let puzzle: Puzzle = { regions: classicRegions(), values: Array(81).fill(0) };
  let busy = false, colors = true, showCandidates = false, worker: Worker | null = null;
  const history: Puzzle[] = [], traceCache = new Map<string, Walkthrough>();
  const clone = (): Puzzle => ({ ...puzzle, regions: [...puzzle.regions], values: [...puzzle.values] });
  try { const saved = JSON.parse(localStorage.getItem('irregular-studio') || 'null'); if (validPuzzle(saved)) puzzle = saved; } catch { /* optional storage */ }
  puzzle.givens ??= [...puzzle.values];
  main.innerHTML = `<div class="studio"><section class="board-panel" aria-label="Sudoku board"><div class="board" id="board" role="group" aria-label="Read-only 9 by 9 Sudoku grid"></div><div class="board-bottom"><span>Read-only grid</span><button id="undo" class="text-button">↶ Undo</button></div></section><aside class="controls"><div class="control-card"><div class="generation-options"><label><input id="symmetric-regions" type="checkbox" checked/> 180° symmetric regions</label><label><input id="paired-digging" type="checkbox" checked/> Dig opposite cells in pairs</label></div><button id="generate" class="primary">Generate</button><div id="generation-stats" class="generation-stats" role="status"></div><button id="solve" class="wide-button">Solve grid</button><button id="cancel" hidden>Cancel</button><div id="status" class="status" role="status" aria-live="polite"></div></div><div class="rules"><div><h3>The rules</h3><p>Place the digits 1 through 9 in the grid so that each digit appears exactly once in each row, column and irregularly shaped region.</p></div></div><div class="options"><label><span>Region colors</span><input id="colors" type="checkbox" checked/></label><label><span>Show candidates</span><input id="candidates" type="checkbox"/></label></div><div class="copy-actions"><button id="copy-string">Copy to clipboard</button><button id="copy-image">Copy image</button></div><p class="copy-help">162 characters: 81 region IDs (1–9), followed by 81 cell digits (0 = blank).</p><div id="copy-fallback" hidden><label for="grid-string">Copy this string:</label><textarea id="grid-string" readonly rows="4"></textarea></div><a class="learn-link" href="/custom-build">Custom build <span>↗</span></a><a class="learn-link" href="/techniques">Solving techniques <span>↗</span></a></aside></div><div id="walkthrough-host"></div>`;
  const el = <T extends HTMLElement>(id: string) => main.querySelector<T>(`#${id}`)!;
  const board = el('board');
  const key = () => serializeGrid(puzzle) + (puzzle.givens ?? puzzle.values).join('');
  const walkView = mountWalkthrough(el('walkthrough-host'), () => run('analyze'));
  const status = (text: string, error = false) => { el('status').textContent = text; el('status').classList.toggle('error', error); };
  const save = () => { try { localStorage.setItem('irregular-studio', JSON.stringify(puzzle)); } catch { /* optional */ } };
  function draw() {
    board.classList.toggle('no-colors', !colors); board.innerHTML = gridMarkup(puzzle, showCandidates);
    const trace = traceCache.get(key());
    el('generation-stats').textContent = busy ? '' : puzzle.values.some(Boolean) ? `Difficulty: ${trace?.score ?? 'Not analyzed'} · ${(puzzle.givens ?? puzzle.values).filter(Boolean).length} givens${puzzle.generation ? ` · Generated in ${(puzzle.generation.elapsedMs / 1000).toFixed(2)} s` : ''}` : '';
    for (const id of ['generate','solve','copy-string','copy-image','symmetric-regions','paired-digging']) el<HTMLButtonElement>(id).disabled = busy;
    el<HTMLButtonElement>('undo').disabled = busy || !history.length;
    el('copy-fallback').hidden = true; el('cancel').hidden = !busy;
    walkView.update(busy ? null : traceCache.get(key()) ?? null, busy, colors);
  }
  function run(type: 'generate' | 'solve' | 'analyze') {
    if (busy) return;
    const previousTrace = traceCache.get(key());
    const previous = clone(), options = { symmetricRegions:el<HTMLInputElement>('symmetric-regions').checked, pairedDigging:el<HTMLInputElement>('paired-digging').checked };
    busy = true; draw();
    const started = performance.now();
    const timer = setInterval(() => { el('generation-stats').textContent = `Elapsed ${((performance.now() - started)/1000).toFixed(1)} s`; },100);
    const finish = () => { clearInterval(timer); worker?.terminate(); worker = null; busy = false; draw(); };
    status(type === 'generate' ? 'Generating…' : type === 'solve' ? 'Solving…' : 'Analyzing…');
    try { worker = new Worker(new URL('./worker.ts', import.meta.url), {type:'module'}); }
    catch { finish(); status('Could not start the solver.',true); return; }
    worker.onmessage = ({data}) => {
      if (data.type === 'progress') { puzzle = {regions:data.regions,values:Array(81).fill(0)}; draw(); status(`Generating layout ${data.attempt}…`); return; }
      if (data.type === 'digging') { puzzle = {regions:data.regions,values:data.values}; draw(); status(`Digging: ${data.tested}/81 cells tested.`); return; }
      if (data.type === 'analyzing') { status(`Analyzing: ${data.steps} steps…`); return; }
      if (data.type === 'analyzed') { traceCache.set(key(),data.walkthrough); finish(); status(''); return; }
      if (data.type === 'error' || !data.values) { puzzle = previous; finish(); status(data.message || 'No solution exists for this grid.',true); return; }
      history.push(previous);
      puzzle = {regions:data.regions || previous.regions,values:data.values,givens:type === 'generate' ? [...data.values] : [...(previous.givens ?? previous.values)],...(type === 'generate' ? {generation:{elapsedMs:data.elapsedMs,clues:data.values.filter(Boolean).length}} : previous.generation ? { generation: previous.generation } : {})};
      if (type === 'solve' && previousTrace) traceCache.set(key(),previousTrace);
      if (data.walkthrough) { traceCache.set(key(),data.walkthrough); if (traceCache.size > 12) traceCache.delete(traceCache.keys().next().value!); }
      save(); finish(); status('');
    };
    worker.onerror = () => { puzzle = previous; finish(); status('Solver failed. Please try again.',true); };
    el<HTMLButtonElement>('cancel').onclick = () => { puzzle = previous; finish(); status('Cancelled.'); };
    worker.postMessage({type,...previous,...(type === 'analyze' ? { values: previous.givens ?? previous.values } : {}),options});
  }
  el<HTMLButtonElement>('generate').onclick = () => run('generate');
  el<HTMLButtonElement>('solve').onclick = () => run('solve');
  el<HTMLButtonElement>('undo').onclick = () => { const previous = history.pop(); if (previous) { puzzle = previous; save(); draw(); status(''); } };
  el<HTMLInputElement>('colors').onchange = () => { colors = el<HTMLInputElement>('colors').checked; draw(); };
  el<HTMLInputElement>('candidates').onchange = () => { showCandidates = el<HTMLInputElement>('candidates').checked; draw(); };
  el<HTMLButtonElement>('copy-string').onclick = async () => {
    const text = serializeGrid(puzzle);
    try { await navigator.clipboard.writeText(text); status('Copied 162 characters.'); }
    catch { el('copy-fallback').hidden = false; const field = el<HTMLTextAreaElement>('grid-string'); field.value = text; field.focus(); field.select(); status('Clipboard unavailable. Copy the selected string manually.'); }
  };
  el<HTMLButtonElement>('copy-image').onclick = async () => {
    const png = gridImage(clone(),colors);
    try { await navigator.clipboard.write([new ClipboardItem({'image/png':png})]); status('Image copied.'); }
    catch { try { const blob = await png, a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'irregular-sudoku.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href),1000); status('Image clipboard unavailable. Downloaded PNG instead.'); } catch { status('Could not create image.',true); } }
  };
  draw(); if (puzzle.generation) run('analyze');
}
function validPuzzle(p: unknown): p is Puzzle {
  if (!p || typeof p !== 'object') return false;
  const x = p as Puzzle;
  if (x.givens !== undefined && (!Array.isArray(x.givens) || x.givens.length !== 81 || x.givens.some(v => !Number.isInteger(v) || v < 0 || v > 9))) return false;
  if (x.generation && (!Number.isFinite(x.generation.elapsedMs) || x.generation.elapsedMs < 0 || !Number.isInteger(x.generation.clues) || x.generation.clues < 0 || x.generation.clues > 81)) return false;
  return Array.isArray(x.regions) && validRegions(x.regions) && Array.isArray(x.values) && x.values.length === 81 && x.values.every(v => Number.isInteger(v) && v >= 0 && v <= 9);
}
