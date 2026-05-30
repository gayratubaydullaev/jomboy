import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const uzPath = path.join(root, 'messages', 'uz.json');
const ruPath = path.join(root, 'messages', 'ru.json');
const uzPartial = path.join(root, 'messages', 'admin-uz.partial.json');
const ruPartial = path.join(root, 'messages', 'admin-ru.partial.json');

const uz = JSON.parse(fs.readFileSync(uzPath, 'utf8'));
const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
if (uz.admin || ru.admin) {
  console.error('admin key already exists');
  process.exit(1);
}
uz.admin = JSON.parse(fs.readFileSync(uzPartial, 'utf8'));
ru.admin = JSON.parse(fs.readFileSync(ruPartial, 'utf8'));
fs.writeFileSync(uzPath, JSON.stringify(uz, null, 2) + '\n');
fs.writeFileSync(ruPath, JSON.stringify(ru, null, 2) + '\n');
fs.unlinkSync(uzPartial);
fs.unlinkSync(ruPartial);
console.log('merged admin into uz.json / ru.json');
