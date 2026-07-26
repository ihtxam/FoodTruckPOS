import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type BlockType = 'hero' | 'richtext' | 'html' | 'menu' | 'hours' | 'cta' | 'image' | 'spacer';

type CmsBlock = {
  id: string;
  type: BlockType;
  [key: string]: any;
};

type CmsPage = {
  id: string;
  title: string;
  slug: string;
  isHomepage: boolean;
  status: string;
  templateKey?: string | null;
  blocks: CmsBlock[];
  seoTitle?: string | null;
  seoDescription?: string | null;
};

type Template = { key: string; name: string; description: string };

type Site = {
  customDomain: string | null;
  cmsHomepageEnabled: boolean;
  shopEnabled: boolean;
  slug?: string | null;
  subdomain?: string | null;
  name?: string;
  shopCustomDomainUrl?: string | null;
};

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function defaultBlock(type: BlockType): CmsBlock {
  switch (type) {
    case 'hero':
      return {
        id: newId(),
        type,
        title: 'Your shop name',
        subtitle: 'A short welcome line',
        ctaLabel: 'Order now',
        ctaHref: '/menu',
        align: 'center',
      };
    case 'richtext':
      return { id: newId(), type, html: '<p>Tell your story…</p>' };
    case 'html':
      return {
        id: newId(),
        type,
        html: '<div style="padding:1rem;text-align:center">Custom HTML block</div>',
      };
    case 'menu':
      return {
        id: newId(),
        type,
        title: 'Menu',
        mode: 'full',
        showPrices: true,
        ctaLabel: 'Order online',
        ctaHref: '/menu',
      };
    case 'hours':
      return { id: newId(), type, title: 'Hours', channel: 'display' };
    case 'cta':
      return {
        id: newId(),
        type,
        title: 'Ready to order?',
        primaryLabel: 'Order now',
        primaryHref: '/menu',
      };
    case 'image':
      return { id: newId(), type, imageUrl: '', alt: '' };
    case 'spacer':
      return { id: newId(), type, size: 'md' };
    default:
      return { id: newId(), type: 'html', html: '' };
  }
}

const BLOCK_LABELS: Record<BlockType, string> = {
  hero: 'Hero',
  richtext: 'Text',
  html: 'HTML',
  menu: 'POS menu',
  hours: 'Hours',
  cta: 'Call to action',
  image: 'Image',
  spacer: 'Spacer',
};

export default function WebsiteCms() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [site, setSite] = useState<Site | null>(null);
  const [customDomain, setCustomDomain] = useState('');
  const [savingSite, setSavingSite] = useState(false);
  const [editing, setEditing] = useState<CmsPage | null>(null);
  const [savingPage, setSavingPage] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('Homepage');
  const [newTemplate, setNewTemplate] = useState('restaurant');
  const [asHomepage, setAsHomepage] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const selectedBlock = useMemo(
    () => editing?.blocks?.find((b) => b.id === selectedBlockId) || null,
    [editing, selectedBlockId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pagesRes, templatesRes, siteRes] = await Promise.all([
        api.get('/merchant/cms/pages'),
        api.get('/merchant/cms/templates'),
        api.get('/merchant/cms/site'),
      ]);
      setPages(pagesRes.data.pages || []);
      setTemplates(templatesRes.data.templates || []);
      const s = siteRes.data.site as Site;
      setSite(s);
      setCustomDomain(s.customDomain || '');
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSite = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSite(true);
    try {
      const res = await api.put('/merchant/cms/site', {
        customDomain: customDomain.trim() || null,
        cmsHomepageEnabled: site?.cmsHomepageEnabled,
      });
      setSite((prev) => ({ ...(prev || ({} as Site)), ...res.data.site }));
      toast.success(t('saved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsSaveFailed'));
    } finally {
      setSavingSite(false);
    }
  };

  const createPage = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/merchant/cms/pages', {
        title: newTitle.trim() || 'Homepage',
        isHomepage: asHomepage,
        templateKey: newTemplate,
        status: 'draft',
      });
      const page = res.data.page as CmsPage;
      setCreateOpen(false);
      setEditing({ ...page, blocks: page.blocks || [] });
      setSelectedBlockId(page.blocks?.[0]?.id || null);
      await load();
      toast.success(t('cmsPageCreated'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const openEditor = async (pageId: string) => {
    try {
      const res = await api.get(`/merchant/cms/pages/${pageId}`);
      const page = res.data.page as CmsPage;
      setEditing({ ...page, blocks: page.blocks || [] });
      setSelectedBlockId(page.blocks?.[0]?.id || null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsLoadFailed'));
    }
  };

  const updateEditing = (patch: Partial<CmsPage>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateBlock = (id: string, patch: Record<string, unknown>) => {
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      };
    });
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const idx = prev.blocks.findIndex((b) => b.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.blocks.length) return prev;
      const blocks = [...prev.blocks];
      const [item] = blocks.splice(idx, 1);
      blocks.splice(next, 0, item);
      return { ...prev, blocks };
    });
  };

  const removeBlock = (id: string) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const blocks = prev.blocks.filter((b) => b.id !== id);
      if (selectedBlockId === id) setSelectedBlockId(blocks[0]?.id || null);
      return { ...prev, blocks };
    });
  };

  const addBlock = (type: BlockType) => {
    const block = defaultBlock(type);
    setEditing((prev) => (prev ? { ...prev, blocks: [...prev.blocks, block] } : prev));
    setSelectedBlockId(block.id);
  };

  const savePage = async (status?: 'draft' | 'published') => {
    if (!editing) return;
    setSavingPage(true);
    try {
      const res = await api.put(`/merchant/cms/pages/${editing.id}`, {
        title: editing.title,
        slug: editing.slug,
        isHomepage: editing.isHomepage,
        blocks: editing.blocks,
        seoTitle: editing.seoTitle,
        seoDescription: editing.seoDescription,
        status: status || editing.status,
      });
      const page = res.data.page as CmsPage;
      setEditing({ ...page, blocks: page.blocks || [] });
      await load();
      toast.success(status === 'published' ? t('cmsPublished') : t('saved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsSaveFailed'));
    } finally {
      setSavingPage(false);
    }
  };

  const deletePage = async (pageId: string) => {
    if (!confirm(t('cmsDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/cms/pages/${pageId}`);
      if (editing?.id === pageId) setEditing(null);
      await load();
      toast.success(t('deleted'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  if (loading) {
    return <div className="p-4 text-sm muted">{t('loading')}</div>;
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button type="button" className="text-sm muted hover:underline" onClick={() => setEditing(null)}>
              ← {t('cmsBackToPages')}
            </button>
            <h1 className="text-xl font-semibold mt-1">{t('cmsPageBuilder')}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={savingPage}
              onClick={() => savePage('draft')}
            >
              {t('cmsSaveDraft')}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={savingPage}
              onClick={() => savePage('published')}
            >
              {t('cmsPublish')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-3 space-y-3">
            <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 space-y-2">
              <label className="text-xs font-medium block">{t('title')}</label>
              <input
                className="input"
                value={editing.title}
                onChange={(e) => updateEditing({ title: e.target.value })}
              />
              <label className="text-xs font-medium block">{t('cmsSlug')}</label>
              <input
                className="input"
                value={editing.slug}
                onChange={(e) => updateEditing({ slug: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm mt-2">
                <input
                  type="checkbox"
                  checked={!!editing.isHomepage}
                  onChange={(e) => updateEditing({ isHomepage: e.target.checked })}
                />
                {t('cmsIsHomepage')}
              </label>
              <p className="text-xs muted">
                {t('status')}: {editing.status}
              </p>
            </div>

            <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
              <p className="text-xs font-medium mb-2">{t('cmsBlocks')}</p>
              <ul className="space-y-1">
                {editing.blocks.map((b, i) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className={`w-full text-left text-sm px-2 py-1.5 rounded ${
                        selectedBlockId === b.id
                          ? 'bg-[var(--bg-muted)] font-medium'
                          : 'hover:bg-[var(--bg-muted)]'
                      }`}
                      onClick={() => setSelectedBlockId(b.id)}
                    >
                      {i + 1}. {BLOCK_LABELS[b.type] || b.type}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="text-xs border border-[var(--border)] rounded px-2 py-1.5 hover:bg-[var(--bg-muted)]"
                    onClick={() => addBlock(type)}
                  >
                    + {BLOCK_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 min-h-[320px]">
              <p className="text-xs font-medium muted mb-3">{t('cmsPreview')}</p>
              {editing.blocks.length === 0 && (
                <p className="text-sm muted py-8 text-center">{t('cmsEmptyBlocks')}</p>
              )}
              <div className="space-y-4">
                {editing.blocks.map((b) => (
                  <div
                    key={b.id}
                    className={`border rounded-md p-3 cursor-pointer ${
                      selectedBlockId === b.id
                        ? 'border-stone-800'
                        : 'border-[var(--border)]'
                    }`}
                    onClick={() => setSelectedBlockId(b.id)}
                  >
                    <BlockPreview block={b} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3 sticky top-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{t('cmsEditBlock')}</p>
                {selectedBlock && (
                  <div className="flex gap-1">
                    <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => moveBlock(selectedBlock.id, -1)}>
                      ↑
                    </button>
                    <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => moveBlock(selectedBlock.id, 1)}>
                      ↓
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 px-2 py-1"
                      onClick={() => removeBlock(selectedBlock.id)}
                    >
                      {t('delete')}
                    </button>
                  </div>
                )}
              </div>
              {!selectedBlock && <p className="text-sm muted">{t('cmsSelectBlock')}</p>}
              {selectedBlock && (
                <BlockEditor block={selectedBlock} onChange={(patch) => updateBlock(selectedBlock.id, patch)} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">{t('cmsWebsite')}</h1>
        <p className="text-sm muted mt-1">{t('cmsWebsiteHint')}</p>
      </div>

      <form onSubmit={saveSite} className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t('cmsCustomDomain')}</h2>
        <p className="text-xs muted">{t('cmsCustomDomainHint')}</p>
        <input
          className="input max-w-md"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          placeholder="www.mycafe.ch"
        />
        {site?.shopCustomDomainUrl && (
          <p className="text-xs">
            <a className="underline" href={site.shopCustomDomainUrl} target="_blank" rel="noreferrer">
              {site.shopCustomDomainUrl}
            </a>
          </p>
        )}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={savingSite}>
            {savingSite ? t('saving') : t('save')}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{t('cmsPages')}</h2>
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          {t('cmsNewPage')}
        </button>
      </div>

      {createOpen && (
        <form onSubmit={createPage} className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)] p-4 space-y-3">
          <label className="text-xs font-medium block">{t('title')}</label>
          <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <label className="text-xs font-medium block">{t('cmsTemplate')}</label>
          <select className="input" value={newTemplate} onChange={(e) => setNewTemplate(e.target.value)}>
            {templates.map((tpl) => (
              <option key={tpl.key} value={tpl.key}>
                {tpl.name} — {tpl.description}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asHomepage} onChange={(e) => setAsHomepage(e.target.checked)} />
            {t('cmsIsHomepage')}
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary">
              {t('create')}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {pages.length === 0 && (
          <p className="text-sm muted border border-dashed border-[var(--border)] rounded-md p-6 text-center">
            {t('cmsNoPages')}
          </p>
        )}
        {pages.map((page) => (
          <div
            key={page.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-3"
          >
            <div>
              <p className="font-medium text-sm">
                {page.title}
                {page.isHomepage && (
                  <span className="ml-2 text-xs font-normal muted">({t('cmsHomepageBadge')})</span>
                )}
              </p>
              <p className="text-xs muted">
                /{page.slug} · {page.status}
                {page.templateKey ? ` · ${page.templateKey}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => openEditor(page.id)}>
                {t('edit')}
              </button>
              <button type="button" className="text-sm text-red-600 px-2" onClick={() => deletePage(page.id)}>
                {t('delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: CmsBlock }) {
  if (block.type === 'hero') {
    return (
      <div className="text-center py-4 bg-stone-100 rounded">
        <p className="text-lg font-semibold">{block.title}</p>
        {block.subtitle && <p className="text-sm text-stone-600 mt-1">{block.subtitle}</p>}
        {block.ctaLabel && (
          <span className="inline-block mt-3 text-xs font-semibold border border-stone-800 px-3 py-1">
            {block.ctaLabel}
          </span>
        )}
      </div>
    );
  }
  if (block.type === 'menu') {
    return (
      <div>
        <p className="font-medium text-sm">{block.title || 'Menu'}</p>
        <p className="text-xs muted mt-1">
          POS catalog · {block.mode === 'featured' ? 'featured' : 'full'}
          {block.showPrices !== false ? ' · prices' : ''}
        </p>
      </div>
    );
  }
  if (block.type === 'html' || block.type === 'richtext') {
    return (
      <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: block.html || '' }} />
    );
  }
  if (block.type === 'hours') {
    return <p className="text-sm font-medium">{block.title || 'Hours'}</p>;
  }
  if (block.type === 'cta') {
    return (
      <div className="text-center py-3">
        <p className="font-semibold">{block.title}</p>
        {block.primaryLabel && <p className="text-xs mt-2 underline">{block.primaryLabel}</p>}
      </div>
    );
  }
  if (block.type === 'image') {
    return block.imageUrl ? (
      <img src={block.imageUrl} alt={block.alt || ''} className="max-h-40 w-full object-cover rounded" />
    ) : (
      <p className="text-xs muted">Image</p>
    );
  }
  if (block.type === 'spacer') {
    return <p className="text-xs muted text-center">Spacer ({block.size || 'md'})</p>;
  }
  return <p className="text-xs muted">{block.type}</p>;
}

function BlockEditor({
  block,
  onChange,
}: {
  block: CmsBlock;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const field = (label: string, key: string, multiline = false) => (
    <div key={key}>
      <label className="text-xs font-medium block mb-1">{label}</label>
      {multiline ? (
        <textarea
          className="input min-h-[100px] font-mono text-xs"
          value={block[key] ?? ''}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
      ) : (
        <input
          className="input"
          value={block[key] ?? ''}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
      )}
    </div>
  );

  if (block.type === 'hero') {
    return (
      <div className="space-y-2">
        {field(t('title'), 'title')}
        {field(t('cmsSubtitle'), 'subtitle')}
        {field(t('cmsCtaLabel'), 'ctaLabel')}
        {field(t('cmsCtaLink'), 'ctaHref')}
        {field(t('cmsImageUrl'), 'imageUrl')}
      </div>
    );
  }
  if (block.type === 'richtext' || block.type === 'html') {
    return (
      <div className="space-y-2">
        {field(block.type === 'html' ? t('cmsHtmlCode') : t('cmsHtmlContent'), 'html', true)}
        {block.type === 'html' && <p className="text-xs muted">{t('cmsHtmlHint')}</p>}
      </div>
    );
  }
  if (block.type === 'menu') {
    return (
      <div className="space-y-2">
        {field(t('title'), 'title')}
        {field(t('cmsSubtitle'), 'subtitle')}
        <div>
          <label className="text-xs font-medium block mb-1">{t('cmsMenuMode')}</label>
          <select
            className="input"
            value={block.mode || 'full'}
            onChange={(e) => onChange({ mode: e.target.value })}
          >
            <option value="full">{t('cmsMenuFull')}</option>
            <option value="featured">{t('cmsMenuFeatured')}</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={block.showPrices !== false}
            onChange={(e) => onChange({ showPrices: e.target.checked })}
          />
          {t('cmsShowPrices')}
        </label>
        {block.mode === 'featured' && (
          <div>
            <label className="text-xs font-medium block mb-1">{t('cmsMenuLimit')}</label>
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              value={block.limit ?? 6}
              onChange={(e) => onChange({ limit: Number(e.target.value) || 6 })}
            />
          </div>
        )}
        {field(t('cmsCtaLabel'), 'ctaLabel')}
        {field(t('cmsCtaLink'), 'ctaHref')}
        <p className="text-xs muted">{t('cmsMenuFromPos')}</p>
      </div>
    );
  }
  if (block.type === 'hours') {
    return (
      <div className="space-y-2">
        {field(t('title'), 'title')}
        <div>
          <label className="text-xs font-medium block mb-1">{t('cmsHoursChannel')}</label>
          <select
            className="input"
            value={block.channel || 'display'}
            onChange={(e) => onChange({ channel: e.target.value })}
          >
            <option value="display">Homepage / display</option>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>
      </div>
    );
  }
  if (block.type === 'cta') {
    return (
      <div className="space-y-2">
        {field(t('title'), 'title')}
        {field(t('cmsSubtitle'), 'subtitle')}
        {field(t('cmsCtaLabel'), 'primaryLabel')}
        {field(t('cmsCtaLink'), 'primaryHref')}
        {field(t('cmsSecondaryLabel'), 'secondaryLabel')}
        {field(t('cmsSecondaryLink'), 'secondaryHref')}
      </div>
    );
  }
  if (block.type === 'image') {
    return (
      <div className="space-y-2">
        {field(t('cmsImageUrl'), 'imageUrl')}
        {field('Alt', 'alt')}
        {field(t('cmsCaption'), 'caption')}
        {field(t('cmsCtaLink'), 'href')}
      </div>
    );
  }
  if (block.type === 'spacer') {
    return (
      <div>
        <label className="text-xs font-medium block mb-1">Size</label>
        <select className="input" value={block.size || 'md'} onChange={(e) => onChange({ size: e.target.value })}>
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
        </select>
      </div>
    );
  }
  return null;
}
