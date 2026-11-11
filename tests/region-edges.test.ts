import test from 'node:test';
import assert from 'node:assert/strict';
import { classicRegions } from '../src/sudoku.ts';
import { edgesFromRegions, regionsFromEdges, puzzleFromEdges, gridEdges, edgeKey } from '../src/region-edges.ts';

test('outlined regions round-trip and preserve independent given snapshots', () => {
  const regions = classicRegions(), edges = edgesFromRegions(regions), values = Array(81).fill(0);
  values[0] = 7;
  assert.equal(gridEdges.length, 144);
  assert.deepEqual(regionsFromEdges(edges), regions);
  const puzzle = puzzleFromEdges(edges, values);
  assert.deepEqual(puzzle.values, values);
  values[0] = 0;
  assert.equal(puzzle.values[0], 7);
  assert.equal(puzzle.givens![0], 7);
});

test('incomplete outlines, internal dangling edges and conflicting givens are rejected', () => {
  const empty = Array(81).fill(0);
  assert.throws(() => puzzleFromEdges(new Set(), empty), /nine closed regions/);
  const edges = edgesFromRegions(classicRegions());
  edges.delete(edgeKey(2, 3));
  assert.throws(() => puzzleFromEdges(edges, empty), /nine closed regions/);
  edges.add(edgeKey(2, 3));
  edges.add(edgeKey(0, 1));
  assert.throws(() => puzzleFromEdges(edges, empty), /unfinished edges/);
  edges.delete(edgeKey(0, 1));
  empty[0] = 1; empty[1] = 1;
  assert.throws(() => puzzleFromEdges(edges, empty), /conflict/);
});
