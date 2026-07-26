import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { ensureCmsChaiBlocks } from '@/lib/cms/chai-blocks';
import { CmsShopProvider } from '@/lib/cms/CmsShopContext';

// ChaiBuilder CSS + editor (heavy) — load only in this page
import '@chaibuilder/sdk/styles';
import { ChaiBuilderEditor, type ChaiBlock } from '@chaibuilder/sdk';

type CmsPage = {
  id: string;
  title: string;
  slug: string;
  isHomepage: boolean;
  status: string;
  templateKey?: string | null;
  blocks: ChaiBlock[];
  theme?: Record<string, unknown> | null;
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

ensureCmsChaiBlocks();

export default function WebsiteCms() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [site, setSite] = useState<Site | null>(null);
  const [customDomain, setCustomDomain] = useState('');
  const [savingSite, setSavingSite] = useState(false);
  const [editing, setEditing] = useState<CmsPage | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('Homepage');
  const [newTemplate, setNewTemplate] = useState('restaurant');
  const [asHomepage, setAsHomepage] = useState(true);
  const [menuPreview, setMenuPreview] = useState<any[]>([]);
  const [storeHours, setStoreHours] = useState<Record<string, any>>({});
  const [publishBusy, setPublishBusy] = useState(false);

  const shopCtx = useMemo(
    () => ({
      shopKey: site?.slug || site?.subdomain || 'preview',
      basePath: '',
      menu: menuPreview,
      storeHours,
      merchantName: site?.name,
    }),
    [site, menuPreview, storeHours]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pagesRes, templatesRes, siteRes, settingsRes, menuRes] = await Promise.all([
        api.get('/merchant/cms/pages'),
        api.get('/merchant/cms/templates'),
        api.get('/merchant/cms/site'),
        api.get('/merchant/settings').catch(() => null),
        api.get('/merchant/products', { params: { limit: 200 } }).catch(() => null),
      ]);
      setPages(pagesRes.data.pages || []);
      setTemplates(templatesRes.data.templates || []);
      const s = siteRes.data.site as Site;
      setSite(s);
      setCustomDomain(s.customDomain || '');
      const hours = settingsRes?.data?.settings?.storeHours || {};
      setStoreHours(hours);

      // Build a lightweight menu preview from merchant products
      const products = menuRes?.data?.products || menuRes?.data?.data || [];
      const byCat = new Map<string, { id: string; name: string; items: any[] }>();
      for (const p of products) {
        if (p.isActive === false) continue;
        const catId = p.categoryId || p.category?.id || 'other';
        const catName = p.category?.name || p.categoryName || 'Menu';
        if (!byCat.has(catId)) byCat.set(catId, { id: catId, name: catName, items: [] });
        byCat.get(catId)!.items.push({
          id: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          description: p.description || '',
          image: p.imageUrl || p.image || undefined,
        });
      }
      setMenuPreview(Array.from(byCat.values()));
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
      setEditing({ ...page, blocks: (page.blocks || []) as ChaiBlock[] });
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
      setEditing({ ...page, blocks: (page.blocks || []) as ChaiBlock[] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsLoadFailed'));
    }
  };

  const persistPage = async (
    blocks: ChaiBlock[],
    theme: Record<string, unknown> | undefined,
    status?: 'draft' | 'published'
  ) => {
    if (!editing) return false;
    try {
      const res = await api.put(`/merchant/cms/pages/${editing.id}`, {
        title: editing.title,
        slug: editing.slug,
        isHomepage: editing.isHomepage,
        blocks,
        theme: theme ?? editing.theme ?? null,
        status: status || editing.status,
      });
      const page = res.data.page as CmsPage;
      setEditing({ ...page, blocks: (page.blocks || []) as ChaiBlock[] });
      await load();
      return true;
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsSaveFailed'));
      return false;
    }
  };

  const onChaiSave = async ({
    blocks,
    theme,
  }: {
    blocks: ChaiBlock[];
    theme?: Record<string, unknown>;
    autoSave?: boolean;
  }) => {
    const ok = await persistPage(blocks, theme);
    if (ok) toast.success(t('saved'));
    return ok;
  };

  const publish = async () => {
    if (!editing) return;
    setPublishBusy(true);
    try {
      const ok = await persistPage(editing.blocks || [], editing.theme || undefined, 'published');
      if (ok) toast.success(t('cmsPublished'));
    } finally {
      setPublishBusy(false);
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
      <CmsShopProvider value={shopCtx}>
        <div className="fixed inset-0 z-40 flex flex-col bg-[var(--bg)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2 bg-[var(--bg)]">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="text-sm muted hover:underline shrink-0"
                onClick={() => setEditing(null)}
              >
                ← {t('cmsBackToPages')}
              </button>
              <input
                className="input text-sm max-w-[220px]"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
              <label className="flex items-center gap-1.5 text-xs shrink-0">
                <input
                  type="checkbox"
                  checked={!!editing.isHomepage}
                  onChange={(e) => setEditing({ ...editing, isHomepage: e.target.checked })}
                />
                {t('cmsIsHomepage')}
              </label>
              <span className="text-xs muted shrink-0">{editing.status}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={publishBusy}
                onClick={() => publish()}
              >
                {t('cmsPublish')}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 relative">
            <ChaiBuilderEditor
              key={editing.id}
              pageId={editing.id}
              blocks={(editing.blocks || []) as ChaiBlock[]}
              theme={(editing.theme || undefined) as any}
              autoSave={false}
              onSave={onChaiSave as any}
              permissions={[
                'add_block',
                'delete_block',
                'edit_block',
                'edit_theme',
                'save_page',
                'move_block',
              ]}
            />
          </div>
        </div>
      </CmsShopProvider>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">{t('cmsWebsite')}</h1>
        <p className="text-sm muted mt-1">{t('cmsWebsiteHint')}</p>
        <p className="text-xs muted mt-1">{t('cmsChaiHint')}</p>
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
        <form
          onSubmit={createPage}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)] p-4 space-y-3"
        >
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
                {t('cmsOpenBuilder')}
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
