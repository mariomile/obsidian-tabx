import { ItemView, Menu, TFile, setIcon, type WorkspaceLeaf } from 'obsidian';

import { buildTabCard } from './card-model.ts';
import { classifyTag, formatRelativeDate } from './card-format.ts';
import { collectTabs } from './tab-source.ts';
import {
  GRID_SORTS,
  matchesQuery,
  sortCards,
  type GridSort,
} from './grid-filter.ts';
import { assignColumns, computeColumnCount } from './masonry-layout.ts';
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
  private cardEls: HTMLElement[] = [];
  private columnCount = 0;
  private lastPolledWidth = -1;
  private renderEpoch = 0;
  private debounce: number | null = null;
  private searchTimer: number | null = null;
  private presentation: Presentation = 'editorial';
  private sort: GridSort = 'tab-order';
  private query = '';
  private allCards: TabCard[] = [];
  private sortButton: HTMLButtonElement | null = null;
  private readonly densityButtons = new Map<Presentation, HTMLButtonElement>();

  constructor(
    leaf: WorkspaceLeaf,
    private readonly getSettings: () => TabxSettings,
    private readonly previews: PreviewProvider,
    private readonly onPresentationChange: (
      presentation: Presentation,
    ) => Promise<void>,
    private readonly onSortChange: (sort: GridSort) => Promise<void>,
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
    this.sort = this.getSettings().sort;
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

    // Column-count updates are driven by ONE settle-based poll — deliberately
    // not ResizeObserver / onResize / workspace 'resize'. Those fire on every
    // frame of a sidebar-toggle animation, and redistributing (empty + rebuild
    // columns) mid-animation is a heavy DOM teardown that drops frames and
    // looks janky. Instead we let the flex columns track the width smoothly via
    // pure CSS during the animation, and only recompute the column count once
    // the width has settled. setInterval is also a timer task, so it is immune
    // to Obsidian's render-loop starvation.
    this.registerInterval(
      window.setInterval(() => this.pollLayout(), 100),
    );

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
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Public entry point for settings-driven refresh. */
  reload(): void {
    this.presentation = this.getSettings().presentation;
    this.sort = this.getSettings().sort;
    this.applyPresentation(this.presentation);
    this.updateSortLabel();
    this.rebuild();
  }

  private buildHeader(): void {
    const header = this.contentEl.createDiv({ cls: 'tabx-grid-header' });

    const searchWrap = header.createDiv({ cls: 'tabx-search' });
    const searchIcon = searchWrap.createSpan({
      cls: 'tabx-search-icon',
      attr: { 'aria-hidden': 'true' },
    });
    setIcon(searchIcon, 'search');
    const search = searchWrap.createEl('input', {
      cls: 'tabx-search-input',
      type: 'search',
      placeholder: 'Search tabs…',
      attr: { 'aria-label': 'Search tabs' },
    });
    this.registerDomEvent(search, 'input', () => {
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.searchTimer = null;
        this.query = search.value;
        this.renderCards();
      }, 120);
    });

    const controls = header.createDiv({ cls: 'tabx-grid-controls' });

    this.sortButton = controls.createEl('button', {
      cls: 'clickable-icon tabx-sort-button',
      attr: { type: 'button', 'aria-label': 'Sort tabs' },
    });
    setIcon(this.sortButton, 'arrow-up-down');
    this.updateSortLabel();
    this.registerDomEvent(this.sortButton, 'click', (event) => {
      this.openSortMenu(event);
    });

    const density = controls.createDiv({
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
    this.renderCards();
    await this.onPresentationChange(mode);
  }

  private updateSortLabel(): void {
    const label =
      GRID_SORTS.find((option) => option.value === this.sort)?.label ??
      'Sort tabs';
    this.sortButton?.setAttribute('aria-label', `Sort: ${label}`);
    this.sortButton?.setAttribute('title', `Sort: ${label}`);
  }

  private openSortMenu(event: MouseEvent): void {
    const menu = new Menu();
    for (const option of GRID_SORTS) {
      menu.addItem((item) => {
        item
          .setTitle(option.label)
          .setChecked(option.value === this.sort)
          .onClick(() => {
            void this.setSort(option.value);
          });
      });
    }
    menu.showAtMouseEvent(event);
  }

  private async setSort(sort: GridSort): Promise<void> {
    if (sort === this.sort) return;
    this.sort = sort;
    this.updateSortLabel();
    this.renderCards();
    await this.onSortChange(sort);
  }

  private queueRebuild(): void {
    if (this.debounce !== null) window.clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => {
      this.debounce = null;
      this.rebuild();
    }, 50);
  }

  /** Re-collect the open tabs, then filter/sort/render them. */
  private rebuild(): void {
    this.allCards = collectTabs(this.app).map((entry) =>
      buildTabCard(this.app, entry),
    );
    this.renderCards();
  }

  /** Render the current cards through the active query + sort (no re-collect). */
  private renderCards(): void {
    this.renderEpoch += 1;
    const showPreview = this.getSettings().showTabPreview;
    const showTags = this.getSettings().showTags;
    const now = Date.now();
    const visible = sortCards(
      this.allCards.filter((card) => matchesQuery(card, this.query)),
      this.sort,
    );
    if (visible.length === 0) {
      this.cardEls = [];
      this.columnCount = 0;
      this.gridEl.empty();
      this.renderEmpty();
      return;
    }
    // Build the card elements detached, then let layout() distribute them into
    // flex columns. Cards live in normal flow inside their column — no absolute
    // positioning, no transforms, no height measurement — so the layout can
    // never break into an unpositioned pile the way the old JS masonry could.
    this.cardEls = visible.map((card) =>
      this.renderCard(card, showPreview, showTags, now),
    );
    this.columnCount = 0;
    this.layout();
  }

  /**
   * Poll (every 100ms) that only recomputes columns once the width has SETTLED:
   * while the width is still changing (a sidebar-toggle animation in flight) it
   * does nothing, letting the flex columns track the width smoothly via CSS. It
   * redistributes only after the width holds steady for one tick, so the heavy
   * empty+rebuild happens once, after the animation — never mid-frame.
   */
  private pollLayout(): void {
    const width = this.gridEl.clientWidth;
    if (width <= 0) return;
    if (width !== this.lastPolledWidth) {
      this.lastPolledWidth = width; // still resizing — wait for it to settle
      return;
    }
    this.layout();
  }

  /**
   * Distribute cards into flex columns. Round-robin (card i → column i % N)
   * keeps the first row left-to-right in tab order; each column stacks its
   * cards with flexbox so there are no vertical gaps. Column widths and vertical
   * stacking are pure CSS, so a missed resize leaves a valid (if not ideal)
   * layout, never a broken one.
   */
  private layout(): void {
    if (this.cardEls.length === 0) return;

    const style = getComputedStyle(this.gridEl);
    const availableWidth =
      this.gridEl.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);

    const def = PRESENTATIONS[this.presentation];
    // Hidden pane (width 0) → keep one column; redistributes on show. Cards
    // stay in the DOM either way, so nothing ever vanishes or piles up.
    const n =
      availableWidth > 0
        ? computeColumnCount(availableWidth, def.cardWidth, def.gridGap)
        : Math.max(1, this.columnCount);
    if (n === this.columnCount) return; // column count unchanged — nothing to do
    this.columnCount = n;

    const assignment = assignColumns(this.cardEls.length, n);
    this.gridEl.empty();
    const columns: HTMLElement[] = [];
    for (let i = 0; i < n; i++) {
      columns.push(this.gridEl.createDiv({ cls: 'tabx-col' }));
    }
    this.cardEls.forEach((cardEl, i) => {
      columns[assignment[i]!]!.appendChild(cardEl);
    });
  }

  private renderEmpty(): void {
    const empty = this.gridEl.createDiv({ cls: 'tabx-grid-empty' });
    const icon = empty.createSpan({
      cls: 'tabx-grid-empty-icon',
      attr: { 'aria-hidden': 'true' },
    });
    setIcon(icon, 'search-x');
    empty.createEl('p', {
      text: this.query
        ? 'No open tabs match your search.'
        : 'No open tabs.',
    });
  }

  private renderCard(
    card: TabCard,
    showPreview: boolean,
    showTags: boolean,
    now: number,
  ): HTMLElement {
    const { entry } = card;
    const cardEl = createEl('article', {
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

    if (showTags && card.tags.length > 0) {
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
    } else if (showPreview) {
      // Non-file tabs (plugin views, empty tabs, web viewers) have no content
      // to preview. Give them a poster — the tab's own glyph on a tinted
      // surface — so the card reads as an intentional tile, not an empty stub.
      const poster = cardEl.createDiv({ cls: 'tabx-card-poster' });
      const glyph = poster.createSpan({
        cls: 'tabx-card-poster-glyph',
        attr: { 'aria-hidden': 'true' },
      });
      setIcon(glyph, entry.icon);
    }

    return cardEl;
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
      // No relayout needed: the card lives in a flex column, so its column
      // re-stacks automatically when the content changes height.
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
