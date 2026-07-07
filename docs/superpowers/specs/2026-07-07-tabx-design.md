# TabX — Design Spec

**Date:** 2026-07-07
**Plugin id:** `tabx` · **Name:** TabX · **Repo:** `~/Dev Projects/obsidian-tabx`
**Status:** approved design → ready for implementation plan

---

## 1. What & why

TabX is a vault-navigation plugin in the marioverse plugin fleet (sibling of
Masonry, Horizon, Sonar, Runway…). It gives Obsidian a **vertical list of open
tabs** in the left sidebar, plus three companion behaviours:

1. **Rail** — a native sidebar panel listing every open tab as a vertical row
   (flat list, no split/group logic).
2. **Auto-hide** — hover-to-reveal collapse of the left sidebar, so the rail
   (and the rest of the sidebar) stays out of the way until the cursor reaches
   the edge.
3. **Scrolling horizontal tab bar** — a CSS restyle so the native top tab bar
   **scrolls horizontally** instead of shrinking each tab to an unreadable sliver.
4. **Grid** — a Masonry-styled **card view of the open tabs** (visual tab
   switcher), opened from a button in the rail header.

It reuses Masonry's visual language and its performance discipline, but is
**self-contained**: no runtime dependency on the Masonry plugin.

### Value: prima vs dopo

- **Prima:** con molti tab aperti, la tab bar orizzontale nativa restringe ogni
  header fino a renderlo illeggibile; non c'è modo di vedere/gestire i tab in
  verticale né di navigarli visivamente.
- **Dopo:** i tab vivono in una lista verticale leggibile nella sidebar (con
  auto-hide opzionale), la tab bar orizzontale scorre invece di comprimersi, e
  un click apre una griglia a card per switchare a colpo d'occhio.
- **Esempio tangibile:** _Prima:_ 15 tab aperti = 15 header da ~40px, solo icone.
  _Dopo:_ 15 righe verticali con titolo pieno + una griglia a card con preview.

---

## 2. Architecture

Same template as `obsidian-masonry` / `obsidian-horizon`: pnpm + esbuild
(`.obsidian-plugin-dir` deploy), strict tsconfig, `eslint-plugin-obsidianmd`,
`versions.json`, node `--test`.

`manifest.json`: `id: "tabx"`, `name: "TabX"`, `minAppVersion: "1.12.7"`,
`isDesktopOnly: false`, `author: "Mario Miletta"`.

### Modules (`src/`)

| File | Responsibility |
|---|---|
| `main.ts` | `Plugin`: load settings, register both views, ribbon + commands, settings tab, wire `AutoHideController`, toggle the scroll-tabbar body class. |
| `tab-source.ts` | `collectTabs(app): TabEntry[]` via `workspace.iterateRootLeaves`; resolve title / icon / filePath / pinned / active / stable leaf id. Pure-ish, unit-tested. |
| `rail-view.ts` | `RailView extends ItemView` — the vertical list panel. |
| `grid-view.ts` | `GridView extends ItemView` — the Masonry-style card grid of open tabs. |
| `preview.ts` | `TabPreviewService` — LRU excerpt cache over `vault.cachedRead`. |
| `autohide.ts` | `AutoHideController` — left-sidebar hover collapse/expand. |
| `settings.ts` | `TabxSettingTab` + re-export of defaults/parse. |
| `settings-data.ts` | `DEFAULT_SETTINGS`, `parseSettings` (pure, unit-tested). |
| `types.ts` | `TabEntry`, `TabxSettings`, `TabPreview`. |
| `styles.css` | `.tabx-*` namespace + `body.tabx-scroll-tabs` restyle. Native vars only. |
| `*.test.ts` | `settings-data.test.ts`, `tab-source.test.ts` (pure helpers). |

---

## 3. Data model

```ts
interface TabEntry {
  id: string;            // stable key for DOM reconciliation (see §3.1)
  leaf: WorkspaceLeaf;   // live reference — activate/detach target
  title: string;         // leaf.getDisplayText()
  icon: string;          // leaf.getIcon()
  filePath: string | null; // from getViewState().state.file — NOT leaf.view
  pinned: boolean;
  active: boolean;
}
```

### 3.1 Leaf identity

Obsidian leaves carry an internal `id` string (used in workspace
serialization). Use `(leaf as any).id` as the reconciliation key, guarded:
if absent, fall back to a `WeakMap<WorkspaceLeaf, string>` that mints a
monotonic id on first sight. Never persist these ids.

### 3.2 Resolving file path WITHOUT loading deferred views

Deferred views (Obsidian ≥1.7.2) must stay deferred for performance. Do **not**
read `leaf.view.file`. Instead read `leaf.getViewState()?.state?.file` (a path
string for file-backed views; `undefined` for graph/settings/etc.). Convert to
a `TFile` lazily in the preview service via `vault.getAbstractFileByPath`.

---

## 4. Feature: Rail (vertical tab list)

`RailView` — `TABX_RAIL_VIEW_TYPE = 'tabx-rail'`, `getIcon(): 'gallery-vertical'`,
default location left sidebar (user-movable like any panel).

### DOM

```
.tabx-rail
  .tabx-rail-header
    .tabx-rail-title      "Open tabs"
    .tabx-rail-count      "15"
    button.tabx-grid-open (icon 'layout-grid')   → open GridView
  .tabx-rail-list
    .tabx-tab [data-leaf-id][aria-current]
      .tabx-tab-icon      (setIcon leaf.getIcon())
      .tabx-tab-title     (leaf.getDisplayText())
      button.tabx-tab-pin (only if pinned — indicator, not interactive v1)
      button.tabx-tab-close (clickable-icon 'x', hover-revealed)
```

### Interactions

- **click row** → `workspace.setActiveLeaf(leaf, { focus: true })` then
  `revealLeaf(leaf)` (the tab already exists — activate, never open a new one).
- **click close / middle-click row** → `leaf.detach()`.
- **hover row** → trigger `hover-link` (page preview), like Masonry cards.
- Keyboard: rows are `tabindex=0`, Enter/Space activates.

### Rendering & performance

- **Full rebuild** on `workspace.on('layout-change')`, **debounced ~50 ms**
  (coalesces bursts like closing many tabs). List is tiny, so a rebuild is cheap;
  reconcile by `data-leaf-id` only to preserve focus/hover mid-interaction.
- **O(1) active update** on `workspace.on('active-leaf-change')`: move the
  `.is-active` / `aria-current` from the previous row to the new one. No rebuild.
- All events via `registerEvent`; all DOM handlers via `registerDomEvent`.

---

## 5. Feature: Auto-hide (left sidebar hover-reveal)

`AutoHideController`, wired in `main.ts`, gated by `settings.autoHide`
(**default off**).

- **Reveal:** a fixed 8px hot-zone strip on the left screen edge
  (`.tabx-hotzone`, high z-index, only present while the sidebar is collapsed).
  `mouseenter` → `workspace.leftSplit.expand()`.
- **Hide:** `mouseleave` on the left-sidebar container → start a
  `settings.autoHideDelay` (default 250 ms) timer → `leftSplit.collapse()`.
  Re-entering the sidebar clears the timer.
- Uses Obsidian's **native** collapse/expand (already CSS-transitioned). No
  polling, no rAF. Timer cleared on unload / setting-off.
- **Accepted trade-off:** auto-hide toggles the **entire** left sidebar, so
  File Explorer / Search hide together with the rail. Documented; off by default.
- Relies on `leftSplit` being a `WorkspaceSidedock` with `expand()/collapse()`
  (confirmed in typings) and a resolvable container element
  (`(leftSplit as any).containerEl`, guarded — no-op if unavailable).

---

## 6. Feature: Scrolling horizontal tab bar (CSS)

Pure CSS in `styles.css`, gated by `body.tabx-scroll-tabs` (toggled from
`main.ts` per `settings.scrollTabBar`, **default on**).

```css
body.tabx-scroll-tabs .workspace-tab-header-container { overflow-x: auto; }
body.tabx-scroll-tabs .workspace-tab-header {
  flex: 0 0 auto;
  min-width: var(--tabx-min-tab-width, 120px);
}
/* thin, unobtrusive scrollbar — geometry only */
```

- `--tabx-min-tab-width` set from `settings.minTabWidth` (default 120px).
- **Constraint (memory `no-visible-tabbar-card`):** geometry + native
  active/hover states ONLY. No background surfaces, no decorative fills behind
  the tab bar. This is a hard rule.
- **Verify at build time:** confirm `.workspace-tab-header-container` /
  `.workspace-tab-header` are still the live selectors in 1.12.7 before shipping;
  keep the rule list minimal so a DOM change degrades gracefully (native bar).

---

## 7. Feature: Grid (Masonry-style card view of open tabs)

`GridView` — `TABX_GRID_VIEW_TYPE = 'tabx-grid'`, `getIcon(): 'layout-grid'`,
opens in a main-area tab (from the rail header button + a command).

### Cards

Each open tab → one `.tabx-card` (Masonry visual tokens: 1px border, radius,
hover lift, focus ring — self-contained CSS copy, no cross-repo import):

- icon + title + folder/path meta
- **lazy** excerpt preview for markdown tabs; non-file tabs (graph, settings,
  canvas w/o md) show icon + title only, no preview.

### Interactions

- **click card** → activate that leaf (`setActiveLeaf` + `revealLeaf`) — the tab
  is already open.
- **close button** → `leaf.detach()`.
- Live: `layout-change` rebuilds the grid (debounced); `active-leaf-change`
  highlights the active card (O(1)).

### Performance (bounded scale = the key simplification)

Open tabs are few (≈5–50), so **no infinite-scroll, no batching, no
virtualization** (unlike Masonry). Render all cards at once; only the **preview
hydration** is lazy:

- `IntersectionObserver` (`rootMargin: '320px 0px'`) hydrates previews on view.
- `renderEpoch` counter guards against stale async writes after a rebuild.
- `TabPreviewService`: LRU `Map` (cap ~64 — bounded by realistic tab counts),
  keyed `path:mtime:maxChars`, backed by `vault.cachedRead`; invalidated on
  `vault` modify/rename/delete. Excerpt = strip frontmatter → strip markdown →
  first `settings.previewCharacters` chars.

---

## 8. Settings

| Key | Type | Default | Effect |
|---|---|---|---|
| `autoHide` | boolean | `false` | Enable left-sidebar hover-reveal. |
| `autoHideDelay` | number (ms) | `250` | Collapse delay after leaving sidebar. |
| `scrollTabBar` | boolean | `true` | Toggle `body.tabx-scroll-tabs`. |
| `minTabWidth` | number (px) | `120` | `--tabx-min-tab-width` for scroll bar. |
| `showTabPreview` | boolean | `true` | Grid card excerpt previews on/off. |
| `previewCharacters` | number | `240` | Excerpt length per grid card. |

`settings-data.ts` owns `DEFAULT_SETTINGS` + `parseSettings` (defensive,
unit-tested — same split as Masonry).

---

## 9. Commands & entry points

- Ribbon icon `gallery-vertical` → open/reveal Rail.
- Command `tabx:open-rail` — Open tab rail.
- Command `tabx:open-grid` — Open tab grid.
- Command `tabx:toggle-autohide` — quick toggle for the sidebar auto-hide.
- Settings tab (`TabxSettingTab`).

---

## 10. Performance summary (aligned to Masonry, adapted to scale)

1. Bounded scale (open tabs) → no infinite-scroll / virtualization; render fully.
2. `layout-change` → debounced (~50 ms) rebuild, reconciled by leaf id.
3. `active-leaf-change` → O(1) class toggle, never a rebuild.
4. Grid previews → `IntersectionObserver` (320px) + `renderEpoch` guard.
5. LRU preview cache over `cachedRead`, invalidated on vault mutations.
6. Deferred views stay deferred (resolve file path from `getViewState`).
7. Clean lifecycle: `registerEvent` / `registerDomEvent` / `addChild` +
   `register(() => observer.disconnect())` — zero leaked listeners/observers.
8. Auto-hide via native collapse/expand + debounced timer — no polling/rAF.

---

## 11. Out of scope (v1 — YAGNI)

- Tab **groups / split** management (flat list only — explicitly decided).
- Drag-to-reorder tabs in the rail.
- Making the rail an overlay that hides independently of the native sidebar.
- Runtime dependency on / integration with the Masonry plugin's gallery.
- Grid image/cover previews (excerpt only in v1; images are a later add).
- Mobile-specific layout (desktop-first; `isDesktopOnly: false` but no `@media`
  tuning yet — noted per memory `obsidian-mobile-webkit-aspect-ratio`).

---

## 12. Verification plan

- `pnpm typecheck` clean.
- `pnpm test` — `settings-data.test.ts` (parse/defaults), `tab-source.test.ts`
  (title/icon/filePath/active resolution with mocked leaves).
- `pnpm lint` clean (`eslint-plugin-obsidianmd`).
- Manual in a **throwaway test vault** (never the real vault): open ~10 tabs →
  rail lists them, active highlights, close works; grid renders + previews
  hydrate; toggle scroll-tabbar; toggle auto-hide and confirm hover reveal.
