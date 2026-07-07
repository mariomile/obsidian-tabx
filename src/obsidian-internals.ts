import type { App, WorkspaceLeaf } from 'obsidian';

/**
 * Typed accessors for Obsidian internals that are not part of the public
 * `obsidian` typings. Keeping every unsafe cast in this one file lets the
 * rest of the codebase stay `no-explicit-any` clean.
 */

interface LeafInternals {
  id?: string;
}

interface SplitInternals {
  containerEl?: HTMLElement;
  expand?: () => void;
  collapse?: () => void;
  collapsed?: boolean;
}

export interface LeftSplitHandle {
  expand(): void;
  collapse(): void;
  readonly collapsed: boolean;
}

const mintedIds = new WeakMap<WorkspaceLeaf, string>();
let counter = 0;

/** Stable per-leaf identity for DOM reconciliation. */
export function leafId(leaf: WorkspaceLeaf): string {
  const native = (leaf as unknown as LeafInternals).id;
  if (typeof native === 'string' && native.length > 0) return native;
  let minted = mintedIds.get(leaf);
  if (!minted) {
    counter += 1;
    minted = `tabx-${counter}`;
    mintedIds.set(leaf, minted);
  }
  return minted;
}

export function leftSplit(app: App): LeftSplitHandle | null {
  const split = app.workspace.leftSplit as unknown as SplitInternals;
  if (
    !split ||
    typeof split.expand !== 'function' ||
    typeof split.collapse !== 'function'
  ) {
    return null;
  }
  return {
    expand: () => split.expand?.(),
    collapse: () => split.collapse?.(),
    get collapsed() {
      return Boolean(split.collapsed);
    },
  };
}

export function leftSidedockEl(app: App): HTMLElement | null {
  const split = app.workspace.leftSplit as unknown as SplitInternals;
  return split?.containerEl instanceof HTMLElement ? split.containerEl : null;
}
