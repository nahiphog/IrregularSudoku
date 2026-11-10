import test from 'node:test';
import assert from 'node:assert/strict';
import { classicRegions, countSolutions, DEFAULT_GENERATION_OPTIONS, dig, generate, partition, rotationallySymmetric, units, validRegions } from '../src/sudoku.ts';
function random(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

test('both UI generation options default to enabled', () => {
  assert.deepEqual(DEFAULT_GENERATION_OPTIONS, { symmetricRegions: true, pairedDigging: true });
});
test('symmetric partitions preserve boundaries under rotation across 40 seeds', () => {
  const layouts = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const regions = partition(random(seed), true);
    assert.ok(validRegions(regions)); assert.ok(rotationallySymmetric(regions));
    assert.notDeepEqual(regions, classicRegions()); layouts.add(regions.join(''));
    // Independently compare each horizontal and vertical boundary to its rotation.
    for (let i = 0; i < 81; i++) for (const j of [i % 9 < 8 ? i + 1 : -1, i < 72 ? i + 9 : -1]) if (j >= 0) {
      assert.equal(regions[i] === regions[j], regions[80 - i] === regions[80 - j]);
    }
  }
  assert.ok(layouts.size > 30);
});
test('all four option combinations generate valid, unique puzzles; paired results are pair-minimal', () => {
  for (const symmetric of [false, true]) for (const paired of [false, true]) {
    const full = generate(random(47), undefined, symmetric);
    if (symmetric) assert.ok(rotationallySymmetric(full.regions));
    for (const house of units(full.regions)) assert.equal(new Set(house.map(i => full.values[i])).size, 9);
    let tested = 0, calls = 0;
    const puzzle = dig(full, random(73), (values, n) => {
      assert.ok(n > tested); tested = n; calls++;
      if (paired) values.forEach((v, i) => assert.equal(!!v, !!values[80 - i]));
    }, paired);
    assert.equal(tested, 81); assert.equal(calls, paired ? 41 : 81);
    assert.equal(countSolutions(puzzle.values, puzzle.regions), 1);
    for (let i = 0; i < (paired ? 41 : 81); i++) if (puzzle.values[i]) {
      const less = [...puzzle.values]; less[i] = 0; if (paired) less[80 - i] = 0;
      assert.equal(countSolutions(less, puzzle.regions), 2);
    }
  }
});
