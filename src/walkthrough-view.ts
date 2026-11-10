import type { Walkthrough } from './walkthrough';

export function mountWalkthrough(host: HTMLElement, analyze: () => void) {
  let trace: Walkthrough | null = null, index = 0;
  host.innerHTML = `<section class="walkthrough" aria-label="Solution walkthrough"><div class="walk-heading"><div><p class="eyebrow">FOLLOW THE LOGIC</p><h2>Solution walkthrough</h2></div><button id="analyze">Analyze walkthrough</button></div><p id="walk-empty"></p><div id="walk-content" hidden><div class="walk-rating" id="walk-rating"></div><p class="rating-note">Studio difficulty estimate for this solve path, not a certified HoDoKu rating or the easiest possible solve. Logical steps use the imported technique weights; exhaustive checks add 1,000 points each and receive a separate Search-assisted label.</p><div class="walk-layout"><div><div id="walk-board" class="board" role="group" aria-label="Walkthrough grid"></div><p class="walk-legend">Green outline: pattern · Gold: changed cell · Crossed-out candidate: eliminated</p></div><div class="walk-detail"><p id="walk-position" class="eyebrow"></p><h3 id="walk-technique"></h3><p id="walk-explanation"></p><p id="walk-step-rating"></p><label class="walk-slider-label" for="walk-slider">Solution step</label><input id="walk-slider" type="range" min="0" value="0" step="1"/><div class="walk-buttons"><button id="walk-start" aria-label="First step">⏮</button><button id="walk-prev">Previous</button><button id="walk-next">Next</button><button id="walk-end" aria-label="Last step">⏭</button></div><p class="rating-note">Step 0 shows the original clues. Drag the slider or use arrow keys. This viewer leaves your puzzle unchanged.</p><details><summary>Techniques in this solve</summary><ul id="walk-summary"></ul></details></div></div></div></section>`;
  const el = <T extends HTMLElement>(id: string) => host.querySelector<T>(`#${id}`)!;
  const slider = el<HTMLInputElement>('walk-slider');
  el<HTMLButtonElement>('analyze').onclick = analyze;
  function render() {
    if (!trace) return;
    const step = trace.steps[index - 1], values = step?.values ?? trace.initial, notes = step?.candidates ?? trace.initialCandidates;
    el('walk-position').textContent = `STEP ${index} OF ${trace.steps.length}${index === trace.steps.length ? ' · COMPLETE' : ''}`;
    el('walk-technique').textContent = step?.technique ?? 'Original puzzle';
    el('walk-explanation').textContent = step?.explanation ?? 'These are the starting givens. Small digits show every currently possible candidate. Move forward to see the first deduction.';
    el('walk-step-rating').textContent = step ? `Step difficulty: ${step.level} · ${step.score} points` : 'No deductions applied yet.';
    slider.value = String(index); slider.max = String(trace.steps.length);
    slider.setAttribute('aria-valuetext', `Step ${index} of ${trace.steps.length}: ${step?.technique ?? 'Original puzzle'}`);
    for (const id of ['walk-start', 'walk-prev']) el<HTMLButtonElement>(id).disabled = index === 0;
    for (const id of ['walk-next', 'walk-end']) el<HTMLButtonElement>(id).disabled = index === trace.steps.length;
    el('walk-board').innerHTML = values.map((value, i) => {
      const r = trace!.regions[i], row = Math.floor(i / 9), col = i % 9;
      const removed = step?.removed.filter(x => x.cell === i).map(x => x.digit) ?? [];
      const style = `border-top-width:${row === 0 || trace!.regions[i - 9] !== r ? 2 : 0}px;border-left-width:${col === 0 || trace!.regions[i - 1] !== r ? 2 : 0}px;border-right-width:${col === 8 ? 2 : 1}px;border-bottom-width:${row === 8 ? 2 : 1}px`;
      return `<div class="cell region-${r} ${value && trace!.givens[i] === value ? 'given' : 'entered'} ${step?.pattern.includes(i) ? 'walk-pattern' : ''} ${step?.affected.includes(i) ? 'walk-affected' : ''}" style="${style}" aria-label="Row ${row + 1}, column ${col + 1}, region ${r + 1}, ${value || `candidates ${notes[i].join(', ')}`}${removed.length ? `; eliminated ${removed.join(', ')}` : ''}">${value || `<span class="notes">${Array.from({ length: 9 }, (_, n) => `<span class="${removed.includes(n + 1) ? 'eliminated' : ''}">${notes[i].includes(n + 1) || removed.includes(n + 1) ? n + 1 : ''}</span>`).join('')}</span>`}</div>`;
    }).join('');
  }
  const move = (n: number) => { if (!trace) return; index = Math.max(0, Math.min(trace.steps.length, n)); render(); };
  slider.oninput = () => move(Number(slider.value));
  el<HTMLButtonElement>('walk-start').onclick = () => move(0);
  el<HTMLButtonElement>('walk-prev').onclick = () => move(index - 1);
  el<HTMLButtonElement>('walk-next').onclick = () => move(index + 1);
  el<HTMLButtonElement>('walk-end').onclick = () => move(trace?.steps.length ?? 0);
  return {
    update(next: Walkthrough | null, busy: boolean, colors: boolean) {
      el<HTMLButtonElement>('analyze').disabled = busy;
      el('walk-content').hidden = !next;
      el('walk-empty').hidden = !!next || !busy;
      el('walk-empty').textContent = busy ? 'Preparing the puzzle and its solution walkthrough…' : '';
      el('walk-board').classList.toggle('no-colors', !colors);
      if (trace !== next) {
        trace = next; index = 0;
        if (trace) {
          el('walk-rating').textContent = `Difficulty: ${trace.rating} · Score: ${trace.score} · ${trace.steps.length} steps · ${trace.searchSteps} search checks`;
          const counts = new Map<string, number>(); trace.steps.forEach(s => counts.set(s.technique, (counts.get(s.technique) ?? 0) + 1));
          el('walk-summary').replaceChildren(...[...counts].map(([name, count]) => { const li = document.createElement('li'); li.textContent = `${name}: ${count}`; return li; }));
          render();
        }
      }
    }
  };
}
