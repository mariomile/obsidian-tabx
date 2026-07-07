import { Plugin } from 'obsidian';

import { AutoHideController } from './autohide.ts';
import { GridView, TABX_GRID_VIEW_TYPE } from './grid-view.ts';
import { RailView, TABX_RAIL_VIEW_TYPE } from './rail-view.ts';
import { TabPreviewService } from './preview.ts';
import { DEFAULT_SETTINGS, parseSettings, TabxSettingTab } from './settings.ts';
import type { TabxSettings } from './types.ts';

export default class TabxPlugin extends Plugin {
  settings: TabxSettings = { ...DEFAULT_SETTINGS };
  previewService!: TabPreviewService;
  private autoHide!: AutoHideController;

  async onload(): Promise<void> {
    this.settings = parseSettings(await this.loadData());
    this.previewService = new TabPreviewService(this.app);
    this.autoHide = new AutoHideController(this.app, () => this.settings);

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
        ),
    );

    this.addRibbonIcon('gallery-vertical', 'Open tab rail', () => {
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
      name: 'Toggle sidebar auto-hide',
      callback: () => {
        void this.toggleAutoHide();
      },
    });

    this.addSettingTab(new TabxSettingTab(this.app, this));

    this.applyTabBarStyle();
    this.app.workspace.onLayoutReady(() => this.applyAutoHide());
  }

  onunload(): void {
    this.autoHide.disable();
    document.body.removeClass('tabx-scroll-tabs');
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
    if (this.settings.autoHide) this.autoHide.enable();
    else this.autoHide.disable();
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
