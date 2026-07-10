import { PluginSettingTab, Setting, type App } from 'obsidian';

import type TabxPlugin from './main.ts';
import { resolvePresentation } from './presentation.ts';
import { GRID_SORTS, resolveSort } from './grid-filter.ts';

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

    new Setting(containerEl).setName('Tab bar').setHeading();

    new Setting(containerEl)
      .setName('Auto-hide tab bar')
      .setDesc(
        'Hide the horizontal note tab bar and reveal it on hover at the top of the pane.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoHide).onChange(async (value) => {
          this.plugin.settings.autoHide = value;
          await this.plugin.saveSettings();
          this.plugin.applyAutoHide();
        }),
      );

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

    new Setting(containerEl)
      .setName('Tab grid button in tab bar')
      .setDesc('Show a button in the main tab bar that opens the tab grid.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.tabBarButton)
          .onChange(async (value) => {
            this.plugin.settings.tabBarButton = value;
            await this.plugin.saveSettings();
            this.plugin.applyTabBarButton();
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
      .setName('Default sort')
      .setDesc('Initial sort order for the tab grid.')
      .addDropdown((dropdown) => {
        for (const option of GRID_SORTS) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown
          .setValue(this.plugin.settings.sort)
          .onChange(async (value) => {
            this.plugin.settings.sort = resolveSort(value);
            await this.plugin.saveSettings();
            this.plugin.refreshGrids();
          });
      });

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
      .setName('Show tags')
      .setDesc('Display up to four tags per card in the tab grid.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showTags)
          .onChange(async (value) => {
            this.plugin.settings.showTags = value;
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
