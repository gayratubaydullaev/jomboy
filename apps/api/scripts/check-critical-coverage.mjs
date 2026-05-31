#!/usr/bin/env node
/**
 * Validates line/branch coverage on P0 API modules (Windows-safe paths).
 * Run after: pnpm exec jest --coverage --coverageReporters=json-summary
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const summaryPath = join(root, 'coverage', 'coverage-summary.json');

if (!existsSync(summaryPath)) {
  console.error('Missing coverage/coverage-summary.json — run jest with --coverageReporters=json-summary');
  process.exit(1);
}

/** @type {Record<string, { lines: { pct: number }, branches: { pct: number } }>} */
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));

/** [summary key suffix, min lines %, min branches %] */
const RULES = [
  ['common/csrf.middleware.ts', 95, 90],
  ['auth/guards/roles.guard.ts', 90, 85],
  ['auth/guards/moderator-permissions.guard.ts', 90, 85],
  ['cart/cart.service.ts', 35, 25],
  ['products/products.service.ts', 35, 25],
  ['products/product-query.service.ts', 70, 50],
];

function findKey(suffix) {
  return Object.keys(summary).find((k) => k.replace(/\\/g, '/').endsWith(suffix));
}

let failed = false;
for (const [suffix, minLines, minBranches] of RULES) {
  const key = findKey(suffix);
  if (!key || key === 'total') {
    console.error(`FAIL: no coverage entry for ${suffix}`);
    failed = true;
    continue;
  }
  const { lines, branches } = summary[key];
  const lineOk = lines.pct >= minLines;
  const branchOk = branches.pct >= minBranches;
  const status = lineOk && branchOk ? 'OK' : 'FAIL';
  console.log(
    `${status} ${suffix}: lines ${lines.pct}% (min ${minLines}%), branches ${branches.pct}% (min ${minBranches}%)`,
  );
  if (!lineOk || !branchOk) failed = true;
}

process.exit(failed ? 1 : 0);
