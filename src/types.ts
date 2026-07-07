import type { WorkspaceLeaf } from 'obsidian';
import type { Presentation } from './presentation.ts';

export interface TabxSettings {
  autoHide: boolean;
  autoHideDelay: number;
  scrollTabBar: boolean;
  minTabWidth: number;
  showTabPreview: boolean;
  previewCharacters: number;
  presentation: Presentation;
  tabBarButton: boolean;
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
  imageUrls: string[];
  empty: boolean;
}

/** Synchronous, file-derived metadata for a grid card (tags, folder, date). */
export interface TabCard {
  entry: TabEntry;
  folder: string;
  mtime: number | null;
  tags: string[];
}
