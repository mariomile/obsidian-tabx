import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyTag, folderOf, formatRelativeDate } from './card-format.ts';

test('classifyTag maps marioverse namespaces', () => {
  assert.equal(classifyTag('status/active'), 'status');
  assert.equal(classifyTag('type/reference'), 'type');
  assert.equal(classifyTag('domain/career'), 'domain');
  assert.equal(classifyTag('random'), 'other');
});

test('formatRelativeDate buckets recent timestamps', () => {
  const now = 1_000_000_000_000;
  assert.equal(formatRelativeDate(now - 5_000, now), 'just now');
  assert.equal(formatRelativeDate(now - 5 * 60_000, now), '5 min ago');
  assert.equal(formatRelativeDate(now - 3 * 3_600_000, now), '3 hr ago');
  assert.equal(formatRelativeDate(now - 2 * 86_400_000, now), '2 days ago');
});

test('formatRelativeDate falls back to an absolute date past a week', () => {
  const now = 1_000_000_000_000;
  const out = formatRelativeDate(now - 30 * 86_400_000, now);
  assert.match(out, /\d{4}/); // contains a year
});

test('folderOf returns parent folder or empty for root', () => {
  assert.equal(folderOf('A/B/note.md'), 'A/B');
  assert.equal(folderOf('note.md'), '');
  assert.equal(folderOf(null), '');
});
