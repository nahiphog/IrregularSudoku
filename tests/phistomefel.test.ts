import test from 'node:test';
import assert from 'node:assert/strict';
import { classicRegions, conflicts, validRegions } from '../src/sudoku.ts';
import { PHISTOMEFEL, PHISTOMEFEL_RING as R, PHISTOMEFEL_CORNERS as C, supportsPhistomefel, findPhistomefel } from '../src/phistomefel.ts';

const complete=[...'123456789456789123789123456234567891567891234891234567345678912678912345912345678'].map(Number);
const emptyNotes=()=>Array.from({length:81},()=>[] as number[]);

test('ring and corner sets match the requested 16-cell coordinates',()=>{
  assert.equal(new Set(R).size,16);assert.equal(new Set(C).size,16);
  assert.ok(R.every(i=>!C.includes(i)));
  assert.deepEqual(R,[20,21,22,23,24,29,33,38,42,47,51,56,57,58,59,60]);
  assert.deepEqual(C,[0,1,7,8,9,10,16,17,63,64,70,71,72,73,79,80]);
  for(let d=1;d<=9;d++) assert.equal(R.filter(i=>complete[i]===d).length,C.filter(i=>complete[i]===d).length);
});

test('proof accepts classic and compatible irregular layouts but rejects a concrete counterexample',()=>{
  const classic=classicRegions(), irregular=[...classic];
  [irregular[2],irregular[12]]=[irregular[12],irregular[2]];
  assert.ok(validRegions(irregular));assert.notDeepEqual(irregular,classic);
  assert.equal(supportsPhistomefel(classic),true);
  assert.equal(supportsPhistomefel(irregular),true);
  assert.equal(supportsPhistomefel(irregular.map(r=>8-r)),true);
  const rows=Array.from({length:81},(_,i)=>Math.floor(i/9));
  const latin=rows.map((r,i)=>(r+i%9)%9+1);
  assert.ok(validRegions(rows));assert.equal(conflicts(latin,rows).size,0);
  assert.equal(R.filter(i=>latin[i]===9).length,2);
  assert.equal(C.filter(i=>latin[i]===9).length,4);
  assert.equal(supportsPhistomefel(rows),false);
  assert.equal(findPhistomefel(rows,latin,emptyNotes()),null);
});

test('known counts eliminate extras and force remaining locations in both directions without mutation',()=>{
  for(const [target,other] of [[8,2],[24,2],[0,9],[33,9]]) {
    const values=[...complete],notes=emptyNotes(),actual=values[target];
    assert.notEqual(actual,other);
    values[target]=0;notes[target]=[actual,other];
    const original=structuredClone({values,notes});
    const step=findPhistomefel(classicRegions(),values,notes);
    assert.ok(step);assert.deepEqual(step.removed,[{cell:target,digit:other}]);
    assert.equal(step.pattern.length,32);
    assert.deepEqual({values,notes},original);
    assert.equal(PHISTOMEFEL.score,200);
  }
});

test('absence eliminates a digit, while overlapping uncertain counts cause no deduction',()=>{
  const values=Array(81).fill(0),notes=Array.from({length:81},()=>[1,2,9]);
  for(const cell of R) notes[cell]=[1,2];
  const absent=findPhistomefel(classicRegions(),values,notes);
  assert.ok(absent);
  // Digit 9 is absent from the ring, so it is removed from every corner cell.
  assert.equal(absent.digit,9);
  assert.deepEqual(absent.removed,C.map(cell=>({cell,digit:9})));
  const uncertain=Array.from({length:81},()=>[1,2,3,4,5,6,7,8,9]);
  assert.equal(findPhistomefel(classicRegions(),values,uncertain),null);
});
