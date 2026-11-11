import { DEFAULT_GENERATION_OPTIONS, dig, generate, solve, findSolutions } from './sudoku';
import { walkthrough, hasCompleteLogicalSolve } from './walkthrough';
self.onmessage = (event: MessageEvent) => {
  try {
    const { type, values, regions, givens } = event.data;
    const options = { ...DEFAULT_GENERATION_OPTIONS, ...event.data.options };
    if (type === 'import') {
      const solutions = findSolutions(values, regions);
      self.postMessage({ type: 'imported', solutions, walkthrough: solutions.length === 1 ? walkthrough({ values, regions, givens }) : null });
    } else if (type === 'generate' || type === 'custom') {
      const started = performance.now();
      const customSolution = type === 'custom' ? solve(Array(81).fill(0), regions) : null;
      if (type === 'custom' && !customSolution) throw new Error('These regions admit no Sudoku solution. Adjust the boundaries and try again.');
      const puzzle = type === 'custom' ? { regions, values: customSolution! } : generate(Math.random, (regions, attempt) => self.postMessage({ type: 'progress', regions, attempt }), options.symmetricRegions);
      const dug = dig(puzzle, Math.random, (values, tested) => self.postMessage({ type: 'digging', regions: puzzle.regions, values, tested }), options.pairedDigging, type === 'custom' ? event.data.required : undefined, type === 'generate' && options.requireLogicalSolve ? hasCompleteLogicalSolve : undefined);
      const elapsedMs = performance.now() - started;
      const trace = walkthrough(dug, steps => self.postMessage({ type: 'analyzing', steps }));
      self.postMessage({ type: 'generated', ...dug, elapsedMs, walkthrough: trace });
    } else if (type === 'analyze') self.postMessage({ type: 'analyzed', walkthrough: walkthrough({ values, regions, givens }, steps => self.postMessage({ type: 'analyzing', steps })) });
    else self.postMessage({ type: 'solved', values: solve(values, regions) });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' }); }
};
