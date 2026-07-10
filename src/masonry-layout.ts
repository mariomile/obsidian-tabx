/**
 * How many equal columns of at least `minCardWidth` fit in `availableWidth`,
 * given the gap between them. Always at least 1. The columns themselves are
 * laid out by flexbox (each `flex: 1`) so they stretch to fill the row flush to
 * both edges — this only decides the count.
 */
export function computeColumnCount(
  availableWidth: number,
  minCardWidth: number,
  gap: number,
): number {
  if (availableWidth <= 0 || minCardWidth <= 0) return 1;
  return Math.max(1, Math.floor((availableWidth + gap) / (minCardWidth + gap)));
}

/**
 * Round-robin: card `i` goes to column `i % columnCount`. This keeps the first
 * row filling left-to-right in tab order (col 0, 1, 2 …) and wrapping to the
 * next row — the reading order matches the tab order. Each column stacks its
 * cards vertically via flexbox, so there are no gaps.
 */
export function assignColumns(
  cardCount: number,
  columnCount: number,
): number[] {
  const cols = Math.max(1, columnCount);
  const assignment: number[] = [];
  for (let i = 0; i < cardCount; i++) assignment.push(i % cols);
  return assignment;
}
