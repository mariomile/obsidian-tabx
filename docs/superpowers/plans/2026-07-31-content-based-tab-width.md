# Content-based Tab Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Native editor tabs hug their content width (short titles get a short tab) instead of being forced to a flat 108px floor, while keeping the existing 184px cap + ellipsis truncation for long titles.

**Architecture:** Two independent, sequential tasks across two repos. Task 1 (`obsidian-cosmos-theme`) lowers and tokenizes the tab-width floor that Cosmos's `!important` currently enforces — this is the actual visible fix. Task 2 (`obsidian-tabx`) removes TabX's own `--tabx-min-tab-width` setting, which is dead code today (Cosmos's `!important` already always wins) and would otherwise keep fighting the Task 1 fix. Task 2 does not depend on Task 1's output; either can ship alone.

**Tech Stack:** Plain CSS (Cosmos theme, custom properties, no build framework beyond string-concat `build.sh`), TypeScript + esbuild + Obsidian Plugin API (TabX), Node's built-in `node:test` runner.

## Global Constraints

- Cosmos: the 184px cap and native ellipsis truncation behavior must not change (spec: "Out of scope").
- Cosmos: no new `!important` may be added — `cosmos-layer.css` is already at a tracked ceiling of 10 in `design-contract.json`; this change edits two existing `!important` lines, it does not add one.
- Cosmos: raw px is not restricted outside `cosmos-tokens.css` by `contract.sh`, but the new floor/cap values must still live in `cosmos-tokens.css` as tokens, per the file's own header rule ("Unica casa dei design token di Cosmos") and to match the existing `--cosmos-tab-*` naming family.
- TabX: this removes a setting; it does not add one. No new UI.
- TabX: theme-independence is not a goal here — width policy is explicitly Cosmos-owned per the approved design (spec: "Out of scope").
- Never deploy Cosmos to the live vault mid-development — `test-vault` (inside the Cosmos repo) is the dev target; the live vault deploy is a separate, explicit action outside this plan.
- Never push a git tag / cut a release as part of this plan. Both repos land directly on `main` (no-PR convention), but publishing a plugin/theme release is a separate, explicit action Mario triggers himself.

---

### Task 1: Cosmos — tokenize and lower the tab-width floor

**Files:**
- Modify: `/Users/mariomiletta/Dev Projects/obsidian-cosmos-theme/cosmos-tokens.css:52` (insert two new tokens after `--cosmos-tab-inset: 2px;`)
- Modify: `/Users/mariomiletta/Dev Projects/obsidian-cosmos-theme/cosmos-layer.css:30-34` (consume the new tokens instead of raw `108px`/`184px`)
- Generated (by `build.sh`, do not hand-edit): `/Users/mariomiletta/Dev Projects/obsidian-cosmos-theme/theme.css`

**Interfaces:**
- Produces: two new custom properties, `--cosmos-tab-min` (default `52px`) and `--cosmos-tab-max` (default `184px`), available anywhere `theme.css` is loaded. No other task consumes these directly — they're a leaf change.

- [ ] **Step 1: Add the two new tokens to `cosmos-tokens.css`**

Open `cosmos-tokens.css` and find this exact block (lines 51-53):

```css
  --cosmos-r-pill: var(--cosmos-tab-radius, var(--tab-radius, 8px));
  --cosmos-tab-inset: 2px;
  --cosmos-r-tabbar: calc(var(--cosmos-r-pill) + var(--cosmos-tab-inset));
```

Replace it with:

```css
  --cosmos-r-pill: var(--cosmos-tab-radius, var(--tab-radius, 8px));
  --cosmos-tab-inset: 2px;
  --cosmos-r-tabbar: calc(var(--cosmos-r-pill) + var(--cosmos-tab-inset));
  /* Ampiezza tab in .mod-root: hug del contenuto tra floor e cap — icona +
     titolo breve resta vicino al floor, titoli lunghi crescono fino al cap
     poi troncano con ellissi nativa (vedi cosmos-layer.css). */
  --cosmos-tab-min: 52px;
  --cosmos-tab-max: 184px;
```

- [ ] **Step 2: Point `cosmos-layer.css` at the new tokens**

Open `cosmos-layer.css` and find this exact block (lines 30-34):

```css
.workspace-split.mod-root .workspace-tab-header {
  min-width: 108px !important;   /* floor leggibile (era 130) */
  flex: 0 0 auto !important;     /* rimpiazza flex-shrink:0 E uccide flex-grow:1 → niente stretch, i tab abbracciano il contenuto (look Craft) */
  max-width: 184px;             /* soffitto: titoli lunghi troncano (…). NO !important: la base non setta max-width */
}
```

Replace it with:

```css
.workspace-split.mod-root .workspace-tab-header {
  min-width: var(--cosmos-tab-min, 52px) !important;   /* floor content-hug (era 108px) */
  flex: 0 0 auto !important;     /* rimpiazza flex-shrink:0 E uccide flex-grow:1 → niente stretch, i tab abbracciano il contenuto (look Craft) */
  max-width: var(--cosmos-tab-max, 184px);             /* soffitto: titoli lunghi troncano (…). NO !important: la base non setta max-width */
}
```

- [ ] **Step 3: Rebuild `theme.css` and run the design-contract check**

Run:
```bash
cd "/Users/mariomiletta/Dev Projects/obsidian-cosmos-theme" && ./build.sh
```

Expected: prints `theme.css rebuilt — base ... lines + 5 layers = ... lines, braces balanced`, then `contract.sh` runs automatically and exits 0 (no `!important` ceiling violation — `cosmos-layer.css` still has the same two `!important` lines, just different right-hand sides, so the count is unchanged; no raw hex/ms was touched).

If `contract.sh` fails, read the printed failure line before changing anything — it will name the exact ceiling that was exceeded.

- [ ] **Step 4: Deploy to `test-vault` and verify visually**

Run:
```bash
cd "/Users/mariomiletta/Dev Projects/obsidian-cosmos-theme" && ./deploy.sh test-vault
```

Expected: `Cosmos deployed → .../test-vault/.obsidian/themes/Cosmos`.

Then, in Obsidian with `test-vault` open (Settings → Appearance → Themes → reload Cosmos, or close/reopen the vault so the new `theme.css` loads):
- Open several tabs with short titles (e.g. rename/create notes titled "A", "Exo") and confirm each tab is now visibly narrower than before, hugging the title instead of sitting at a fixed wide floor.
- Open a tab with a long title (25+ characters) and confirm it still grows only up to the cap and then truncates with `…` — this must look unchanged from before the fix.
- Hover a short tab (the close `✕` button appears) and confirm the tab does not visibly jump width when the button appears.

This is a manual visual check — there is no scripted assertion for it (`verify.sh`/`verify-spec.json` cover other pixel contracts and are out of scope for this fix per the design doc).

- [ ] **Step 5: Commit**

```bash
cd "/Users/mariomiletta/Dev Projects/obsidian-cosmos-theme" && git add cosmos-tokens.css cosmos-layer.css theme.css && git commit -m "fix: lower tab-width floor from 108px to content-hug 52px

Tokenizes the min/max tab width (--cosmos-tab-min/-max) instead of the
prior raw 108px/184px pair. Short-titled tabs (e.g. 'Exo') no longer
sit at a wasteful fixed floor; the 184px cap + ellipsis truncation for
long titles is unchanged."
```

---

### Task 2: TabX — remove the dead `minTabWidth` setting

**Files:**
- Modify: `/Users/mariomiletta/Dev Projects/obsidian-tabx/src/types.ts:8` (remove field)
- Modify: `/Users/mariomiletta/Dev Projects/obsidian-tabx/src/settings-data.ts:8,38` (remove default + parse)
- Modify: `/Users/mariomiletta/Dev Projects/obsidian-tabx/src/settings-data.test.ts:20-21,25,27` (drop stale assertions)
- Modify: `/Users/mariomiletta/Dev Projects/obsidian-tabx/src/settings.ts:51-64` (remove slider UI)
- Modify: `/Users/mariomiletta/Dev Projects/obsidian-tabx/src/main.ts:95,104-109` (remove CSS var wiring)
- Modify: `/Users/mariomiletta/Dev Projects/obsidian-tabx/styles.css:747-750` (remove `min-width` line)
- Modify: `/Users/mariomiletta/Dev Projects/obsidian-tabx/manifest.json`, `package.json`, `versions.json` (version bump)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `TabxSettings` no longer has a `minTabWidth` field. `TabxPlugin.applyTabBarStyle()` keeps its existing signature (`(): void`) but only toggles the `tabx-scroll-tabs` body class now — no other task/file outside this list references `minTabWidth` (confirmed by repo-wide grep during design).

- [ ] **Step 1: Remove the field from the settings type**

In `src/types.ts`, remove this line from `TabxSettings` (currently line 8):

```ts
  minTabWidth: number;
```

- [ ] **Step 2: Remove the default and the parse/clamp logic**

In `src/settings-data.ts`, remove this line from `DEFAULT_SETTINGS` (currently line 8):

```ts
  minTabWidth: 120,
```

And remove this line from `parseSettings` (currently line 38):

```ts
    minTabWidth: clampInt(data.minTabWidth, DEFAULT_SETTINGS.minTabWidth, 60, 400),
```

`clampInt` itself stays — `previewCharacters` still uses it.

- [ ] **Step 3: Update the settings test to drop stale assertions**

Replace the full contents of `src/settings-data.test.ts` with:

```ts
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
});

test('parseSettings ignores wrong types', () => {
  const parsed = parseSettings({ autoHide: 'yes', previewCharacters: 'wide' });
  assert.equal(parsed.autoHide, DEFAULT_SETTINGS.autoHide);
  assert.equal(parsed.previewCharacters, DEFAULT_SETTINGS.previewCharacters);
});
```

- [ ] **Step 4: Run the test suite to confirm the settings layer is clean**

Run:
```bash
cd "/Users/mariomiletta/Dev Projects/obsidian-tabx" && pnpm test
```

Expected: all tests pass, including the four in `settings-data.test.ts`. If TypeScript complains about `minTabWidth` anywhere else, that surfaces here or in Step 7 — do not proceed past a red run.

- [ ] **Step 5: Remove the settings UI slider**

In `src/settings.ts`, remove this entire block (currently lines 51-64):

```ts
    new Setting(containerEl)
      .setName('Minimum tab width')
      .setDesc('Pixels each tab keeps before the bar scrolls.')
      .addSlider((slider) =>
        slider
          .setLimits(60, 400, 10)
          .setValue(this.plugin.settings.minTabWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.minTabWidth = value;
            await this.plugin.saveSettings();
            this.plugin.applyTabBarStyle();
          }),
      );

```

(Leave the "Scrolling horizontal tab bar" toggle above it and the "Tab grid button in tab bar" toggle below it untouched — only this slider block goes.)

- [ ] **Step 6: Remove the CSS variable wiring in `main.ts`**

In `src/main.ts`, in `onunload()`, remove this line (currently line 95):

```ts
    document.body.style.removeProperty('--tabx-min-tab-width');
```

Then change `applyTabBarStyle()` from:

```ts
  applyTabBarStyle(): void {
    document.body.toggleClass('tabx-scroll-tabs', this.settings.scrollTabBar);
    document.body.style.setProperty(
      '--tabx-min-tab-width',
      `${this.settings.minTabWidth}px`,
    );
  }
```

to:

```ts
  applyTabBarStyle(): void {
    document.body.toggleClass('tabx-scroll-tabs', this.settings.scrollTabBar);
  }
```

- [ ] **Step 7: Typecheck**

Run:
```bash
cd "/Users/mariomiletta/Dev Projects/obsidian-tabx" && pnpm typecheck
```

Expected: exits 0, no errors. This is the step that would catch any remaining `minTabWidth` reference left in `src/`.

- [ ] **Step 8: Remove the redundant CSS min-width**

In `styles.css`, find this exact block (currently lines 747-750):

```css
body.tabx-scroll-tabs .mod-root .workspace-tab-header {
  flex: 0 0 auto;
  min-width: var(--tabx-min-tab-width, 120px);
}
```

Replace it with:

```css
body.tabx-scroll-tabs .mod-root .workspace-tab-header {
  flex: 0 0 auto;
}
```

- [ ] **Step 9: Run the full test suite and lint again**

Run:
```bash
cd "/Users/mariomiletta/Dev Projects/obsidian-tabx" && pnpm test && pnpm lint
```

Expected: all tests pass (including `style-contract.test.ts` — the removed line contained no ms/hex/cubic-bezier/`!important`/`--cosmos-*`/`--mv-*` token, so none of its five assertions are affected), lint clean.

- [ ] **Step 10: Build**

Run:
```bash
cd "/Users/mariomiletta/Dev Projects/obsidian-tabx" && pnpm build
```

Expected: `pnpm typecheck` runs clean, then esbuild produces `main.js` with no errors.

- [ ] **Step 11: Bump the plugin version**

In `manifest.json`, change:
```json
  "version": "0.1.1",
```
to:
```json
  "version": "0.1.2",
```

In `package.json`, change:
```json
  "version": "0.1.1",
```
to:
```json
  "version": "0.1.2",
```

In `versions.json`, change:
```json
{
  "0.1.0": "1.12.7",
  "0.1.1": "1.12.7"
}
```
to:
```json
{
  "0.1.0": "1.12.7",
  "0.1.1": "1.12.7",
  "0.1.2": "1.12.7"
}
```

- [ ] **Step 12: Commit**

```bash
cd "/Users/mariomiletta/Dev Projects/obsidian-tabx" && git add src/types.ts src/settings-data.ts src/settings-data.test.ts src/settings.ts src/main.ts styles.css manifest.json package.json versions.json && git commit -m "fix: remove dead minTabWidth setting

Cosmos's !important tab min-width always won over this setting, so it
had no real effect under the active theme. Tab width floor/cap now
lives entirely in Cosmos (see obsidian-cosmos-theme commit lowering
the floor to content-hug 52px); TabX keeps owning scroll + auto-hide
behavior only."
```

Note: this bump does not push a tag or trigger a release — that remains a separate step for Mario to trigger explicitly.

---

## Self-Review Notes

- **Spec coverage:** every spec section maps to a step above — token addition (Task 1 Step 1), floor/cap consumption (Task 1 Step 2), TabX CSS dedup (Task 2 Step 8), dead setting removal (Task 2 Steps 1-2, 5-6), version bump (Task 2 Step 11), verification (Task 1 Steps 3-4, Task 2 Steps 4/7/9/10).
- **No placeholders:** every step shows exact before/after code or an exact command with expected output.
- **Type consistency:** `TabxSettings` (Task 2 Step 1) drops `minTabWidth`; every other reference to it in the repo (`settings-data.ts`, `settings-data.test.ts`, `settings.ts`, `main.ts`, `styles.css`) is removed in the same task, confirmed by a repo-wide grep during design (no other file referenced it).
