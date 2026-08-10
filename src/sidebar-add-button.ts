import { Menu, setIcon } from 'obsidian';
import type { App } from 'obsidian';

import {
  commandIds,
  executeCommand,
  fileBackedViewTypes,
  registeredViewTypes,
} from './obsidian-internals.ts';
import { buildSidebarMenu, type MenuEntry } from './sidebar-add-menu.ts';

const MARK = 'tabx-sidebar-add';

/**
 * Injects a "+" at the end of the right sidebar's tab-header strip, so panes
 * can be added where their icons already live — the way a tab bar's "+" adds
 * a tab. Without it, opening a sidebar view means knowing its command name.
 *
 * Obsidian rebuilds the header container on layout changes, so `mount()` is
 * idempotent and meant to be re-run on layout-change — same contract as
 * `TabBarButtonManager`, which does this for the main tab bar. Main window
 * only; popout windows are out of scope, as they are for that button.
 */
export class SidebarAddButtonManager {
  constructor(private readonly app: App) {}

  refresh(enabled: boolean): void {
    if (enabled) this.mount();
    else this.unmount();
  }

  mount(): void {
    const containers = document.querySelectorAll<HTMLElement>(
      '.mod-right-split .workspace-tab-header-container',
    );
    for (const container of Array.from(containers)) {
      if (container.querySelector(`.${MARK}`)) continue;

      // Deliberately NOT `workspace-tab-header-tab-list`: Obsidian hides that
      // class outside the main split, so reusing it here mounts an invisible
      // button. The child keeps `clickable-icon`, which is what carries the
      // native look (and lets a theme skin it for free).
      const wrap = createDiv({ cls: MARK });
      // Right after the icon strip, before the flexible spacer — appending to
      // the container instead would push the "+" past the spacer AND past the
      // sidebar-toggle button, landing it in the far corner with a gap where
      // the tabs are.
      const inner = container.querySelector('.workspace-tab-header-container-inner');
      if (inner) inner.insertAdjacentElement('afterend', wrap);
      else container.appendChild(wrap);
      const button = wrap.createDiv({
        cls: 'clickable-icon',
        attr: {
          'aria-label': 'Add a pane',
          'data-tooltip-position': 'bottom',
          role: 'button',
          tabindex: '0',
        },
      });
      setIcon(button, 'plus');
      button.addEventListener('click', (event) => this.showMenu(event));
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        button.click();
      });
    }
  }

  unmount(): void {
    for (const el of Array.from(document.querySelectorAll(`.${MARK}`))) el.remove();
  }

  private showMenu(event: MouseEvent): void {
    const { featured, views } = buildSidebarMenu({
      registered: registeredViewTypes(this.app),
      fileBacked: fileBackedViewTypes(this.app),
      openInSidebars: this.openInSidebars(),
      commands: commandIds(this.app),
    });

    const menu = new Menu();
    for (const entry of featured) {
      menu.addItem((item) =>
        item
          .setTitle(entry.label)
          .setIcon(entry.icon)
          .onClick(() => void this.open(entry)),
      );
    }
    if (featured.length > 0 && views.length > 0) menu.addSeparator();
    for (const entry of views) {
      menu.addItem((item) =>
        item
          .setTitle(entry.label)
          .setIcon(entry.icon)
          .onClick(() => void this.open(entry)),
      );
    }
    menu.showAtMouseEvent(event);
  }

  /** View types already mounted in either sidebar. `getRoot()` is the public
   *  way to ask which split a leaf belongs to, so this needs no internals. */
  private openInSidebars(): string[] {
    const { workspace } = this.app;
    const types = new Set<string>();
    workspace.iterateAllLeaves((leaf) => {
      const root = leaf.getRoot();
      if (root === workspace.leftSplit || root === workspace.rightSplit) {
        types.add(leaf.view.getViewType());
      }
    });
    return [...types];
  }

  private async open(entry: MenuEntry): Promise<void> {
    if (entry.commandId) {
      executeCommand(this.app, entry.commandId);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: entry.type, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
