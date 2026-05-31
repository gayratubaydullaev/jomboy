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
  if (file.includes('auth-context')) continue;
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('token') && !src.includes('isTokenExpired')) continue;
  const orig = src;

  src = src.replace(/const \{ token, isReady \} = useAuth\(\)/g, 'const { isLoggedIn, isReady } = useAuth()');
  src = src.replace(/const \{ token, setToken \} = useAuth\(\)/g, 'const { isLoggedIn, isReady, setToken, clearAuth } = useAuth()');
  src = src.replace(/const \{ token \} = useAuth\(\)/g, 'const { isLoggedIn, isReady } = useAuth()');

  src = src.replace(/if \(!token\) return <DashboardAuthGate \/>;/g, 'if (!isReady || !isLoggedIn) return <DashboardAuthGate />;');
  src = src.replace(/if \(!token\) return null;/g, 'if (!isReady || !isLoggedIn) return null;');
  src = src.replace(/if \(!token\) return;/g, 'if (!isReady || !isLoggedIn) return;');
  src = src.replace(/if \(!token \|\|/g, 'if (!isLoggedIn ||');
  src = src.replace(/if \(token\)/g, 'if (isLoggedIn)');
  src = src.replace(/if \(!mounted \|\| token\)/g, 'if (!mounted || isLoggedIn)');
  src = src.replace(/if \(!mounted \|\| !token\)/g, 'if (!mounted || !isLoggedIn)');
  src = src.replace(/if \(token\)/g, 'if (isLoggedIn)');
  src = src.replace(/!token &&/g, '!isLoggedIn &&');
  src = src.replace(/\{!token &&/g, '{!isLoggedIn &&');
  src = src.replace(/\{!token \|\|/g, '{!isLoggedIn ||');
  src = src.replace(/, token\)/g, ', isReady, isLoggedIn)');
  src = src.replace(/, token,/g, ', isReady, isLoggedIn,');
  src = src.replace(/\[token\]/g, '[isReady, isLoggedIn]');
  src = src.replace(/\[router, token, isReady\]/g, '[router, isReady, isLoggedIn]');
  src = src.replace(/const isLoggedIn = !!token;/g, '');
  src = src.replace(/if \(!token \|\| !id\)/g, 'if (!isLoggedIn || !id)');
  src = src.replace(/if \(!text \|\| !token \|\| !id\)/g, 'if (!text || !isLoggedIn || !id)');
  src = src.replace(/if \(!file \|\| !token\)/g, 'if (!file || !isLoggedIn)');
  src = src.replace(/if \(!files\?\.length \|\| !token\)/g, 'if (!files?.length || !isLoggedIn)');
  src = src.replace(/open && token\)/g, 'open && isLoggedIn)');

  if (src !== orig) {
    fs.writeFileSync(file, src);
    console.log('token->isLoggedIn', path.relative(root, file));
  }
}
