import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import EmailBlockBuilder from '@/components/EmailBlockBuilder';
import { useI18n } from '@/lib/i18n';

type AudienceRow = {
  id: string | null;
  email: string;
  name: string;
  lastOrderAt?: string | null;
};

type Campaign = {
  id: string;
  title: string;
  subject: string;
  bodyHtml: string;
  status: string;
  audience: string;
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  selectedEmails?: string[] | null;
  sentAt?: string | null;
  createdAt?: string;
};

export default function Newsletter() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<AudienceRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailStatus, setEmailStatus] = useState<{ configured?: boolean; provider?: string | null }>(
    {}
  );
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [title, setTitle] = useState('Newsletter');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState(
    '<p>Hi {{name}},</p>\n<p>Here is our latest news from {{businessName}}.</p>\n<p><a href="{{shopUrl}}">Visit our shop</a></p>'
  );
  const [audienceMode, setAudienceMode] = useState<'all' | 'selected'>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [a, c, s] = await Promise.all([
        api.get('/merchant/marketing/audience'),
        api.get('/merchant/marketing/campaigns'),
        api.get('/merchant/marketing/email-status'),
      ]);
      setAudience(a.data.audience || []);
      setCampaigns(c.data.campaigns || []);
      setEmailStatus(s.data.status || {});
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('newsletterLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAudience = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return audience;
    return audience.filter(
      (r) => r.email.includes(q) || (r.name || '').toLowerCase().includes(q)
    );
  }, [audience, filter]);

  const selectedEmails = useMemo(
    () => Object.keys(selected).filter((e) => selected[e]),
    [selected]
  );

  const saveDraft = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/merchant/marketing/campaigns', {
        id: campaignId || undefined,
        title,
        subject,
        bodyHtml,
        audience: audienceMode,
        selectedEmails: audienceMode === 'selected' ? selectedEmails : undefined,
      });
      setCampaignId(res.data.campaign.id);
      toast.success(t('newsletterDraftSaved'));
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('newsletterSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    if (!emailStatus.configured) {
      toast.error(t('newsletterEmailNotConfigured'));
      return;
    }
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.error(t('newsletterNeedSubjectBody'));
      return;
    }
    if (audienceMode === 'selected' && selectedEmails.length === 0) {
      toast.error(t('newsletterNeedRecipients'));
      return;
    }
    if (!window.confirm(t('newsletterSendConfirm'))) return;
    setSending(true);
    try {
      const saved = await api.post('/merchant/marketing/campaigns', {
        id: campaignId || undefined,
        title,
        subject,
        bodyHtml,
        audience: audienceMode,
        selectedEmails: audienceMode === 'selected' ? selectedEmails : undefined,
      });
      const id = saved.data.campaign.id as string;
      setCampaignId(id);
      const res = await api.post(`/merchant/marketing/campaigns/${id}/send`);
      toast.success(
        t('newsletterSent')
          .replace('{sent}', String(res.data.campaign.sentCount || 0))
          .replace('{failed}', String(res.data.campaign.failedCount || 0))
      );
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('newsletterSendFailed'));
    } finally {
      setSending(false);
    }
  };

  const loadCampaign = (c: Campaign) => {
    setCampaignId(c.id);
    setTitle(c.title || 'Newsletter');
    setSubject(c.subject || '');
    setBodyHtml(c.bodyHtml || '');
    setAudienceMode(c.audience === 'selected' ? 'selected' : 'all');
    const next: Record<string, boolean> = {};
    (c.selectedEmails || []).forEach((e) => {
      next[e] = true;
    });
    setSelected(next);
  };

  if (loading) {
    return <div className="text-center py-12 muted text-sm">{t('loading')}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="page-title">{t('newsletter')}</h1>
        <p className="page-sub">{t('newsletterHint')}</p>
      </div>

      {!emailStatus.configured ? (
        <div className="card border-amber-200 bg-amber-50 text-amber-950 text-sm">
          {t('newsletterEmailNotConfigured')}
        </div>
      ) : (
        <p className="text-xs muted">
          {t('newsletterEmailReady')} ({emailStatus.provider})
        </p>
      )}

      <form onSubmit={saveDraft} className="card space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('newsletterTitle')}</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">{t('newsletterSubject')}</span>
            <input
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="{{businessName}} - news"
              required
            />
          </label>
        </div>
        <div className="space-y-1">
          <span className="text-sm font-medium block">{t('newsletterBody')}</span>
          <p className="text-[11px] muted">{t('newsletterBuilderHint')}</p>
          <EmailBlockBuilder
            key={campaignId || 'new'}
            valueHtml={bodyHtml}
            onChangeHtml={setBodyHtml}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('newsletterAudience')}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={audienceMode === 'all'}
                onChange={() => setAudienceMode('all')}
              />
              {t('newsletterAllCustomers')} ({audience.length})
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={audienceMode === 'selected'}
                onChange={() => setAudienceMode('selected')}
              />
              {t('newsletterSelected')} ({selectedEmails.length})
            </label>
          </div>
        </div>

        {audienceMode === 'selected' ? (
          <div className="space-y-2">
            <input
              className="input"
              placeholder={t('search')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="max-h-56 overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)]">
              {filteredAudience.map((r) => (
                <label
                  key={r.email}
                  className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--bg-muted)]"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!selected[r.email]}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [r.email]: e.target.checked }))
                    }
                  />
                  <span className="min-w-0">
                    <span className="font-medium block truncate">{r.name}</span>
                    <span className="text-xs muted block truncate">{r.email}</span>
                  </span>
                </label>
              ))}
              {filteredAudience.length === 0 ? (
                <p className="px-3 py-4 text-xs muted">{t('newsletterNoAudience')}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 justify-end border-t border-[var(--border)] pt-3">
          <button type="submit" className="btn-secondary" disabled={saving || sending}>
            {saving ? t('saving') : t('newsletterSaveDraft')}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving || sending}
            onClick={() => void sendNow()}
          >
            {sending ? t('newsletterSending') : t('newsletterSend')}
          </button>
        </div>
      </form>

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold">{t('newsletterRecent')}</h2>
        {campaigns.length === 0 ? (
          <p className="text-xs muted">{t('newsletterNoCampaigns')}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {campaigns.map((c) => (
              <li key={c.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.subject}</p>
                  <p className="text-xs muted">
                    {c.status}
                    {c.sentCount != null ? ` · ${c.sentCount}/${c.recipientCount || 0}` : ''}
                  </p>
                </div>
                <button type="button" className="btn-secondary text-xs shrink-0" onClick={() => loadCampaign(c)}>
                  {t('edit')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
