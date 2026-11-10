import test from 'node:test';
import assert from 'node:assert/strict';
import { walkthrough } from '../src/walkthrough.ts';
import { candidates, classicRegions, dig, generate, units } from '../src/sudoku.ts';
function random(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

test('walkthroughs replay from original clues to the unique solution without invalid deductions', () => {
  const techniques = new Set<string>();
  for (let seed = 1; seed <= 5; seed++) {
    const full = generate(random(seed)), puzzle = dig(full, random(seed + 100));
    const original = structuredClone(puzzle), trace = walkthrough(puzzle);
    assert.deepEqual(puzzle, original);
    assert.deepEqual(trace.initial, puzzle.values);
    let values = [...trace.initial], notes = trace.initialCandidates.map(n => [...n]);
    for (const step of trace.steps) {
      techniques.add(step.technique);
      if (step.level === 'Search-assisted') { assert.equal(step.technique, 'Brute force'); assert.equal(step.score, 10000); }
      assert.ok(step.explanation.length > 20);
      if (step.placed) {
        const { cell, digit } = step.placed;
        assert.equal(values[cell], 0); assert.equal(digit, full.values[cell]);
        assert.ok(notes[cell].includes(digit)); values[cell] = digit;
        notes = notes.map((ns, i) => values[i] ? [] : ns.filter(d => candidates(values, puzzle.regions, i).includes(d)));
      } else {
        assert.ok(step.removed.length);
        for (const { cell, digit } of step.removed) {
          assert.notEqual(full.values[cell], digit); assert.ok(notes[cell].includes(digit));
          notes[cell] = notes[cell].filter(d => d !== digit);
        }
      }
      assert.deepEqual(step.values, values);
      assert.deepEqual(step.candidates, notes);
      notes.forEach((ns, i) => { if (!values[i]) assert.ok(ns.includes(full.values[i])); });
    }
    assert.deepEqual(values, full.values);
    for (const house of units(trace.regions)) assert.equal(new Set(house.map(i => values[i])).size, 9);
    assert.equal(trace.score, trace.steps.reduce((sum, s) => sum + s.score, 0));
    assert.equal(trace.searchSteps, trace.steps.filter(s => s.level === 'Search-assisted').length);
    assert.equal(trace.rating === 'Search-assisted', trace.searchSteps > 0);
  }
  assert.ok(techniques.has('Full House'));
  assert.ok(techniques.has('Hidden Single'));
  assert.ok(techniques.has('Brute force'));
});
test('a one-cell walkthrough has an easy Full House deduction; completed grid has zero steps', () => {
  const full = generate(random(42)), partial = structuredClone(full); partial.values[0] = 0;
  const trace = walkthrough(partial);
  assert.equal(trace.steps.length, 1); assert.equal(trace.steps[0].technique, 'Full House');
  assert.equal(trace.rating, 'Easy'); assert.equal(trace.score, 4);
  assert.equal(walkthrough(full).steps.length, 0);
});
test('walkthrough rejects ambiguous and conflicting puzzles instead of fabricating a rating', () => {
  const puzzle = { regions: classicRegions(), values: Array(81).fill(0) };
  assert.throws(() => walkthrough(puzzle), /exactly one solution/);
  puzzle.values[0] = puzzle.values[1] = 1;
  assert.throws(() => walkthrough(puzzle), /Correct the grid/);
});
