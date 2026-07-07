import type { App } from 'obsidian';

import { leftSidedockEl, leftSplit } from './obsidian-internals.ts';
import type { TabxSettings } from './types.ts';

/**
 * Hover-to-reveal for the left sidebar. When enabled, the sidebar collapses
 * and a thin hot-zone on the left screen edge expands it on hover; leaving the
 * sidebar re-collapses it after a short delay. Uses Obsidian's native
 * collapse/expand (already CSS-transitioned) — no polling, no rAF.
 */
export class AutoHideController {
  private hotzone: HTMLElement | null = null;
  private timer: number | null = null;
  private cleanups: Array<() => void> = [];

  constructor(
    private readonly app: App,
    private readonly getSettings: () => TabxSettings,
  ) {}

  enable(): void {
    if (this.hotzone) return;
    const split = leftSplit(this.app);
    const dock = leftSidedockEl(this.app);
    if (!split || !dock) return;

    const zone = document.body.createDiv({ cls: 'tabx-hotzone' });
    this.hotzone = zone;

    const onZoneEnter = (): void => {
      this.clearTimer();
      split.expand();
    };
    const onDockLeave = (): void => {
      this.clearTimer();
      this.timer = window.setTimeout(
        () => split.collapse(),
        this.getSettings().autoHideDelay,
      );
    };
    const onDockEnter = (): void => this.clearTimer();

    zone.addEventListener('mouseenter', onZoneEnter);
    dock.addEventListener('mouseleave', onDockLeave);
    dock.addEventListener('mouseenter', onDockEnter);

    this.cleanups = [
      () => zone.removeEventListener('mouseenter', onZoneEnter),
      () => dock.removeEventListener('mouseleave', onDockLeave),
      () => dock.removeEventListener('mouseenter', onDockEnter),
    ];

    split.collapse();
  }

  disable(): void {
    this.clearTimer();
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    this.hotzone?.remove();
    this.hotzone = null;
    leftSplit(this.app)?.expand();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
