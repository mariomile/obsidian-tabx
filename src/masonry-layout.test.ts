import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignColumns, computeColumnCount } from './masonry-layout.ts';

test('computeColumnCount fits as many min-width columns as the row allows', () => {
  assert.equal(computeColumnCount(1093, 200, 12), 5);
  assert.equal(computeColumnCount(260, 260, 16), 1);
  assert.equal(computeColumnCount(0, 260, 16), 1);
  assert.equal(computeColumnCount(150, 200, 16), 1);
});

test('assignColumns fills the first row left-to-right, then wraps', () => {
  // 5 cards across 3 columns: row 1 = cols 0,1,2; row 2 = cols 0,1.
  assert.deepEqual(assignColumns(5, 3), [0, 1, 2, 0, 1]);
});

test('assignColumns keeps tab order readable left-to-right per row', () => {
  // Reading order across each row is the card order (no column-first shuffle).
  const cols = assignColumns(6, 3);
  assert.deepEqual(cols, [0, 1, 2, 0, 1, 2]);
});

test('assignColumns clamps to at least one column', () => {
  assert.deepEqual(assignColumns(3, 0), [0, 0, 0]);
});
