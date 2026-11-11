import { parseGrid, serializeGrid, gridImage } from './clipboard';
import { gridMarkup } from './grid-view';
import { mountWalkthrough } from './walkthrough-view';
import type { Board, Puzzle } from './sudoku';

function copyButtons(target: string, label: string): string {
  return `<div class="copy-actions" role="group" aria-label="Copy ${label}"><button data-copy="${target}" data-format="string">Copy string</button><button data-copy="${target}" data-format="image">Copy image</button></div>`;
}
export function renderImport(main: HTMLElement) {
  document.title = 'Import grid — Irregular Sudoku';
  main.innerHTML = `<h1 class="page-title">Import grid</h1><section class="import-form"><label for="import-string">Paste your 162-character grid string</label><p class="copy-help">81 region IDs (1–9), followed by 81 cell digits (0 = blank).</p><textarea id="import-string" rows="4" spellcheck="false"></textarea><div class="copy-actions"><button id="paste-string">Paste clipboard</button><button id="apply-import">Import grid</button></div><button id="import-cancel" class="wide-button" hidden>Cancel</button><p id="import-status" role="status" aria-live="polite"></p><label><input id="import-colors" type="checkbox" checked/> Region colors</label></section><section id="import-result" hidden><h2>Imported puzzle</h2><div id="import-board" class="board import-board" role="group" aria-label="Imported puzzle"></div>${copyButtons("imported", "imported puzzle")}<div id="import-solutions"></div></section><div id="import-copy-fallback" hidden><label for="import-copy-text">Copy this 162-character string:</label><textarea id="import-copy-text" readonly rows="4"></textarea></div><div id="import-walkthrough" hidden></div>`;
  const el = <T extends HTMLElement>(id: string) => main.querySelector<T>(`#${id}`)!;
  let worker: Worker | null = null, puzzle: Puzzle | null = null, solutions: Board[] = [];
  const view = mountWalkthrough(el('import-walkthrough'), check);
  const status = (message: string) => { el('import-status').textContent = message; };
  function draw() {
    if (!puzzle) return;
    const colors = el<HTMLInputElement>('import-colors').checked;
    el('import-board').innerHTML = gridMarkup(puzzle);
    el('import-board').classList.toggle('no-colors', !colors);
    const differences = new Set(solutions.length === 2 ? solutions[0].flatMap((value, i) => value !== solutions[1][i] ? [i] : []) : []);
    el('import-solutions').innerHTML = solutions.length ? `<h2>${solutions.length === 2 ? "Two possible solutions" : "Solution"}</h2>${solutions.length === 2 ? `<p>${differences.size} cells differ. Matching positions are circled in both grids.</p>` : ""}<div class="solution-comparison">${solutions.map((values, i) => `<section><h3>Solution ${i + 1}</h3><div class="board ${colors ? '' : 'no-colors'}" role="group" aria-label="Solution ${i + 1}">${gridMarkup({ ...puzzle!, values, givens: puzzle!.values }, false, differences)}</div>${copyButtons(String(i), `solution ${i + 1}`)}</section>`).join('')}</div>` : '';
    main.querySelectorAll('#import-walkthrough .board').forEach(board => board.classList.toggle('no-colors', !colors));
  }
  function finish() {
    worker?.terminate(); worker = null;
    el<HTMLButtonElement>('apply-import').disabled = false;
    el('import-cancel').hidden = true;
  }
  function check() {
    worker?.terminate(); worker = null;
    el('import-copy-fallback').hidden = true;
    solutions = []; el('import-result').hidden = true; el('import-walkthrough').hidden = true;
    view.update(null, false, el<HTMLInputElement>('import-colors').checked);
    try { puzzle = parseGrid(el<HTMLTextAreaElement>('import-string').value); }
    catch (error) { finish(); status((error as Error).message); return; }
    draw(); el('import-result').hidden = false;
    status('Checking solutions…'); el<HTMLButtonElement>('apply-import').disabled = true; el('import-cancel').hidden = false;
    try { worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }); }
    catch { finish(); status('Could not start the solver. Please try again.'); return; }
    worker.onmessage = ({ data }) => {
      finish();
      if (data.type === 'error') { status(data.message); return; }
      solutions = data.solutions;
      status(solutions.length === 0 ? 'This grid has no solution.' : solutions.length === 1 ? 'This grid has exactly one solution.' : 'This grid has multiple solutions. Two distinct solutions are shown below.');
      draw();
      if (data.walkthrough) {
        el('import-walkthrough').hidden = false;
        view.update(data.walkthrough, false, el<HTMLInputElement>('import-colors').checked);
      }
    };
    worker.onerror = () => { finish(); status('Solver failed. Please try again.'); };
    worker.postMessage({ type: 'import', ...puzzle });
  }
  el('import-result').addEventListener('click', async event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-copy]');
    if (!button || !puzzle) return;
    const target = button.dataset.copy!, index = Number(target);
    const selected: Puzzle = target === 'imported' ? { ...puzzle, values: [...puzzle.values] } : { ...puzzle, values: [...solutions[index]], givens: [...puzzle.values] };
    el('import-copy-fallback').hidden = true;
    if (button.dataset.format === 'string') {
      const text = serializeGrid(selected);
      try { await navigator.clipboard.writeText(text); status('Copied 162 characters.'); }
      catch { el('import-copy-fallback').hidden = false; const field = el<HTMLTextAreaElement>('import-copy-text'); field.value = text; field.focus(); field.select(); status('Clipboard unavailable. Copy the selected string manually.'); }
    } else {
      const differences = new Set(target !== 'imported' && solutions.length === 2 ? solutions[0].flatMap((v, i) => v !== solutions[1][i] ? [i] : []) : []);
      const png = gridImage(selected, el<HTMLInputElement>('import-colors').checked, differences);
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]); status('Image copied.'); }
      catch { try { const blob = await png, a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = target === 'imported' ? 'imported-grid.png' : `solution-${index + 1}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); status('Image clipboard unavailable. Downloaded PNG instead.'); } catch { status('Could not create image.'); } }
    }
  });
  el<HTMLButtonElement>('apply-import').onclick = check;
  el<HTMLButtonElement>('import-cancel').onclick = () => { finish(); status('Check cancelled.'); };
  el<HTMLInputElement>('import-colors').onchange = draw;
  el<HTMLButtonElement>('paste-string').onclick = async () => {
    try { el<HTMLTextAreaElement>('import-string').value = await navigator.clipboard.readText(); }
    catch { status('Paste into the field using Ctrl+V or Command+V.'); el('import-string').focus(); }
  };
}
