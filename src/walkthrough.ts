import { candidates, conflicts, countSolutions, units, validRegions, type Board, type Puzzle } from './sudoku';
import { TECHS, LEVELS, LEVEL_MAX_SCORE, type Level, type Tech } from '../vendor/sudokui/engine/ratings';
import { findIrregularLockedCandidates, IRREGULAR_LOCKED } from './irregular-techniques';
import { findPhistomefel, PHISTOMEFEL } from './phistomefel';

export interface SolveStep {
  technique: string; explanation: string; level: Level | 'Search-assisted'; score: number;
  values: Board; candidates: number[][]; pattern: number[]; affected: number[];
  placed?: { cell: number; digit: number };
  removed: { cell: number; digit: number }[];
}
export interface Walkthrough {
  initial: Board; givens: Board; regions: Board; initialCandidates: number[][]; steps: SolveStep[];
  rating: Level | 'Search-assisted'; score: number; searchSteps: number;
}
const coord = (i: number) => `r${Math.floor(i / 9) + 1}c${i % 9 + 1}`;
const houseName = (u: number) => u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `region ${u - 17}`;
function combinations(a: number[], n: number): number[][] {
  if (!n) return [[]];
  return a.flatMap((v, i) => combinations(a.slice(i + 1), n - 1).map(rest => [v, ...rest]));
}
/** Pure region-aware deductions. Classic box-dependent finders are not invoked. */
export function walkthrough(puzzle: Puzzle, progress?: (steps: number) => void, allowSearch = true): Walkthrough {
  if (!validRegions(puzzle.regions) || puzzle.values.length !== 81 || puzzle.values.some(v => !Number.isInteger(v) || v < 0 || v > 9) || conflicts(puzzle.values, puzzle.regions).size) throw new Error('Correct the grid before building a walkthrough.');
  if (countSolutions(puzzle.values, puzzle.regions) !== 1) throw new Error('A rated walkthrough requires exactly one solution. This grid has zero or multiple solutions.');
  const values = [...puzzle.values], houses = units(puzzle.regions);
  let notes = values.map((_, i) => candidates(values, puzzle.regions, i));
  const result: Walkthrough = { initial: [...values], givens: [...(puzzle.givens ?? values)], regions: [...puzzle.regions], initialCandidates: notes.map(a => [...a]), steps: [], rating: 'Easy', score: 0, searchSteps: 0 };
  function record(tech: Tech | 'SEARCH' | 'IRREGULAR_LOCKED' | 'PHISTOMEFEL', explanation: string, pattern: number[], removed: SolveStep['removed'] = [], placed?: SolveStep['placed']) {
    if (placed) {
      values[placed.cell] = placed.digit;
      notes = notes.map((list, i) => values[i] ? [] : list.filter(d => candidates(values, puzzle.regions, i).includes(d)));
    } else for (const { cell, digit } of removed) notes[cell] = notes[cell].filter(d => d !== digit);
    const info = tech === 'SEARCH' ? { name: 'Brute force', level: 'Search-assisted' as const, score: 10000 } : tech === 'IRREGULAR_LOCKED' ? IRREGULAR_LOCKED : tech === 'PHISTOMEFEL' ? PHISTOMEFEL : TECHS[tech];
    result.steps.push({ technique: info.name, explanation, level: info.level, score: info.score, values: [...values], candidates: notes.map(a => [...a]), pattern: [...pattern], affected: placed ? [placed.cell] : [...new Set(removed.map(r => r.cell))], placed, removed });
    result.score += info.score;
    if (tech === 'SEARCH') result.searchSteps++;
    else if (result.rating !== 'Search-assisted' && LEVELS.indexOf(info.level as Level) > LEVELS.indexOf(result.rating)) result.rating = info.level as Level;
    progress?.(result.steps.length);
  }
  while (values.some(v => !v)) {
    let changed = false;
    for (let u = 0; u < 27 && !changed; u++) {
      const empty = houses[u].filter(i => !values[i]);
      if (empty.length === 1) { const cell = empty[0], digit = notes[cell][0]; record('FULL_HOUSE', `${houseName(u)} has just one empty cell. Its missing digit is ${digit}, so ${coord(cell)} = ${digit}.`, houses[u], [], { cell, digit }); changed = true; }
    }
    if (changed) continue;
    const single = notes.findIndex((ns, i) => !values[i] && ns.length === 1);
    if (single >= 0) { const digit = notes[single][0]; record('NAKED_SINGLE', `After the row, column, region and earlier eliminations are considered, ${coord(single)} has only candidate ${digit}. Place ${digit}.`, [single], [], { cell: single, digit }); continue; }
    for (let u = 0; u < 27 && !changed; u++) for (let d = 1; d <= 9 && !changed; d++) {
      const places = houses[u].filter(i => notes[i].includes(d));
      if (places.length === 1) { record('HIDDEN_SINGLE', `Only ${coord(places[0])} can contain ${d} in ${houseName(u)}. Place ${d} there.`, houses[u], [], { cell: places[0], digit: d }); changed = true; }
    }
    if (changed) continue;
    // Locked candidates between any region and row/column, with arbitrary intersection size.
    for (let a = 0; a < 27 && !changed; a++) for (let b = 0; b < 27 && !changed; b++) {
      if ((a < 18) === (b < 18)) continue;
      for (let d = 1; d <= 9 && !changed; d++) {
        const places = houses[a].filter(i => notes[i].includes(d));
        if (places.length < 2 || !places.every(i => houses[b].includes(i))) continue;
        const removed = houses[b].filter(i => !houses[a].includes(i) && notes[i].includes(d)).map(cell => ({ cell, digit: d }));
        if (removed.length) { record(a >= 18 ? 'LOCKED_CANDIDATES_1' : 'LOCKED_CANDIDATES_2', `Every place for ${d} in ${houseName(a)} lies in ${houseName(b)} (${places.map(coord).join(', ')}). Remove ${d} from the other cells of ${houseName(b)}.`, places, removed); changed = true; }
      }
    }
    if (changed) continue;
    const irregularLocked = findIrregularLockedCandidates(puzzle.regions, notes);
    if (irregularLocked) {
      const { region, digit, places, removed } = irregularLocked;
      record('IRREGULAR_LOCKED', `${digit} must occupy one of ${places.map(coord).join(', ')} in region ${region + 1}. Each of ${removed.map(({ cell }) => coord(cell)).join(', ')} sees every possible location through a shared row or column, so none can contain ${digit}. Remove candidate ${digit} from those cells.`, places, removed);
      continue;
    }
    for (const size of [2, 3, 4]) {
      for (let u = 0; u < 27 && !changed; u++) for (const group of combinations(houses[u].filter(i => notes[i].length >= 2 && notes[i].length <= size), size)) {
        const digits = [...new Set(group.flatMap(i => notes[i]))];
        if (digits.length !== size) continue;
        const removed = houses[u].filter(i => !group.includes(i)).flatMap(cell => notes[cell].filter(d => digits.includes(d)).map(digit => ({ cell, digit })));
        if (removed.length) { record(size === 2 ? 'NAKED_PAIR' : size === 3 ? 'NAKED_TRIPLE' : 'NAKED_QUADRUPLE', `${group.map(coord).join(', ')} in ${houseName(u)} can use only ${digits.join(', ')}. Those ${size} digits occupy those ${size} cells, so remove them from the other cells of this house.`, group, removed); changed = true; break; }
      }
      if (changed) break;
    }
    if (changed) continue;
    // X-Wing uses rows and columns only, so its proof is independent of region shapes.
    for (const transpose of [false, true]) {
      for (let d = 1; d <= 9 && !changed; d++) for (const [a, b] of combinations(Array.from({ length: 9 }, (_, i) => i), 2)) {
        const base = (n: number) => houses[n + (transpose ? 9 : 0)].filter(i => notes[i].includes(d));
        const first = base(a), second = base(b), cross = (i: number) => transpose ? Math.floor(i / 9) : i % 9;
        if (first.length !== 2 || second.length !== 2 || !first.every(i => second.some(j => cross(i) === cross(j)))) continue;
        const pattern = [...first, ...second];
        const removed = notes.flatMap((ns, cell) => ns.includes(d) && !pattern.includes(cell) && first.some(i => cross(i) === cross(cell)) ? [{ cell, digit: d }] : []);
        if (removed.length) { record('X_WING', `In ${transpose ? 'columns' : 'rows'} ${a + 1} and ${b + 1}, ${d} can only occupy ${pattern.map(coord).join(', ')}. These cover the same two ${transpose ? 'rows' : 'columns'}, so remove ${d} from the other cells in them.`, pattern, removed); changed = true; break; }
      }
      if (changed) break;
    }
    if (changed) continue;
    const ringStep=findPhistomefel(puzzle.regions,values,notes);
    if(ringStep) {
      const {digit,ring,corners,pattern,removed}=ringStep;
      record('PHISTOMEFEL', `This layout's row, column and region constraints prove that the ring and four corner 2×2 groups have identical digit tallies. For ${digit}, the ring allows ${ring.minimum}–${ring.maximum} occurrences and the corners allow ${corners.minimum}–${corners.maximum}. Matching these counts eliminates ${removed.map(r=>`${r.digit} from ${coord(r.cell)}`).join(', ')}.`,pattern,removed);
      continue;
    }
    if (!allowSearch) throw new LogicalSolveError();
    // Explicit search, never disguised as a human technique or a proven minimum difficulty.
    const cell = notes.reduce((best, ns, i) => ns.length && (best < 0 || ns.length < notes[best].length) ? i : best, -1);
    if (cell < 0) throw new Error('Walkthrough encountered an inconsistent candidate state.');
    const rejected: number[] = []; let digit = 0;
    for (const candidate of notes[cell]) {
      const trial = [...values]; trial[cell] = candidate;
      if (countSolutions(trial, puzzle.regions) === 0) rejected.push(candidate); else digit = candidate;
    }
    if (!digit) throw new Error('No completion exists for the walkthrough state.');
    record('SEARCH', `The supported logical techniques found no next step. Exhaustive search tested ${notes[cell].join(', ')} at ${coord(cell)}: ${rejected.join(', ')} each lead to zero completions. Only ${digit} permits a completion, so place ${digit}. This step uses search, not a named human deduction.`, [cell], [], { cell, digit });
  }
  if (result.searchSteps) result.rating = 'Search-assisted';
  else {
    let level = result.rating as Level;
    while (level !== 'Extreme' && result.score > LEVEL_MAX_SCORE[level]) level = LEVELS[LEVELS.indexOf(level) + 1];
    result.rating = level;
  }
  return result;
}

export class LogicalSolveError extends Error { constructor() { super('The supported logical techniques cannot complete this puzzle.'); } }
export function hasCompleteLogicalSolve(puzzle: Puzzle): boolean {
  try { walkthrough(puzzle, undefined, false); return true; }
  catch (error) { if (error instanceof LogicalSolveError) return false; throw error; }
}
export function hardestTechnique(trace: Walkthrough): string {
  if (!trace.steps.length) return 'None (already complete)';
  const score = Math.max(...trace.steps.map(step => step.score));
  const names = [...new Set(trace.steps.filter(step => step.score === score).map(step => step.technique))];
  return names.join(', ') + ' (' + score + ' points)';
}
