import { DEFAULT_GENERATION_OPTIONS, dig, generate, solve } from './sudoku';
import { walkthrough } from './walkthrough';
self.onmessage = (event: MessageEvent) => {
  try {
    const { type, values, regions, givens } = event.data;
    const options = { ...DEFAULT_GENERATION_OPTIONS, ...event.data.options };
    if (type === 'generate') {
      const started = performance.now();
      const puzzle = generate(Math.random, (regions, attempt) => self.postMessage({ type: 'progress', regions, attempt }), options.symmetricRegions);
      const dug = dig(puzzle, Math.random, (values, tested) => self.postMessage({ type: 'digging', regions: puzzle.regions, values, tested }), options.pairedDigging);
      const elapsedMs = performance.now() - started;
      const trace = walkthrough(dug, steps => self.postMessage({ type: 'analyzing', steps }));
      self.postMessage({ type: 'generated', ...dug, elapsedMs, walkthrough: trace });
    } else if (type === 'analyze') self.postMessage({ type: 'analyzed', walkthrough: walkthrough({ values, regions, givens }, steps => self.postMessage({ type: 'analyzing', steps })) });
    else self.postMessage({ type: 'solved', values: solve(values, regions) });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' }); }
};
