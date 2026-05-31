import { describe, expect, it } from 'vitest';
import { deepMergeMessages } from '@/i18n/deep-merge';

describe('deepMergeMessages', () => {
  it('overlays nested keys without dropping sibling keys', () => {
    const base = { nav: { home: 'Bosh', cart: 'Savat' }, site: { metaTitle: 'UZ' } };
    const over = { nav: { home: 'Home' } };
    const merged = deepMergeMessages(base, over);
    expect(merged.nav.home).toBe('Home');
    expect(merged.nav.cart).toBe('Savat');
    expect(merged.site.metaTitle).toBe('UZ');
  });
});
