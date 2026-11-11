import test from 'node:test';
import assert from 'node:assert/strict';
import { countSolutions, dig, generate } from '../src/sudoku.ts';
import { hardestTechnique, hasCompleteLogicalSolve, walkthrough } from '../src/walkthrough.ts';
function random(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

test('logical digging preserves uniqueness and clue symmetry and finishes without Brute force', () => {
  for (const paired of [false, true]) {
    const full = generate(random(7), undefined, true);
    const dug = dig(full, random(107), undefined, paired, undefined, hasCompleteLogicalSolve);
    assert.equal(countSolutions(dug.values, dug.regions), 1);
    assert.ok(dug.values.some(v => !v));
    if (paired) dug.values.forEach((v, i) => assert.equal(!!v, !!dug.values[80 - i]));
    const trace = walkthrough(dug, undefined, false);
    assert.equal(trace.searchSteps, 0);
    assert.deepEqual(trace.steps.at(-1)!.values, full.values);
    const maximum = Math.max(...trace.steps.map(step => step.score));
    assert.ok(hardestTechnique(trace).includes(`(${maximum} points)`));
    for (const step of trace.steps.filter(step => step.score === maximum)) assert.ok(hardestTechnique(trace).includes(step.technique));
  }
});

test('logical check rejects puzzles whose walkthrough needs Brute force', () => {
  const full = generate(random(1));
  const dug = dig(full, random(101));
  const trace = walkthrough(dug);
  assert.ok(trace.searchSteps > 0);
  assert.equal(hasCompleteLogicalSolve(dug), false);
  assert.equal(hardestTechnique(trace), 'Brute force (10000 points)');
  assert.equal(hardestTechnique(walkthrough(full)), 'None (already complete)');
});
