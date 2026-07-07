import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExcerpt } from './excerpt.ts';

test('buildExcerpt strips frontmatter and markdown', () => {
  const src = '---\ntag: x\n---\n# Title\n\nHello **world** with [[a link]].';
  const out = buildExcerpt(src, 200);
  assert.ok(!out.includes('---'));
  assert.ok(!out.includes('#'));
  assert.ok(!out.includes('**'));
  assert.ok(out.includes('Hello world'));
  assert.ok(out.includes('a link'));
});

test('buildExcerpt renders wikilink aliases', () => {
  const out = buildExcerpt('See [[Real Note|the alias]] here.', 200);
  assert.ok(out.includes('the alias'));
  assert.ok(!out.includes('Real Note'));
});

test('buildExcerpt truncates to maxChars with ellipsis', () => {
  const out = buildExcerpt('word '.repeat(100), 40);
  assert.ok(out.length <= 41);
  assert.ok(out.endsWith('…'));
});

test('buildExcerpt returns empty string for whitespace-only body', () => {
  assert.equal(buildExcerpt('---\na: 1\n---\n\n   \n', 200), '');
});
