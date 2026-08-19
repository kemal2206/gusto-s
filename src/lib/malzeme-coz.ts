/**
 * Kullanıcının yazdığı malzeme satırını çözme.
 *
 * "2 su bardağı un" gibi bir satırı miktar + birim + ada ayırıyor, adı
 * katalogla eşleştiriyor ve grama çeviriyor. Eşleşirse tarif uygulamanın
 * akıllı kısımlarına katılabiliyor: "elimde ne var" onu bulabiliyor, besin
 * değeri hesaplanabiliyor, lezzet motoru malzemeyi tanıyor.
 *
 * **Eşleşmezse satır yine duruyor.** Katalogda olmayan bir şey yazan
 * kullanıcıyı kapıda bırakmak, tarifini hiç yazmamasına yol açar; satır
 * `raw` olarak kalıyor ve ekranda aynen görünüyor.
 */

import { BY_SLUG, INGREDIENTS } from '@/data/catalog';
import { gramsFor, UNIT_NAMES } from '@/data/catalog/olcu';
import type { Ingredient } from '@/engine';
import type { OwnIngredient } from '@/lib/cookbook/types';

const lower = (s: string) => s.toLocaleLowerCase('tr-TR');

const fold = (s: string) =>
  lower(s)
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');

/** Türkçe iyelik eki: "mantarı" → "mantar". Katalog adları ekli yazılıyor. */
const stem = (w: string) => (w.length >= 6 ? w.replace(/(sı|si|su|sü|ı|i|u|ü)$/, '') : w);

const BY_NAME = new Map<string, string>();
const BY_FOLDED = new Map<string, string>();
for (const i of INGREDIENTS) {
  BY_NAME.set(lower(i.nameTr), i.slug);
  const f = fold(i.nameTr);
  if (!BY_FOLDED.has(f)) BY_FOLDED.set(f, i.slug);
}

export interface ParsedLine {
  amount: number | null;
  unit: string | null;
  name: string;
}

/**
 * "2,5 su bardağı un" → { amount: 2.5, unit: 'su bardağı', name: 'un' }
 *
 * Birim listesi uzundan kısaya taranıyor: "çay bardağı" ile "çay kaşığı"
 * ikisi de "çay" ile başlıyor, kısa olan önce eşleşirse ölçü yanlış çıkıyor.
 */
export function parseIngredientLine(input: string): ParsedLine {
  let rest = input.trim().replace(/\s+/g, ' ');
  if (!rest) return { amount: null, unit: null, name: '' };

  // Baştaki sayı — "1/2" ve "2,5" dâhil.
  let amount: number | null = null;
  const frac = rest.match(/^(\d+)\s*\/\s*(\d+)\s*/);
  const num = rest.match(/^(\d+(?:[.,]\d+)?)\s*/);

  if (frac) {
    amount = Number(frac[1]) / Number(frac[2]);
    rest = rest.slice(frac[0].length);
  } else if (num) {
    amount = Number(num[1].replace(',', '.'));
    rest = rest.slice(num[0].length);
  }

  let unit: string | null = null;
  const low = lower(rest);
  for (const u of UNIT_NAMES) {
    if (low.startsWith(u + ' ') || low === u) {
      unit = u;
      rest = rest.slice(u.length).trim();
      break;
    }
  }
  if (!unit && /^adet\b/i.test(rest)) rest = rest.replace(/^adet\b/i, '').trim();

  return { amount, unit, name: rest.trim() };
}

/** Malzeme adını katalogda ara. Bulamazsa `undefined`. */
export function resolveIngredientName(name: string): Ingredient | undefined {
  const n = lower(name).trim();
  if (!n) return undefined;

  const direct = BY_NAME.get(n) ?? BY_FOLDED.get(fold(n));
  if (direct) return BY_SLUG.get(direct);

  // Katalog adı girdiyi kapsıyor mu: "kültür mantarı" ← "mantar"
  const st = stem(fold(n));
  for (const i of INGREDIENTS) {
    const f = fold(i.nameTr);
    if (f === st || f.startsWith(st + ' ') || f.endsWith(' ' + st) || fold(i.nameTr).includes(st)) {
      if (st.length >= 4) return i;
    }
  }
  return undefined;
}

/** Yazarken çıkan öneriler — baştan eşleşenler önce. */
export function suggestIngredients(query: string, limit = 8): Ingredient[] {
  const q = fold(query).trim();
  if (q.length < 2) return [];

  const starts: Ingredient[] = [];
  const contains: Ingredient[] = [];

  for (const i of INGREDIENTS) {
    const f = fold(i.nameTr);
    if (f.startsWith(q)) starts.push(i);
    else if (f.includes(q)) contains.push(i);
    if (starts.length >= limit) break;
  }

  return [...starts, ...contains].slice(0, limit);
}

/** Bir satırı kitaba yazılacak biçime çevir. */
export function resolveLine(text: string): OwnIngredient {
  const raw = text.trim();
  const parsed = parseIngredientLine(raw);
  const ing = resolveIngredientName(parsed.name);
  if (!ing) return { raw };

  return {
    raw,
    slug: ing.slug,
    grams: gramsFor(parsed.amount, parsed.unit, ing.slug, ing.category),
  };
}
