/**
 * Remove manual Authorization headers — apiFetch uses httpOnly cookies via proxy.
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

for (const file of walk(root)) {
  if (file.endsWith('api\\auth\\session\\route.ts') || file.endsWith('lib\\api.ts')) continue;
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;

  // Remove standalone header vars
  src = src.replace(/\n\s*const headers = token \? \{ Authorization: `Bearer \$\{token\}` \} : undefined;\n/g, '\n');
  src = src.replace(/\n\s*const h = \{ Authorization: `Bearer \$\{token\}` \};\n/g, '\n');
  src = src.replace(/,\s*\{\s*headers:\s*h\s*\}/g, '');
  src = src.replace(/,\s*\{\s*headers\s*\}/g, '');

  // headers: { Authorization: `Bearer ${token}` } only
  src = src.replace(/headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`\s*\},?\s*/g, '');
  src = src.replace(/headers:\s*\{\s*Authorization:\s*`Bearer \$\{authToken\}`\s*\},?\s*/g, '');
  src = src.replace(/headers:\s*\{\s*'Content-Type':\s*'application\/json',\s*Authorization:\s*`Bearer \$\{token\}`\s*\}/g, "headers: { 'Content-Type': 'application/json' }");
  src = src.replace(/headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`,\s*'Content-Type':\s*'application\/json'\s*\}/g, "headers: { 'Content-Type': 'application/json' }");
  src = src.replace(/headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`,\s*\n\s*'Content-Type':\s*'application\/json',?\s*\}/g, "headers: { 'Content-Type': 'application/json' }");

  // Record<string, string> headers with only Authorization
  src = src.replace(/\n\s*const headers: Record<string, string> = \{ Authorization: `Bearer \$\{token\}` \};\n/g, '\n');
  src = src.replace(/Authorization: `Bearer \$\{token\}`,\n\s*/g, '');
  src = src.replace(/,\s*Authorization: `Bearer \$\{token\}`/g, '');

  // localStorage accessToken remnants
  src = src.replace(/localStorage\.setItem\('accessToken',[^)]+\);\n?\s*/g, '');
  src = src.replace(/const token = localStorage\.getItem\('accessToken'\);\n/g, '');
  src = src.replace(/const authToken = localStorage\.getItem\('accessToken'\);\n/g, '');
  src = src.replace(/const accessToken = localStorage\.getItem\('accessToken'\);\n/g, '');
  src = src.replace(/const jwt = typeof window !== 'undefined' \? localStorage\.getItem\('accessToken'\) : null;\n/g, '');

  // Empty headers objects
  src = src.replace(/headers:\s*\{\s*\}/g, '');
  src = src.replace(/,\s*headers:\s*\{\s*,/g, ', headers: {');
  src = src.replace(/headers:\s*\{\s*,\s*'Content-Type'/g, "headers: { 'Content-Type'");

  if (src !== orig) {
    fs.writeFileSync(file, src);
    console.log('cleaned', path.relative(root, file));
  }
}
