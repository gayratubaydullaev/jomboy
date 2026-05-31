/**
 * One-off migration script: replace localStorage accessToken with useAuth().isLoggedIn
 * Run: node scripts/migrate-auth-cookie-only.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'src');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(name)) acc.push(p);
  }
  return acc;
}

const tokenLine =
  /const token = typeof window !== 'undefined' \? localStorage\.getItem\('accessToken'\) : null;/g;
const tokenLineMounted =
  /const token = mounted && typeof window !== 'undefined' \? localStorage\.getItem\('accessToken'\) : null;/g;

for (const file of walk(root)) {
  if (file.includes('auth-context') || file.includes('lib\\api.ts')) continue;
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes("localStorage.getItem('accessToken')") && !src.includes('Authorization: `Bearer ${token}`')) {
    continue;
  }

  let changed = false;
  if (tokenLine.test(src)) {
    src = src.replace(tokenLine, 'const { isLoggedIn, isReady } = useAuth();');
    changed = true;
  }
  if (tokenLineMounted.test(src)) {
    src = src.replace(tokenLineMounted, 'const { isLoggedIn, isReady } = useAuth();');
    changed = true;
  }

  src = src.replace(/if \(!token\) return;/g, 'if (!isReady || !isLoggedIn) return;');
  src = src.replace(/if \(!token\) \{/g, 'if (!isReady || !isLoggedIn) {');
  src = src.replace(/, \[token\]\)/g, ', [isReady, isLoggedIn])');
  src = src.replace(/, \[token,/g, ', [isReady, isLoggedIn,');
  src = src.replace(/apiFetch\(([^,]+), \{ headers: \{ Authorization: `Bearer \$\{token\}` \} \}\)/g, 'apiFetch($1)');
  src = src.replace(
    /apiFetch\(([^,]+), \{\s*headers: \{ Authorization: `Bearer \$\{token\}` \},?\s*\}\)/g,
    'apiFetch($1)',
  );

  if (changed || src.includes('isLoggedIn')) {
    if (!src.includes("from '@/contexts/auth-context'") && !src.includes('from "@/contexts/auth-context"')) {
      if (src.includes('useAuth()')) {
        const importMatch = src.match(/^import .+;\n/m);
        if (importMatch) {
          src = src.replace(importMatch[0], `${importMatch[0]}import { useAuth } from '@/contexts/auth-context';\n`);
        }
      }
    }
    fs.writeFileSync(file, src);
    console.log('updated', path.relative(root, file));
  }
}
