import test from 'node:test';
import assert from 'node:assert/strict';
import { histogramBins, matchesSimulation } from '../src/simulation-stats.ts';

test('simulation filters include the threshold and optionally exclude brute force', () => {
  assert.equal(matchesSimulation(1000, 0, 1000, true), true);
  assert.equal(matchesSimulation(999, 0, 1000, true), false);
  assert.equal(matchesSimulation(11000, 1, 1000, true), false);
  assert.equal(matchesSimulation(11000, 1, 1000, false), true);
  assert.equal(matchesSimulation(999999, 0, 1000000, false), false);
  assert.equal(matchesSimulation(1000000, 1, 1000000, false), true);
});

test('histogram bins retain all trials and place boundary and large scores correctly', () => {
  const counts = new Map([[0, 2], [999, 3], [1000, 4], [1999, 1]]);
  assert.deepEqual(histogramBins(counts), [{low:0,high:999,count:5},{low:1000,high:1999,count:5}]);
  counts.set(1000000, 7);
  const bins=histogramBins(counts);
  assert.ok(bins.length<=20);
  assert.equal(bins.reduce((sum,b)=>sum+b.count,0),17);
  assert.equal(bins.find(b=>b.low<=1000000 && b.high>=1000000)?.count,7);
  assert.deepEqual(histogramBins(new Map()),[{low:0,high:999,count:0}]);
});
