import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = __dirname;

const uz = JSON.parse(fs.readFileSync(path.join(dir, 'uz.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(dir, 'ru.json'), 'utf8'));

const CACHE_PATH = path.join(dir, '_ru-en-cache.json');
let cache = {};
if (fs.existsSync(CACHE_PATH)) {
  cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
}

function collectValues(obj, out = new Set()) {
  for (const k of Object.keys(obj)) {
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      collectValues(obj[k], out);
    } else {
      out.add(obj[k]);
    }
  }
  return out;
}

const allValues = [...collectValues(ru)];
const toTranslate = allValues.filter((v) => !cache[v]);

function shouldKeepAsIs(text, uzText) {
  if (text === uzText && /^[\w@.+:\-\/\s{}«»—(),.…*#%+°²³]+$/u.test(text) && !/[а-яА-ЯёЁ]/.test(text)) {
    return true;
  }
  if (/^(uz_Latn|ru_RU|en_US|Oline Bozor|Click|Payme|BozorUZ|Telegram|Excel|SKU|AB12CD|\+998\.\.\.|••••••••|email@example\.com|name@example\.com|https:\/\/\.\.\.|\/catalog|ORD-|kg|g|l|ml|m²|m|Min|Max|—|\.|Ha|Yoʻq)$/i.test(text)) {
    return true;
  }
  if (text === 'Oʻzbekcha' || text === 'Русский') return true;
  return false;
}

async function translateOne(text, retries = 5) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url =
        'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(text.slice(0, 450)) +
        '&langpair=ru|en';
      const res = await fetch(url);
      const j = await res.json();
      if (j.responseStatus === 200) return j.responseData.translatedText;
      if (j.responseStatus === 429) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
    } catch {
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error(`translate failed: ${text.slice(0, 50)}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

console.log(`Translating ${toTranslate.length} strings (${allValues.length - toTranslate.length} cached)...`);

for (let i = 0; i < toTranslate.length; i++) {
  const ruText = toTranslate[i];
  if (shouldKeepAsIs(ruText, ruText)) {
    cache[ruText] = ruText;
    continue;
  }
  try {
    cache[ruText] = await translateOne(ruText);
  } catch (e) {
    console.error(`Failed at ${i}:`, ruText.slice(0, 60), e.message);
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    process.exit(1);
  }
  if ((i + 1) % 50 === 0) {
    console.log(`${i + 1}/${toTranslate.length}`);
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  }
  await sleep(600);
}

fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
console.log('Cache saved.');

function postProcess(enText, pathKey, uzText, ruText) {
  let s = enText;

  // Language section: match uz.json exactly
  if (pathKey === 'language.label') return 'Language';
  if (pathKey === 'language.uz') return 'Oʻzbekcha';
  if (pathKey === 'language.ru') return 'Русский';

  // Locale codes & identical non-Cyrillic strings
  if (pathKey.startsWith('site.ogLocale')) return uzText;
  if (shouldKeepAsIs(ruText, uzText) && ruText === uzText) return uzText;

  // Currency
  if (pathKey === 'checkout.currency') return 'sum';
  if (pathKey.includes('filterPrice') || pathKey.includes('amountSom') || pathKey.includes('MinPayout') || pathKey.includes('amountSomLabel')) {
    s = s.replace(/\b(UZS|soums?|so'?ms?|сум)\b/gi, 'sum');
    s = s.replace(/\(sum\)/gi, '(sum)');
  }

  // Brand names & legal abbreviations
  const brands = [
    ['Oline Bozor', 'Oline Bozor'],
    ['Online Bazaar', 'Oline Bozor'],
    ['Online Market', 'Oline Bozor'],
    ['Click', 'Click'],
    ['Payme', 'Payme'],
    ['BozorUZ', 'BozorUZ'],
    ['Telegram', 'Telegram'],
    ['Excel', 'Excel'],
    ['SKU', 'SKU'],
  ];
  for (const [from, to] of brands) {
    s = s.replaceAll(from, to);
  }

  // Restore interpolation placeholders if API broke them
  const placeholders = uzText.match(/\{\{[^}]+\}\}/g) || [];
  for (const ph of placeholders) {
    if (!s.includes(ph)) {
      const broken = ph.replace(/\{\{/g, '{ {').replace(/\}\}/g, '} }');
      if (s.includes(broken)) s = s.replaceAll(broken, ph);
      const spaced = ph.replace(/\{\{/g, '{{ ').replace(/\}\}/g, ' }}');
      if (s.includes(spaced)) s = s.replaceAll(spaced, ph);
    }
  }

  // Legal forms - keep Cyrillic abbreviations
  s = s.replace(/\bIE\b/g, 'ИП').replace(/\bLLC\b/g, 'ООО');
  if (pathKey.includes('legalIp') || pathKey.includes('LegalFormIp')) {
    return 'ИП (sole proprietor)';
  }
  if (pathKey.includes('legalOoo') || pathKey.includes('LegalFormOoo')) {
    return 'ООО (LLC)';
  }

  // Fix common API issues
  s = s.replace(/\s+/g, (m, offset, str) => (str[offset - 1] === ' ' ? ' ' : m));
  s = s.replace(/\. \./g, '.');
  s = s.replace(/sum sum/gi, 'sum');

  return s;
}

function buildEn(uzObj, ruObj, prefix = '') {
  const result = {};
  for (const k of Object.keys(uzObj)) {
    const pathKey = prefix ? prefix + '.' + k : k;
    if (uzObj[k] && typeof uzObj[k] === 'object' && !Array.isArray(uzObj[k])) {
      result[k] = buildEn(uzObj[k], ruObj?.[k], pathKey);
    } else {
      const ruVal = ruObj?.[k] ?? uzObj[k];
      let enVal = cache[ruVal] ?? ruVal;
      enVal = postProcess(enVal, pathKey, uzObj[k], ruVal);
      result[k] = enVal;
    }
  }
  return result;
}

const en = buildEn(uz, ru);
fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify(en, null, 2) + '\n', 'utf8');

function flatten(obj, prefix = '') {
  const keys = [];
  for (const k of Object.keys(obj)) {
    const p = prefix ? prefix + '.' + k : k;
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      keys.push(...flatten(obj[k], p));
    } else {
      keys.push(p);
    }
  }
  return keys;
}

console.log('uz:', flatten(uz).length, 'en:', flatten(en).length);
