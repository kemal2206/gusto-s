/**
 * Adım 1 — kaynakları indir.
 *
 *   npm run data:fetch
 *
 * Fikri sabit: var olan dosyayı tekrar indirmez. `--force` ile zorlanır.
 * Zip açmak için `tar` (Windows 10+ dahil bsdtar) kullanılıyor; yoksa python'a düşüyor.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { RAW_DIR, SOURCES, raw } from './sources.ts';

const force = process.argv.includes('--force');

const sha256 = (file: string) =>
  createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);

function unzip(zipPath: string, member: string, target: string) {
  const dir = path.dirname(target);
  try {
    // bsdtar zip de açar; Windows 10+ ile birlikte geliyor.
    execFileSync('tar', ['-xf', zipPath, '-C', dir, member], { stdio: 'pipe' });
  } catch {
    // Yedek yol: python zipfile.
    execFileSync(
      'python',
      [
        '-c',
        `import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extract(sys.argv[2],sys.argv[3])`,
        zipPath,
        member,
        dir,
      ],
      { stdio: 'pipe' },
    );
  }
  if (!fs.existsSync(target)) throw new Error(`Zip'ten çıkarılamadı: ${member}`);
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const manifest: Record<string, { bytes: number; sha256: string; license: string }> = {};

  for (const src of SOURCES) {
    const dest = raw(src.file);
    const final = src.extract ? raw(src.extract) : dest;

    if (fs.existsSync(final) && !force) {
      console.log(`atlandı  ${src.extract ?? src.file}`);
    } else {
      process.stdout.write(`indiriliyor  ${src.file} … `);
      const res = await fetch(src.url);
      if (!res.ok) throw new Error(`${src.url} → HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      console.log(`${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);

      if (src.extract) unzip(dest, src.extract, final);
    }

    manifest[src.id] = {
      bytes: fs.statSync(final).size,
      sha256: sha256(final),
      license: src.license,
    };
  }

  fs.writeFileSync(
    raw('MANIFEST.json'),
    JSON.stringify({ fetchedAt: new Date().toISOString(), sources: manifest }, null, 2),
  );

  console.log(`\n${SOURCES.length} kaynak hazır → data-raw/`);
  console.log('Atıf: Ahn Y-Y ve ark. (2011) Scientific Reports 1:196');
}

main();
