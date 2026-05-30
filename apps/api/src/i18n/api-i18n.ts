import type { ApiLocale } from './api-locale';
import { API_DICT_UZ } from './api-dict-uz';
import { API_DICT_RU } from './api-dict-ru';
import { getApiLocale } from './api-locale.context';

const dictionaries: Record<ApiLocale, Record<string, string>> = {
  uz: API_DICT_UZ,
  ru: API_DICT_RU,
};

export function apiT(loc: ApiLocale, key: string, vars?: Record<string, string | number>): string {
  const d = dictionaries[loc] ?? dictionaries.uz;
  const fb = dictionaries.uz;
  let s = d[key] ?? fb[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{{${k}}}`).join(String(v));
    }
  }
  return s;
}

/** Map legacy throw strings (EN/UZ) to dictionary keys. */
const LEGACY_TO_KEY: Record<string, string> = {
  'User not found': 'errors.userNotFound',
  'File is required': 'errors.fileRequired',
  'File content does not match image type': 'errors.fileContentMismatch',
  'uploadFromUrl is only supported when Cloudinary is configured (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET)': 'errors.cloudinaryOnly',
  "Do'kon topilmadi. Avval ariza topshiring va admin tasdiqlashini kuting.": 'errors.shopNotFoundApply',
  'Doʻkon topilmadi. Avval ariza topshiring va admin tasdiqlashini kuting.': 'errors.shopNotFoundApply',
  'Kod notoʻgʻri yoki muddati tugagan. Botda /start yoki /link bosing va yangi kod oling.': 'errors.linkCodeInvalid',
  'Doʻkon topilmadi.': 'errors.shopNotFound',
  'Siz allaqachon sotuvchisiz.': 'errors.alreadySeller',
  'Admin uchun ariza kerak emas.': 'errors.adminNoApplication',
  'Arizangiz ko‘rib chiqilmoqda. Kuting yoki admin bilan bog‘laning.': 'errors.applicationPending',
  'Arizangiz allaqachon qabul qilingan.': 'errors.applicationApproved',
  'Product not found': 'errors.productNotFound',
  'Rating must be between 1 and 5': 'errors.ratingRange',
  'Sharh yozish uchun avval ushbu mahsulotni sotib olishingiz kerak.': 'errors.reviewMustPurchase',
  'Review not found': 'errors.reviewNotFound',
  'Mahsulot faqat ostkategoriyaga biriktirilishi mumkin': 'errors.categoryLeafOnly',
  'Solishtirish narxi (eski narx) joriy narxdan kam boʻlishi mumkin emas. Sunʼiy chegirma yaratish taqiqlanadi.': 'errors.comparePriceInvalid',
  'Shop not found': 'errors.shopNotFoundForbidden',
  'Category not found': 'errors.categoryNotFound',
  'Excel faylida hech qanday varaq topilmadi': 'errors.excelNoSheet',
  'Fayl tanlanmadi. Excel (.xlsx, .xls) faylini yuklang.': 'errors.fileNotSelected',
  'Fayl yuklanmadi. Qaytadan urinib koʻring.': 'errors.fileUploadFailed',
  'Click not configured': 'errors.clickNotConfigured',
  'Checkout session not found': 'errors.checkoutSessionNotFound',
  'Session is not for Click': 'errors.sessionNotClick',
  'Order is not for Click': 'errors.orderNotClick',
  'Payme not configured': 'errors.paymeNotConfigured',
  'Session is not for Payme': 'errors.sessionNotPayme',
  'Order is not for Payme': 'errors.orderNotPayme',
  'sessionId or orderId and returnUrl required': 'errors.paymentParamsRequired',
  'Guest order requires guestPhone': 'errors.guestPhoneRequired',
  'Cart session required for guest order': 'errors.cartSessionRequired',
  'Cart session required': 'errors.cartSessionIdRequired',
  'Invalid session access': 'errors.invalidSessionAccess',
  'Toʻlovni faqat naqd yoki karta (yetkazishda) usuli uchun belgilash mumkin.': 'errors.orderPaymentCashOnly',
  'Click yoki Payme orqali toʻlov qilinmaguncha «Yuborildi» / «Yetkazildi» belgilab boʻlmaydi. Toʻlovni kuting yoki naqd/karta (yetkazishda) uchun buyurtma qiling.':
    'errors.orderPrepaidStatusBlocked',
  'Shipping address required for delivery': 'errors.shippingRequired',
  'Cart is empty': 'errors.cartEmpty',
  "Ba'zi mahsulotlar yetarli miqdorda mavjud emas. Savatni yangilang.": 'errors.cartOutOfStock',
  "Ba'zi mahsulotlar yetarli miqdorda mavjud emas.": 'errors.cartOutOfStockShort',
  'Invalid session cart': 'errors.invalidSessionCart',
  'Order not found': 'errors.orderNotFound',
  'Notification not found': 'errors.notificationNotFound',
  'Checkout session only for CLICK or PAYME': 'errors.checkoutOnlineOnly',
  "Click yoki Payme faqat bitta do'kondan buyurtma uchun. Boshqa to'lov turini tanlang yoki savatni bitta do'konga qisqartiring.": 'errors.singleShopPayment',
  'Cannot chat with yourself': 'errors.chatSelf',
  'Chat xaridor–sotuvchi hozircha platforma administratori tomonidan o‘chirilgan': 'errors.chatDisabledPlatform',
  'Sotuvchi hozircha xabarlarni qabul qilmaydi': 'errors.chatSellerDisabled',
  'Session not found': 'errors.sessionNotFound',
  'Content is required': 'errors.contentRequired',
  'O‘zingizni bloklay olmaysiz.': 'errors.cannotBlockSelf',
  'Faqat bosh admin foydalanuvchi rolini o‘zgartirishi mumkin.': 'errors.onlySuperAdminRole',
  'Noto‘g‘ri rol.': 'errors.invalidRole',
  'O‘zingizga bosh admindan boshqa rol berib bo‘lmaydi (tizimdan chiqib ketasiz).': 'errors.cannotDemoteSelf',
  'Faqat bosh admin moderator huquqlarini o‘zgartirishi mumkin.': 'errors.onlySuperAdminPermissions',
  'Faqat moderator rolidagi foydalanuvchiga huquqlar beriladi.': 'errors.moderatorPermissionsOnly',
  'Ariza topilmadi.': 'errors.applicationNotFound',
  'Ariza allaqachon ko‘rib chiqilgan.': 'errors.applicationAlreadyReviewed',
  'So‘rov topilmadi.': 'errors.shopUpdateNotFound',
  'So‘rov allaqachon ko‘rib chiqilgan.': 'errors.shopUpdateAlreadyReviewed',
  'Telegram login is not configured': 'errors.telegramNotConfigured',
  'Invalid Telegram init data': 'errors.telegramInitInvalid',
  'Invalid Telegram user data': 'errors.telegramUserInvalid',
  'Account blocked': 'errors.accountBlocked',
  'Telegram link is not configured': 'errors.telegramLinkNotConfigured',
  'Guest phone is required': 'errors.guestPhoneRequiredAuth',
  'Bu Telegram hisob allaqachon boshqa hisobga ulangan.': 'errors.telegramAlreadyLinked',
  'Link expired or invalid': 'errors.linkExpired',
  'Invalid credentials': 'errors.invalidCredentials',
  'No refresh token': 'errors.noRefreshToken',
  'Invalid or expired code': 'errors.invalidOtp',
  'token required': 'errors.tokenRequired',
  'Not available in production': 'errors.notAvailableProduction',
  'Email already registered': 'errors.emailAlreadyRegistered',
  'Invalid or expired refresh token': 'errors.invalidRefreshToken',
  'Kod notoʻgʻri yoki muddati tugagan. Botda /start yoki /link yuboring.': 'errors.adminLinkCodeInvalid',
  "To'lovni faqat naqd yoki karta (yetkazishda) usuli uchun belgilash mumkin.": 'errors.orderPaymentCashOnly',
  'Internal server error': 'errors.internal',
};

function translateOne(message: string, loc: ApiLocale): string {
  if (message.startsWith('errors.') || message.startsWith('email.')) {
    const t = apiT(loc, message);
    return t === message ? message : t;
  }
  const key = LEGACY_TO_KEY[message];
  if (key) return apiT(loc, key);

  if (message.startsWith('Invalid file type. Allowed:')) {
    const types = message.replace(/^Invalid file type\. Allowed:\s*/, '');
    return apiT(loc, 'errors.fileTypeInvalid', { types });
  }
  const insufficient = message.match(/^Mahsulot yetarli emas: (.+)$/);
  if (insufficient) return apiT(loc, 'errors.insufficientStock', { product: insufficient[1] });
  const slugTaken = message.match(/^Slug "(.+)" allaqachon band\.$/);
  if (slugTaken) return apiT(loc, 'errors.slugTaken', { slug: slugTaken[1] });
  const outOfStockLine = message.match(/^"(.+?)": (\d+) ta soʻralgan, mavjud (\d+) ta$/);
  if (outOfStockLine) {
    return apiT(loc, 'errors.outOfStockLine', {
      title: outOfStockLine[1],
      need: outOfStockLine[2],
      available: outOfStockLine[3],
    });
  }

  const variantMissing = message.match(
    /^Variantda "(.+)" uchun qiymat ko'rsatilmagan\. Barcha variantlar har bir option \((.+)\) uchun qiymatga ega bo'lishi kerak\.$/,
  );
  if (variantMissing) return apiT(loc, 'errors.variantOptionMissing', { key: variantMissing[1], options: variantMissing[2] });

  const variantInvalid = message.match(
    /^Variantda "(.+)": "(.+)" ruxsat etilmagan\. Ruxsat etilgan qiymatlar: (.+)$/,
  );
  if (variantInvalid) {
    return apiT(loc, 'errors.variantOptionInvalid', {
      key: variantInvalid[1],
      val: variantInvalid[2],
      allowed: variantInvalid[3],
    });
  }

  const variantDup = message.match(
    /^Bir xil variant ikki marta kiritilgan: (.+)\. Har bir kombinatsiya bitta variant bo'lishi kerak\.$/,
  );
  if (variantDup) return apiT(loc, 'errors.variantDuplicate', { combo: variantDup[1] });

  const variantIncomplete = message.match(/^Variantlar to'liq emas\. Quyidagi kombinatsiyalar uchun variant qo'shing: (.+)\. Har bir option qiymatlari kombinatsiyasi uchun bitta variant bo'lishi kerak\.$/);
  if (variantIncomplete) return apiT(loc, 'errors.variantIncomplete', { missing: variantIncomplete[1] });

  const variantExtra = message.match(/^Variantda product options'da bo'lmagan qiymat ishlatilgan: (.+)\.$/);
  if (variantExtra) return apiT(loc, 'errors.variantExtra', { extra: variantExtra[1] });

  if (message.includes('Excel faylida ustunlar topilmadi')) return apiT(loc, 'errors.excelInvalid');

  const reviewQuota = message.match(
    /^Siz ushbu mahsulot boʻyicha (\d+) ta sharh yozgansiz \(sotib olganlar: (\d+)\)\. Qoʻshimcha sharh yozish uchun mahsulotni qayta sotib oling\.$/,
  );
  if (reviewQuota) {
    return apiT(loc, 'errors.reviewQuotaExceeded', {
      reviewCount: reviewQuota[1],
      purchaseCount: reviewQuota[2],
    });
  }

  return message;
}

export function translateApiMessage(message: string | string[], loc?: ApiLocale): string | string[] {
  const l = loc ?? getApiLocale();
  if (Array.isArray(message)) return message.map((m) => translateOne(String(m), l));
  return translateOne(String(message), l);
}

export function translateExceptionPayload(
  payload: string | object,
  loc?: ApiLocale,
): string | object {
  const l = loc ?? getApiLocale();
  if (typeof payload === 'string') return translateOne(payload, l);
  if (payload && typeof payload === 'object') {
    const copy = { ...(payload as Record<string, unknown>) };
    if (typeof copy.message === 'string') copy.message = translateOne(copy.message, l);
    if (Array.isArray(copy.message)) copy.message = copy.message.map((m) => translateOne(String(m), l));
    if (Array.isArray(copy.outOfStock)) {
      copy.outOfStock = copy.outOfStock.map((line) => translateOne(String(line), l));
    }
    return copy;
  }
  return payload;
}
