export type Presentation = 'compact' | 'editorial' | 'visual';

export interface PresentationDef {
  cardWidth: number;
  excerptLines: number;
}

export const PRESENTATIONS: Record<Presentation, PresentationDef> = {
  compact: { cardWidth: 200, excerptLines: 3 },
  editorial: { cardWidth: 260, excerptLines: 5 },
  visual: { cardWidth: 340, excerptLines: 9 },
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
