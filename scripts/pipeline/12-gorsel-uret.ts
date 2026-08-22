/**
 * Adım 12 — promptlardan görselleri toplu üret.
 *
 *   npm run gorsel:uret -- --kuru                 ne üretilecek, ne tutacak (istek atmaz)
 *   npm run gorsel:uret -- --parti1               deneme partisi
 *   npm run gorsel:uret -- --slug manti,kunefe    tek tek
 *   npm run gorsel:uret -- --limit 50             ilk 50
 *   npm run gorsel:uret -- --hepsi                korpusun tamamı
 *   npm run gorsel:uret -- --saglayici replicate  (varsayılan: fal)
 *
 * Girdi `data-build/gorsel-promptlari.jsonl` — adım 11'in çıktısı.
 * `docs/PARTI-1.md` DEĞİL: o dosya insan için, elle kopyalanacak promptları
 * okunur biçimde tutuyor. Makine için JSONL var ve zaten her alan ayrı
 * duruyor (prompt, negative, slug, angle, vessel…).
 *
 * ── Neden ayrı bir çalıştırıcı ─────────────────────────────────────
 *
 * 2.964 görseli elle üretmek mümkün değil ve sohbet arayüzünden hiç değil:
 * o arayüzler promptu görsel modeline göndermeden önce **yeniden yazıyor**.
 * Şartnamenin çalışıp çalışmadığını ölçmek istiyorsak araya yeniden yazıcı
 * girmemeli — bu yüzden doğrudan API.
 *
 * ── Yeniden başlatılabilir ─────────────────────────────────────────
 *
 * Dosyası zaten olan tarif atlanıyor. 3.000 görsellik bir iş yarıda kesilir
 * (kota, ağ, elektrik) ve baştan başlamak hem parayı hem saatleri çöpe atar.
 * Aynı komutu tekrar çalıştırmak kaldığı yerden devam ediyor.
 *
 * ── Negatif prompt ─────────────────────────────────────────────────
 *
 * Süs denetimi ve katı tepeden kuralının yarısı negatif promptta duruyor.
 * Sağlayıcı ayrı bir negatif alanı kabul etmiyorsa `--negatif-birlestir`
 * negatifleri olumlu cümleye çevirip prompta ekliyor ("The image must not
 * contain: …"). Modern talimat izleyen modellerde bu yeterince iyi
 * çalışıyor; hiç göndermemek ise menemen'e peyniri geri getirir.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Sağlayıcılar ───────────────────────────────────────────────────
//
// Fiyatlar Ağustos 2026 itibarıyla; değişirse buradan güncellenecek çünkü
// `--kuru` maliyet tahmini bunlara bakıyor.

interface Provider {
  name: string;
  envKey: string;
  endpoint: string;
  pricePerImage: number;
  /** Ayrı negatif alanı kabul ediyor mu? Etmiyorsa prompta katılıyor. */
  supportsNegative: boolean;
  headers: (key: string) => Record<string, string>;
  body: (prompt: string, negative: string) => unknown;
}

/**
 * fal.ai modelleri — eleme turu için.
 *
 * Bu iş için sıralama ölçütü **güzellik değil itaat**: promptta aynı anda
 * ~10 kısıt var (açı, kap, sır, zemin, süs yasakları, güvenli kırpma alanı).
 * En güzel kareyi üreten değil, en çok kısıta uyan model kazanmalı — 3.000
 * karede gözle denetim maliyetini o belirliyor.
 *
 * Metin üretme yeteneği bu işte **tamamen gereksiz**: karelerde yazı yok.
 * Recraft ve Ideogram'ın başlıca üstünlüğü orada olduğu için listeye
 * alınmadılar.
 *
 * Uç nokta kimlikleri fal.ai/models sayfasından doğrulanmalı; sürüm adları
 * değişiyor. `--kuru` çıktısı uç noktayı basıyor, göz kontrolü kolay olsun.
 */
const FAL_HEADERS = (key: string) => ({
  Authorization: `Key ${key}`,
  'Content-Type': 'application/json',
});

const FAL_SIZE = { image_size: { width: 1536, height: 1536 }, num_images: 1 };

const PROVIDERS: Record<string, Provider> = {
  // Yemek kıyaslamalarında önde, ucuz. Taban ölçüm.
  fal: {
    name: 'fal.ai · Seedream 4.5',
    envKey: 'FAL_KEY',
    endpoint: 'https://fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image',
    pricePerImage: 0.04,
    supportsNegative: false,
    headers: FAL_HEADERS,
    body: (prompt, negative) => ({
      prompt,
      ...(negative ? { negative_prompt: negative } : {}),
      ...FAL_SIZE,
      enable_safety_checker: false,
    }),
  },

  // "Deep-thinking prompt understanding" iddiası tam da çok kısıtlı
  // promptun ihtiyacı olan şey. Fiyat farkı itaati hak ediyor mu, ölçülecek.
  seedream5: {
    name: 'fal.ai · Seedream 5.0 Pro',
    envKey: 'FAL_KEY',
    endpoint: 'https://fal.run/fal-ai/bytedance/seedream/v5/pro/text-to-image',
    pricePerImage: 0.06,
    supportsNegative: false,
    headers: FAL_HEADERS,
    body: (prompt) => ({ prompt, ...FAL_SIZE }),
  },

  // Farklı soy ağacı — Seedream'in varyantı değil, gerçekten başka bir bahis.
  // Fotogerçekçilikte iddialı.
  flux2: {
    name: 'fal.ai · FLUX.2 [pro]',
    envKey: 'FAL_KEY',
    endpoint: 'https://fal.run/fal-ai/flux-2/pro',
    pricePerImage: 0.05,
    supportsNegative: false,
    headers: FAL_HEADERS,
    body: (prompt) => ({ prompt, ...FAL_SIZE }),
  },

  // Google'ın dünya bilgisi geniş; Türk mutfağını tanıma ihtimali en yüksek
  // aday bu. Ad çapası (`nameLead`) yalnızca model yemeği biliyorsa işe
  // yarıyor, o yüzden ayrı bir bahis.
  nanobanana: {
    name: 'fal.ai · Gemini 3 Pro Image (Nano Banana Pro)',
    envKey: 'FAL_KEY',
    endpoint: 'https://fal.run/fal-ai/gemini-3-pro-image',
    pricePerImage: 0.12,
    supportsNegative: false,
    headers: FAL_HEADERS,
    body: (prompt) => ({ prompt, ...FAL_SIZE }),
  },
  replicate: {
    name: 'Replicate · Seedream 4.5',
    envKey: 'REPLICATE_API_TOKEN',
    endpoint: 'https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions',
    pricePerImage: 0.04,
    supportsNegative: false,
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    }),
    body: (prompt) => ({
      input: { prompt, size: '2K', aspect_ratio: '1:1' },
    }),
  },
};

// ── CLI ────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const val = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const kuru = flag('kuru');
const saglayiciAdi = val('saglayici') ?? 'fal';
const provider = PROVIDERS[saglayiciAdi];
if (!provider) {
  console.error(`Bilinmeyen sağlayıcı: ${saglayiciAdi}. Seçenekler: ${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(1);
}

const OUT_DIR = val('cikti') ?? 'data-build/gorseller';
// `--parti1` de tam korpustan okuyor: deneme partisi, gerçek fotoğrafı olan
// tarifleri (Adana, künefe, su böreği) bilerek içeriyor — A/B karşılaştırması
// onlarla yapılacak ve varsayılan dosyada bulunmuyorlar.
const IN_FILE =
  flag('hepsi') || flag('parti1')
    ? 'data-build/gorsel-promptlari-hepsi.jsonl'
    : 'data-build/gorsel-promptlari.jsonl';
const CONCURRENCY = Number(val('es') ?? 4);
const MAX_RETRY = 3;

interface Row {
  slug: string;
  title: string;
  categoryId: string;
  angle: number;
  prompt: string;
  negative: string;
}

if (!fs.existsSync(IN_FILE)) {
  console.error(`Girdi yok: ${IN_FILE}\nÖnce: npm run data:gorsel -- --write`);
  process.exit(1);
}

let rows: Row[] = fs
  .readFileSync(IN_FILE, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Row);

// ── Süzgeçler ──────────────────────────────────────────────────────

const slugArg = val('slug');
if (slugArg) {
  const want = new Set(slugArg.split(',').map((s) => s.trim()));
  rows = rows.filter((r) => want.has(r.slug));
}

/**
 * Deneme partisi — `docs/PARTI-1.md` ile aynı tarifler.
 *
 * Liste burada duruyor çünkü partinin amacı kapsama: 18 tabak sırrının
 * tamamı, 13 kategori, 11 kap sınıfı. Rastgele 34 tarif aynı şeyi ölçmez.
 */
const PARTI_1 = [
  'mercimek-corbasi', 'manti', 'adana-kebap', 'kunefe', 'karides-guvec', 'keskek',
  'ev-ayrani', 'salep', 'turk-kahvesi', 'ezogelin-corbasi', 'yayla-corbasi',
  'tarhana-corbasi', 'iskembe-alternatifi-tavuk-suyu', 'sehriye-corbasi',
  'ispanak-yemegi', 'kabak-dolmasi-etli', 'izgara-kofte', 'kuzu-pirzola-izgara',
  'cop-sis', 'imambayildi', 'patlican-salatasi', 'kuzu-ayvali-yahni', 'bibimbap',
  'patatesli-bomba-kofte', 'kuzu-incik-firin', 'guvec', 'antrikot-izgara', 'falafel',
  'karidesli-wok', 'sac-kavurma', 'yaban-mersinli-sos', 'yaprak-sarma',
  'su-boregi', 'menemen',
];

// Liste `docs/PARTI-1.md` ile aynı olmalı. Değiştirirsen ikisini birlikte
// güncelle; aşağıdaki denetim sessizce eksik parti üretmeyi engelliyor.
if (flag('parti1') && PARTI_1.length !== 34) {
  console.error(`PARTI_1 listesi bozuk: ${PARTI_1.length} slug, 34 bekleniyordu.`);
  process.exit(1);
}

if (flag('parti1')) {
  const want = new Set(PARTI_1);
  rows = rows.filter((r) => want.has(r.slug));
}

const limit = Number(val('limit') ?? 0);
if (limit > 0) rows = rows.slice(0, limit);

// Zaten üretilmiş olanları atla — iş yarıda kesilirse baştan başlanmasın.
fs.mkdirSync(OUT_DIR, { recursive: true });
const donePath = (slug: string) => path.join(OUT_DIR, `${slug}.jpg`);
const before = rows.length;
rows = rows.filter((r) => !fs.existsSync(donePath(r.slug)));
const skipped = before - rows.length;

// ── Negatifi prompta katma ─────────────────────────────────────────

function finalPrompt(r: Row): { prompt: string; negative: string } {
  if (provider.supportsNegative && !flag('negatif-birlestir')) {
    return { prompt: r.prompt, negative: r.negative };
  }
  return {
    prompt: `${r.prompt}\n\nThe image must NOT contain any of the following: ${r.negative}.`,
    negative: '',
  };
}

// ── Kuru çalıştırma ────────────────────────────────────────────────

const cost = rows.length * provider.pricePerImage;

console.log(`\nSağlayıcı : ${provider.name}`);
console.log(`Girdi     : ${IN_FILE}`);
console.log(`Çıktı     : ${OUT_DIR}/<slug>.jpg`);
console.log(`Negatif   : ${provider.supportsNegative && !flag('negatif-birlestir') ? 'ayrı alan' : 'prompta katılıyor'}`);
console.log(`Üretilecek: ${rows.length}${skipped ? ` (${skipped} tanesi zaten var, atlandı)` : ''}`);
console.log(`Tahmini   : $${cost.toFixed(2)}  (görsel başına $${provider.pricePerImage})\n`);

if (kuru) {
  for (const r of rows.slice(0, 5)) {
    const { prompt } = finalPrompt(r);
    console.log(`■ ${r.slug} — ${r.title} (${r.angle}°)`);
    console.log(`  ${prompt.slice(0, 150)}…\n`);
  }
  if (rows.length > 5) console.log(`… ve ${rows.length - 5} tane daha\n`);
  console.log('Kuru çalıştırma — hiçbir istek atılmadı.\n');
  process.exit(0);
}

if (!rows.length) {
  console.log('Üretilecek bir şey yok.\n');
  process.exit(0);
}

const apiKey = process.env[provider.envKey];
if (!apiKey) {
  console.error(`${provider.envKey} tanımlı değil.\n`);
  console.error('PowerShell:  $env:' + provider.envKey + ' = "anahtar"');
  console.error('Bash:        export ' + provider.envKey + '="anahtar"\n');
  process.exit(1);
}

// ── Üretim ─────────────────────────────────────────────────────────

/**
 * Yanıttan görsel adresini çıkar.
 *
 * Sağlayıcılar farklı biçim döndürüyor ve biçimler sürüm sürüm değişiyor.
 * Bilinen üç şekli deniyoruz; hiçbiri tutmazsa ham yanıtı basıp duruyoruz —
 * sessizce boş dosya yazmaktansa görünür şekilde durmak daha iyi.
 */
function imageUrlFrom(json: unknown): string | null {
  const j = json as Record<string, unknown>;
  const images = j.images as { url?: string }[] | undefined;
  if (images?.[0]?.url) return images[0].url!;

  const output = j.output as unknown;
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];

  const data = j.data as { url?: string }[] | undefined;
  if (data?.[0]?.url) return data[0].url!;

  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
let fail = 0;
const failures: { slug: string; reason: string }[] = [];
const started = Date.now();

async function generate(r: Row): Promise<void> {
  const { prompt, negative } = finalPrompt(r);

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await fetch(provider.endpoint, {
        method: 'POST',
        headers: provider.headers(apiKey!),
        body: JSON.stringify(provider.body(prompt, negative)),
      });

      if (!res.ok) {
        const text = await res.text();
        // 429 ve 5xx geçici; diğerleri tekrar denemeye değmez.
        if (res.status === 429 || res.status >= 500) {
          if (attempt < MAX_RETRY) {
            await sleep(2000 * attempt);
            continue;
          }
        }
        throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
      }

      const json = await res.json();
      const url = imageUrlFrom(json);
      if (!url) {
        throw new Error(`Yanıtta görsel adresi yok: ${JSON.stringify(json).slice(0, 300)}`);
      }

      const img = await fetch(url);
      if (!img.ok) throw new Error(`Görsel indirilemedi: HTTP ${img.status}`);
      const buf = Buffer.from(await img.arrayBuffer());
      fs.writeFileSync(donePath(r.slug), buf);

      ok += 1;
      const pct = (((ok + fail) / rows.length) * 100).toFixed(0);
      console.log(`  [${pct}%] ${r.slug} — ${(buf.length / 1024).toFixed(0)} KB`);
      return;
    } catch (err) {
      if (attempt === MAX_RETRY) {
        fail += 1;
        const reason = err instanceof Error ? err.message : String(err);
        failures.push({ slug: r.slug, reason });
        console.log(`  [!]  ${r.slug} — ${reason.slice(0, 120)}`);
        return;
      }
      await sleep(1500 * attempt);
    }
  }
}

/** Basit havuz: aynı anda en fazla CONCURRENCY istek. */
async function run(): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, rows.length) }, async () => {
    while (cursor < rows.length) {
      const r = rows[cursor++]!;
      await generate(r);
    }
  });
  await Promise.all(workers);
}

// tsx bu projede cjs'e derliyor; üst düzey await desteklenmiyor.
run().then(() => {
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\nBitti — ${ok} üretildi, ${fail} başarısız, ${mins} dk`);
  console.log(`Harcanan (tahmini): $${(ok * provider.pricePerImage).toFixed(2)}`);

  if (failures.length) {
    const logPath = path.join(OUT_DIR, '_basarisiz.json');
    fs.writeFileSync(logPath, JSON.stringify(failures, null, 2));
    console.log(`\nBaşarısızlar → ${logPath}`);
    console.log('Aynı komutu tekrar çalıştırmak yalnızca eksikleri deniyor.\n');
  } else {
    console.log('');
  }
});
