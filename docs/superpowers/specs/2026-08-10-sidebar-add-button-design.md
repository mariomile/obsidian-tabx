# Sidebar add-pane "+" — design

**Date:** 2026-08-10
**Status:** implemented

## Problem

The right sidebar's tab-header strip shows one icon per open view and offers no
way to add another. Opening a sidebar view means knowing its command name and
going through the command palette — the strip that represents the panes is not
the place you manage them. Codex-style editors put a "+" at the end of that
strip; Obsidian's own "+" exists only in the main tab bar.

## Design

**Where.** A `clickable-icon` with the `plus` icon, injected into
`.mod-right-split .workspace-tab-header-container`, immediately after
`.workspace-tab-header-container-inner` — i.e. flush against the last icon.
Appending to the container instead puts it past the flexible spacer *and* the
sidebar-toggle button, stranding it in the far corner.

The wrapper deliberately does **not** reuse the native
`workspace-tab-header-tab-list` class that `TabBarButtonManager` uses in the
main bar: Obsidian sets that class to `display: none` outside the main split,
so reusing it mounts an invisible button. The wrapper is `.tabx-sidebar-add`
with three layout declarations; the child keeps `clickable-icon`, which is what
carries colour, hover and press — so a theme skins it for free.

Obsidian rebuilds the header container on layout changes, so `mount()` is
idempotent and re-runs on `layout-change`, exactly like the main-bar button.
Main window only; popout windows are out of scope, as they are there.

**What the menu offers.** Two tiers:

1. **New** — Browser (`webviewer`) and Terminal. Always offered when installed,
   even if one is already open: a second browser pane is a normal thing to
   want.
2. Everything else that can live in a sidebar and is not already in one, sorted
   by label.

**Why the exclusions are derived, not curated.** File-backed views (`markdown`,
`pdf`, `canvas`, `bases`, …) are excluded by reading Obsidian's own
`viewRegistry.typeByExtension`, so a plugin that registers a new file type
drops out of the menu on its own. Views already mounted in a sidebar are
omitted rather than greyed out — their icon is right next to the "+", so
listing them would duplicate what the user is looking at. A hand-curated list
of "views that make sense in a sidebar" was rejected: it drifts with every
plugin installed.

**Labels and icons.** A short static map covers the names Obsidian uses in its
own UI (`backlink` → "Backlinks", `tag` → "Tags") plus TabX's own two views;
everything else is prettified from the type id. The prettifier splits on
`:`/`-`/`_`, collapses a repeated word, and capitalises — so `exo-chats` →
"Exo chats" and `terminal:terminal` → "Terminal", the `plugin:view` convention
handled without an entry per plugin.

A learned label cache (recording type → title/icon whenever a view is observed
open) was considered and rejected: extra persistent state for a problem a map
plus a prettifier already solves.

**How a view opens.** `getRightLeaf(false)` → `setViewState({ type })` →
`revealLeaf`. Always in the right sidebar, by construction.

**The terminal exception.** The Terminal plugin's view state carries a shell
profile it resolves from its own settings. Opening `terminal:terminal` with an
empty state was tried against the live vault and produces a view titled
"Invalid". So that entry delegates to `terminal:open-terminal.integrated.root`,
which means the terminal lands wherever the plugin puts it — the main area, not
the sidebar. Reconstructing the profile in TabX would duplicate logic that
belongs to the Terminal plugin; a correctly-working terminal in the wrong pane
beats a correctly-placed broken one. Documented in the README rather than
hidden.

An entry with a `commandId` is skipped when that command is absent, so a
partially-configured plugin never yields a dead menu item.

## Structure

- `src/tab-header-button.ts` — the injection mechanism, now shared with the
  main tab bar's grid button: idempotent mount guarded by a marker class,
  remount on `layout-change`, unmount on unload, keyboard activation. The
  strip-specific pieces (container selector, insertion anchor, wrapper class,
  label, icon, activation) are its spec. Extracted once the second injector
  proved the pattern — before that it would have been a guess at which parts
  vary.
- `src/sidebar-add-menu.ts` — pure. Takes plain lists (registered types,
  file-backed types, types open in a sidebar, command ids) and returns the two
  tiers. The whole policy is testable without a workspace.
- `src/sidebar-add-button.ts` — the sidebar spec plus the menu construction and
  activation.
- `src/obsidian-internals.ts` — gains `registeredViewTypes`,
  `fileBackedViewTypes`, `commandIds`, `executeCommand`, keeping every unsafe
  cast in the one file that owns them. Which split a leaf belongs to is asked
  through the public `leaf.getRoot()`, so that needs no internals.
- `sidebarAddButton` setting, default on, alongside `tabBarButton`.

## Verification

- 8 unit tests on the pure module: prettifier, both featured entries, featured
  dropped when view or command is missing, featured still offered when open,
  the three exclusions, label sorting, TabX's own names, unknown types.
- `pnpm lint`, `pnpm typecheck`, full suite 56/56 including the style contract.
- Live vault: the button mounts at the end of the strip (x = 1309, exactly
  where the icons end), the menu opens with 23 entries — Browser and Terminal,
  separator, then the alphabetical remainder with the seven open sidebar views
  correctly absent — and clicking Browser opened a `webviewer` leaf in the
  right sidebar.
- The icon measured `opacity: 0` when inspected from a CLI-driven, backgrounded
  window: a CSS entry transition stuck at `currentTime: 0` because rAF is
  starved there. Forcing the transitions to finish rendered the "+" correctly,
  confirming a measurement artifact rather than a style bug.
