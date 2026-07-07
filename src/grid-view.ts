import {
  ItemView,
  TFile,
  setIcon,
  type WorkspaceLeaf,
} from 'obsidian';

import { collectTabs } from './tab-source.ts';
import { leafId } from './obsidian-internals.ts';
import type { PreviewProvider } from './preview.ts';
import type { TabEntry, TabxSettings } from './types.ts';

export const TABX_GRID_VIEW_TYPE = 'tabx-grid';

export class GridView extends ItemView {
  private gridEl!: HTMLElement;
  private observer: IntersectionObserver | null = null;
  private renderEpoch = 0;
  private debounce: number | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly getSettings: () => TabxSettings,
    private readonly previews: PreviewProvider,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return TABX_GRID_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Tab grid';
  }

  getIcon(): string {
    return 'layout-grid';
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('tabx-grid-content');
    this.gridEl = this.contentEl.createDiv({ cls: 'tabx-grid' });

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          this.observer?.unobserve(entry.target);
          void this.hydrate(entry.target as HTMLElement);
        }
      },
      { root: this.contentEl, rootMargin: '320px 0px' },
    );
    this.register(() => this.observer?.disconnect());

    this.registerDomEvent(this.gridEl, 'click', (event) =>
      this.onClick(event),
    );
    this.registerDomEvent(this.gridEl, 'auxclick', (event) =>
      this.onAux(event),
    );
    this.registerDomEvent(this.gridEl, 'keydown', (event) => this.onKey(event));

    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.queueRebuild()),
    );
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => this.updateActive()),
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile) this.previews.invalidate(file.path);
      }),
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        this.previews.invalidate(oldPath);
        if (file instanceof TFile) this.previews.invalidate(file.path);
        this.queueRebuild();
      }),
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile) this.previews.invalidate(file.path);
      }),
    );

    this.rebuild();
  }

  async onClose(): Promise<void> {
    if (this.debounce !== null) window.clearTimeout(this.debounce);
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Public entry point for settings-driven refresh. */
  reload(): void {
    this.rebuild();
  }

  private queueRebuild(): void {
    if (this.debounce !== null) window.clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => {
      this.debounce = null;
      this.rebuild();
    }, 50);
  }

  private rebuild(): void {
    this.renderEpoch += 1;
    this.gridEl.empty();
    const entries = collectTabs(this.app);
    const showPreview = this.getSettings().showTabPreview;
    for (const entry of entries) this.renderCard(entry, showPreview);
  }

  private renderCard(entry: TabEntry, showPreview: boolean): void {
    const card = this.gridEl.createEl('article', {
      cls: 'tabx-card',
      attr: {
        'data-leaf-id': entry.id,
        role: 'button',
        tabindex: '0',
        'aria-label': `Activate ${entry.title}`,
      },
    });
    card.toggleClass('is-active', entry.active);

    const closeButton = card.createEl('button', {
      cls: 'clickable-icon tabx-card-close',
      attr: { type: 'button', 'aria-label': `Close ${entry.title}` },
    });
    setIcon(closeButton, 'x');

    const head = card.createDiv({ cls: 'tabx-card-head' });
    const iconEl = head.createSpan({
      cls: 'tabx-card-icon',
      attr: { 'aria-hidden': 'true' },
    });
    setIcon(iconEl, entry.icon);
    const titleEl = head.createEl('h3', {
      cls: 'tabx-card-title',
      text: entry.title,
    });
    titleEl.setAttribute('title', entry.title);

    const folder = folderOf(entry.filePath);
    if (folder) card.createDiv({ cls: 'tabx-card-meta', text: folder });

    if (showPreview && entry.filePath) {
      const host = card.createDiv({
        cls: 'tabx-preview-host is-loading',
        attr: {
          'data-file': entry.filePath,
          'data-epoch': String(this.renderEpoch),
        },
      });
      host.createDiv({ cls: 'tabx-preview-skeleton' });
      this.observer?.observe(host);
    }
  }

  private async hydrate(host: HTMLElement): Promise<void> {
    const path = host.dataset.file;
    const epoch = host.dataset.epoch;
    if (!path) return;
    try {
      const preview = await this.previews.getPreview(
        path,
        this.getSettings().previewCharacters,
      );
      if (
        !host.isConnected ||
        host.dataset.epoch !== epoch ||
        epoch !== String(this.renderEpoch)
      ) {
        return;
      }
      host.empty();
      host.removeClass('is-loading');
      if (preview.empty) {
        host.createDiv({ cls: 'tabx-card-empty', text: 'Empty note' });
      } else {
        host.createDiv({ cls: 'tabx-card-preview', text: preview.excerpt });
      }
    } catch (error) {
      if (!host.isConnected) return;
      host.empty();
      host.removeClass('is-loading');
      host.createDiv({ cls: 'tabx-card-empty', text: 'Preview unavailable' });
      console.warn(`TabX could not preview ${path}`, error);
    }
  }

  private updateActive(): void {
    const activeLeaf = this.app.workspace.getMostRecentLeaf(
      this.app.workspace.rootSplit,
    );
    const activeId = activeLeaf ? leafId(activeLeaf) : null;
    for (const card of Array.from(
      this.gridEl.querySelectorAll<HTMLElement>('.tabx-card'),
    )) {
      card.toggleClass('is-active', card.dataset.leafId === activeId);
    }
  }

  private cardEntry(event: Event): { leaf: WorkspaceLeaf } | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const card = target.closest<HTMLElement>('.tabx-card');
    const id = card?.dataset.leafId;
    if (!id) return null;
    let found: WorkspaceLeaf | null = null;
    this.app.workspace.iterateRootLeaves((leaf) => {
      if (leafId(leaf) === id) found = leaf;
    });
    return found ? { leaf: found } : null;
  }

  private onClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('.tabx-card-close')) {
      const hit = this.cardEntry(event);
      if (hit) {
        event.preventDefault();
        hit.leaf.detach();
        this.rebuild();
      }
      return;
    }
    const hit = this.cardEntry(event);
    if (hit) this.activate(hit.leaf);
  }

  private onAux(event: MouseEvent): void {
    if (event.button !== 1) return;
    const hit = this.cardEntry(event);
    if (!hit) return;
    event.preventDefault();
    hit.leaf.detach();
    this.rebuild();
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches('.tabx-card')) {
      return;
    }
    const hit = this.cardEntry(event);
    if (!hit) return;
    event.preventDefault();
    this.activate(hit.leaf);
  }

  private activate(leaf: WorkspaceLeaf): void {
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    void this.app.workspace.revealLeaf(leaf);
  }
}

function folderOf(filePath: string | null): string {
  if (!filePath) return '';
  const slash = filePath.lastIndexOf('/');
  return slash > 0 ? filePath.slice(0, slash) : '';
}
