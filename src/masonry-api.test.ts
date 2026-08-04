import assert from 'node:assert/strict';
import test from 'node:test';
import { supportsRichPreview } from './masonry-api.ts';

/*
 * supportsRichPreview è la riga più probabile da far esplodere a runtime: gira
 * contro un oggetto che arriva da un ALTRO plugin, di versione ignota, che può
 * mancare del tutto. Ogni forma qui sotto è una che si può davvero incontrare
 * in un vault reale.
 */

test('rifiuta ciò che non è un oggetto', () => {
  for (const value of [undefined, null, 0, 'api', true]) {
    assert.equal(supportsRichPreview(value), false, String(value));
  }
});

test('rifiuta un Masonry più vecchio, senza version', () => {
  assert.equal(
    supportsRichPreview({ getFilePreview: () => {}, invalidatePreview: () => {} }),
    false,
  );
});

test('rifiuta version 1 anche se i metodi ci fossero', () => {
  assert.equal(
    supportsRichPreview({
      version: 1,
      renderFilePreview: () => {},
      isRichPreviewAvailable: () => true,
    }),
    false,
  );
});

test('rifiuta version 2 a cui manca un metodo', () => {
  assert.equal(supportsRichPreview({ version: 2, isRichPreviewAvailable: () => true }), false);
  assert.equal(supportsRichPreview({ version: 2, renderFilePreview: () => {} }), false);
});

test('accetta una superficie v2 completa', () => {
  assert.equal(
    supportsRichPreview({
      version: 2,
      renderFilePreview: () => {},
      isRichPreviewAvailable: () => true,
    }),
    true,
  );
});

test('accetta una version futura, non solo esattamente 2', () => {
  assert.equal(
    supportsRichPreview({
      version: 7,
      renderFilePreview: () => {},
      isRichPreviewAvailable: () => true,
    }),
    true,
  );
});
