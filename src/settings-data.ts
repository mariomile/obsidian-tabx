import { resolvePresentation } from './presentation.ts';
import { resolveSort } from './grid-filter.ts';
import type { TabxSettings } from './types.ts';

export const DEFAULT_SETTINGS: TabxSettings = {
  autoHide: false,
  scrollTabBar: true,
  minTabWidth: 120,
  showTabPreview: true,
  showTags: true,
  previewCharacters: 240,
  presentation: 'editorial',
  tabBarButton: true,
  sort: 'tab-order',
};

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function parseSettings(raw: unknown): TabxSettings {
  const data = (
    raw && typeof raw === 'object' ? raw : {}
  ) as Record<string, unknown>;
  return {
    autoHide: bool(data.autoHide, DEFAULT_SETTINGS.autoHide),
    scrollTabBar: bool(data.scrollTabBar, DEFAULT_SETTINGS.scrollTabBar),
    minTabWidth: clampInt(data.minTabWidth, DEFAULT_SETTINGS.minTabWidth, 60, 400),
    showTabPreview: bool(data.showTabPreview, DEFAULT_SETTINGS.showTabPreview),
    showTags: bool(data.showTags, DEFAULT_SETTINGS.showTags),
    previewCharacters: clampInt(
      data.previewCharacters,
      DEFAULT_SETTINGS.previewCharacters,
      40,
      2000,
    ),
    presentation: resolvePresentation(
      data.presentation,
      DEFAULT_SETTINGS.presentation,
    ),
    tabBarButton: bool(data.tabBarButton, DEFAULT_SETTINGS.tabBarButton),
    sort: resolveSort(data.sort, DEFAULT_SETTINGS.sort),
  };
}
