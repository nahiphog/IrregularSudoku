import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGrid } from '../src/clipboard.ts';
import { findIrregularLockedCandidates, IRREGULAR_LOCKED } from '../src/irregular-techniques.ts';
import { walkthrough } from '../src/walkthrough.ts';
import { findSolutions } from '../src/sudoku.ts';

const grid = '112222333111112233116662223766566663755555553744445443788844499778899999777888899903006200608000000000000000000071040000702000020940000000000000000000902004200507';

test('mixed row/column visibility eliminates only candidates seen by every region location', () => {
  const { regions } = parseGrid(grid), notes: number[][] = Array.from({length:81},()=>[]);
  for (const cell of [20,21,28,19,37]) notes[cell]=[5];
  const original=structuredClone(notes);
  assert.deepEqual(findIrregularLockedCandidates(regions,notes), {
    region:5,digit:5,places:[20,21,28],removed:[{cell:19,digit:5}]
  });
  assert.deepEqual(notes,original);
  // An additional location not seen by r3c2 invalidates that elimination.
  notes[31]=[5];
  assert.equal(findIrregularLockedCandidates(regions,notes),null);
  assert.equal(findIrregularLockedCandidates(regions,Array.from({length:81},()=>[])),null);
});

test('one instance groups all common-peer eliminations and preserves the source candidates', () => {
  const { regions }=parseGrid(grid), notes:number[][]=Array.from({length:81},()=>[]);
  // r3c4 and r4c2 have two common peers: r3c2 and r4c4.
  for (const cell of [21,28,19,30]) notes[cell]=[5];
  assert.deepEqual(findIrregularLockedCandidates(regions,notes)?.removed,[{cell:19,digit:5},{cell:30,digit:5}]);
  notes[28]=[];
  assert.equal(findIrregularLockedCandidates(regions,notes),null);
});

test('supplied puzzle uses irregular locked candidates before search and charges 55 per instance', () => {
  const puzzle=parseGrid(grid), trace=walkthrough(puzzle), solution=findSolutions(puzzle.values,puzzle.regions)[0];
  const steps=trace.steps.filter(s=>s.technique===IRREGULAR_LOCKED.name);
  const example=trace.steps.findIndex(s=>s.technique===IRREGULAR_LOCKED.name && s.removed.some(r=>r.cell===19 && r.digit===5));
  assert.ok(example>=0);
  assert.deepEqual(trace.steps[example].pattern,[20,21,28]);
  assert.ok(trace.steps.slice(0,example+1).every(s=>s.technique!=='Brute force'));
  assert.equal(trace.steps[20].technique,IRREGULAR_LOCKED.name);
  assert.ok(steps.length>0);
  for (const step of steps) {
    assert.equal(step.score,55);
    for (const {cell,digit} of step.removed) assert.notEqual(solution[cell],digit);
  }
  assert.equal(trace.score,trace.steps.reduce((sum,s)=>sum+s.score,0));
  assert.deepEqual(trace.steps.at(-1)!.values,solution);
});
