import { setIcon, type App } from 'obsidian';

const MARK = 'tabx-tabbar-grid';

/**
 * Injects a "Open tab grid" button into the native main-area tab bar, next to
 * the built-in "+" new-tab button. Obsidian rebuilds that container on layout
 * changes, so `mount()` is idempotent and meant to be re-run on layout-change.
 * Main window only (popout windows are not handled in v1).
 */
export class TabBarButtonManager {
  constructor(
    private readonly app: App,
    private readonly onClick: () => void,
  ) {}

  refresh(enabled: boolean): void {
    if (enabled) this.mount();
    else this.unmount();
  }

  mount(): void {
    const containers = document.querySelectorAll<HTMLElement>(
      '.mod-root .workspace-tab-header-container',
    );
    for (const container of Array.from(containers)) {
      if (container.querySelector(`.${MARK}`)) continue;

      const wrap = createDiv({
        cls: `workspace-tab-header-tab-list ${MARK}`,
      });
      const button = wrap.createDiv({
        cls: 'clickable-icon',
        attr: {
          'aria-label': 'Open tab grid',
          'data-tooltip-position': 'bottom',
        },
      });
      setIcon(button, 'layout-grid');
      button.addEventListener('click', () => this.onClick());

      const newTab = container.querySelector('.workspace-tab-header-new-tab');
      if (newTab) newTab.insertAdjacentElement('afterend', wrap);
      else container.appendChild(wrap);
    }
  }

  unmount(): void {
    for (const el of Array.from(document.querySelectorAll(`.${MARK}`))) {
      el.remove();
    }
  }
}
