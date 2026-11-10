import { classicRegions, connected, validRegions, type Puzzle } from './sudoku';
import { parseGrid } from './clipboard';

export function renderCustomBuild(main: HTMLElement, base: string) {
  document.title = 'Custom build — Irregular Sudoku';
  let regions = classicRegions(), required: boolean[] = Array(81).fill(false), selected = 0, mode = 'region', busy = false;
  let worker: Worker | null = null, painting = false, mark = true;
  const history: { regions: number[]; required: boolean[] }[] = [];
  try { const saved = JSON.parse(localStorage.getItem('irregular-builder') || 'null'); if (saved && Array.isArray(saved.regions) && saved.regions.length === 81 && saved.regions.every((r: number) => Number.isInteger(r) && r >= -1 && r < 9) && Array.isArray(saved.required) && saved.required.length === 81 && saved.required.every((b: unknown) => typeof b === 'boolean')) { regions = saved.regions; required = saved.required; } } catch { /* optional draft storage */ }
  main.innerHTML = `<h1 class="page-title">Custom build</h1><div class="studio"><section class="board-panel"><div class="board custom-board" id="custom-board" role="group" aria-label="Custom region editor"></div><p class="copy-help">Choose a region, then click or drag across cells to paint. Every region needs nine edge-connected cells. ★ marks a required given; its digit is chosen during generation.</p><button id="custom-undo">Undo edit</button></section><aside class="controls"><fieldset class="builder-modes"><legend>Edit mode</legend><label><input type="radio" name="edit-mode" value="region" checked/> Regions</label><label><input type="radio" name="edit-mode" value="required"/> Required givens (optional)</label><label><input type="radio" name="edit-mode" value="erase"/> Erase region</label></fieldset><div id="region-palette" class="region-palette"></div><p id="builder-counts"></p><div class="builder-actions"><button id="reset-regions">Use classic regions</button><button id="clear-regions">Clear regions</button><button id="clear-required">Clear required givens</button></div><label class="builder-paired"><input id="custom-paired" type="checkbox" checked/> Dig opposite cells in pairs</label><p class="copy-help">When paired digging is enabled, a required cell also keeps its opposite partner. Unmarked cells may still be retained to preserve uniqueness.</p><button id="custom-generate" class="primary">Generate custom puzzle</button><button id="custom-cancel" hidden>Cancel</button><p id="custom-status" role="status"></p><details><summary>Start from a grid string</summary><label for="custom-string">Paste the 162-character grid string</label><textarea id="custom-string" rows="4" spellcheck="false"></textarea><button id="custom-import">Use regions and mark existing digits as required</button><p class="copy-help">Only the cell positions are retained as required; generation chooses new digits.</p></details></aside></div>`;
  const get = <T extends HTMLElement>(id: string) => main.querySelector<T>(`#${id}`)!;
  const board = get('custom-board'), palette = get('region-palette');
  const status = (text: string) => get('custom-status').textContent = text;
  function checkpoint() { history.push({ regions: [...regions], required: [...required] }); if (history.length > 100) history.shift(); }
  function save() { try { localStorage.setItem('irregular-builder', JSON.stringify({ regions, required })); } catch { /* optional */ } }
  function draw() {
    board.innerHTML = regions.map((r, i) => {
      const row = Math.floor(i / 9), col = i % 9;
      const style = `border-top-width:${row === 0 || regions[i - 9] !== r ? 2 : 0}px;border-left-width:${col === 0 || regions[i - 1] !== r ? 2 : 0}px;border-right-width:${col === 8 ? 2 : 1}px;border-bottom-width:${row === 8 ? 2 : 1}px`;
      return `<button class="cell region-${r}${required[i] ? ' required-cell' : ''}" data-cell="${i}" style="${style}" ${busy ? 'disabled' : ''} aria-label="Row ${row + 1}, column ${col + 1}, ${r < 0 ? 'unassigned' : `region ${r + 1}`}${required[i] ? ', required given' : ''}"><span class="region-label">${r < 0 ? '·' : r + 1}</span>${required[i] ? '<span class="required-star" aria-hidden="true">★</span>' : ''}</button>`;
    }).join('');
    palette.innerHTML = Array.from({length:9}, (_, r) => { const count = regions.filter(x => x === r).length; return `<button class="region-${r}" data-region="${r}" aria-pressed="${selected === r}" ${busy ? 'disabled' : ''}>Region ${r + 1}<small>${count}/9${count === 9 && !connected(regions, r) ? ' · disconnected' : ''}</small></button>`; }).join('');
    get('builder-counts').textContent = `${regions.filter(r => r >= 0).length}/81 cells assigned · ${required.filter(Boolean).length} required givens`;
    get<HTMLButtonElement>('custom-generate').disabled = busy || !validRegions(regions);
    get<HTMLButtonElement>('custom-undo').disabled = busy || !history.length;
    for (const id of ['reset-regions','clear-regions','clear-required','custom-import','custom-paired']) get<HTMLButtonElement>(id).disabled = busy;
    main.querySelectorAll<HTMLInputElement>('input[name="edit-mode"]').forEach(el => el.disabled = busy);
    get('custom-cancel').hidden = !busy;
  }
  function paint(i: number) { if (mode === 'required') required[i] = mark; else regions[i] = mode === 'erase' ? -1 : selected; save(); draw(); }
  board.addEventListener('pointerdown', e => {
    const event = e as PointerEvent, cell = (event.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    if (!cell || busy || event.button !== 0) return;
    event.preventDefault(); board.setPointerCapture(event.pointerId); checkpoint(); painting = true; const i = Number(cell.dataset.cell); mark = !required[i]; paint(i);
  });
  board.addEventListener('pointermove', e => {
    if (!painting || busy) return;
    const event = e as PointerEvent, cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cell]');
    if (cell && board.contains(cell)) paint(Number(cell.dataset.cell));
  });
  window.addEventListener('pointerup', () => painting = false);
  window.addEventListener('pointercancel', () => painting = false);
  board.addEventListener('click', e => { if ((e as MouseEvent).detail !== 0 || busy) return; const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]'); if (!cell) return; checkpoint(); const i = Number(cell.dataset.cell); mark = !required[i]; paint(i); });
  palette.onclick = e => { const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-region]'); if (cell && !busy) { selected = Number(cell.dataset.region); mode = 'region'; main.querySelector<HTMLInputElement>('input[value="region"]')!.checked = true; draw(); } };
  main.querySelectorAll<HTMLInputElement>('input[name="edit-mode"]').forEach(el => el.onchange = () => { mode = el.value; });
  get<HTMLButtonElement>('custom-undo').onclick = () => { const prev = history.pop(); if (prev) { regions = prev.regions; required = prev.required; save(); draw(); } };
  get<HTMLButtonElement>('reset-regions').onclick = () => { checkpoint(); regions = classicRegions(); save(); draw(); };
  get<HTMLButtonElement>('clear-regions').onclick = () => { checkpoint(); regions = Array(81).fill(-1); save(); draw(); };
  get<HTMLButtonElement>('clear-required').onclick = () => { checkpoint(); required.fill(false); save(); draw(); };
  get<HTMLButtonElement>('custom-import').onclick = () => { try { const p = parseGrid(get<HTMLTextAreaElement>('custom-string').value); checkpoint(); regions = p.regions; required = p.values.map(Boolean); save(); draw(); status('Regions loaded. Existing digit positions are marked as required.'); } catch (e) { status((e as Error).message); } };
  get<HTMLButtonElement>('custom-generate').onclick = () => {
    if (!validRegions(regions) || busy) return;
    busy = true; draw(); status('Solving your region layout…');
    worker = new Worker(new URL('./worker.ts', import.meta.url), {type:'module'});
    const finish = () => { worker?.terminate(); worker = null; busy = false; draw(); };
    worker.onmessage = ({data}) => {
      if (data.type === 'error') { finish(); status(data.message); return; }
      if (data.type === 'digging') { status(`Digging: ${data.tested}/81 cells tested. Required givens are protected.`); return; }
      if (data.type === 'analyzing') { status(`Preparing walkthrough: ${data.steps} steps…`); return; }
      if (data.type === 'generated') {
        const puzzle: Puzzle = { regions:data.regions, values:data.values, givens:[...data.values], generation:{elapsedMs:data.elapsedMs,clues:data.values.filter(Boolean).length} };
        finish();
        try { localStorage.setItem('irregular-studio',JSON.stringify(puzzle)); location.assign(base); }
        catch { status('Browser storage is unavailable. Enable site storage to open your generated puzzle in the studio.'); }
      }
    };
    worker.onerror = () => { finish(); status('Could not generate the custom puzzle. Please try again.'); };
    get<HTMLButtonElement>('custom-cancel').onclick = () => { finish(); status('Cancelled. Your custom design is preserved.'); };
    worker.postMessage({type:'custom',regions:[...regions],required:[...required],options:{pairedDigging:get<HTMLInputElement>('custom-paired').checked}});
  };
  draw();
}
