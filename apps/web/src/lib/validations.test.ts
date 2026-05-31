import { describe, expect, it } from 'vitest';
import { validateCheckoutAddress, loginSchema, registerSchema } from './validations';

describe('validateCheckoutAddress', () => {
  it('requires phone for all delivery types', () => {
    const result = validateCheckoutAddress({
      phone: '',
      deliveryType: 'PICKUP',
      firstName: 'Ali',
      lastName: 'Valiyev',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors).toContain('Telefon raqamini kiriting');
  });

  it('requires address fields for DELIVERY', () => {
    const result = validateCheckoutAddress({
      phone: '998901234567',
      deliveryType: 'DELIVERY',
      city: '',
      street: 'Navoi',
      house: '1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContain('Shahar kiriting');
    }
  });

  it('requires name for PICKUP', () => {
    const result = validateCheckoutAddress({
      phone: '998901234567',
      deliveryType: 'PICKUP',
      firstName: '',
      lastName: 'Valiyev',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors).toContain('Ism kiriting');
  });

  it('passes valid DELIVERY address', () => {
    const result = validateCheckoutAddress({
      phone: '998901234567',
      deliveryType: 'DELIVERY',
      city: 'Toshkent',
      street: 'Navoi',
      house: '12',
    });
    expect(result.success).toBe(true);
  });

  it('passes valid PICKUP address', () => {
    const result = validateCheckoutAddress({
      phone: '998901234567',
      deliveryType: 'PICKUP',
      firstName: 'Ali',
      lastName: 'Valiyev',
    });
    expect(result.success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      password: 'Password1!',
      passwordConfirm: 'Password2!',
      firstName: 'Ali',
      lastName: 'Valiyev',
    });
    expect(result.success).toBe(false);
  });
});
