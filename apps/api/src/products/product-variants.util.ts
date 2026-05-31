import { BadRequestException } from '@nestjs/common';
import { normOptionValue } from '@myshopuz/shared';

export function parseProductNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && !isNaN(value)) return value;
  const s = String(value).replace(/\s/g, '').replace(/,/g, '.');
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}

export function validateOptionsAndVariants(
  options: Record<string, string[]>,
  variants: Array<{ options: Record<string, string> }>,
): void {
  const keys = Object.keys(options);
  if (keys.length === 0) return;
  const allowed = new Map<string, Set<string>>();
  for (const k of keys) {
    const vals = (options[k] ?? []).map((v) => normOptionValue(v));
    allowed.set(k, new Set(vals));
  }
  const variantCombos = new Set<string>();
  for (const v of variants) {
    const combo: string[] = [];
    for (const k of keys) {
      const val = (v.options ?? {})[k];
      if (val == null || val === '') {
        throw new BadRequestException(
          `Variantda "${k}" uchun qiymat ko'rsatilmagan. Barcha variantlar har bir option (${keys.join(', ')}) uchun qiymatga ega bo'lishi kerak.`,
        );
      }
      const n = normOptionValue(val);
      if (!allowed.get(k)?.has(n)) {
        throw new BadRequestException(
          `Variantda "${k}": "${val}" ruxsat etilmagan. Ruxsat etilgan qiymatlar: ${(options[k] ?? []).join(', ')}`,
        );
      }
      combo.push(`${k}=${n}`);
    }
    const key = combo.sort().join('|');
    if (variantCombos.has(key)) {
      throw new BadRequestException(
        `Bir xil variant ikki marta kiritilgan: ${combo.join(', ')}. Har bir kombinatsiya bitta variant bo'lishi kerak.`,
      );
    }
    variantCombos.add(key);
  }
  function cartesian(acc: string[][], keyIndex: number): string[][] {
    if (keyIndex >= keys.length) return acc;
    const k = keys[keyIndex];
    const vals = (options[k] ?? []).map((v) => normOptionValue(v));
    if (vals.length === 0) return cartesian(acc, keyIndex + 1);
    const next: string[][] = [];
    for (const row of acc) {
      for (const v of vals) {
        next.push([...row, `${k}=${v}`]);
      }
    }
    return cartesian(next.length ? next : vals.map((v) => [`${k}=${v}`]), keyIndex + 1);
  }
  const required = cartesian([[]], 0).map((parts) => parts.sort().join('|'));
  const missing = required.filter((r) => !variantCombos.has(r));
  if (missing.length > 0) {
    throw new BadRequestException(
      `Variantlar to'liq emas. Quyidagi kombinatsiyalar uchun variant qo'shing: ${missing.slice(0, 5).join('; ')}${missing.length > 5 ? ` ... va yana ${missing.length - 5} ta` : ''}. Har bir option qiymatlari kombinatsiyasi uchun bitta variant bo'lishi kerak.`,
    );
  }
  const extra = [...variantCombos].filter((r) => !required.includes(r));
  if (extra.length > 0) {
    throw new BadRequestException(
      `Variantda product options'da bo'lmagan qiymat ishlatilgan: ${extra.slice(0, 3).join('; ')}.`,
    );
  }
}
