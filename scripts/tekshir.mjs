// Tentart ERP — tez tekshiruv: har bir HTML ichidagi <script> va har bir .js fayl sintaksisini tekshiradi.
// Ishga tushirish: node scripts/tekshir.mjs   (xato bo'lsa exit code 1)
import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = new URL('..', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'tekshir-'));
const files = [
  ...readdirSync(root).filter(f => /\.(html|js)$/.test(f)),
  'site/index.html', 'api/claude.js',
];
let xato = 0, soni = 0;

function check(code, nom, isModule) {
  const p = join(tmp, `${soni++}.${isModule ? 'mjs' : 'js'}`);
  writeFileSync(p, code);
  try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); }
  catch (e) { xato++; console.log(`❌ ${nom}\n${String(e.stderr).split('\n').slice(1, 5).join('\n')}`); }
}

for (const f of files) {
  let src; try { src = readFileSync(join(root, f), 'utf8'); } catch { continue; }
  if (f.endsWith('.js')) { check(src, f, /^\s*(export|import)\s/m.test(src)); continue; }
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, i = 0;
  while ((m = re.exec(src))) {
    const attrs = m[1] || '';
    if (/\bsrc=/.test(attrs) || /type=["'](application\/(ld\+)?json|text\/template)/.test(attrs)) continue;
    i++; check(m[2], `${f} <script #${i}>`, /type=["']module/.test(attrs));
  }
}
console.log(xato ? `\n${xato} ta xato topildi.` : `✅ Hammasi joyida (${soni} ta skript tekshirildi).`);
process.exit(xato ? 1 : 0);
