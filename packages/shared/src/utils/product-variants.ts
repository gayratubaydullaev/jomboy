/** Cartesian product of option value lists (e.g. sizes × colors). */
export function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  const [first, ...rest] = arrays;
  const restProduct = cartesian(rest);
  return first.flatMap((v) => restProduct.map((p) => [v, ...p]));
}

export type ProductOptionRow = { name: string; values: string };

export type GeneratedVariantRow = {
  options: Record<string, string>;
  stock: number;
  imageUrl: string;
};

/**
 * Build variant rows from seller form option rows.
 * Returns null when any option has no values.
 */
export function buildVariantRowsFromOptions(
  optionsRows: ProductOptionRow[],
): GeneratedVariantRow[] | null {
  const names = optionsRows.map((r) => r.name.trim()).filter(Boolean);
  const valueLists = optionsRows
    .filter((r) => r.name.trim())
    .map((r) => r.values.split(',').map((v) => v.trim()).filter(Boolean));
  if (valueLists.some((arr) => !arr.length)) return null;
  const combos = cartesian(valueLists);
  return combos.map((values) => {
    const options: Record<string, string> = {};
    names.forEach((name, i) => {
      options[name] = values[i] as string;
    });
    return { options, stock: 0, imageUrl: '' };
  });
}

/** Normalize option value for comparison (matches API normOpt). */
export function normOptionValue(s: string): string {
  return String(s ?? '').replace(/\s+/g, '').trim();
}
