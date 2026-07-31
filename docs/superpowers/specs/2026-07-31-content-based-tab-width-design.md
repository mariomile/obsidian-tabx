# Content-based tab width — design

**Date:** 2026-07-31
**Repos touched:** `obsidian-cosmos-theme` (primary fix), `obsidian-tabx` (dedup cleanup)
**Status:** approved, ready for implementation plan

## Problem

The native horizontal tab bar in `.mod-root` forces every tab to at least
108px wide (`cosmos-layer.css:30-34`, `min-width: 108px !important`). Short
titles like "✦ Exo" waste space at that floor. The 184px cap + native
ellipsis truncation already works correctly for long titles — only the floor
is wrong.

TabX independently sets `--tabx-min-tab-width` (default 120px) on the same
selector inside its "scroll tab bar" feature (`styles.css:747-750`), but
Cosmos's `!important` always wins, so the TabX value is dead in practice
whenever Cosmos is the active theme.

## Goal

Tabs hug their content width, from a small floor (icon + a couple of
characters) up to the existing 184px cap, past which the native ellipsis
truncates. No behavior change to the cap or truncation — only the floor
drops.

```
TODAY:   [⊞ All Docs ][ ✦ Exo      ][ Native App — Design… ][ 25-07-2026 ]
                        └─ 108px floor, wasted space ─┘

AFTER:   [⊞ All Docs][✦ Exo][ Native App — Design… ][ 25-07-2026 ]
          └ each tab hugs its text, capped at 184px then "…" ┘
```

## Ownership split

- **Cosmos** owns tab width/appearance (floor, cap, hug behavior).
- **TabX** owns tab bar *behavior* only: horizontal scroll container and
  auto-hide. It stops setting a competing min-width.

## Changes

### `obsidian-cosmos-theme`

- Add two tokens to the token layer (name matches existing `--cosmos-*`
  convention): `--cosmos-tab-min: 52px`, `--cosmos-tab-max: 184px`.
- `cosmos-layer.css:30-34` becomes:
  ```css
  .workspace-split.mod-root .workspace-tab-header {
    min-width: var(--cosmos-tab-min, 52px) !important;   /* was 108px */
    flex: 0 0 auto !important;                            /* unchanged — hug content */
    max-width: var(--cosmos-tab-max, 184px);              /* unchanged — cap + ellipsis */
  }
  ```
- No new `!important` — same count the design-contract ratchet (`contract.sh`)
  already tracks for this file.
- Watch item during visual verification: the close (✕) button that appears
  on hover on a short tab must not cause a visible width jump when it
  overlaps text at the 52px floor.

### `obsidian-tabx`

- Remove the now-redundant `min-width: var(--tabx-min-tab-width, 120px)`
  from the scroll-tabs rule (`styles.css:747-750`); keep `flex: 0 0 auto` and
  the `overflow-x: auto` scroll container untouched.
- Remove the dead "min tab width" setting entirely: the field in
  `types.ts`, its default in `settings-data.ts`, the slider in
  `settings.ts`, and the `--tabx-min-tab-width` CSS var writes in
  `main.ts`. Keep `scrollTabBar` and `autoHide` as-is.
- A stale `minTabWidth` key left over in an existing `data.json` is inert
  (unread) — no migration needed.
- Bump plugin version + `versions.json` per the suite's release contract
  (`obsidian-suite-release-process`).

## Out of scope

- No change to the 184px cap or ellipsis truncation behavior.
- No change to TabX's rail/grid views.
- No new settings UI (this removes a setting, doesn't add one).
- Not portable to non-Cosmos themes — width policy stays theme-owned per the
  "Cosmos = appearance, TabX = behavior" split agreed with Mario. (A
  theme-independent version was considered and explicitly rejected as
  overkill for this fix.)

## Verification

- **Cosmos:** `verify.sh` / `contract.sh` stay green (no new `!important`
  count). Build → deploy to `test-vault` (never the live vault mid-dev).
  Visual check: short tab ("✦ Exo") hugs content; long tab title truncates
  at 184px with `…`; hover close button doesn't jump the tab width.
- **TabX:** `pnpm build` + typecheck clean, existing `masonry-layout.test.ts`
  still passes (untouched by this change). Deploy to the real vault plugin
  dir and confirm scroll-tab-bar behavior (many tabs still scroll, don't
  shrink) is unaffected.
