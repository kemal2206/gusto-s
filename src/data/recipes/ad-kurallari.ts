/**
 * Yemek adından kategori çıkarma.
 *
 * Türkçede yemek adı kategoriyi neredeyse her zaman söylüyor: "…çorbası",
 * "…böreği", "…kebabı". Bu kurallar üç yerde kullanılıyor ve tek yerde
 * durmaları önemli, yoksa üçü ayrı ayrı kayıyor:
 *
 *  1. Tarif korpusunu içe aktarırken (`scripts/pipeline/05-tarif-ithal.ts`) —
 *     kaynağın 8 kaba kategorisini daraltmak için
 *  2. Yemek kitabına eklenen **sosyal medya videosunu** bölümlemek için —
 *     elimizdeki tek veri videonun başlığı
 *  3. Kullanıcının **kendi yazdığı tarifi** bölümlemek için
 *
 * Sıra önemli: ilk eşleşen kural kazanıyor. Tatlı kuralı içecek kuralından
 * önce geliyor, yoksa "Kahveli Kurabiye" içecek sayılıyor.
 */

export const NAME_RULES: [RegExp, string][] = [
  [/çorba|çorbası/i, 'corba'],
  [/kebap|kebabı|köfte|şiş|ızgara|pirzola|sucuk|külbastı/i, 'kebap-izgara'],
  [/dolma|dolması|sarma|sarması|yaprak/i, 'dolma-sarma'],
  [/zeytinyağlı|imambayıldı/i, 'zeytinyagli'],
  [/pilav|pilavı|makarna|erişte|mantı|spagetti|noodle/i, 'pilav-makarna'],
  [/börek|böreği|poğaça|açma|pide|lahmacun|gözleme|çörek|ekmek|simit|kurabiye tuzlu|milföy/i, 'hamur-isi'],
  [/balık|balığı|hamsi|levrek|çipura|somon|karides|midye|kalamar|uskumru|palamut|alabalık|deniz/i, 'deniz'],
  [/salata|salatası|meze|cacık|haydari|humus|ezme|piyaz|turşu|tarator|pilaki|şakşuka|babagannuş|çiğ köfte|kısır|tabule|piyaz/i, 'meze-salata'],
  // "Baharatlı Zeytinyağı" kaynakta içecek diye geçiyor; yemek değil, sos.
  [/sos|sosu|marine|marinasyon|terbiye|zeytinyağı$|aromalı yağ|sarımsaklı yağ/i, 'sos-marine'],
  [/kek|tatlı|tatlısı|baklava|kadayıf|sütlaç|revani|künefe|helva|puding|kurabiye|browni|muhallebi|dondurma|reçel|magnolia|cheesecake|tiramisu|profiterol|lokma|şekerpare|irmik helvası/i, 'tatli'],
  // Tatlı kuralı önce geliyor: "Kahveli Kurabiye" içecek değil.
  [/ayran|limonata|şerbet|şurup|komposto|hoşaf|salep|boza|smoothie|çay(ı)?$|kahvesi|milkshake|şıra|suyu$/i, 'icecek'],
  [/kahvaltı|menemen|omlet|yumurta|tost|sandviç|krep|pankek/i, 'kahvalti'],
];

/** Ada bakarak kategoriyi daralt; eşleşme yoksa verilen varsayılan kalıyor. */
export function refineCategory(name: string, fallback: string): string {
  for (const [re, cat] of NAME_RULES) if (re.test(name)) return cat;
  return fallback;
}

/**
 * Serbest metinden kategori tahmini.
 *
 * Videoda ve kullanıcının kendi tarifinde güvenilir bir kategori alanı yok;
 * elimizde başlık (ve varsa açıklama) var. Hiçbir kural tutmazsa `null`
 * dönüyoruz — yanlış bir bölüme atmaktansa "Diğer"de kalsın.
 */
export function guessCategory(...texts: (string | undefined)[]): string | null {
  const text = texts.filter(Boolean).join(' ');
  if (!text.trim()) return null;
  for (const [re, cat] of NAME_RULES) if (re.test(text)) return cat;
  return null;
}
