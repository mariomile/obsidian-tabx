import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PRESENTATIONS,
  PRESENTATION_ORDER,
  isPresentation,
  resolvePresentation,
} from './presentation.ts';

test('isPresentation validates the three modes', () => {
  assert.equal(isPresentation('compact'), true);
  assert.equal(isPresentation('editorial'), true);
  assert.equal(isPresentation('visual'), true);
  assert.equal(isPresentation('huge'), false);
  assert.equal(isPresentation(3), false);
});

test('resolvePresentation falls back for invalid input', () => {
  assert.equal(resolvePresentation('visual'), 'visual');
  assert.equal(resolvePresentation('nope'), 'editorial');
  assert.equal(resolvePresentation(undefined, 'compact'), 'compact');
});

test('every ordered presentation has a definition', () => {
  for (const mode of PRESENTATION_ORDER) {
    assert.ok(PRESENTATIONS[mode].cardWidth > 0);
    assert.ok(PRESENTATIONS[mode].excerptLines > 0);
  }
});
