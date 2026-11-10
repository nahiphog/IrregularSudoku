import { candidates, isGiven, type Puzzle } from './sudoku';
/** Fixed-track read-only board shared by the studio and previews. */
export function gridMarkup(puzzle: Puzzle, showCandidates = false): string {
  return puzzle.values.map((value, i) => {
    const r = puzzle.regions[i], row = Math.floor(i / 9), col = i % 9;
    const style = `border-top-width:${row === 0 || puzzle.regions[i - 9] !== r ? 2 : 0}px;border-left-width:${col === 0 || puzzle.regions[i - 1] !== r ? 2 : 0}px;border-right-width:${col === 8 ? 2 : 1}px;border-bottom-width:${row === 8 ? 2 : 1}px`;
    const notes = showCandidates && !value ? candidates(puzzle.values, puzzle.regions, i) : [];
    return `<div class="cell region-${r} ${isGiven(puzzle, i) ? 'given' : 'entered'}" style="${style}" aria-label="Row ${row + 1}, column ${col + 1}, region ${r + 1}, ${value || 'empty'}">${value || (notes.length ? `<span class="notes">${Array.from({length:9}, (_, d) => `<span>${notes.includes(d + 1) ? d + 1 : ''}</span>`).join('')}</span>` : '')}</div>`;
  }).join('');
}
