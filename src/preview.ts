import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import type { TabPreview } from './types.ts';
import { buildExcerpt } from './excerpt.ts';

export interface PreviewProvider {
  getPreview(filePath: string, maxChars: number): Promise<TabPreview>;
  invalidate(path?: string): void;
}

const IMAGE_EXTENSIONS = new Set([
  'avif',
  'bmp',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
]);

const EMPTY: TabPreview = { excerpt: '', imageUrls: [], empty: true };

export class TabPreviewService implements PreviewProvider {
  private readonly cache = new Map<string, TabPreview>();

  constructor(
    private readonly app: App,
    private readonly maxCacheEntries = 64,
  ) {}

  async getPreview(filePath: string, maxChars: number): Promise<TabPreview> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile) || file.extension !== 'md') return EMPTY;

    const key = `${filePath}:${file.stat.mtime}:${maxChars}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    const source = await this.app.vault.cachedRead(file);
    const excerpt = buildExcerpt(source, maxChars);
    const imageUrls = this.findImageUrls(file);
    const preview: TabPreview = {
      excerpt,
      imageUrls,
      empty: excerpt.length === 0 && imageUrls.length === 0,
    };

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

  /** Local vault images only (cover frontmatter + embeds); no network fetches. */
  private findImageUrls(file: TFile): string[] {
    const cache = this.app.metadataCache.getFileCache(file);
    const urls: string[] = [];
    const add = (url: string | undefined): void => {
      if (url && !urls.includes(url)) urls.push(url);
    };

    for (const property of ['cover', 'image', 'thumbnail'] as const) {
      const candidate = normalizeCandidate(cache?.frontmatter?.[property]);
      if (candidate) add(this.resolveVaultImage(candidate, file.path));
    }

    for (const embed of cache?.embeds ?? []) {
      const dest = this.app.metadataCache.getFirstLinkpathDest(
        embed.link,
        file.path,
      );
      if (dest instanceof TFile && IMAGE_EXTENSIONS.has(dest.extension.toLowerCase())) {
        add(this.app.vault.getResourcePath(dest));
      }
    }

    return urls;
  }

  private resolveVaultImage(
    candidate: string,
    sourcePath: string,
  ): string | undefined {
    if (/^https?:\/\//i.test(candidate)) return undefined; // skip remote
    const dest = this.app.metadataCache.getFirstLinkpathDest(
      candidate,
      sourcePath,
    );
    if (dest instanceof TFile && IMAGE_EXTENSIONS.has(dest.extension.toLowerCase())) {
      return this.app.vault.getResourcePath(dest);
    }
    return undefined;
  }

  private prune(): void {
    while (this.cache.size > this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (!oldest) return;
      this.cache.delete(oldest);
    }
  }
}

function normalizeCandidate(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeCandidate(item);
      if (normalized) return normalized;
    }
    return undefined;
  }
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const wikilink = trimmed.match(/^!?\[\[([^\]]+)\]\]$/);
  if (wikilink?.[1]) return wikilink[1].split('|')[0]?.trim() || undefined;
  return trimmed.replace(/^['"]|['"]$/g, '').trim() || undefined;
}
