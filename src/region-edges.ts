import { neighbors, validRegions, conflicts, type Puzzle } from './sudoku';

export const edgeKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
export const gridEdges = Array.from({ length: 81 }, (_, i) => neighbors(i).filter(j => j > i).map(j => [i, j] as const)).flat();
export function edgesFromRegions(regions: number[]): Set<string> {
  return new Set(gridEdges.filter(([a, b]) => regions[a] !== regions[b]).map(([a, b]) => edgeKey(a, b)));
}
export function regionsFromEdges(edges: ReadonlySet<string>): number[] {
  const regions = Array(81).fill(-1); let region = 0;
  for (let i = 0; i < 81; i++) if (regions[i] < 0) {
    const todo = [i]; regions[i] = region;
    while (todo.length) {
      const cell = todo.pop()!;
      for (const next of neighbors(cell)) if (regions[next] < 0 && !edges.has(edgeKey(cell, next))) { regions[next] = region; todo.push(next); }
    }
    region++;
  }
  return regions;
}
export function puzzleFromEdges(edges: ReadonlySet<string>, values: number[]): Puzzle {
  const regions = regionsFromEdges(edges);
  if (!validRegions(regions)) throw new Error('Draw nine closed regions, each containing nine edge-connected cells.');
  if (gridEdges.some(([a, b]) => edges.has(edgeKey(a, b)) && regions[a] === regions[b])) throw new Error('Remove unfinished edges inside a region, or complete their outline.');
  if (values.length !== 81 || values.some(v => !Number.isInteger(v) || v < 0 || v > 9)) throw new Error('Use digits 1–9 for givens.');
  if (conflicts(values, regions).size) throw new Error('The givens conflict in a row, column or region.');
  return { regions, values: [...values], givens: [...values] };
}
