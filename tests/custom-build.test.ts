import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGrid, serializeGrid } from '../src/clipboard.ts';
import { classicRegions, countSolutions, dig, generate } from '../src/sudoku.ts';
import { gridMarkup } from '../src/grid-view.ts';
function random(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
test('clipboard format round-trips regions, blanks and givens without JSON', () => {
  const p = generate(random(42)); p.values = p.values.map((v, i) => i % 3 ? 0 : v);
  const text = serializeGrid(p), imported = parseGrid(`\n${text.slice(0,81)}\n${text.slice(81)}\n`);
  assert.deepEqual(imported.regions, p.regions); assert.deepEqual(imported.values, p.values); assert.deepEqual(imported.givens, p.values);
  assert.throws(() => parseGrid(JSON.stringify(p)), /162 digits/);
  assert.throws(() => parseGrid('1'.repeat(81) + '0'.repeat(81)), /nine regions/);
  const bad = { regions:classicRegions(), values:Array(81).fill(0) }; bad.values[0] = bad.values[1] = 1;
  assert.throws(() => parseGrid(serializeGrid(bad)), /conflict/);
});
test('custom required positions survive both individual and paired digging', () => {
  const full = generate(random(3)), required = Array(81).fill(false); required[0] = required[40] = required[15] = true;
  for (const paired of [false,true]) {
    const p = dig(full,random(17),undefined,paired,required);
    assert.equal(countSolutions(p.values,p.regions),1);
    for (const i of [0,40,15]) { assert.equal(p.values[i],full.values[i]); if (paired) assert.equal(p.values[80-i],full.values[80-i]); }
    for (let i = 0; i < (paired ? 41 : 81); i++) if (p.values[i] && !required[i] && !(paired && required[80-i])) {
      const fewer = [...p.values]; fewer[i] = 0; if (paired) fewer[80-i] = 0;
      assert.equal(countSolutions(fewer,p.regions),2);
    }
  }
  assert.throws(() => dig(full,Math.random,undefined,false,[true]), /81 required/);
});
test('studio grid is read-only and renders exactly 81 cells with or without candidates', () => {
  const p = { regions:classicRegions(),values:Array(81).fill(0) }; p.values[0] = 3;
  for (const showCandidates of [false,true]) {
    const html = gridMarkup(p,showCandidates);
    assert.equal((html.match(/class="cell /g) ?? []).length,81);
    assert.doesNotMatch(html, /<(button|input|textarea)|contenteditable|tabindex/);
    if (showCandidates) assert.match(html,/class="notes"/);
  }
});
