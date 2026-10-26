import { describe, expect, it } from 'vitest';

import { Locale, isLocale, t } from './index.js';

describe('i18n dictionaries', () => {
  it('falls back to English for missing keys', () => {
    expect(t(Locale.Malayalam, 'app.name')).not.toBe('app.name');
    expect(t(Locale.Tamil, 'nonexistent.key')).toBe('nonexistent.key');
    expect(t(Locale.English, 'common.signOut')).toBe('Sign out');
  });

  it('interpolates variables into keys', () => {
    expect(t(Locale.English, 'app.name', {})).toBe('Ameen OMS');
  });

  it('validates locale strings', () => {
    expect(isLocale('ml')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });
});
