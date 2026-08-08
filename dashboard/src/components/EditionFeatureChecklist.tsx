import {
  ALL_EDITION_FEATURES,
  EDITION_FEATURE_GROUPS,
  type EditionFeatureKey,
} from '@/lib/edition-features';

type Props = {
  value: EditionFeatureKey[];
  onChange: (next: EditionFeatureKey[]) => void;
  disabled?: boolean;
};

export default function EditionFeatureChecklist({ value, onChange, disabled }: Props) {
  const selected = new Set(value);

  const toggle = (key: EditionFeatureKey) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(ALL_EDITION_FEATURES.filter((k) => next.has(k)));
  };

  const toggleGroup = (keys: EditionFeatureKey[], allOn: boolean) => {
    const next = new Set(selected);
    for (const k of keys) {
      if (allOn) next.add(k);
      else next.delete(k);
    }
    onChange(ALL_EDITION_FEATURES.filter((k) => next.has(k)));
  };

  return (
    <div className="space-y-4">
      {EDITION_FEATURE_GROUPS.map((group) => {
        const keys = group.features.map((f) => f.key);
        const allOn = keys.every((k) => selected.has(k));
        return (
          <div key={group.id} className="border border-stone-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-stone-800">{group.label}</h4>
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleGroup(keys, !allOn)}
                className="text-xs text-teal-700 hover:underline disabled:opacity-50"
              >
                {allOn ? 'Clear group' : 'Select all'}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {group.features.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={selected.has(f.key)}
                    onChange={() => toggle(f.key)}
                    className="rounded border-stone-300"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
