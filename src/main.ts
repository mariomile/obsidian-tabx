import { Plugin, addIcon } from 'obsidian';

import { GridView, TABX_GRID_VIEW_TYPE } from './grid-view.ts';
import { RailView, TABX_RAIL_VIEW_TYPE } from './rail-view.ts';
import { TabPreviewService } from './preview.ts';
import { TabBarButtonManager } from './tabbar-button.ts';
import { DEFAULT_SETTINGS, parseSettings, TabxSettingTab } from './settings.ts';
import type { TabxSettings } from './types.ts';

// Huge Icons (hugeicons.com, free/MIT, Stroke Rounded, 24x24 grid) — matches
// the hi-* set already used elsewhere in the suite (Sonar, Horizon, Portal).
// addIcon() always wraps content in a fixed viewBox="0 0 100 100", so a
// 4.166667x scale (100/24) fills it correctly.
addIcon(
  'hi-square-stack',
  '<g transform="scale(4.166667)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">' +
    '<path d="M20.728 14.365C21 14.9 21 15.6 21 17s0 2.1-.273 2.635a2.5 2.5 0 0 1-1.092 1.092C19.1 21 18.4 21 17 21s-2.1 0-2.635-.273a2.5 2.5 0 0 1-1.092-1.092C13 19.1 13 18.4 13 17s0-2.1.273-2.635a2.5 2.5 0 0 1 1.092-1.092C14.9 13 15.6 13 17 13s2.1 0 2.635.273a2.5 2.5 0 0 1 1.092 1.092M15.924 10a2.1 2.1 0 0 0-.197-.635a2.5 2.5 0 0 0-1.092-1.093C14.1 8 13.4 8 12 8s-2.1 0-2.635.272a2.5 2.5 0 0 0-1.093 1.093C8 9.9 8 10.6 8 12s0 2.1.272 2.635a2.5 2.5 0 0 0 1.093 1.092c.185.095.389.156.635.197M10.924 5a2.1 2.1 0 0 0-.197-.635a2.5 2.5 0 0 0-1.092-1.093C9.1 3 8.4 3 7 3s-2.1 0-2.635.272a2.5 2.5 0 0 0-1.093 1.093C3 4.9 3 5.6 3 7s0 2.1.272 2.635a2.5 2.5 0 0 0 1.093 1.092c.185.095.389.156.635.197"/>' +
    '</g>',
);

export default class TabxPlugin extends Plugin {
  settings: TabxSettings = { ...DEFAULT_SETTINGS };
  previewService!: TabPreviewService;
  private tabBarButton!: TabBarButtonManager;

  async onload(): Promise<void> {
    this.settings = parseSettings(await this.loadData());
    this.previewService = new TabPreviewService(this.app);
    this.tabBarButton = new TabBarButtonManager(this.app, () =>
      void this.openGrid(),
    );

    this.registerHoverLinkSource('tabx', {
      display: 'TabX',
      defaultMod: true,
    });

    this.registerView(
      TABX_RAIL_VIEW_TYPE,
      (leaf) => new RailView(leaf, () => void this.openGrid()),
    );
    this.registerView(
      TABX_GRID_VIEW_TYPE,
      (leaf) =>
        new GridView(
          leaf,
          () => this.settings,
          this.previewService,
          async (presentation) => {
            this.settings.presentation = presentation;
            await this.saveSettings();
          },
          async (sort) => {
            this.settings.sort = sort;
            await this.saveSettings();
          },
        ),
    );

    this.addRibbonIcon('hi-square-stack', 'Open tab rail', () => {
      void this.openRail();
    });
    this.addCommand({
      id: 'open-rail',
      name: 'Open tab rail',
      callback: () => void this.openRail(),
    });
    this.addCommand({
      id: 'open-grid',
      name: 'Open tab grid',
      callback: () => void this.openGrid(),
    });
    this.addCommand({
      id: 'toggle-autohide',
      name: 'Toggle tab bar auto-hide',
      callback: () => {
        void this.toggleAutoHide();
      },
    });

    this.addSettingTab(new TabxSettingTab(this.app, this));

    this.applyTabBarStyle();
    this.applyAutoHide();
    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.applyTabBarButton()),
    );
    this.app.workspace.onLayoutReady(() => this.applyTabBarButton());
  }

  onunload(): void {
    this.tabBarButton.unmount();
    document.body.removeClass('tabx-scroll-tabs');
    document.body.removeClass('tabx-autohide-tabs');
    document.body.style.removeProperty('--tabx-min-tab-width');
    this.previewService.invalidate();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  applyTabBarStyle(): void {
    document.body.toggleClass('tabx-scroll-tabs', this.settings.scrollTabBar);
    document.body.style.setProperty(
      '--tabx-min-tab-width',
      `${this.settings.minTabWidth}px`,
    );
  }

  applyAutoHide(): void {
    document.body.toggleClass('tabx-autohide-tabs', this.settings.autoHide);
  }

  applyTabBarButton(): void {
    this.tabBarButton.refresh(this.settings.tabBarButton);
  }

  refreshGrids(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(
      TABX_GRID_VIEW_TYPE,
    )) {
      const view = leaf.view;
      if (view instanceof GridView) view.reload();
    }
  }

  private async toggleAutoHide(): Promise<void> {
    this.settings.autoHide = !this.settings.autoHide;
    await this.saveSettings();
    this.applyAutoHide();
  }

  async openRail(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(TABX_RAIL_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeftLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: TABX_RAIL_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async openGrid(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(TABX_GRID_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: TABX_GRID_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}
