import test from 'node:test';
import assert from 'node:assert/strict';
import { classicRegions, findSolutions, conflicts } from '../src/sudoku.ts';
import { gridMarkup } from '../src/grid-view.ts';

test('import comparison returns two distinct valid solutions and circles exactly their differences', () => {
  const regions = classicRegions(), values = Array(81).fill(0); values[0] = 1;
  const original = [...values], solutions = findSolutions(values, regions);
  assert.equal(solutions.length, 2);
  assert.notDeepEqual(solutions[0], solutions[1]);
  assert.deepEqual(values, original);
  const differences = new Set(solutions[0].flatMap((v, i) => v !== solutions[1][i] ? [i] : []));
  assert.ok(differences.size > 0); assert.ok(!differences.has(0));
  for (const solution of solutions) {
    assert.equal(solution[0], 1);
    assert.ok(solution.every(v => v >= 1 && v <= 9));
    assert.equal(conflicts(solution, regions).size, 0);
    const html = gridMarkup({ regions, values: solution, givens: values }, false, differences);
    assert.equal((html.match(/different-value/g) ?? []).length, differences.size);
    assert.equal((html.match(/differs between solutions/g) ?? []).length, differences.size);
  }
});

test('import search distinguishes unique and impossible grids', () => {
  const regions = classicRegions();
  const full = findSolutions(Array(81).fill(0), regions)[0];
  const partial = [...full]; partial[0] = 0;
  assert.deepEqual(findSolutions(partial, regions), [full]);
  const impossible = Array(81).fill(0);
  for (let i = 0; i < 8; i++) impossible[i] = i + 1;
  impossible[17] = 9;
  assert.equal(conflicts(impossible, regions).size, 0);
  assert.deepEqual(findSolutions(impossible, regions), []);
});
