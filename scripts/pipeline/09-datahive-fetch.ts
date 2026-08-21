/**
 * Adım 9 — besin kalibrasyonu için referans tarif seti indir.
 *
 *   npm run data:datahive              8.000 tarif indir
 *   npm run data:datahive -- --adet 20000
 *
 * Kaynak: `datahiveai/recipes-with-nutrition` (Hugging Face, 39.447 tarif,
 * Edamam türevi). Kimlik doğrulaması gerektirmiyor.
 *
 * ── Neden bu set ───────────────────────────────────────────────────
 *
 * Besin hesabımızın hatasını ölçmek için malzemesi **gramajıyla** verilen
 * ve porsiyon başına besin değeri yazan tarifler gerekiyor. Şimdiye kadar
 * Yummly28K kullanıyorduk ve düzeneğin kendi gürültüsü ölçümü boğuyordu:
 * "2 cups chopped onion" gibi satırları grama çevirmek gerekiyordu ve
 * 8.000 tarifin 6.583'ü eşleşme eşiğini geçemiyordu.
 *
 * Bu sette o adım yok — her malzemenin ağırlığı zaten gram:
 *
 *   { "food": "kosher salt", "text": "1 tablespoon kosher salt",
 *     "weight": 14.56, "measure": "tablespoon", "quantity": 1 }
 *
 * Ayrıca `total_weight_g` alanı var; pişmiş ağırlık hesabımızı (`cookedGrams`)
 * ilk kez doğrulayabileceğiz — o çıktı bugüne kadar hiç sınanmadı.
 *
 * **Sınırı:** Edamam'ın rakamları da hesaplanmış, laboratuvarda ölçülmüş
 * değil. Yani bu "gerçekle karşılaştırma" değil, "olgun bir ticari besin
 * motoruyla aynı fikirde miyiz" sınavı. Yine de kendi düzeneğimizden çok
 * daha temiz.
 *
 * ── Neden CSV akışı ────────────────────────────────────────────────
 *
 * Dosya 450 MB ve satır başına ~11 KB (malzeme ve besin alanları gömülü
 * JSON). Tamamını indirmeye gerek yok: akış okunup istenen satır sayısına
 * ulaşınca kesiliyor. 8.000 satır ~90 MB.
 *
 * CSV alanları gömülü virgül, tırnak ve satır sonu içerdiği için satır satır
 * bölmek çalışmaz; aşağıdaki ayrıştırıcı tırnak durumunu takip ediyor.
 */

import fs from 'node:fs';
import path from 'node:path';

import { RAW_DIR } from './sources.ts';

const argN = process.argv.indexOf('--adet');
const LIMIT = argN > -1 ? Number(process.argv[argN + 1]) : 8000;

const URL =
  'https://huggingface.co/datasets/datahiveai/recipes-with-nutrition/resolve/main/recipes-with-nutrition.csv';

const OUT = path.join(RAW_DIR, 'datahive-besin.json');

// ── Akış hâlinde CSV ayrıştırma ────────────────────────────────────

/**
 * Tırnak durumunu takip eden basit ayrıştırıcı.
 *
 * Kural RFC 4180: alan tırnak içindeyse virgül ve satır sonu veriye aittir;
 * tırnak içinde çift tırnak (`""`) tek tırnak demektir.
 */
class CsvStream {
  private field = '';
  private row: string[] = [];
  private inQuotes = false;
  private quoteJustClosed = false;

  /** Bir metin parçasını yutar, tamamlanan satırları döndürür. */
  push(chunk: string): string[][] {
    const rows: string[][] = [];
    for (const ch of chunk) {
      if (this.inQuotes) {
        if (this.quoteJustClosed) {
          this.quoteJustClosed = false;
          if (ch === '"') {
            this.field += '"';
            continue;
          }
          this.inQuotes = false;
          // Tırnak kapandı; karakteri normal akışta yeniden değerlendir.
        } else if (ch === '"') {
          this.quoteJustClosed = true;
          continue;
        } else {
          this.field += ch;
          continue;
        }
      }

      if (ch === '"') this.inQuotes = true;
      else if (ch === ',') {
        this.row.push(this.field);
        this.field = '';
      } else if (ch === '\n') {
        this.row.push(this.field.replace(/\r$/, ''));
        rows.push(this.row);
        this.row = [];
        this.field = '';
      } else this.field += ch;
    }
    return rows;
  }
}

// ── Çekilecek alanlar ──────────────────────────────────────────────

interface Slim {
  name: string;
  servings: number;
  weightG: number;
  cuisine: string;
  /** [ad, gram] — ağırlığı olmayan malzeme atlanıyor. */
  ing: [string, number][];
  /** Porsiyon başına: kalori, protein, karbonhidrat, yağ. */
  per: [number, number, number, number];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/** Gömülü JSON alanları bozuk olabiliyor; hata satırı atlanıyor. */
function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  console.log(`\n════ DATAHIVE REFERANS SETİ ════`);
  console.log(`  kaynak: ${URL}`);
  console.log(`  hedef:  ${LIMIT} tarif\n`);

  const res = await fetch(URL);
  if (!res.ok || !res.body) throw new Error(`indirilemedi: HTTP ${res.status}`);

  const parser = new CsvStream();
  const decoder = new TextDecoder('utf-8');
  const reader = res.body.getReader();

  let header: string[] | null = null;
  let idx: Record<string, number> = {};
  const out: Slim[] = [];
  let seen = 0;
  let bytes = 0;
  let skipped = 0;

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;

    for (const row of parser.push(decoder.decode(value, { stream: true }))) {
      if (!header) {
        header = row;
        idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
        const need = ['recipe_name', 'servings', 'total_weight_g', 'ingredients', 'total_nutrients'];
        const missing = need.filter((k) => !(k in idx));
        if (missing.length) throw new Error(`beklenen sütun yok: ${missing.join(', ')}`);
        continue;
      }

      seen += 1;
      const servings = num(row[idx.servings]);
      const weightG = num(row[idx.total_weight_g]);
      if (!Number.isFinite(servings) || servings < 1) {
        skipped += 1;
        continue;
      }

      const ingRaw = parseJson<{ food?: string; weight?: number }[]>(row[idx.ingredients], []);
      const ing: [string, number][] = [];
      for (const it of ingRaw) {
        const w = num(it?.weight);
        if (it?.food && Number.isFinite(w) && w > 0) ing.push([String(it.food).toLowerCase(), w]);
      }
      if (ing.length < 3) {
        skipped += 1;
        continue;
      }

      const nut = parseJson<Record<string, { quantity?: number }>>(row[idx.total_nutrients], {});
      const per: [number, number, number, number] = [
        num(nut.ENERC_KCAL?.quantity) / servings,
        num(nut.PROCNT?.quantity) / servings,
        num(nut.CHOCDF?.quantity) / servings,
        num(nut.FAT?.quantity) / servings,
      ];
      if (!per.every((x) => Number.isFinite(x) && x >= 0) || per[0] <= 0) {
        skipped += 1;
        continue;
      }

      out.push({
        name: row[idx.recipe_name] ?? '',
        servings,
        weightG: Number.isFinite(weightG) ? weightG : 0,
        cuisine: (row[idx.cuisine_type] ?? '').replace(/[[\]"]/g, ''),
        ing,
        per: per.map((x) => Math.round(x * 10) / 10) as typeof per,
      });

      if (out.length >= LIMIT) break outer;
    }
  }

  // Akışı erken kesiyoruz; kalan veriyi indirmeye gerek yok.
  await reader.cancel().catch(() => {});

  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`  taranan satır: ${seen}`);
  console.log(`  atlanan:       ${skipped}`);
  console.log(`  alınan:        ${out.length}`);
  console.log(`  indirilen:     ${(bytes / 1e6).toFixed(0)} MB`);
  console.log(`\n  ${OUT} yazıldı (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
