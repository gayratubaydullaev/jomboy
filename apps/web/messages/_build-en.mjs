import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = __dirname;
const uz = JSON.parse(fs.readFileSync(path.join(dir, 'uz.json'), 'utf8'));

const en = JSON.parse(fs.readFileSync(path.join(dir, '_en-data.json'), 'utf8'));

function flatten(obj, prefix = '') {
  const keys = [];
  for (const k of Object.keys(obj)) {
    const pathKey = prefix ? prefix + '.' + k : k;
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      keys.push(...flatten(obj[k], pathKey));
    } else {
      keys.push(pathKey);
    }
  }
  return keys;
}

const uzKeys = flatten(uz).sort();
const enKeys = flatten(en).sort();
const missing = uzKeys.filter((k) => !enKeys.includes(k));
const extra = enKeys.filter((k) => !uzKeys.includes(k));

if (missing.length || extra.length) {
  console.error('Structure mismatch!');
  console.error('Missing:', missing);
  console.error('Extra:', extra);
  process.exit(1);
}

fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify(en, null, 2) + '\n', 'utf8');
console.log('Written en.json');
console.log('uz keys:', uzKeys.length);
console.log('en keys:', enKeys.length);
console.log('Match:', uzKeys.length === enKeys.length);
