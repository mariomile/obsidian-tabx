import { resolvePresentation } from './presentation.ts';
import type { TabxSettings } from './types.ts';

export const DEFAULT_SETTINGS: TabxSettings = {
  autoHide: false,
  autoHideDelay: 250,
  scrollTabBar: true,
  minTabWidth: 120,
  showTabPreview: true,
  previewCharacters: 240,
  presentation: 'editorial',
  tabBarButton: true,
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
    autoHideDelay: clampInt(
      data.autoHideDelay,
      DEFAULT_SETTINGS.autoHideDelay,
      0,
      3000,
    ),
    scrollTabBar: bool(data.scrollTabBar, DEFAULT_SETTINGS.scrollTabBar),
    minTabWidth: clampInt(data.minTabWidth, DEFAULT_SETTINGS.minTabWidth, 60, 400),
    showTabPreview: bool(data.showTabPreview, DEFAULT_SETTINGS.showTabPreview),
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
  };
}
