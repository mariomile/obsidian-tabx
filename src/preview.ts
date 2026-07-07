import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import type { TabPreview } from './types.ts';
import { buildExcerpt } from './excerpt.ts';

export class TabPreviewService {
  private readonly cache = new Map<string, TabPreview>();

  constructor(
    private readonly app: App,
    private readonly maxCacheEntries = 64,
  ) {}

  async getPreview(filePath: string, maxChars: number): Promise<TabPreview> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile) || file.extension !== 'md') {
      return { excerpt: '', empty: true };
    }
    const key = `${filePath}:${file.stat.mtime}:${maxChars}`;
    const cached = this.cache.get(key);
    if (cached) {
      // Refresh LRU recency.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const source = await this.app.vault.cachedRead(file);
    const excerpt = buildExcerpt(source, maxChars);
    const preview: TabPreview = { excerpt, empty: excerpt.length === 0 };
    this.cache.set(key, preview);
    this.prune();
    return preview;
  }

  invalidate(path?: string): void {
    if (!path) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${path}:`)) this.cache.delete(key);
    }
  }

  private prune(): void {
    while (this.cache.size > this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (!oldest) return;
      this.cache.delete(oldest);
    }
  }
}
