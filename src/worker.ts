import { dig, generate, solve } from './sudoku';
self.onmessage = (event: MessageEvent) => {
  try {
    const { type, values, regions } = event.data;
    if (type === 'generate') {
      const started = performance.now();
      const puzzle = generate(Math.random, (regions, attempt) => self.postMessage({ type: 'progress', regions, attempt }));
      const dug = dig(puzzle, Math.random, (values, tested) => self.postMessage({ type: 'digging', regions: puzzle.regions, values, tested }));
      self.postMessage({ type: 'generated', ...dug, elapsedMs: performance.now() - started });
    } else self.postMessage({ type: 'solved', values: solve(values, regions) });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' }); }
};
