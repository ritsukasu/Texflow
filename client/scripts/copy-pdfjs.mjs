import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
const target = path.join(here, '..', 'public', 'pdfjs');

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const dir of ['standard_fonts', 'wasm', 'cmaps']) {
  const source = path.join(pdfjsRoot, dir);
  if (existsSync(source)) cpSync(source, path.join(target, dir), { recursive: true });
}
