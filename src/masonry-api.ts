// Superficie v2 dell'API cross-plugin di Masonry, e il predicato che dice se
// il Masonry installato la offre.
//
// Modulo SUO e non dentro preview.ts: quel file dichiara una classe con
// parameter properties, che lo strip-only di Node non sa compilare — importarlo
// da un test lo fa esplodere. Un predicato puro merita comunque un file puro.

/** Superficie v2 dell'API Masonry: la miniatura renderizzata. */
export interface MasonryRenderApi {
  version: number;
  isRichPreviewAvailable(): boolean;
  renderFilePreview(request: {
    filePath: string;
    hostEl: HTMLElement;
    token: string;
    scale?: number;
  }): Promise<{ rendered: boolean; clipped: boolean; height: number }>;
}

/**
 * Predicato PURO — è la riga più probabile da far esplodere a runtime, quindi
 * sta fuori dalla classe e ha i suoi test. Non basta che `masonry` esista: un
 * Masonry più vecchio non ha `version`, e uno con `version` potrebbe non avere
 * ancora il metodo.
 */
export function supportsRichPreview(api: unknown): api is MasonryRenderApi {
  if (!api || typeof api !== 'object') return false;
  const candidate = api as Partial<MasonryRenderApi>;
  return (
    typeof candidate.version === 'number' &&
    candidate.version >= 2 &&
    typeof candidate.renderFilePreview === 'function' &&
    typeof candidate.isRichPreviewAvailable === 'function'
  );
}
