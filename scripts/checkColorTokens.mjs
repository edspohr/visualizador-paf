#!/usr/bin/env node
// Verifica que cada `var(--color-*)` referenciado en src/ esté definido
// en el bloque :root de src/index.css. Falla con exit 1 si hay tokens
// indefinidos, listando dónde aparecen.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(ROOT, 'src');
const INDEX_CSS = join(SRC_DIR, 'index.css');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function extractDefinedTokens(cssText) {
  const rootMatch = cssText.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch) return new Set();
  const body = rootMatch[1];
  const tokens = new Set();
  const re = /--color-[a-zA-Z0-9-]+/g;
  let m;
  while ((m = re.exec(body)) !== null) tokens.add(m[0]);
  return tokens;
}

const defined = extractDefinedTokens(readFileSync(INDEX_CSS, 'utf8'));

const refRe = /var\((--color-[a-zA-Z0-9-]+)\)/g;
const offenders = []; // { file, line, token }

for (const file of walk(SRC_DIR)) {
  if (!/\.(jsx?|tsx?|css)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((lineText, i) => {
    let m;
    refRe.lastIndex = 0;
    while ((m = refRe.exec(lineText)) !== null) {
      const token = m[1];
      if (!defined.has(token)) {
        offenders.push({ file: relative(ROOT, file), line: i + 1, token });
      }
    }
  });
}

if (offenders.length) {
  console.error('\n✗ Tokens CSS indefinidos referenciados en src/:');
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  ${o.token}`);
  }
  console.error(`\nDefine estos tokens en el bloque :root de src/index.css antes de compilar.\n`);
  process.exit(1);
}

console.log(`✓ Tokens CSS OK (${defined.size} definidos, sin referencias huérfanas).`);
