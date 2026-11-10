import { generate, solve } from './sudoku';
self.onmessage = (event: MessageEvent) => {
  try {
    const { type, values, regions } = event.data;
    if (type === 'generate') {
      const puzzle = generate(Math.random, (regions, attempt) => self.postMessage({ type: 'progress', regions, attempt }));
      self.postMessage({ type: 'generated', ...puzzle });
    } else self.postMessage({ type: 'solved', values: solve(values, regions) });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' }); }
};
