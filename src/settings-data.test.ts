import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, parseSettings } from './settings-data.ts';

test('parseSettings returns defaults for empty input', () => {
  assert.deepEqual(parseSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings({}), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
});

test('parseSettings keeps valid overrides', () => {
  const parsed = parseSettings({ autoHide: true, previewCharacters: 100 });
  assert.equal(parsed.autoHide, true);
  assert.equal(parsed.previewCharacters, 100);
});

test('parseSettings clamps out-of-range numbers', () => {
  assert.equal(parseSettings({ previewCharacters: 5 }).previewCharacters, 40);
  assert.equal(parseSettings({ previewCharacters: 9999 }).previewCharacters, 2000);
  assert.equal(parseSettings({ minTabWidth: 10 }).minTabWidth, 60);
  assert.equal(parseSettings({ autoHideDelay: -5 }).autoHideDelay, 0);
});

test('parseSettings ignores wrong types', () => {
  const parsed = parseSettings({ autoHide: 'yes', minTabWidth: 'wide' });
  assert.equal(parsed.autoHide, DEFAULT_SETTINGS.autoHide);
  assert.equal(parsed.minTabWidth, DEFAULT_SETTINGS.minTabWidth);
});
