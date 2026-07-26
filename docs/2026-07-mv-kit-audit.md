# mv-kit audit — TabX (wave 4)

Audit of `styles.css` (722 lines pre-fix, 794 post-fix) + the UI code
(`src/grid-view.ts`, `src/rail-view.ts`, `src/tabbar-button.ts`,
`src/preview.ts`, `src/card-format.ts`, `src/settings.ts`,
`src/presentation.ts`) against `obsidian-cosmos-theme/docs/mv-kit.md`, both
desktop and phone columns. Scope: coherence-only fixes (radius / motion
tokens / touch targets / empty states / microcopy). No layout redesign, no
DOM restructure — per `docs/2026-07-24-suite-coherence-design.md` §C/D
non-goals. TabX's grid uses keyed reconciliation per `leafId`
(`planReconcile` + `cardSignature` in `src/reconcile.ts`) and a flex-column
masonry layout with a `setInterval` polling backstop — both explicitly
out of scope and untouched by this wave; the reconcile/masonry-layout test
files are the mechanical proof.

Per-rule verdict: **pass** (already compliant) / **fixed** (this wave) /
**waived** (kit rule doesn't apply here, with reason).

An earlier commit on this branch (`3461483`) had already added
`src/style-contract.test.ts`, at a time when `styles.css` consumed zero
suite tokens — its docstring explicitly flagged that gap ("tabx has not
(yet) migrated to mv-kit's `var(--mv-token, fallback)` consumption idiom").
This wave closes that gap: the contract's assertions needed no logic
changes (its `var()`-fallback-range machinery was already
forward-compatible), only its documentation, which is corrected in the same
commit as the CSS fixes below.

## Golden rule — theme-independent consumption

| Check | Verdict |
|---|---|
| Every `var(--cosmos-*)`/`var(--mv-*)` has a literal fallback | **fixed** — before this wave, zero suite-token consumption (`grep -oE "var\(--(mv|cosmos)-"`: 0 hits). Now 20 consumption sites across 8 distinct tokens (`--mv-wash`, `--mv-r-card`, `--mv-r-chip`, `--cosmos-t-fast` ×8, `--cosmos-t-base` ×2, `--cosmos-touch-min` ×6, `--cosmos-press-scale`, `--cosmos-native`), every one with a literal fallback equal to TabX's pre-fix value — a Cosmos-less vault renders identically. |
| No plugin stylesheet redefines `--mv-*`/`--cosmos-*` at `:root`/`body` | **pass**, mechanically enforced — TabX only ever defines its own `--tabx-*` namespace at `:root`. `src/style-contract.test.ts` assertion 3 fails on any `--cosmos-*`/`--mv-*` definition anywhere, matched at a declaration boundary (`{` or `;`), inherited unmodified from the masonry/sonar contract lineage. |

The rewiring, mirroring Masonry's wave-3 pattern exactly:

```css
/* before */                        /* after */
--tabx-ease: cubic-bezier(          --tabx-ease: var(--mv-wash,
  0.25, 1, 0.5, 1);                   cubic-bezier(0.25, 1, 0.5, 1));
--tabx-radius: 9px;                 --tabx-radius: var(--mv-r-card, 9px);
```

Every downstream `var(--tabx-ease)` / `var(--tabx-radius)` reference is
unchanged, so a two-line rewire moved the whole stylesheet's easing and
card-radius onto the suite scale. Note: TabX's own card radius (`9px`)
differs from `--mv-r-card`'s canonical value (`11px`, Masonry's own card) —
the fallback stays `9px`, TabX's own literal, not the canonical number. The
kit names a *token slot*, not a mandate to visually match every other
plugin's card.

## §1 Radius + surfaces

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| `.tabx-card` radius (`--tabx-radius`) | was literal `9px` | same, no phone variant | **fixed** — now `var(--mv-r-card, 9px)`. Same token slot Masonry's `--masonry-radius` consumes; TabX's own historical value kept as the fallback since it doesn't match the canonical `11px` (see above). |
| `.tabx-tag-chip` radius | was literal `5px` | same | **fixed** — now `var(--mv-r-chip, 5px)`. The kit's `--mv-r-chip` row reads "(= `.masonry-tag-chip`)"; TabX's own value already matched the canonical `5px` exactly, so this is a clean token substitution with zero fallback drift. |
| `.tabx-tab` (rail row, `--radius-s`), `.tabx-density`/`.tabx-preview-skeleton` (`--radius-m`/`--radius-s`) | native Obsidian tokens | same | **pass** — native tokens, not hand-picked pixels. Same verdict class as Sonar wave 1 and Masonry wave 3's native-token uses. |
| `.tabx-tag-chip[data-tag-kind='status']::before` — `border-radius: 50%` on a 5×5 dot | n/a | n/a | **waived** — the round-cap idiom on a fixed tiny shape, not a "pill/card/chip" *surface* in the kit's §1 sense. Same waiver Sonar's badge-dot and Masonry's status-dot got in their waves; the kit's radius table has no entry for status dots. |
| Elevation shadow on `.tabx-card:hover` (`box-shadow: 0 5px 16px color-mix(…)`) | desktop-only, inside `@media (hover: hover)` | not reachable on touch | **waived** — the kit's shadow MUST covers *floating surfaces* (`--cosmos-pop-shadow`: menu/tooltip/popover/prompt) and sidebar islands (`--cosmos-island-shadow`). A card hover-lift inside a scrolling grid is neither, and the value is already theme-derived (`color-mix` over `--background-modifier-box-shadow`), not a hardcoded rgba. Identical verdict to Masonry's own card-hover shadow. |
| Floating surfaces of TabX's own | none — TabX renders no popovers/menus/modals of its own | n/a | **waived, nothing to tokenize** — no plugin-owned floating chrome exists to consume `--cosmos-pop-shadow` for. |

## §2 Type sizes, icon sizes, touch targets

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| `.tabx-tab` (rail row) | `min-height: 30px` (no desktop minimum in the kit) | was raw `min-height: 44px` inside the coarse-pointer block | **fixed** — now `var(--cosmos-touch-min, 44px)`. Same computed value, now token-sourced. |
| Pseudo-element hit-area extension on `.tabx-tab-close` / `.tabx-card-close` / `.tabx-rail-action` (`inset: calc((100% - 44px) / 2)`) | n/a, desktop sizes (22px/24px/26px) unchanged, no touch-min requirement | was a raw `44px` inside the `calc()` | **fixed** — now `calc((100% - var(--cosmos-touch-min, 44px)) / 2)`. The transparent pseudo-element hit-area-extension pattern itself (documented in the file as "MOBILE KIT, nato in masonry 2026-07-10") is kept verbatim; only the literal inside the calc is tokenized. |
| `.tabx-search-input` (grid toolbar search field) | `min-height: 34px`, no minimum enforced | **was missing from the coarse-pointer block entirely** — stayed 34px, 10px under the floor | **fixed** — added `min-height: var(--cosmos-touch-min, 44px)` inside `@media (pointer: coarse)`. A genuine, previously-unnoticed §2 violation: the primary text-entry control in the grid header sat under the floor on phone. |
| `.tabx-sort-button` (grid toolbar sort toggle) | `34×34px`, no minimum enforced | **was missing from the coarse-pointer block entirely** — stayed 34px square, 10px under the floor on both axes | **fixed** — added `width`/`height: var(--cosmos-touch-min, 44px)` inside the coarse block. Same class of miss as Masonry's `.masonry-load-more`/`.masonry-retry-button` in wave 3: a real, frequently-tapped control simply never got added to the MOBILE KIT block. |
| `.tabx-density-button` (compact/editorial/visual toggle, 28px) | `28×28px`, mouse-only, no minimum enforced | was **not in the pseudo-element hit-area group at all** — the block only listed `.tabx-tab-close`/`.tabx-card-close`/`.tabx-rail-action` | **fixed (tokenized, and added to the group)** — now gets the same transparent-pseudo-element hit-area extension as the other small icon buttons: `inset: calc((100% - var(--cosmos-touch-min, 44px)) / 2)`. It sits in the same grid toolbar as `.tabx-sort-button` and is exactly as frequently tapped; leaving it out was a gap, not a judgement call. |
| `.tabx-rail-action` (rail header "+"-style action, 26px) | `26×26px` | already in the pseudo-element hit-area group pre-fix | **pass (now tokenized)** — behavior unchanged, only the `44px` literal inside its shared `calc()` is now the token (see the shared block fix above). |
| `.tabx-card` itself (the primary tap target) | n/a | whole card is clickable, well above 44px in practice (image + body + padding) | **pass** |
| Micro-label font size (`.tabx-rail-count`, `.tabx-card-meta`) | `var(--font-ui-smaller)` | same | **pass** |
| Card-content type scale (`.tabx-card-title` `1.02rem`, `.tabx-tag-chip` `0.68rem`, `.tabx-card-preview` `0.76rem`, compact/visual variant overrides) | bespoke rem values | same | **waived** — content typography, explicitly out of scope by the programme doc ("Niente tipografia di contenuto (NC-Tight = cantiere 3, decisione di Mario)"). §2's MUST NOT is scoped to *micro-labels*, and TabX's micro-labels already use the token. Same reasoning as Masonry's identical waiver. |
| Icon sizing (16px search/tab/card icons, 26px empty-state icon, 34/44px poster glyphs) | raw px on SVG wrapper spans | same | **pass** — matches the kit's own §2 row ("Cosmos defines no separate icon-size scale") and the wave-1/wave-3 precedent on the identical pattern. |

## §3 Motion

| Token / animation | Before | After | Verdict |
|---|---|---|---|
| `--tabx-ease` (the file's only wash easing, used by every hover/press transition) | raw `cubic-bezier(0.25, 1, 0.5, 1)` | `var(--mv-wash, cubic-bezier(0.25, 1, 0.5, 1))` | **fixed** — the kit names this exact curve `--mv-wash` (its canonical value is byte-identical to TabX's pre-fix literal); it drives colour/background washes across the rail and grid, precisely what `--mv-wash` is for. |
| `.tabx-tab` background/shadow/color hover wash | raw `120ms` ×3 | `var(--cosmos-t-fast, 120ms)` ×3 | **fixed** — micro-feedback tier, exact token match. |
| `.tabx-tab-close` opacity reveal | raw `120ms` | `var(--cosmos-t-fast, 120ms)` | **fixed** |
| `.tabx-card` border/shadow hover | raw `140ms` / `180ms` | `var(--cosmos-t-fast, 140ms)` / `var(--cosmos-t-base, 180ms)` | **fixed** — micro-feedback tier for the border wash, physical-lift tier for the shadow, matching the kit's own tier split (Masonry's identical card-hover pair got the same treatment in wave 3). |
| `.tabx-card-close` opacity reveal | raw `120ms` | `var(--cosmos-t-fast, 120ms)` | **fixed** |
| Auto-hide tab bar collapse (`max-height` transition) | raw `180ms` | `var(--cosmos-t-base, 180ms)` | **fixed (duration only)** — see the note below; the property itself (`max-height`) is a documented, accepted exception to "transform/opacity only". |
| Auto-hide tab bar content fade (`opacity`) | raw `120ms` | `var(--cosmos-t-fast, 120ms)` | **fixed** |
| **Press-scale on phone** (`--cosmos-press-scale`) | **absent** — no tap-confirmation anywhere on the rail or grid | `transform: scale(var(--cosmos-press-scale, 0.98))` on `:active` for `.tabx-tab`, `.tabx-card`, `.tabx-tab-close`, `.tabx-card-close`, `.tabx-rail-action`, `.tabx-sort-button`, `.tabx-density-button`, inside `@media (pointer: coarse)`, transitioned on `var(--cosmos-t-fast, 140ms) var(--cosmos-native, cubic-bezier(0.32, 0.72, 0, 1))` | **fixed** — kit §3 MUST: "tap targets apply `transform: scale(var(--cosmos-press-scale, 0.98))` on active/press." TabX had nothing; same gap Portal and Masonry both had before their waves. `transform`-only, composited. |
| `prefers-reduced-motion: reduce` | zeroed `.tabx-tab`/`.tabx-tab-close`/`.tabx-card`/`.tabx-card-close` transition-duration; `animation: none` on the preview shimmer | **extended** — added `.tabx-rail-action`, `.tabx-sort-button`, `.tabx-density-button` (the new press-scale targets) to the same zeroing block | **fixed (extended)** — under Cosmos the duration tokens are zeroed at token level, so token-consuming transitions get reduced-motion for free; but the block also has to cover the no-Cosmos case, where the literal fallbacks stay live. Same "belt-and-suspenders" reasoning as Masonry wave 3's identical extension. |
| Animated properties (hover washes) | `background-color`/`box-shadow`/`color`/`opacity` | unchanged, plus the new `transform` on press-scale | **pass** — no layout-triggering property is animated on hover/press. |
| **Auto-hide tab bar `max-height` transition — layout property, not transform/opacity** | flagged by the design-review hook (`layout-transition`) | **left unchanged, classified as an accepted exception, not a defect** | **waived, with reasoning** — the kit's §3 MUST reads "animate only `transform` and `opacity`… never `width`/`height`/`top`/`left`". `max-height` on the auto-hide bar is architecturally load-bearing: the header is genuinely *in flow* (it reclaims/yields real editor-pane space as it collapses/expands — that's the entire point of the feature, distinct from an overlay). The kit's own §3 table lists "Structural panel movement (sidebar open/close, ribbon peek)" as the canonical use for `--cosmos-t-panel`, which is by definition layout motion (a sidebar's `width` or a ribbon's position changes). There is no transform-only way to animate a genuinely in-flow height collapse without either (a) faking it with `scaleY` (which would visually squash tab-bar content rather than reveal/hide it, a worse UX and a redesign this wave's non-goals forbid) or (b) restructuring the bar to render as an absolutely-positioned overlay (a DOM/layout change, also forbidden). The duration is still token-sourced (`--cosmos-t-base`) so it inherits reduced-motion for free. Flagged here rather than silenced with an inline hook-ignore comment, per the instruction not to suppress a real finding without addressing it — this is a judged, documented exception, not an unaddressed one. |
| `.tabx-preview-skeleton` shimmer loop (`animation: tabx-shimmer 1.25s linear infinite`) | raw `1.25s` | unchanged | **waived** — the `--cosmos-t-*` scale tops out at `300ms` (`--cosmos-t-panel`); no suite token exists for a continuous loop duration. Fully disabled under `prefers-reduced-motion`. Identical waiver to Masonry's shimmer. |
| `--tabx-autohide-delay` (450ms grace period before auto-hide collapses) | raw `450ms`, defined once at `:root` | unchanged, still a `:root` `--tabx-*` token definition | **pass, correctly untouched** — this is an interaction-timing threshold (mouse-out tolerance), not a design duration on the kit's `--cosmos-t-*` scale; no suite token exists for it and inventing one would violate the kit's own premise ("the kit EXTRACTS Cosmos's rules, it doesn't invent new ones"). Stays TabX's own local token, per the contract's own token-definition exemption. |
| Phone entrance recipes (`cosmos-pop-in` / `cosmos-sheet-rise` / `cosmos-fade-in`) | n/a | TabX renders no popover/menu/modal chrome of its own | **pass, inherited** — same verdict as Masonry/Sonar/Portal's identical situation: nothing plugin-owned to animate an entrance for; native Obsidian chrome (if any is ever opened by TabX) already carries the theme's recipes. |
| `--cosmos-spring` (overshoot) | never used | unchanged | **pass** — correctly not reached for on hover/reveal; TabX has no confirmation micro-moment that would call for it. |

## §4 Empty-state pattern

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| `.tabx-grid-empty p` ("No open tabs." / "No open tabs match your search.") | was `color` inherited from `.tabx-grid-empty` (`--text-muted`) at `font-size: var(--font-ui-small)` — one step too dark and one step too large | same, no phone variant | **fixed** — now explicit `color: var(--text-faint); font-size: var(--font-ui-smaller)` on the `<p>` itself, the kit's whisper recipe verbatim. The icon above it (`--text-faint` already) and the message now agree. |
| `.tabx-card-empty` ("Empty note" / "Preview unavailable") | was `color: var(--text-faint)` (already correct) at `font-size: var(--font-ui-small)` (one step too large) | same | **fixed** — `font-size` dropped to `var(--font-ui-smaller)`. Italic is kept, same reasoning as Masonry's `.masonry-card-empty-preview`: the whisper recipe constrains colour and size, not style, and italic reinforces "this is a state note, not note content". |
| `.tabx-rail-title` ("OPEN TABS" section label above the rail list) | `font-size: var(--font-ui-smaller); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted)` | same | **waived, verdict flagged for Mario — same judgement class as Portal's `.portal-section-title`.** This already has uppercase + letter-spacing + the smaller size (3 of 4 micro-label ingredients), but two details diverge from the kit's verbatim recipe: `font-weight: 600` vs. the kit's `var(--font-medium)`, `letter-spacing: 0.04em` vs. the kit's `0.06em`, and `color: var(--text-muted)` vs. the kit's `--text-faint`. It is also, like Portal's section titles, the *only* heading naming the rail's contents — not a secondary eyebrow sitting above other content the way Sonar's/Masonry's group labels are. Left as-is rather than force-matched, because `--text-muted`→`--text-faint` would make the rail's sole section label read even quieter than the row titles under it, a hierarchy call, not a token substitution. Flagged, not fixed. |
| `.tabx-rail-count` (open-tab count badge next to the rail title) | `color: var(--text-faint); font-size: var(--font-ui-smaller)` | same | **pass** — already the whisper-adjacent micro recipe, correctly quiet next to the title it annotates. |

## §5 Microcopy voice

| Rule | Desktop | Phone | Verdict |
|---|---|---|---|
| Sentence-case labels | `TabxSettingTab` uses Obsidian's native `Setting`/`PluginSettingTab` API exclusively (`new Setting(containerEl).setName('Auto-hide tab bar')…`) — every one of the 8 setting names/descriptions is sentence-case | n/a | **pass** — no bespoke `.mva-pv`-style form exists to normalize; delegates entirely to native `Setting`, matching the identical verdict Sonar and Portal reached for the same reason. |
| No native `<select>` in plugin-authored UI | `grep -n "createEl('select'\|<select"` over `src/`: zero hits | same | **pass** |
| No native `<select>` — settings tab | `settings.ts` uses `.addDropdown(…)` twice (default card density, default sort), which renders a native `<select>` | same | **deferred, out of scope by design** — identical to Masonry wave 3's verdict on its own `addDropdown` uses: the programme doc excludes settings screens on purpose ("Niente settings screens (in coda programma)"). Replacing `addDropdown` with a chip+popover means writing a custom form component — a component rework this wave's non-goals forbid. Flagged for the settings-screen cantiere. |
| No `mod-cta` on buttons | `grep -rn "mod-cta"` over `src/` + `styles.css`: zero hits | same | **pass** |
| English product copy, PM jargon untranslated | every user-facing string in `grid-view.ts`/`rail-view.ts`/`tabbar-button.ts`/`settings.ts` is English | same | **pass** |
| Chip+popover pickers, never native `<select>` | TabX has no picker-style controls in its views (sort/density are icon toggle buttons cycling a fixed enum, not open-ended pickers) | n/a | **pass, not applicable** — nothing in TabX's view surface is a picker in the kit's sense. |
| Button labels are verb + object / standalone meaning | Empty-state message and card labels are descriptive strings, not action buttons; the rail/grid have no free-standing action buttons beyond icon-only toggles with `aria-label`s ("Activate {title}", tab-bar sort/density toggles) | same | **pass** — icon-only controls carry descriptive `aria-label`s rather than visible verb+object text, which is the correct pattern for icon-only chrome (same category Sonar's icon-only phone chip variant was judged **pass** on in wave 1). |

## Golden-rule raw-value leakage (post-fix grep, repo-wide)

- raw hex: **0 occurrences**, before and after.
- `cubic-bezier`: **2 occurrences** — the `--mv-wash` fallback (`:root`) and
  the new press-scale block's `--cosmos-native` fallback (phone). Both are
  literal fallbacks inside `var()`.
- `ms` durations: **14 occurrences**, of which **9** are `var(--cosmos-t-*, N)`
  fallbacks, **1** is `--tabx-autohide-delay: 450ms` (a `:root`
  `--tabx-*` token definition with no suite equivalent — the contract's own
  documented exemption), and **4** are `0ms`/`0.01ms`
  reset/reduced-motion escape hatches.
- `var(--cosmos-*)` / `var(--mv-*)` consumption: **0 → 20** occurrences
  across 8 distinct tokens.
- `--cosmos-*` / `--mv-*` *definitions* anywhere (including `:root`/`body`):
  **0**.

`src/style-contract.test.ts` (introduced in commit `3461483`, predating this
wave) already enforced exactly this shape; only its docstring/inline
comments needed updating in this wave, since the assertion machinery itself
required no logic changes — the `var()`-fallback-range scanner was already
written generally enough to cover the new `--cosmos-*`/`--mv-*` consumption
sites (verified: all 3 assertions pass unmodified against the post-fix
file). Red-before-green re-verified in this wave: appended a bare `999ms`
duration plus an extra `#ff0000 !important` declaration — both failed as
expected (`not ok 32` raw-value scan flagged `999ms` and `#ff0000`; `not ok
33` ceiling assertion failed at count 7 > 6). Reverted `styles.css` to its
pre-probe state (confirmed byte-identical via `diff` and matching
`shasum`), re-ran: **37/37 green**.

## `!important` audit — 6, unchanged, each now justified inline

The kit is silent on `!important` (no MUST/MUST NOT); each was judged on
whether it wins a real specificity battle or shortcuts the cascade. No
`!important` was added or removed this wave — all 6 were already genuine
specificity battles; the fix was adding the justification comment each one
lacked.

| Block | Count | Verdict |
|---|---|---|
| `.tabx-rail-content` — `padding: 0` | 1 | **kept, justified inline (new comment)** — Obsidian core styles the same node via `.workspace-leaf-content > .view-content` (higher specificity than one plugin class), setting the standard view padding; the rail needs a true edge-to-edge list. |
| `.tabx-grid-content` — `padding: 0` | 1 | **kept, justified inline (new comment)** — same core `.view-content` override as above; the grid also needs an edge-to-edge canvas. |
| `.tabx-search-input` — `padding-inline`, `border-color`, `background`, `box-shadow` | 4 | **kept, justified inline (new comment)** — core styles this control through the `input[type='search']` attribute selector (0,1,1), which outranks `.tabx-search-input` (0,1,0) on all four properties; without `!important` the field renders as native search chrome instead of matching the grid toolbar. Same specificity story as Masonry's `.masonry-search-input` block in wave 3. |

**Total: 6**, unchanged from the pre-wave count that `style-contract.test.ts`
already froze the ceiling at. Every survivor now carries an adjacent comment
naming the selector it must outrank and why; before this wave none of them
did.

## Not touched (explicit non-goals, confirmed out of scope)

- No layout or DOM changes anywhere — every fix in this wave is a token
  substitution, a missing phone-size/pseudo-element addition on an
  already-existing selector group, or a new `:active` motion rule. The
  keyed-reconciliation grid (`src/reconcile.ts`, `planReconcile` +
  `cardSignature`) and the flex-column masonry layout + `setInterval`
  polling backstop (`src/masonry-layout.ts`, `src/grid-view.ts`) were not
  touched; `src/reconcile.test.ts` and `src/masonry-layout.test.ts` passing
  unmodified in the final run is the mechanical proof.
- Card-content typography (`1.02rem` card title, `0.68rem` chips, `0.76rem`
  excerpt, compact/visual variant overrides) — cantiere 3 (NC-Tight),
  Mario's call, same as Masonry's identical waiver.
- Settings screen (`settings.ts` `.addDropdown` → native `<select>`) —
  explicitly queued after this programme.
- `.tabx-rail-title` micro-label recipe divergence (weight/letter-spacing/
  colour) — flagged, not fixed; a hierarchy judgement call for Mario, same
  category as Portal's `.portal-section-title` deferral in wave 2.
- The auto-hide tab bar's `max-height`/`opacity` transition property choice
  — durations tokenized, but the layout-property animation itself is kept
  as a documented, kit-sanctioned exception (structural panel movement),
  not fixed to transform-only, because no transform-only implementation
  exists that doesn't redesign the feature.
- The shimmer's `1.25s` loop duration — no suite token exists for loop
  durations, same waiver as Masonry's.
- `--tabx-autohide-delay` (450ms interaction-timing token) — not a design
  duration, no suite equivalent; stays TabX's own `:root` token.

## Verification

Run on the post-fix tree, exit codes and counts quoted verbatim:

- `pnpm typecheck` (`tsc --noEmit`) — **exit 0**, 0 errors.
- `pnpm lint` (`eslint src`) — **exit 0**, 0 problems.
- `pnpm test` (`node --experimental-strip-types --test src/*.test.ts`) —
  **tests 37 / pass 37 / fail 0** (all 8 test files, including
  `reconcile.test.ts` and `masonry-layout.test.ts`, both green and
  unmodified — the mechanical proof that keyed reconciliation and the
  masonry layout backstop were untouched). No test files added or removed
  this wave (`style-contract.test.ts` already existed from commit
  `3461483`, predating this wave); its 3 assertions pass unmodified against
  the migrated stylesheet.
- Red-before-green re-verified against the pre-existing contract: injected
  a bare `999ms` duration + an extra `#ff0000 !important` declaration into
  `styles.css`; both failed as expected (raw-value scan flagged `999ms` and
  `#ff0000` by line; `!important` ceiling assertion failed at count 7 > 6).
  Reverted to the pre-probe state — confirmed byte-identical (`diff` clean,
  matching `shasum`) — re-ran: **37/37 green**.
- Desktop screenshot / live vault reload verification: **pending** — not
  performed this wave (no live vault-reload check run in this session).
- Phone verification: **pending Mario's on-device sign-off** — per the hard
  constraint, `EmulateMobile` was not used (it kills Node plugins). The
  phone fixes (44px floors on the search field / sort button / density
  button hit-area, press-scale) are verified by reading the resulting CSS
  values against the kit's phone column, not by rendering on-device.

---

# §6 — wave 2026-07 dinamica

Audit of `styles.css` (post wave-4, 794 lines pre-fix, 826 lines post-fix)
against `obsidian-cosmos-theme/docs/mv-kit.md` §6 ("Elevation & motion
depth", landed cosmos-theme commit `10f5ddc`), both desktop and phone
columns. Scope: the four §6 sub-rules only (elevation hierarchy, hover
richness, drag polish, panel/tab transitions) — coherence-only, no layout
redesign, no new components, no new CSS files, per
`docs/2026-07-25-dynamics-depth-design.md`'s inherited non-goals. TabX owns
no drag surface and no tab-content-swap surface of its own (see the Drag
polish and Panel/tab transitions rows below) — this wave's real findings are
entirely in the Hover richness and Panel-duration-tier areas.

## Elevation hierarchy

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| `.tabx-tab.is-active` `box-shadow` (rail row) | hand-picked 2-layer `rgba(...)` shadow | same, no phone variant | **waived, unchanged from wave 4's verdict on the identical pattern** — mv-kit §6's shadow-tier MUST covers *floating* surfaces (Pop: menu/tooltip/popover/prompt, dismissed by outside-click) and *persistent* Island surfaces (a sidebar/panel that doesn't close on outside-click). A rail row inside a scrolling list is neither — it's inline flow content, permanently part of the document, no dismiss behaviour at all. Re-verified this wave rather than assumed: still true, nothing changed about this selector's category. |
| `.tabx-card:hover` / `.tabx-card.is-active` `box-shadow` (grid card) | hand-picked `color-mix(...)` shadow / inset ring | same, no phone variant (hover unreachable on touch; `.is-active` ring still applies) | **waived, same reasoning** — a card inside a scrolling masonry grid, not a floating/persistent surface in §6's sense. The wave-4 audit already reached this verdict for §1; re-confirmed under §6's more detailed tier language, no change. |
| Floating surfaces of TabX's own (menu, popover, tooltip, prompt, modal) | none exist | none exist | **waived, nothing to tokenize** — TabX renders no popover/menu/modal chrome; `grep -n "createDiv.*menu\|Menu(\|Modal(" src/*.ts` (excluding test files): zero hits. Nothing in TabX's surface set qualifies for `--cosmos-pop-shadow` or `--cosmos-island-shadow`. |
| Two tiers stacked on one element (Pop shadow **and** glass blur) | not present | not present | **pass, not applicable** — TabX has no glass/blur surface anywhere (`grep -n "blur\|glass" styles.css`: zero hits), so the "never stack two tiers" MUST NOT has nothing to violate. |

## Hover richness

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| `.tabx-card:hover` | was colour/shadow wash only (`border-color` + `box-shadow`), **no lift transform** | hover unreachable on touch (correctly gated `@media (hover: hover)` already) — the physical-response equivalent is the pre-existing `:active { transform: scale(--cosmos-press-scale) }` in the `@media (pointer: coarse)` block | **fixed** — added `transform: translateY(-1px)` inside the existing `@media (hover: hover)` block, plus a new `transform` transition on the base rule using `--cosmos-t-fast` + `--mv-lift` (a *new* easing token for this file — every other transition uses `--tabx-ease`/`--mv-wash`, correctly, since `--mv-lift` is reserved for physical-transform easing, not colour washes, per the kit's own "the two easings are not interchangeable" MUST). This is the canonical case the kit's own §6 example (`.card:hover { transform: translateY(-1px) }`) targets almost verbatim. |
| `.tabx-tab:hover` (rail row) | colour wash only (`background-color`) | hover unreachable on touch (gated) | **pass, correctly colour-only** — this is a *row* in §6's own vocabulary (the kit's example explicitly splits `.row:hover` = wash-only from `.card:hover` = wash+lift). A rail row inline in a list is the row case, not the card case; adding a lift here would be inventing richness the kit doesn't ask for on this surface class. |
| `.tabx-rail-action:hover`, `.tabx-tab-close:hover`, `.tabx-sort-button:hover`, `.tabx-card-close:hover` | were bare top-level `:hover` rules, **not gated by `@media (hover: hover)`** | **all four are phone-reachable**: `.tabx-tab-close`/`.tabx-card-close` are forced to `opacity: 1` (always visible, always tappable) inside the existing `@media (pointer: coarse)` block; `.tabx-rail-action`/`.tabx-sort-button` are plain always-visible toolbar icons. A bare `:hover` on any of them fires on tap and the wash state visually sticks until an unrelated tap elsewhere — no pointer ever "leaves" on touch to clear it. | **fixed** — all four wrapped in `@media (hover: hover)`. This is the kit's own explicit correctness MUST ("a touch tap must never leave a stuck hover state… plugins must not fight it with custom `:hover` outside that media query on phone-reachable elements"), not a richness judgement call — genuine gaps, not a style choice. |
| `> .workspace-tab-header-container:hover` (auto-hide bar's reveal trigger, native-DOM selector TabX styles via `body.tabx-autohide-tabs`) | bare `:hover`, ungated | same selector, ungated | **waived, different defect class from the row above — flagged, not fixed.** This selector cannot leave a *stuck visual state* on touch (the specific MUST this rule enforces): confirmed via `grep -rn "Platform\|isMobile" src/*.ts` (zero hits) that the auto-hide feature has no mobile gating at all, so `body.tabx-autohide-tabs` can be toggled on mobile, but since touch has no hover concept the bar simply never reveals there — no state gets stuck because none ever activates. The actual gap this surfaces (auto-hide is unreachable on phone once enabled) is a *feature-reachability* problem, not a §6 elevation/motion-depth defect, and fixing it means designing a tap-to-reveal affordance — new interaction design, forbidden by this wave's "no new components" non-goal. Flagged here for a future cantiere, not silently left. |
| `--mv-wash` vs `--mv-lift` used correctly (not interchanged) | `.tabx-card:hover`'s new `transform` uses `--mv-lift`; every colour/shadow wash across the file (`.tabx-tab`, `.tabx-tab-close`, `.tabx-card` border/shadow, `.tabx-card-close`) still uses `--tabx-ease` (itself `var(--mv-wash, …)`) | same | **pass (verified, not assumed)** — `grep -n "mv-lift\|mv-wash" styles.css` confirms exactly one `--mv-lift` consumption site (the new card lift) and the pre-existing `--mv-wash` consumption stays on `--tabx-ease`'s definition only; no site mixes the two. |

## Drag polish

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| Any TabX-owned drag interaction (`.is-dragging`/`.is-dropped` or equivalent) | **does not exist** | **does not exist** | **waived, nothing to audit — TabX implements no drag of its own.** Verified, not assumed: `grep -n "draggable\|dragstart\|dragover\|drop\b" src/*.ts` (excluding test files) returns zero hits; the rail and grid are click-to-activate views (`activateTab`/`activate` call `app.workspace.setActiveLeaf`), not reorderable lists. Tab reordering itself happens in Obsidian's native horizontal tab bar, entirely outside TabX's DOM — `docs/2026-07-25-dynamics-depth-design.md`'s own note ("il drag nativo usa transform inline → verificare che non ci sia conflitto") asks only to confirm no conflict, not to add drag polish TabX doesn't own. Confirmed no conflict: `grep -n "left:\|top:\|\.style\." src/*.ts` shows the only inline `style.setProperty` calls are `--tabx-card-width`/`--tabx-min-tab-width` custom-property widths, never `left`/`top` positioning that could fight native drag. |

## Panel & tab transitions

| Motion | Before | After | Verdict |
|---|---|---|---|
| Auto-hide tab bar `max-height` collapse/expand (`body.tabx-autohide-tabs … .workspace-tab-header-container`) | `transition: max-height var(--cosmos-t-base, 180ms) var(--tabx-ease) var(--tabx-autohide-delay)` — **wrong tier**: the adjacent comment already named this mv-kit's "structural panel movement" category (citing `--cosmos-t-panel`'s own doc example, sidebar open/close) but the code used the *hover/wash* tier (`--cosmos-t-base` + `--tabx-ease`/`--mv-wash`), not the *panel* tier the kit's §6 table actually names for this category (`--cosmos-t-panel` + `--cosmos-native`) | `transition: max-height var(--cosmos-t-panel, 300ms) var(--cosmos-native, cubic-bezier(0.32, 0.72, 0, 1)) var(--tabx-autohide-delay)` | **fixed** — both the duration (180ms → 300ms) and the easing (`--mv-wash`'s colour curve → `--cosmos-native`'s zero-overshoot structural curve) moved to the pair the kit's own §6 table specifies for "Panel/sidebar open-close". The wave-4 audit had already correctly judged *which property* animates (`max-height`, the sanctioned structural exception — unchanged, still correct, not revisited this wave) but had the *tier* wrong; this wave's fix is duration/easing only, no property or architecture change. |
| Auto-hide tab bar content fade (`opacity` on the header's children, same selector's `> *`) | `transition: opacity var(--cosmos-t-fast, 120ms) var(--tabx-ease)` | unchanged | **pass, correctly fast-tier** — this is the text-fade riding along with the structural collapse, a wash-style opacity fade, not the structural move itself (the kit's own §3 phone-recipe table treats lightweight fades as `--cosmos-t-fast`-tier, e.g. `cosmos-fade-in`). Re-confirmed this wave, not changed. |
| Auto-hide tab bar reveal-on-hover (`:hover` override, same block, `transition-delay: 0ms` only) | inherits the parent selector's `transition:` shorthand, overrides only the delay | automatically inherits the new `--cosmos-t-panel`/`--cosmos-native` pair from the fix above — no separate edit needed | **pass (inherited fix, verified not assumed)** — confirmed by reading the cascade: the `:hover` rule never redeclares its own `transition` property, so CSS's normal inheritance-through-specificity gives it the corrected parent value for free. |
| Tab-content swap (crossfade vs. slide) | TabX renders no tab-content swap of its own | same | **waived, not applicable — TabX owns no such surface.** The rail/grid *select* a leaf (`setActiveLeaf`); the actual pane content swap that follows is native Obsidian editor-pane behaviour, entirely outside any CSS TabX ships. `grep -n "@keyframes\|slide" styles.css` (excluding the unrelated shimmer keyframe already waived in wave 4): zero hits for anything resembling a slide-in. Nothing to crossfade-ify because nothing plugin-owned swaps. |
| `.tabx-tab.is-active` / `.tabx-card.is-active` state change on tab switch | colour/shadow transition already token-sourced (`--cosmos-t-fast`/`--cosmos-t-base` + `--tabx-ease`), unchanged this wave | same | **pass, correctly hover/wash-tier, not panel-tier** — this is a colour-state change on an existing, already-rendered row/card (not a structural open/close or a content swap), so the kit's panel-duration MUST doesn't apply here; the faster hover tier is the correct one, matching the kit's own tier split between "hover wash" (fast) and "structural panel movement" (panel). Re-confirmed, not changed. |

## Style contract — new §6 assertions

Two new assertions added to `src/style-contract.test.ts`, both mechanically
derived from concrete findings above (zero speculative assertions, per this
wave's brief):

1. **`§6: no bare :hover rule outside @media (hover: hover) on a tabx-owned
   selector`** — a brace-depth scanner walks `styles.css` (comments
   stripped) tracking whether each `.tabx-*:hover` rule opens inside an
   `@media (hover: hover)` block; any that opens at depth 0 (or inside any
   other enclosing block that isn't the hover-gate) is a violation. Explicitly
   excludes the native `.workspace-tab-header-container:hover` selector by
   construction (the regex only matches `.tabx-*` selectors) — the waived
   selector above is a different, judged exception, not something the test
   silently permits by accident.
2. **`§6: the auto-hide tab bar (structural panel movement) uses
   --cosmos-t-panel`** — extracts the `max-height` transition value from the
   `workspace-tab-header-container` rule and asserts it names
   `var(--cosmos-t-panel, 300ms)` literally, catching any future regression
   back to the hover/wash tier.

Both assertions are additive; all 5 pre-existing assertions in the file
(raw-value scan, `!important` ceiling, no `--cosmos-*`/`--mv-*` definitions,
the two comment-integrity guards) pass unmodified.

**Red-before-green, re-verified this wave**: injected both violations back
into a working copy — un-gated `.tabx-rail-action:hover` (removed its
`@media` wrapper) and reverted the auto-hide `max-height` transition to
`var(--cosmos-t-base, 180ms) var(--tabx-ease)`. Both new assertions failed as
expected (`not ok 6` flagged the ungated selector by line, `not ok 7` flagged
the wrong duration token); all 5 pre-existing assertions stayed green
throughout. Restored from a pre-probe backup and confirmed byte-identical via
`shasum` (`2e629640d38680d4c0745213db8d13ee7f6c8a3e`, matching before and
after); re-ran: **41/41 green** (39 pre-wave + 2 new).

## Not touched (explicit non-goals, confirmed out of scope)

- No layout or DOM changes anywhere — every fix in this wave is a duration
  token substitution, a media-query gate addition around three already-shipped
  hover rules, or one new `transform` transition on an already-existing
  selector. `src/reconcile.test.ts` and `src/masonry-layout.test.ts` passing
  unmodified in the final run (41/41 total) is the mechanical proof the
  keyed-reconciliation grid and masonry layout backstop were untouched.
- No new plugin-owned drag surface was built to give §6's Drag polish rule
  something to satisfy — TabX's click-to-activate model has no drag of its
  own, and building one would be a new component, forbidden by this wave's
  non-goals.
- No tap-to-reveal affordance was added for the auto-hide bar on mobile —
  the reachability gap surfaced under Hover richness above is flagged for a
  future cantiere, not fixed here (new interaction design, not a coherence
  token fix).
- `.tabx-tab.is-active` / `.tabx-card.is-active` state-change duration tier
  — audited and confirmed already correct (hover/wash tier, not
  panel tier), no change made.
- Elevation shadows on `.tabx-tab.is-active` / `.tabx-card:hover` /
  `.tabx-card.is-active` — re-confirmed as the wave-4 waiver (not
  floating/persistent surfaces in §6's sense), not touched.

## Verification

Run on the post-fix tree, exit codes and counts quoted verbatim:

- `pnpm typecheck` (`tsc --noEmit`) — **exit 0**, 0 errors.
- `pnpm lint` (`eslint src`) — **exit 0**, 0 problems.
- `pnpm test` (`node --experimental-strip-types --test src/*.test.ts`) —
  **tests 41 / pass 41 / fail 0** (39 pre-wave + 2 new §6 assertions;
  `reconcile.test.ts` and `masonry-layout.test.ts` both green and
  unmodified).
- Red-before-green re-verified against both new assertions (see the Style
  contract section above): both failed as expected on the injected
  violations, both pass on the fixed file; restore confirmed byte-identical
  via `shasum`.
- Desktop screenshot / live vault reload verification: **pending** — not
  performed this wave (no live vault-reload check run in this session,
  consistent with wave 4's own scope).
- Phone verification: **pending Mario's on-device sign-off**, same
  constraint as wave 4 — `EmulateMobile` was not used (kills Node plugins).
  The phone-side claims in this wave (all four gated hover rules stop
  triggering on touch; the auto-hide reachability gap is a pre-existing,
  now-documented limitation, not a regression) are verified by reading the
  resulting CSS/JS against the kit's phone column and against
  `grep`-confirmed absence of mobile gating, not by rendering on-device.
