import { generate, dig } from './sudoku';
import { walkthrough } from './walkthrough';

// One trial per message: the UI controls scheduling and can terminate immediately.
self.onmessage = () => {
  try {
    const started = performance.now();
    const puzzle = dig(generate(Math.random, undefined, true), Math.random, undefined, true);
    const elapsedMs = performance.now() - started;
    const trace = walkthrough(puzzle);
    const hardest = trace.steps.reduce<(typeof trace.steps)[number] | undefined>((best, step) => !best || step.score > best.score ? step : best, undefined);
    self.postMessage({ type: 'result', puzzle, elapsedMs, score: trace.score, searchSteps: trace.searchSteps, hardestTechnique: hardest?.technique ?? 'None (already complete)' });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Trial failed.' });
  }
};
