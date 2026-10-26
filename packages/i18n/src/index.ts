/**
 * UI dictionaries for the office admin console. English is the source of
 * truth; Malayalam and Tamil cover the office clerk's day in Kerala/TN.
 * Keys are flat dot-names; missing keys fall back to English.
 */

export const Locale = {
  English: 'en',
  Tamil: 'ta',
  Malayalam: 'ml',
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export const LOCALES: readonly Locale[] = Object.values(Locale);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export type Dictionary = Record<string, string>;

export const dictionaries: Record<Locale, Dictionary> = {
  [Locale.English]: {
    'app.name': 'Ameen OMS',
    'office.myDay': 'My Day',
    'office.orderDesk': 'Order Desk',
    'office.followups': 'Follow-up & Routes',
    'office.outstanding': 'Outstanding',
    'office.dispatch': 'Dispatch',
    'office.registers': 'Registers',
    'office.controls': 'Controls',
    'office.theme': 'Theme',
    'office.checklist.opening': 'Opening checklist',
    'office.checklist.closing': 'Closing checklist',
    'common.signOut': 'Sign out',
  },
  [Locale.Tamil]: {
    'app.name': 'அமீன் OMS',
    'office.myDay': 'என் நாள்',
    'office.orderDesk': 'ஆர்டர் டெஸ்க்',
    'office.followups': 'தொடர் பராமரிப்பு & வழிகள்',
    'office.outstanding': 'நிலுவை',
    'office.dispatch': 'விநியோகம்',
    'office.registers': 'பதிவேடுகள்',
    'office.controls': 'கட்டுப்பாடுகள்',
    'office.theme': 'தீம்',
    'office.checklist.opening': 'திறப்பு சரிபார்ப்பு',
    'office.checklist.closing': 'முடிவு சரிபார்ப்பு',
    'common.signOut': 'வெளியேறு',
  },
  [Locale.Malayalam]: {
    'app.name': 'അമീൻ OMS',
    'office.myDay': 'എന്റെ ദിവസം',
    'office.orderDesk': 'ഓർഡർ ഡെസ്ക്',
    'office.followups': 'തുടർച്ചയായ ഫോളോ-അപ്പ് & റൂട്ടുകൾ',
    'office.outstanding': 'ബാക്കി',
    'office.dispatch': 'വിതരണം',
    'office.registers': 'രജിസ്റ്ററുകൾ',
    'office.controls': 'നിയന്ത്രണങ്ങൾ',
    'office.theme': 'തീം',
    'office.checklist.opening': 'തുറക്കൽ പരിശോധന',
    'office.checklist.closing': 'അവസാന പരിശോധന',
    'common.signOut': 'പുറത്തുകയറുക',
  },
};

/** Translates `key` for `locale`, falling back to English and then the key. */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const raw = dictionaries[locale]?.[key] ?? dictionaries[Locale.English][key] ?? key;
  if (!vars) return raw;
  let out = raw;
  for (const [name, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${name}}`, String(value));
  }
  return out;
}
