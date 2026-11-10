import test from 'node:test';
import assert from 'node:assert/strict';
import { countSolutions, dig, generate, partition, validRegions, classicRegions, solve, units, conflicts, candidates, SearchLimitError } from '../src/sudoku.ts';
import { serializeGrid } from '../src/clipboard.ts';
import { ALL_TECHS } from '../vendor/sudokui/engine/ratings.ts';
import { TECH_DOCS } from '../vendor/sudokui/content/techniqueDocs.ts';
function random(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
test('random partitions cover 81 cells in nine connected nine-cell regions', () => {
  for (let seed = 1; seed <= 40; seed++) assert.ok(validRegions(partition(random(seed))));
});
test('generated grids satisfy every row, column and irregular region across 20 seeds', () => {
  const layouts = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) {
    const p = generate(random(seed));
    assert.ok(validRegions(p.regions));
    assert.notDeepEqual(p.regions, classicRegions());
    for (const unit of units(p.regions)) assert.deepEqual(unit.map(i => p.values[i]).sort(), [1,2,3,4,5,6,7,8,9]);
    layouts.add(p.regions.join(''));
    const partial = p.values.map((v, i) => i % 3 ? v : 0);
    const solved = solve(partial, p.regions)!;
    assert.ok(solved);
    assert.equal(conflicts(solved, p.regions).size, 0);
    partial.forEach((v, i) => { if (v) assert.equal(solved[i], v); });
  }
  assert.equal(layouts.size, 20);
});
test('rejects invalid region maps and conflicting entries', () => {
  assert.equal(validRegions(Array(81).fill(0)), false);
  const invalid = classicRegions(); [invalid[0], invalid[80]] = [invalid[80], invalid[0]];
  assert.equal(validRegions(invalid), false);
  assert.throws(() => solve(Array(81).fill(0), invalid));
  const values = Array(81).fill(0); values[0] = values[8] = 1;
  assert.equal(solve(values, classicRegions()), null);
  assert.equal(conflicts(values, classicRegions()).size, 2);
  assert.ok(!candidates(values, classicRegions(), 1).includes(1));
});
test('bounded search reports exhaustion instead of claiming unsatisfiable', () => {
  assert.throws(() => solve(Array(81).fill(0), classicRegions(), Math.random, 0), SearchLimitError);
});
test('all 80 imported techniques have complete documentation', () => {
  assert.equal(ALL_TECHS.length, 80);
  for (const key of ALL_TECHS) { assert.ok(TECH_DOCS[key].what); assert.ok(TECH_DOCS[key].why); assert.ok(TECH_DOCS[key].spot); }
});
test('solution counting distinguishes zero, one and multiple solutions', () => {
  const regions = classicRegions(), values = Array(81).fill(0);
  assert.equal(countSolutions(values, regions), 2);
  values[0] = values[1] = 1;
  assert.equal(countSolutions(values, regions), 0);
  const complete = generate(random(42));
  assert.equal(countSolutions(complete.values, complete.regions), 1);
  const partial = [...complete.values]; partial[0] = 0;
  assert.equal(countSolutions(partial, complete.regions), 1);
  assert.equal(partial[0], 0);
});
test('digging produces unique, single-clue-minimal grids and preserves the input', () => {
  for (let seed = 1; seed <= 3; seed++) {
    const full = generate(random(seed)), original = structuredClone(full);
    let progress = 0;
    const dug = dig(full, random(seed + 100), (values, tested) => { assert.equal(tested, ++progress); assert.equal(values.length, 81); });
    assert.equal(progress, 81);
    assert.deepEqual(full, original);
    assert.deepEqual(dug.regions, full.regions);
    assert.ok(dug.values.includes(0));
    assert.equal(countSolutions(dug.values, dug.regions), 1);
    assert.deepEqual(solve(dug.values, dug.regions), full.values);
    for (let i = 0; i < 81; i++) if (dug.values[i]) {
      assert.equal(dug.values[i], full.values[i]);
      const less = [...dug.values]; less[i] = 0;
      assert.equal(countSolutions(less, dug.regions), 2, `seed ${seed}: clue ${i} must be essential`);
    }
  }
});
test('clipboard string matches the specified region format and row-major digit order', () => {
  const values = Array.from({ length: 81 }, (_, i) => i % 10);
  const text = serializeGrid({ regions: classicRegions(), values });
  assert.equal(text.length, 162);
  assert.equal(text.slice(0, 81), '111222333111222333111222333444555666444555666444555666777888999777888999777888999');
  assert.equal(text.slice(81), values.join(''));
});
