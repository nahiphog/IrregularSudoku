export type Board = number[];
export interface Puzzle { regions: Board; values: Board; generation?: { elapsedMs: number; clues: number } }
export const classicRegions = () => Array.from({ length: 81 }, (_, i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));
export const neighbors = (i: number) => [i - 9, i + 9, ...(i % 9 ? [i - 1] : []), ...(i % 9 < 8 ? [i + 1] : [])].filter(j => j >= 0 && j < 81);
function shuffle<T>(a: T[], random = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function connected(regions: Board, region: number): boolean {
  const cells = regions.flatMap((v, i) => v === region ? [i] : []);
  if (cells.length !== 9) return false;
  const seen = new Set([cells[0]]), todo = [cells[0]];
  while (todo.length) for (const n of neighbors(todo.pop()!)) if (regions[n] === region && !seen.has(n)) { seen.add(n); todo.push(n); }
  return seen.size === 9;
}
export function validRegions(regions: Board): boolean {
  return regions.length === 81 && regions.every(r => Number.isInteger(r) && r >= 0 && r < 9) && Array.from({ length: 9 }, (_, r) => connected(regions, r)).every(Boolean);
}
export function units(regions: Board): number[][] {
  return Array.from({ length: 27 }, (_, u) => Array.from({ length: 81 }, (_, i) => i).filter(i => u < 9 ? Math.floor(i / 9) === u : u < 18 ? i % 9 === u - 9 : regions[i] === u - 18));
}
export function conflicts(values: Board, regions: Board): Set<number> {
  const result = new Set<number>();
  for (const unit of units(regions)) for (const i of unit) if (values[i] && unit.some(j => j !== i && values[j] === values[i])) result.add(i);
  return result;
}
export function candidates(values: Board, regions: Board, i: number): number[] {
  if (values[i]) return [];
  const used = new Set(values.filter((_, j) => Math.floor(i / 9) === Math.floor(j / 9) || i % 9 === j % 9 || regions[i] === regions[j]));
  return Array.from({ length: 9 }, (_, j) => j + 1).filter(d => !used.has(d));
}
export class SearchLimitError extends Error { constructor() { super('The search limit was reached. Try adding more digits or generating another layout.'); } }
/** Exact solution count, stopping as soon as two completions are found. */
export function countSolutions(values: Board, regions: Board): number {
  if (!validRegions(regions) || values.length !== 81 || values.some(v => !Number.isInteger(v) || v < 0 || v > 9)) throw new Error('Invalid grid or region map.');
  const board = [...values], rows = new Int32Array(9), cols = new Int32Array(9), areas = new Int32Array(9);
  for (let i = 0; i < 81; i++) if (board[i]) {
    const bit = 1 << board[i], r = Math.floor(i / 9), c = i % 9, a = regions[i];
    if ((rows[r] | cols[c] | areas[a]) & bit) return 0;
    rows[r] |= bit; cols[c] |= bit; areas[a] |= bit;
  }
  let found = 0;
  function search(): void {
    let best = -1, mask = 0, count = 10;
    for (let i = 0; i < 81; i++) if (!board[i]) {
      const m = 1022 & ~(rows[Math.floor(i / 9)] | cols[i % 9] | areas[regions[i]]);
      let n = 0; for (let b = m; b; b &= b - 1) n++;
      if (!n) return;
      if (n < count) { best = i; mask = m; count = n; if (n === 1) break; }
    }
    if (best === -1) { found++; return; }
    const r = Math.floor(best / 9), c = best % 9, a = regions[best];
    for (let d = 1; d <= 9 && found < 2; d++) if (mask & (1 << d)) {
      const bit = 1 << d; board[best] = d; rows[r] |= bit; cols[c] |= bit; areas[a] |= bit;
      search();
      board[best] = 0; rows[r] ^= bit; cols[c] ^= bit; areas[a] ^= bit;
    }
  }
  search(); return found;
}
/** A failed removal never becomes possible after removing more clues, so one
 * shuffled pass proves single-clue minimality (not a global minimum clue count).
 * No search cutoff: an inconclusive search must never be treated as uniqueness.
 */
export function dig(puzzle: Puzzle, random = Math.random, progress?: (values: Board, tested: number) => void): Puzzle {
  if (puzzle.values.some(v => !v) || countSolutions(puzzle.values, puzzle.regions) !== 1) throw new Error('Digging requires a valid completed grid.');
  const values = [...puzzle.values];
  let tested = 0;
  for (const i of shuffle(Array.from({ length: 81 }, (_, i) => i), random)) {
    const given = values[i]; values[i] = 0;
    if (countSolutions(values, puzzle.regions) !== 1) values[i] = given;
    progress?.([...values], ++tested);
  }
  return { regions: [...puzzle.regions], values };
}

/** MRV backtracking with row, column and arbitrary-region bit masks. */
export function solve(values: Board, regions: Board, random = Math.random, limit = 2_000_000): Board | null {
  if (!validRegions(regions) || values.length !== 81 || values.some(v => !Number.isInteger(v) || v < 0 || v > 9)) throw new Error('Invalid grid or region map.');
  const board = [...values], rows = new Int32Array(9), cols = new Int32Array(9), areas = new Int32Array(9);
  for (let i = 0; i < 81; i++) if (board[i]) {
    const bit = 1 << board[i], r = Math.floor(i / 9), c = i % 9, a = regions[i];
    if ((rows[r] | cols[c] | areas[a]) & bit) return null;
    rows[r] |= bit; cols[c] |= bit; areas[a] |= bit;
  }
  let nodes = 0;
  function search(): boolean {
    if (++nodes > limit) throw new SearchLimitError();
    let best = -1, mask = 0, count = 10;
    for (let i = 0; i < 81; i++) if (!board[i]) {
      const m = 1022 & ~(rows[Math.floor(i / 9)] | cols[i % 9] | areas[regions[i]]);
      let n = 0; for (let b = m; b; b &= b - 1) n++;
      if (!n) return false;
      if (n < count) { best = i; mask = m; count = n; if (n === 1) break; }
    }
    if (best === -1) return true;
    const r = Math.floor(best / 9), c = best % 9, a = regions[best];
    for (const d of shuffle(Array.from({ length: 9 }, (_, i) => i + 1).filter(d => mask & (1 << d)), random)) {
      const bit = 1 << d; board[best] = d; rows[r] |= bit; cols[c] |= bit; areas[a] |= bit;
      if (search()) return true;
      board[best] = 0; rows[r] ^= bit; cols[c] ^= bit; areas[a] ^= bit;
    }
    return false;
  }
  return search() ? board : null;
}
/** Swap boundary cells between regions, accepting only connected nine-cell regions. */
export function partition(random = Math.random): Board {
  const regions = classicRegions();
  for (let step = 0; step < 1600; step++) {
    const i = Math.floor(random() * 81), adjacent = neighbors(i).filter(j => regions[i] !== regions[j]);
    if (!adjacent.length) continue;
    const b = regions[adjacent[Math.floor(random() * adjacent.length)]], a = regions[i];
    const options = regions.flatMap((r, j) => r === b && neighbors(j).some(k => regions[k] === a) ? [j] : []);
    const j = options[Math.floor(random() * options.length)];
    [regions[i], regions[j]] = [regions[j], regions[i]];
    if (!connected(regions, a) || !connected(regions, b)) [regions[i], regions[j]] = [regions[j], regions[i]];
  }
  return regions;
}
export function generate(random = Math.random, progress?: (regions: Board, attempt: number) => void): Puzzle {
  for (let attempt = 1; attempt <= 100; attempt++) {
    const regions = partition(random);
    if (regions.every((r, i) => r === classicRegions()[i])) continue;
    progress?.(regions, attempt);
    try { const values = solve(Array(81).fill(0), regions, random, 80_000); if (values) return { regions, values }; }
    catch (error) { if (!(error instanceof SearchLimitError)) throw error; }
  }
  throw new Error('Could not find a solvable layout within the attempt limit. Please generate again.');
}
