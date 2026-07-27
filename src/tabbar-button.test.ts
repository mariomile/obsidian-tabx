import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./tabbar-button.ts', import.meta.url), 'utf8');

test('the injected tab-grid control is keyboard operable', () => {
  assert.match(source, /role: 'button'/);
  assert.match(source, /tabindex: '0'/);
  assert.match(source, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(source, /button\.click\(\)/);
});
