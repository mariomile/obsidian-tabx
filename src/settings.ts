import { PluginSettingTab, Setting, type App } from 'obsidian';

import type TabxPlugin from './main.ts';
import { resolvePresentation } from './presentation.ts';

export { DEFAULT_SETTINGS, parseSettings } from './settings-data.ts';

export class TabxSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: TabxPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Sidebar').setHeading();

    new Setting(containerEl)
      .setName('Auto-hide left sidebar')
      .setDesc(
        'Collapse the left sidebar and reveal it on hover at the screen edge. Note: this hides the entire left sidebar, not just the tab rail.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoHide).onChange(async (value) => {
          this.plugin.settings.autoHide = value;
          await this.plugin.saveSettings();
          this.plugin.applyAutoHide();
        }),
      );

    new Setting(containerEl)
      .setName('Auto-hide delay')
      .setDesc('Milliseconds to wait before collapsing after leaving the sidebar.')
      .addSlider((slider) =>
        slider
          .setLimits(0, 1500, 50)
          .setValue(this.plugin.settings.autoHideDelay)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.autoHideDelay = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl).setName('Tab bar').setHeading();

    new Setting(containerEl)
      .setName('Scrolling horizontal tab bar')
      .setDesc(
        'Let the native top tab bar scroll horizontally instead of shrinking each tab.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.scrollTabBar)
          .onChange(async (value) => {
            this.plugin.settings.scrollTabBar = value;
            await this.plugin.saveSettings();
            this.plugin.applyTabBarStyle();
          }),
      );

    new Setting(containerEl)
      .setName('Minimum tab width')
      .setDesc('Pixels each tab keeps before the bar scrolls.')
      .addSlider((slider) =>
        slider
          .setLimits(60, 400, 10)
          .setValue(this.plugin.settings.minTabWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.minTabWidth = value;
            await this.plugin.saveSettings();
            this.plugin.applyTabBarStyle();
          }),
      );

    new Setting(containerEl).setName('Grid').setHeading();

    new Setting(containerEl)
      .setName('Default card density')
      .setDesc('Initial layout for the tab grid.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            compact: 'Compact',
            editorial: 'Editorial',
            visual: 'Visual',
          })
          .setValue(this.plugin.settings.presentation)
          .onChange(async (value) => {
            this.plugin.settings.presentation = resolvePresentation(value);
            await this.plugin.saveSettings();
            this.plugin.refreshGrids();
          }),
      );

    new Setting(containerEl)
      .setName('Show card previews')
      .setDesc('Load a short excerpt on each card in the tab grid.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showTabPreview)
          .onChange(async (value) => {
            this.plugin.settings.showTabPreview = value;
            await this.plugin.saveSettings();
            this.plugin.refreshGrids();
          }),
      );

    new Setting(containerEl)
      .setName('Preview length')
      .setDesc('Maximum characters loaded per card excerpt.')
      .addSlider((slider) =>
        slider
          .setLimits(40, 600, 20)
          .setValue(this.plugin.settings.previewCharacters)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.previewCharacters = value;
            await this.plugin.saveSettings();
            this.plugin.refreshGrids();
          }),
      );
  }
}
