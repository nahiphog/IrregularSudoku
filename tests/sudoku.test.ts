import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, partition, validRegions, classicRegions, solve, units, conflicts, candidates, SearchLimitError } from '../src/sudoku.ts';
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
