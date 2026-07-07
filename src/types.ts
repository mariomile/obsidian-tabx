import type { WorkspaceLeaf } from 'obsidian';

export interface TabxSettings {
  autoHide: boolean;
  autoHideDelay: number;
  scrollTabBar: boolean;
  minTabWidth: number;
  showTabPreview: boolean;
  previewCharacters: number;
}

export interface TabEntry {
  id: string;
  leaf: WorkspaceLeaf;
  title: string;
  icon: string;
  filePath: string | null;
  pinned: boolean;
  active: boolean;
}

export interface TabPreview {
  excerpt: string;
  empty: boolean;
}
