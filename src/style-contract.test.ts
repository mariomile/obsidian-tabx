import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * mv-kit style contract for styles.css, sibling to release-contract.test.ts.
 * Structurally ported from obsidian-masonry's contract, itself ported from
 * obsidian-sonar's contract (commit 3acb417) — the same enforcement pattern
 * now lands uniformly across sonar, masonry, portal, and tabx.
 *
 * tabx has since migrated to mv-kit's `var(--mv-token, fallback)` /
 * `var(--cosmos-token, fallback)` consumption idiom (wave 4,
 * docs/2026-07-mv-kit-audit.md) — it now consumes `--mv-wash`, `--mv-r-card`,
 * `--mv-r-chip`, `--cosmos-t-fast`, `--cosmos-t-base`, `--cosmos-touch-min`,
 * `--cosmos-press-scale`, and `--cosmos-native`, each with a literal fallback
 * equal to tabx's pre-migration value. It still ALSO keeps its own local
 * design tokens (`--tabx-ease`, `--tabx-radius`, `--tabx-autohide-delay`)
 * defined once at `:root` and referenced everywhere else via `var(--tabx-*)`
 * — `--tabx-ease`/`--tabx-radius` are now themselves consumers (their values
 * are `var(--mv-wash, …)`/`var(--mv-r-card, …)`), so the suite tokens flow
 * through tabx's own naming layer rather than replacing it. Assertion 1
 * below allows a raw literal in exactly three places: inside a
 * `var(--token, <fallback>)` fallback (mv-kit's own idiom, now the primary
 * path), inside a `:root { --tabx-*: ... }` token definition (tabx's
 * pre-existing local-token pattern, still used for tokens with no suite
 * equivalent, e.g. `--tabx-autohide-delay`), or as the standard
 * `0ms`/`0.01ms` reduced-motion/reset duration (an a11y escape hatch, not a
 * design value). Three assertions:
 *
 * 1. every raw ms/hex/cubic-bezier value appears only where tabx's own
 *    convention allows it (the three cases above). Everywhere else, only a
 *    `var(...)` reference may appear — a bare literal transition duration
 *    sitting next to `var(--tabx-ease)` in a shorthand would be a violation
 *    of tabx's own token discipline.
 * 2. !important declarations are capped at 6, the exact current count — the
 *    ceiling can only ratchet down, so any future edit that adds one without
 *    removing another fails the test. Every survivor carries an adjacent
 *    comment justifying the specificity battle it wins.
 * 3. the stylesheet never DEFINES a `--cosmos-*`/`--mv-*` property — the
 *    golden rule's MUST NOT. Matched at declaration boundaries (`{` or `;`),
 *    so the compact one-liner `:root { --mv-r-card: 11px; }` is caught as
 *    surely as the multi-line block form.
 */

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

/**
 * Blank out comments so prose like `/* 80ms *\/` doesn't trip the scans below,
 * while preserving every character position and newline — the scans report
 * line numbers and test containment by offset, both of which would drift if
 * comments were deleted outright.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
}

/**
 * Character ranges covering the *fallback* argument of every `var()` call,
 * i.e. everything after the top-level comma up to the matching `)`. Nested
 * calls (`var(--a, var(--b, 1px))`, `var(--mv-wash, cubic-bezier(…))`) are
 * handled by paren depth, so a nested fallback yields its own range too.
 */
function varFallbackRanges(code: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];

  for (let i = 0; i < code.length; i += 1) {
    if (!code.startsWith('var(', i)) continue;

    let depth = 1;
    let commaAt = -1;

    for (let j = i + 4; j < code.length; j += 1) {
      const ch = code[j];
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          if (commaAt !== -1) ranges.push([commaAt + 1, j]);
          break;
        }
      } else if (ch === ',' && depth === 1 && commaAt === -1) {
        commaAt = j;
      }
    }
  }

  return ranges;
}

test('raw ms/hex/cubic-bezier values appear only where the token convention allows', () => {
  const code = stripComments(css);
  const fallbacks = varFallbackRanges(code);

  // A raw ms/hex/cubic-bezier is allowed when it either:
  //   - sits inside a `var(--token, <fallback>)` fallback (mv-kit's golden
  //     rule: consume the token, keep the literal as the no-Cosmos
  //     fallback) — the primary path since the wave-4 mv-kit migration
  //     (--mv-wash, --mv-r-card, --mv-r-chip, --cosmos-t-fast,
  //     --cosmos-t-base, --cosmos-touch-min, --cosmos-press-scale,
  //     --cosmos-native all consumed this way), or
  //   - is a `--tabx-*` token DEFINITION inside `:root { ... }` — tabx's own
  //     local design-token pattern: define the literal once, reference it
  //     everywhere else via `var(--tabx-*)`, or
  //   - is a raw duration immediately followed by `var(--tabx-ease)` (or
  //     `var(--tabx-autohide-delay)`) in a `transition:` shorthand — the
  //     duration is a peer argument to the easing/delay token, not a
  //     fallback, but it is still tabx's own token-referencing convention
  //     rather than a hardcoded, untethered value, or
  //   - is a `0ms`/`0.01ms` reset/reduced-motion transition-duration or
  //     transition-delay (the universal "effectively instant" a11y/reset
  //     override, not a design value).
  const rawMsPattern = /\b\d+(?:\.\d+)?ms\b/g;
  const rawHexPattern = /#[0-9a-fA-F]{3,8}\b/g;
  const rawCubicBezierPattern = /cubic-bezier\([^)]*\)/g;

  const isInVarFallback = (index: number) =>
    fallbacks.some(([start, end]) => index >= start && index < end);
  const isTabxTokenDefinition = (line: string) => /^\s*--tabx-[\w-]+\s*:/.test(line);
  const isZeroOrReducedMotionDuration = (line: string) =>
    /^\s*transition-(?:duration|delay):\s*0(?:\.01)?ms;\s*$/.test(line);
  const isDurationPairedWithTabxToken = (match: string, line: string) =>
    new RegExp(`${match}\\s+var\\(--tabx-(?:ease|autohide-delay)\\)`).test(line);

  const violations: string[] = [];
  let offset = 0;

  code.split('\n').forEach((line, idx) => {
    if (!isTabxTokenDefinition(line) && !isZeroOrReducedMotionDuration(line)) {
      for (const pattern of [rawMsPattern, rawHexPattern, rawCubicBezierPattern]) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(line)) !== null) {
          if (isInVarFallback(offset + match.index)) continue;
          if (pattern === rawMsPattern && isDurationPairedWithTabxToken(match[0], line)) continue;
          violations.push(`line ${idx + 1}: "${match[0]}" in "${line.trim()}"`);
        }
      }
    }
    offset += line.length + 1;
  });

  assert.deepEqual(violations, []);
});

test('!important declarations are capped at the current count (ratchet down only)', () => {
  // Count declarations only: the justification comments next to each
  // survivor mention the word too.
  const importantCount = (stripComments(css).match(/!important/g) ?? []).length;
  // Ceiling frozen at 6 (unchanged by the wave-4 mv-kit fixes — no
  // !important was added or removed, only justification comments were added
  // next to each survivor): the .tabx-rail-content / .tabx-grid-content
  // `padding: 0` view-content overrides, and the .tabx-search-input
  // padding-inline/border-color/background/box-shadow overrides that flatten
  // native `input[type='search']` chrome. This ceiling may only be LOWERED,
  // never raised: if a future edit needs an !important, it must first
  // remove one elsewhere.
  assert.ok(
    importantCount <= 6,
    `!important count ${importantCount} exceeds the frozen ceiling of 6`,
  );
});

test('the plugin never defines --cosmos-* / --mv-* itself', () => {
  // mv-kit golden rule: plugins are theme-independent. They consume the suite
  // tokens with a literal fallback; they never redefine them (at :root, on
  // body, or anywhere else), which would make the theme the plugin's
  // dependent instead of the other way round.
  //
  // Anchored to a declaration boundary (`{` or `;`, or the start of the
  // file) rather than to the start of a LINE: `:root { --mv-r-card: 11px; }`
  // written on one line is the likeliest way this regression gets authored,
  // and a line anchor would wave it straight through. Consumption sites are
  // immune by construction — `var(--mv-wash, …)` puts a comma, never a
  // colon, after the token name.
  const definitions = stripComments(css).match(/(?:^|[{;])\s*--(?:cosmos|mv)-[\w-]+\s*:/g) ?? [];
  assert.deepEqual(definitions, []);
});
