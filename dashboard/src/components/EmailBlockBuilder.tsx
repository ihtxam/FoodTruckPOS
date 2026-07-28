import { useEffect, useMemo, useState } from 'react';
import { SortableList, SortableRow, DragHandle } from '@/components/SortableList';

export type EmailBlockType = 'heading' | 'text' | 'button' | 'image' | 'divider' | 'spacer';

export type EmailBlock = {
  id: string;
  type: EmailBlockType;
  text?: string;
  label?: string;
  url?: string;
  alt?: string;
  height?: number;
};

function uid() {
  return `b-${Math.random().toString(36).slice(2, 10)}`;
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  const parts = blocks.map((b) => {
    switch (b.type) {
      case 'heading':
        return `<h2 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#1c1917">${escapeHtml(
          b.text || ''
        )}</h2>`;
      case 'text':
        return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#44403c;white-space:pre-wrap">${escapeHtml(
          b.text || ''
        ).replace(/\n/g, '<br/>')}</p>`;
      case 'button': {
        const href = (b.url || '{{shopUrl}}').trim() || '{{shopUrl}}';
        const label = escapeHtml(b.label || 'Order now');
        return `<p style="margin:0 0 18px"><a href="${escapeAttr(href)}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:12px 18px;font-size:14px;font-weight:600">${label}</a></p>`;
      }
      case 'image':
        if (!b.url?.trim()) return '';
        return `<p style="margin:0 0 16px"><img src="${escapeAttr(b.url.trim())}" alt="${escapeAttr(
          b.alt || ''
        )}" style="max-width:100%;height:auto;display:block"/></p>`;
      case 'divider':
        return `<hr style="border:none;border-top:1px solid #e7e5e4;margin:8px 0 18px"/>`;
      case 'spacer':
        return `<div style="height:${Math.max(8, Number(b.height) || 24)}px;line-height:0">&nbsp;</div>`;
      default:
        return '';
    }
  });
  return parts.filter(Boolean).join('\n');
}

export function htmlToBlocks(html: string): EmailBlock[] {
  const trimmed = String(html || '').trim();
  if (!trimmed) {
    return [
      {
        id: uid(),
        type: 'heading',
        text: 'Hello {{name}}',
      },
      {
        id: uid(),
        type: 'text',
        text: 'Here is our latest news from {{businessName}}.',
      },
      {
        id: uid(),
        type: 'button',
        label: 'Visit our shop',
        url: '{{shopUrl}}',
      },
    ];
  }
  // Keep existing HTML as one editable text block if it isn't from our builder
  return [
    {
      id: uid(),
      type: 'text',
      text: trimmed
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim(),
    },
  ];
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

const BLOCK_PALETTE: { type: EmailBlockType; label: string }[] = [
  { type: 'heading', label: 'Heading' },
  { type: 'text', label: 'Text' },
  { type: 'button', label: 'Button' },
  { type: 'image', label: 'Image' },
  { type: 'divider', label: 'Divider' },
  { type: 'spacer', label: 'Spacer' },
];

function newBlock(type: EmailBlockType): EmailBlock {
  switch (type) {
    case 'heading':
      return { id: uid(), type, text: 'Headline' };
    case 'text':
      return { id: uid(), type, text: 'Write your message… Use {{name}} {{shopUrl}} {{businessName}}' };
    case 'button':
      return { id: uid(), type, label: 'Order now', url: '{{shopUrl}}' };
    case 'image':
      return { id: uid(), type, url: '', alt: '' };
    case 'divider':
      return { id: uid(), type };
    case 'spacer':
      return { id: uid(), type, height: 24 };
  }
}

type Props = {
  valueHtml: string;
  onChangeHtml: (html: string) => void;
};

/**
 * Drag-and-drop email block builder → compiles to HTML for marketing sends.
 */
export default function EmailBlockBuilder({ valueHtml, onChangeHtml }: Props) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => htmlToBlocks(valueHtml));
  const [showHtml, setShowHtml] = useState(false);
  const [rawHtml, setRawHtml] = useState(valueHtml);

  const compiled = useMemo(() => blocksToHtml(blocks), [blocks]);

  useEffect(() => {
    if (!showHtml) onChangeHtml(compiled);
  }, [compiled, showHtml, onChangeHtml]);

  const updateBlock = (id: string, patch: Partial<EmailBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== id)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Email builder</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              if (showHtml) {
                setBlocks(htmlToBlocks(rawHtml));
                setShowHtml(false);
              } else {
                setRawHtml(compiled);
                setShowHtml(true);
              }
            }}
          >
            {showHtml ? 'Back to builder' : 'Edit HTML'}
          </button>
        </div>
      </div>

      {showHtml ? (
        <textarea
          className="input min-h-[14rem] font-mono text-xs"
          value={rawHtml}
          onChange={(e) => {
            setRawHtml(e.target.value);
            onChangeHtml(e.target.value);
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {BLOCK_PALETTE.map((p) => (
              <button
                key={p.type}
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setBlocks((prev) => [...prev, newBlock(p.type)])}
              >
                + {p.label}
              </button>
            ))}
          </div>

          <SortableList
            items={blocks}
            getId={(b) => b.id}
            onReorder={setBlocks}
            className="space-y-2"
            renderItem={(block) => (
              <SortableRow key={block.id} id={block.id} className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]">
                {({ attributes, listeners }) => (
                  <div className="flex gap-2 p-2.5">
                    <DragHandle attributes={attributes} listeners={listeners} className="mt-1" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wide muted font-semibold">
                          {block.type}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-red-600"
                          onClick={() => removeBlock(block.id)}
                        >
                          Remove
                        </button>
                      </div>
                      {(block.type === 'heading' || block.type === 'text') && (
                        <textarea
                          className="input text-sm min-h-[4rem]"
                          value={block.text || ''}
                          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                        />
                      )}
                      {block.type === 'button' && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            className="input text-sm"
                            placeholder="Button label"
                            value={block.label || ''}
                            onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                          />
                          <input
                            className="input text-sm"
                            placeholder="URL ({{shopUrl}})"
                            value={block.url || ''}
                            onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                          />
                        </div>
                      )}
                      {block.type === 'image' && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            className="input text-sm sm:col-span-2"
                            placeholder="Image URL"
                            value={block.url || ''}
                            onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                          />
                          <input
                            className="input text-sm sm:col-span-2"
                            placeholder="Alt text"
                            value={block.alt || ''}
                            onChange={(e) => updateBlock(block.id, { alt: e.target.value })}
                          />
                        </div>
                      )}
                      {block.type === 'spacer' && (
                        <label className="flex items-center gap-2 text-sm">
                          <span className="muted text-xs">Height</span>
                          <input
                            className="input w-24"
                            type="number"
                            min={8}
                            max={120}
                            value={block.height || 24}
                            onChange={(e) =>
                              updateBlock(block.id, { height: Number(e.target.value) || 24 })
                            }
                          />
                          px
                        </label>
                      )}
                      {block.type === 'divider' && (
                        <p className="text-xs muted">Horizontal line between sections.</p>
                      )}
                    </div>
                  </div>
                )}
              </SortableRow>
            )}
          />

          <div className="rounded-md border border-[var(--border)] bg-white p-4">
            <p className="text-[11px] uppercase tracking-wide muted font-semibold mb-3">Preview</p>
            <div
              className="prose prose-sm max-w-none text-stone-800"
              dangerouslySetInnerHTML={{ __html: compiled || '<p class="text-stone-400">Empty</p>' }}
            />
          </div>
        </>
      )}
      <p className="text-[11px] muted">Placeholders: {'{{name}} {{shopUrl}} {{businessName}}'}</p>
    </div>
  );
}
