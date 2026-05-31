import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { buildWorkbookBuffer, workbookToRowRecords } from './excel-utils';
import { parseProductNum } from './product-variants.util';

const EXCEL_IMPORT_MAX_ROWS = 500;
const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 10000;

@Injectable()
export class ProductImportService {
  constructor(
    private prisma: PrismaService,
    private products: ProductsService,
  ) {}

  async getImportTemplate(): Promise<Buffer> {
    const leafCategories = await this.prisma.category.findMany({
      where: { parentId: { not: null } },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    });
    const headerRow = [
      'Nomi', 'Tavsif', 'Narx (soʻm)', 'Qoldiq', 'SKU (ixtiyoriy)', 'Kategoriya slug',
      'Rasmlar URL (vergul bilan)', 'Birlik (dona, kg...)', 'Xususiyatlar (kalit:qiymat; kalit2:qiymat2)',
      'Xususiyat 1 nomi', 'Xususiyat 1 qiymat', 'Xususiyat 2 nomi', 'Xususiyat 2 qiymat', 'Xususiyat 3 nomi', 'Xususiyat 3 qiymat',
      "Variant 1 nomi (masalan: O'lcham)", "Variant 1 qiymat (masalan: S)", "Variant 2 nomi (masalan: Rang)", "Variant 2 qiymat (masalan: Qora)",
    ];
    const example1 = [
      'Smartfon Samsung A54', 'Yaxshi kamera va batareya', 4500000, 10, 'SAM-A54',
      leafCategories[0]?.slug ?? 'elektronika', '', 'dona', 'Rang:Qora; Xotira:128GB',
      'Material', 'Alyuminiy', 'Og\'irlik', '200 g', 'Ekran', '6.4"',
      '', '', '', '',
    ];
    const example2 = [
      'Futbolka erkaklar uchun', 'Paxta 100%', 150000, 5, 'FUT-S',
      leafCategories[1]?.slug ?? leafCategories[0]?.slug ?? 'odejda', '', 'dona', '',
      "O'lcham", 'S', 'Material', 'Paxta 100%', 'Mamlakat', 'O\'zbekiston',
      "O'lcham", 'S', 'Rang', 'Qora',
    ];
    const example3 = [
      'Futbolka erkaklar uchun', 'Paxta 100%', 150000, 3, 'FUT-M',
      leafCategories[1]?.slug ?? leafCategories[0]?.slug ?? 'odejda', '', 'dona', '',
      "O'lcham", 'M', 'Material', 'Paxta 100%', '', '',
      "O'lcham", 'M', 'Rang', 'Qora',
    ];
    const example4 = [
      'Futbolka erkaklar uchun', 'Paxta 100%', 150000, 8, '',
      leafCategories[1]?.slug ?? leafCategories[0]?.slug ?? 'odejda', '', 'dona', '',
      '', '', '', '', '', '',
      "O'lcham", 'M', 'Rang', 'Oq',
    ];
    return buildWorkbookBuffer([
      {
        name: 'Tovarlar',
        rows: [headerRow, example1, example2, example3, example4],
        colWidths: [25, 40, 12, 8, 14, 18, 35, 14, 35, 16, 14, 16, 14, 16, 14, 22, 18, 22, 18],
      },
      {
        name: 'Kategoriyalar',
        rows: [['slug', 'name'], ...leafCategories.map((c) => [c.slug, c.name])],
        colWidths: [22, 30],
      },
      {
        name: 'Variantlar qoʻllanmasi',
        rows: [
          ['Variantlar va xususiyatlar'],
          [],
          ['Xususiyatlar (harakteristikalar):'],
          ['  — "Xususiyatlar" ustunida: kalit:qiymat; kalit2:qiymat2 (masalan: Material:Paxta; Og\'irlik:200g)'],
          ['  — Yoki alohida ustunlar: "Xususiyat 1 nomi" va "Xususiyat 1 qiymat", 2 va 3 xuddi shunday. Ikkalasini ham ishlatish mumkin.'],
          [],
          ['Variantlar:'],
          ['Bir xil Nomi, Tavsif, Narx va Kategoriya slug boʻlgan qatorlar bitta mahsulot hisoblanadi.'],
          ['Agar "Variant 1 nomi" va "Variant 1 qiymat" (ixtiyoriy "Variant 2" ustunlari) toʻldirilsa, har bir qator bitta variant boʻladi.'],
          ['Misol: Futbolka uchun 3 qator — S-Qora (qoldiq 5), M-Qora (3), M-Oq (8). Natijada 1 ta mahsulot, 3 ta variant.'],
          ['Variant ustunlari boʻsh qator — oddiy mahsulot (variantsiz).'],
        ],
        colWidths: [70],
      },
    ]);
  }

  async importFromExcel(
    sellerId: string,
    buffer: Buffer,
  ): Promise<{ created: number; failed: number; createdTitles: string[]; errors: { row: number; title?: string; message: string }[] }> {
    const shop = await this.prisma.shop.findFirst({ where: { userId: sellerId } });
    if (!shop) throw new ForbiddenException('Shop not found');
    let rows: Record<string, unknown>[];
    try {
      rows = await workbookToRowRecords(buffer);
    } catch {
      throw new BadRequestException('Excel faylida hech qanday varaq topilmadi');
    }
    if (rows.length > EXCEL_IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `Maksimum ${EXCEL_IMPORT_MAX_ROWS} ta qator qabul qilinadi. Sizda ${rows.length} ta. Faylni boʻling yoki qatorlarni kamaytiring.`,
      );
    }
    const categoryBySlug = new Map<string, { id: string }>();
    const leafCategories = await this.prisma.category.findMany({
      where: { parentId: { not: null } },
      select: { id: true, slug: true },
    });
    leafCategories.forEach((c) => categoryBySlug.set(c.slug, { id: c.id }));

    const errors: { row: number; title?: string; message: string }[] = [];
    const createdTitles: string[] = [];
    let created = 0;
    const headerRow = 1;

    const col = (r: Record<string, unknown>, ...keys: string[]) => {
      for (const k of keys) {
        const v = r?.[k];
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return undefined;
    };
    const colStr = (r: Record<string, unknown>, ...keys: string[]) => String(col(r, ...keys) ?? '').trim();

    const isEmptyRow = (r: Record<string, unknown>) => {
      const vals = Object.values(r);
      return vals.every((v) => v === undefined || v === null || v === '' || String(v).trim() === '');
    };

    type ParsedRow = {
      rowNum: number;
      title: string;
      description: string;
      price: number;
      categoryId: string;
      categorySlug: string;
      stock: number;
      sku?: string;
      imageUrls?: string[];
      unit?: string;
      specs?: Record<string, string>;
      opt1Name: string;
      opt1Value: string;
      opt2Name: string;
      opt2Value: string;
    };

    const parsed: ParsedRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>;
      const rowNum = headerRow + 1 + i;
      if (isEmptyRow(row)) continue;
      const title = colStr(row, 'Nomi', 'title');
      if (title === 'Nomi' || title === 'title') continue;
      const description = colStr(row, 'Tavsif', 'description');
      const priceRaw = col(row, 'Narx (soʻm)', 'price');
      const categorySlug = colStr(row, 'Kategoriya slug', 'categorySlug');

      if (!title) {
        errors.push({ row: rowNum, message: 'Nomi toʻldirilishi shart' });
        continue;
      }
      if (title.length > TITLE_MAX_LENGTH) {
        errors.push({ row: rowNum, title, message: `Nomi ${TITLE_MAX_LENGTH} belgidan oshmasligi kerak` });
        continue;
      }
      if (!description) {
        errors.push({ row: rowNum, title, message: 'Tavsif toʻldirilishi shart' });
        continue;
      }
      if (description.length > DESCRIPTION_MAX_LENGTH) {
        errors.push({ row: rowNum, title, message: `Tavsif ${DESCRIPTION_MAX_LENGTH} belgidan oshmasligi kerak` });
        continue;
      }
      const price = parseProductNum(priceRaw);
      if (price === undefined || price < 0) {
        errors.push({ row: rowNum, title, message: 'Narx musbat son boʻlishi kerak' });
        continue;
      }
      if (!categorySlug) {
        errors.push({ row: rowNum, title, message: 'Kategoriya slug kiritilishi shart. "Kategoriyalar" varaqiga qarang' });
        continue;
      }
      const category = categoryBySlug.get(categorySlug);
      if (!category) {
        errors.push({ row: rowNum, title, message: `Kategoriya topilmadi: "${categorySlug}". "Kategoriyalar" varaqidagi slug dan foydalaning` });
        continue;
      }
      const stockRaw = col(row, 'Qoldiq', 'stock');
      const stock = stockRaw !== undefined && stockRaw !== null && stockRaw !== ''
        ? Math.max(0, Math.floor(Number(stockRaw)) || 0)
        : 0;
      const sku = colStr(row, 'SKU (ixtiyoriy)', 'sku') || undefined;
      const imageUrlsStr = colStr(row, 'Rasmlar URL (vergul bilan)', 'imageUrls');
      const imageUrls = imageUrlsStr ? imageUrlsStr.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
      const unit = colStr(row, 'Birlik (dona, kg...)', 'unit') || undefined;
      const specsStr = colStr(row, 'Xususiyatlar (kalit:qiymat; kalit2:qiymat2)', 'specs');
      const specs: Record<string, string> = {};
      if (specsStr) {
        for (const part of specsStr.split(';')) {
          const [k, v] = part.split(':').map((s) => s.trim());
          if (k && v) specs[k] = v;
        }
      }
      const spec1Name = colStr(row, 'Xususiyat 1 nomi');
      const spec1Val = colStr(row, 'Xususiyat 1 qiymat');
      const spec2Name = colStr(row, 'Xususiyat 2 nomi');
      const spec2Val = colStr(row, 'Xususiyat 2 qiymat');
      const spec3Name = colStr(row, 'Xususiyat 3 nomi');
      const spec3Val = colStr(row, 'Xususiyat 3 qiymat');
      if (spec1Name && spec1Val) specs[spec1Name] = spec1Val;
      if (spec2Name && spec2Val) specs[spec2Name] = spec2Val;
      if (spec3Name && spec3Val) specs[spec3Name] = spec3Val;
      const specsFinal = Object.keys(specs).length > 0 ? specs : undefined;
      const opt1Name = colStr(row, "Variant 1 nomi (masalan: O'lcham)", 'Variant 1 nomi');
      const opt1Value = colStr(row, "Variant 1 qiymat (masalan: S)", 'Variant 1 qiymat');
      const opt2Name = colStr(row, "Variant 2 nomi (masalan: Rang)", 'Variant 2 nomi');
      const opt2Value = colStr(row, "Variant 2 qiymat (masalan: Qora)", 'Variant 2 qiymat');
      parsed.push({
        rowNum, title, description, price, categoryId: category.id, categorySlug, stock, sku, imageUrls, unit, specs: specsFinal,
        opt1Name, opt1Value, opt2Name, opt2Value,
      });
    }

    const productKey = (p: ParsedRow) => `${p.title}\t${p.description}\t${p.price}\t${p.categorySlug}`;
    const groups = new Map<string, ParsedRow[]>();
    for (const p of parsed) {
      const key = productKey(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    for (const groupRows of groups.values()) {
      const first = groupRows[0];
      const hasVariants = groupRows.some((r) => r.opt1Name || r.opt1Value || r.opt2Name || r.opt2Value);

      if (!hasVariants) {
        const dto: CreateProductDto = {
          title: first.title,
          description: first.description,
          price: first.price,
          stock: first.stock,
          sku: first.sku,
          categoryId: first.categoryId,
          imageUrls: first.imageUrls,
          unit: first.unit,
          specs: first.specs,
        };
        try {
          await this.products.create(sellerId, dto);
          created++;
          createdTitles.push(first.title);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ row: first.rowNum, title: first.title, message: msg });
        }
        continue;
      }

      const name1 = groupRows.map((r) => r.opt1Name).find(Boolean) ?? '';
      let name2 = groupRows.map((r) => r.opt2Name).find(Boolean) ?? '';
      if (name2 === name1) name2 = '';
      const options: Record<string, string[]> = {};
      const valueByOpt = new Map<string, Set<string>>();
      for (const r of groupRows) {
        if (name1 && r.opt1Value) {
          if (!valueByOpt.has(name1)) valueByOpt.set(name1, new Set());
          valueByOpt.get(name1)!.add(r.opt1Value);
        }
        if (name2 && r.opt2Value) {
          if (!valueByOpt.has(name2)) valueByOpt.set(name2, new Set());
          valueByOpt.get(name2)!.add(r.opt2Value);
        }
      }
      for (const [name, vals] of valueByOpt) {
        options[name] = [...vals];
      }
      const variants = groupRows.map((r) => {
        const opts: Record<string, string> = {};
        if (name1 && r.opt1Value) opts[name1] = r.opt1Value;
        if (name2 && r.opt2Value) opts[name2] = r.opt2Value;
        return { options: opts, stock: r.stock, imageUrl: undefined as string | undefined, sku: r.sku };
      });

      const dto: CreateProductDto = {
        title: first.title,
        description: first.description,
        price: first.price,
        categoryId: first.categoryId,
        imageUrls: first.imageUrls,
        unit: first.unit,
        specs: first.specs,
        options,
        variants,
      };
      try {
        await this.products.create(sellerId, dto);
        created++;
        createdTitles.push(first.title);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ row: first.rowNum, title: first.title, message: msg });
      }
    }
    return { created, failed: errors.length, createdTitles, errors };
  }
}
