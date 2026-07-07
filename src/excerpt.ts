/** Turn raw Markdown into a plain, single-line excerpt for a card. */
export function buildExcerpt(source: string, maxChars: number): string {
  let text = source.replace(/^\uFEFF/, ''); // strip byte-order mark
  text = text.replace(/^---\n[\s\S]*?\n---\n?/, ''); // YAML frontmatter
  text = text
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ') // code spans/fences
    .replace(/!?\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_m, target, alias) =>
      alias || target,
    ) // wikilinks → alias or target
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // md links/images → label
    .replace(/[#>*_~`-]+/g, ' ') // md punctuation
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}…`;
}
