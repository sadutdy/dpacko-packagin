import { useEffect, useState, type FormEvent } from 'react';

import {
  useUiPrefs,
  SIDEBAR_STYLES,
  type SidebarStyle,
} from '../../app/settings/UiPrefsContext.js';
import { useAuth } from '../../app/auth/AuthContext.js';
import { api } from '../../lib/api.js';

type CompanyProfile = {
  name: string;
  address: string;
  phone: string;
  website: string;
  logo: string;
  gstin: string;
  stateName: string;
  stateCode: string;
  declaration: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
};

/** Text inputs for the fields printed on quotations (state, bank, declaration). */
const PRINT_FIELDS: { key: keyof CompanyProfile; label: string; placeholder?: string }[] = [
  { key: 'stateName', label: 'State', placeholder: 'Kerala' },
  { key: 'stateCode', label: 'State code', placeholder: 'From GSTIN, e.g. 32' },
  { key: 'bankName', label: 'Bank name' },
  { key: 'accountNo', label: 'Account number' },
  { key: 'ifsc', label: 'IFSC', placeholder: 'SBIN0001234' },
  { key: 'branch', label: 'Branch' },
];

function MiniPreview({ variant, active }: { variant: SidebarStyle; active: boolean }) {
  if (variant === 'glass') {
    return (
      <div className="relative h-28 overflow-hidden rounded-lg bg-gradient-to-br from-sky-400/60 via-indigo-500/50 to-fuchsia-400/60">
        <div className="absolute inset-y-0 left-2 flex w-16 flex-col gap-1 rounded-md border border-white/30 bg-white/20 p-1.5 backdrop-blur-md">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`h-2.5 rounded ${
                index === (active ? 0 : 1) ? 'bg-white/60' : 'bg-white/25'
              } transition-transform duration-500 group-hover:scale-x-110`}
            />
          ))}
        </div>
        <div className="absolute right-2 bottom-2 h-10 w-16 rounded bg-white/25 backdrop-blur-sm" />
      </div>
    );
  }
  return (
    <div className="flex h-28 rounded-lg bg-app-nav p-2">
      <div className="flex w-16 flex-col gap-1">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-2.5 rounded px-3 ${
              index === (active ? 0 : 1) ? 'bg-app-nav-active' : 'bg-app-nav-hover'
            }`}
          />
        ))}
      </div>
      <div className="ml-2 h-full flex-1 rounded bg-app-subtle" />
    </div>
  );
}

function StyleOption({
  value,
  label,
  description,
  current,
  onSelect,
}: {
  value: SidebarStyle;
  label: string;
  description: string;
  current: SidebarStyle;
  onSelect: (style: SidebarStyle) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={`group flex flex-col gap-3 rounded-xl border p-4 text-left transition-colors ${
        active
          ? 'border-app-accent bg-app-subtle ring-2 ring-app-accent'
          : 'border-app-border bg-app-surface hover:border-app-accent-hover hover:shadow-md'
      }`}
    >
      <MiniPreview variant={value} active={active} />
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-app-strong">
          {label}
          {active && <span className="text-xs font-medium text-app-accent">Active</span>}
        </div>
        <p className="mt-1 text-xs text-app-muted">{description}</p>
      </div>
    </button>
  );
}

function SidebarSection() {
  const { sidebarStyle, setSidebarStyle } = useUiPrefs();
  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-6">
      <h3 className="section-label">Appearance</h3>
      <p className="mb-4 mt-1 text-sm text-app-text">Left menu bar layout</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SIDEBAR_STYLES.map((style) => (
          <StyleOption
            key={style.value}
            value={style.value}
            label={style.label}
            description={style.description}
            current={sidebarStyle}
            onSelect={setSidebarStyle}
          />
        ))}
      </div>
    </section>
  );
}

function CompanySection() {
  const { can } = useAuth();
  const canWrite = can('settings:write');

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<CompanyProfile>('/api/v1/company')
      .then(setProfile)
      .catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const next = await api.put<CompanyProfile>('/api/v1/company', profile);
      setProfile(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving failed');
    } finally {
      setBusy(false);
    }
  }

  if (!profile) {
    return (
      <section className="rounded-xl border border-app-border bg-app-surface p-6">
        <h3 className="section-label">Company details</h3>
        <p className={`mt-2 text-sm ${error ? 'text-app-danger-text' : 'text-app-muted'}`}>
          {error ?? 'Loading…'}
        </p>
      </section>
    );
  }

  const set = (key: keyof CompanyProfile, value: string) =>
    setProfile({ ...profile, [key]: value });

  const readOnly = (
    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      {(
        [
          ['Name', profile.name],
          ['Address', profile.address],
          ['Phone', profile.phone],
          ['Website', profile.website],
          ['GST number', profile.gstin],
          ['Logo', profile.logo],
          ['State', profile.stateName && `${profile.stateName} (${profile.stateCode})`],
          ['Bank', [profile.bankName, profile.accountNo, profile.ifsc].filter(Boolean).join(' · ')],
        ] as [string, string][]
      ).map(([label, value]) => (
        <div key={label}>
          <dt className="section-label">{label}</dt>
          <dd className="mt-0.5 break-words text-app-text">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="section-label">Company details</h3>
        {profile.logo && (
          <img src={profile.logo} alt="Company logo" className="h-8 max-w-[8rem] object-contain" />
        )}
      </div>

      {!canWrite ? (
        <div className="mt-4">{readOnly}</div>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="mt-4 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <label className="mb-3 block">
              <span className="section-label mb-1 block">Name</span>
              <input
                className="field"
                value={profile.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </label>
            <label className="mb-3 block">
              <span className="section-label mb-1 block">Phone</span>
              <input
                className="field"
                value={profile.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+919440000001"
                inputMode="tel"
              />
            </label>
            <label className="mb-3 block">
              <span className="section-label mb-1 block">Website</span>
              <input
                className="field"
                value={profile.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="https://…"
                inputMode="url"
              />
            </label>
            <label className="mb-3 block">
              <span className="section-label mb-1 block">GST number</span>
              <input
                className="field uppercase"
                value={profile.gstin}
                onChange={(e) => set('gstin', e.target.value)}
                placeholder="32AABCA1234A1Z5"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
            <label className="mb-3 block sm:col-span-2">
              <span className="section-label mb-1 block">Address</span>
              <textarea
                className="field"
                rows={2}
                value={profile.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </label>
            <label className="mb-3 block sm:col-span-2">
              <span className="section-label mb-1 block">Logo URL</span>
              <input
                className="field"
                value={profile.logo}
                onChange={(e) => set('logo', e.target.value)}
                placeholder="https://…/logo.svg"
                inputMode="url"
              />
            </label>
          </div>

          <h4 className="section-label mb-2 mt-2">Printed on quotations</h4>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {PRINT_FIELDS.map((field) => (
              <label key={field.key} className="mb-3 block">
                <span className="section-label mb-1 block">{field.label}</span>
                <input
                  className="field"
                  value={profile[field.key]}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                />
              </label>
            ))}
            <label className="mb-3 block sm:col-span-2">
              <span className="section-label mb-1 block">Declaration</span>
              <textarea
                className="field"
                rows={2}
                value={profile.declaration}
                onChange={(e) => set('declaration', e.target.value)}
                placeholder="We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
              />
            </label>
          </div>

          {error && <p className="mb-3 text-sm text-app-danger-text">{error}</p>}
          {saved && <p className="mb-3 text-sm text-app-text">Company details saved.</p>}

          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
    </section>
  );
}

export function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-app-strong">Settings</h2>
        <p className="mt-1 text-sm text-app-muted">
          Appearance preferences are stored in this browser; company details are shared across the team.
        </p>
      </div>

      <div className="space-y-4">
        <SidebarSection />
        <CompanySection />
      </div>
    </div>
  );
}
