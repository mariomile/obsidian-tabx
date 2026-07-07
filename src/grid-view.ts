import { ItemView, TFile, setIcon, type WorkspaceLeaf } from 'obsidian';

import { buildTabCard } from './card-model.ts';
import { classifyTag, formatRelativeDate } from './card-format.ts';
import { collectTabs } from './tab-source.ts';
import { leafId } from './obsidian-internals.ts';
import {
  PRESENTATIONS,
  PRESENTATION_ORDER,
  type Presentation,
} from './presentation.ts';
import type { PreviewProvider } from './preview.ts';
import type { TabCard, TabxSettings } from './types.ts';

export const TABX_GRID_VIEW_TYPE = 'tabx-grid';

const DENSITY_ICONS: Record<Presentation, string> = {
  compact: 'grip',
  editorial: 'layout-grid',
  visual: 'panels-top-left',
};
const DENSITY_LABELS: Record<Presentation, string> = {
  compact: 'Compact',
  editorial: 'Editorial',
  visual: 'Visual',
};

export class GridView extends ItemView {
  private gridEl!: HTMLElement;
  private observer: IntersectionObserver | null = null;
  private renderEpoch = 0;
  private debounce: number | null = null;
  private presentation: Presentation = 'editorial';
  private readonly densityButtons = new Map<Presentation, HTMLButtonElement>();

  constructor(
    leaf: WorkspaceLeaf,
    private readonly getSettings: () => TabxSettings,
    private readonly previews: PreviewProvider,
    private readonly onPresentationChange: (
      presentation: Presentation,
    ) => Promise<void>,
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
    this.presentation = this.getSettings().presentation;
    this.buildHeader();
    this.gridEl = this.contentEl.createDiv({ cls: 'tabx-grid' });
    this.applyPresentation(this.presentation);

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

    this.registerDomEvent(this.gridEl, 'click', (event) => this.onClick(event));
    this.registerDomEvent(this.gridEl, 'auxclick', (event) => this.onAux(event));
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
    this.presentation = this.getSettings().presentation;
    this.applyPresentation(this.presentation);
    this.rebuild();
  }

  private buildHeader(): void {
    const header = this.contentEl.createDiv({ cls: 'tabx-grid-header' });
    const density = header.createDiv({
      cls: 'tabx-density',
      attr: { role: 'group', 'aria-label': 'Card density' },
    });
    for (const mode of PRESENTATION_ORDER) {
      const button = density.createEl('button', {
        cls: 'clickable-icon tabx-density-button',
        attr: {
          type: 'button',
          title: DENSITY_LABELS[mode],
          'aria-label': DENSITY_LABELS[mode],
          'aria-pressed': String(mode === this.presentation),
        },
      });
      setIcon(button, DENSITY_ICONS[mode]);
      this.registerDomEvent(button, 'click', () => {
        void this.setPresentation(mode);
      });
      this.densityButtons.set(mode, button);
    }
  }

  private applyPresentation(mode: Presentation): void {
    const def = PRESENTATIONS[mode];
    this.gridEl.dataset.presentation = mode;
    this.gridEl.style.setProperty('--tabx-card-width', `${def.cardWidth}px`);
    this.gridEl.style.setProperty(
      '--tabx-excerpt-lines',
      String(def.excerptLines),
    );
    for (const [value, button] of this.densityButtons) {
      button.setAttribute('aria-pressed', String(value === mode));
    }
  }

  private async setPresentation(mode: Presentation): Promise<void> {
    if (mode === this.presentation) return;
    this.presentation = mode;
    this.applyPresentation(mode);
    this.rebuild();
    await this.onPresentationChange(mode);
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
    const showPreview = this.getSettings().showTabPreview;
    const now = Date.now();
    for (const entry of collectTabs(this.app)) {
      this.renderCard(buildTabCard(this.app, entry), showPreview, now);
    }
  }

  private renderCard(card: TabCard, showPreview: boolean, now: number): void {
    const { entry } = card;
    const cardEl = this.gridEl.createEl('article', {
      cls: 'tabx-card',
      attr: {
        'data-leaf-id': entry.id,
        role: 'button',
        tabindex: '0',
        'aria-label': `Activate ${entry.title}`,
      },
    });
    cardEl.toggleClass('is-active', entry.active);

    const closeButton = cardEl.createEl('button', {
      cls: 'clickable-icon tabx-card-close',
      attr: { type: 'button', 'aria-label': `Close ${entry.title}` },
    });
    setIcon(closeButton, 'x');

    const body = cardEl.createDiv({ cls: 'tabx-card-body' });

    const head = body.createDiv({ cls: 'tabx-card-head' });
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

    if (card.folder || card.mtime !== null) {
      const meta = body.createDiv({ cls: 'tabx-card-meta' });
      if (card.folder) {
        meta.createSpan({ cls: 'tabx-card-folder', text: card.folder });
      }
      if (card.mtime !== null) {
        meta.createSpan({
          cls: 'tabx-card-date',
          text: formatRelativeDate(card.mtime, now),
        });
      }
    }

    if (card.tags.length > 0) {
      const tagsEl = body.createDiv({ cls: 'tabx-card-tags' });
      for (const tag of card.tags.slice(0, 4)) {
        tagsEl.createSpan({
          cls: 'tabx-tag-chip',
          text: `#${tag}`,
          attr: { 'data-tag-kind': classifyTag(tag) },
        });
      }
    }

    if (showPreview && entry.filePath) {
      const host = cardEl.createDiv({
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
      if (preview.imageUrls.length > 0) {
        this.renderImage(host, preview.imageUrls[0]);
      }
      if (preview.excerpt) {
        host.createDiv({ cls: 'tabx-card-preview', text: preview.excerpt });
      } else if (preview.imageUrls.length === 0) {
        host.createDiv({ cls: 'tabx-card-empty', text: 'Empty note' });
      }
    } catch (error) {
      if (!host.isConnected) return;
      host.empty();
      host.removeClass('is-loading');
      host.createDiv({ cls: 'tabx-card-empty', text: 'Preview unavailable' });
      console.warn(`TabX could not preview ${path}`, error);
    }
  }

  private renderImage(host: HTMLElement, url: string | undefined): void {
    if (!url) return;
    const img = host.createEl('img', {
      cls: 'tabx-card-image',
      attr: { alt: '', loading: 'lazy', decoding: 'async', src: url },
    });
    img.addEventListener('error', () => img.remove(), { once: true });
  }

  private updateActive(): void {
    const activeLeaf = this.app.workspace.getMostRecentLeaf(
      this.app.workspace.rootSplit,
    );
    const activeId = activeLeaf ? leafId(activeLeaf) : null;
    for (const cardEl of Array.from(
      this.gridEl.querySelectorAll<HTMLElement>('.tabx-card'),
    )) {
      cardEl.toggleClass('is-active', cardEl.dataset.leafId === activeId);
    }
  }

  private cardLeaf(event: Event): WorkspaceLeaf | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const cardEl = target.closest<HTMLElement>('.tabx-card');
    const id = cardEl?.dataset.leafId;
    if (!id) return null;
    let found: WorkspaceLeaf | null = null;
    this.app.workspace.iterateRootLeaves((leaf) => {
      if (leafId(leaf) === id) found = leaf;
    });
    return found;
  }

  private onClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('.tabx-card-close')) {
      const leaf = this.cardLeaf(event);
      if (leaf) {
        event.preventDefault();
        leaf.detach();
        this.rebuild();
      }
      return;
    }
    const leaf = this.cardLeaf(event);
    if (leaf) this.activate(leaf);
  }

  private onAux(event: MouseEvent): void {
    if (event.button !== 1) return;
    const leaf = this.cardLeaf(event);
    if (!leaf) return;
    event.preventDefault();
    leaf.detach();
    this.rebuild();
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches('.tabx-card')) {
      return;
    }
    const leaf = this.cardLeaf(event);
    if (!leaf) return;
    event.preventDefault();
    this.activate(leaf);
  }

  private activate(leaf: WorkspaceLeaf): void {
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    void this.app.workspace.revealLeaf(leaf);
  }
}
