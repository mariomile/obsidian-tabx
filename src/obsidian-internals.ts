import type { WorkspaceLeaf } from 'obsidian';

/**
 * Typed accessors for Obsidian internals that are not part of the public
 * `obsidian` typings. Keeping every unsafe cast in this one file lets the
 * rest of the codebase stay `no-explicit-any` clean.
 */

interface LeafInternals {
  id?: string;
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
