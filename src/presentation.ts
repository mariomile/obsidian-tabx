export type Presentation = 'compact' | 'editorial' | 'visual';

export interface PresentationDef {
  /** Minimum column width — columns stretch beyond it to fill the row. */
  cardWidth: number;
  excerptLines: number;
  gridGap: number;
}

export const PRESENTATIONS: Record<Presentation, PresentationDef> = {
  compact: { cardWidth: 200, excerptLines: 3, gridGap: 12 },
  editorial: { cardWidth: 260, excerptLines: 5, gridGap: 16 },
  visual: { cardWidth: 340, excerptLines: 9, gridGap: 16 },
};

export const PRESENTATION_ORDER: Presentation[] = [
  'compact',
  'editorial',
  'visual',
];

export function isPresentation(value: unknown): value is Presentation {
  return value === 'compact' || value === 'editorial' || value === 'visual';
}

export function resolvePresentation(
  value: unknown,
  fallback: Presentation = 'editorial',
): Presentation {
  return isPresentation(value) ? value : fallback;
}
