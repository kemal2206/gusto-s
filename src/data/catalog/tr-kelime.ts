/**
 * Türkçe metinde kelime sınırı.
 *
 * Diyet ve eliminasyon süzgeçleri malzeme listesine ek olarak tarifin adına
 * ve özetine de bakıyor — içe aktarılan korpusta malzeme listesi her zaman
 * dürüst değil ve vejetaryen birine et göstermek pahalı bir hata. Ama bu
 * güvenlik ağı, kalıbı yanlış yazınca kendisi hataya dönüşüyor.
 *
 * **JavaScript'in `\b` sınırı burada işe yaramıyor.** ASCII'ye göre çalışıyor:
 * `ı ş ğ ç ö ü` harfleri "kelime karakteri" sayılmıyor, bu yüzden sınır
 * yanlış yerlere düşüyor.
 *
 *   /bal\b/  →  "çorbalık" ile eşleşiyor   (l'den sonraki ı sınır sayılıyor)
 *   /un\b/   →  "kavun", "yolun", "lorun" ile eşleşiyor
 *
 * Sınırı hiç yazmamak daha da kötü:
 *
 *   /etli/   →  "lezzetli", "bereketli", "zahmetli", "davetli"
 *   /balık/  →  "kalabalık"
 *   /et/     →  "misket", "lezzet", "sosyete", "afiyetle" (142 kelime)
 *
 * Somut sonucu şuydu: yemek.com korpusunun özetleri insan eliyle yazılmış
 * tanıtım cümleleri ve içlerinde "lezzetli" 63 kere geçiyor. Vejetaryen
 * kullanıcı, açıklamasında bu kelime geçtiği için Brokoli Çorbası'nı,
 * Roka Salatası'nı ve Mantar Dolması'nı göremiyordu.
 *
 * Aşağıdaki iki kalıp üreteci doğru sınırı kuruyor.
 */

/** Türkçe harfler — küçük ve büyük, i/ı ayrımı dâhil. */
const HARF = 'a-zA-ZçğıöşüÇĞİIÖŞÜ';

/**
 * Kelimenin **başında** eşleşir, sonuna Türkçe ek gelmesi serbest.
 *
 * "balık" için doğru davranış bu: "balıklar", "balığın", "balıkçı" hepsi
 * yakalanmalı ama "kalabalık" yakalanmamalı.
 */
export function kelimeBasi(...tokens: string[]): RegExp {
  return new RegExp(`(^|[^${HARF}])(${tokens.join('|')})`, 'i');
}

/**
 * **Tam kelime** eşleşmesi — ne başına ne sonuna harf gelebilir.
 *
 * Kısa ve başka kelimelerin içinde sık geçen köklerde şart: "et", "bal",
 * "un". `kelimeBasi` bunlara yetmiyor çünkü "balık" ve "balkabağı" da
 * "bal" ile başlıyor, ikisi de bal değil.
 */
export function tamKelime(...tokens: string[]): RegExp {
  return new RegExp(`(^|[^${HARF}])(${tokens.join('|')})([^${HARF}]|$)`, 'i');
}

/**
 * Birden çok kalıbın herhangi biri tutuyor mu?
 *
 * Kelime sınırı kalıpları tek bir dev regex'te birleştirilemiyor: bir kısmı
 * kelime başı, bir kısmı tam kelime istiyor.
 */
export function herhangiBiri(patterns: RegExp[], ...texts: string[]): boolean {
  return patterns.some((re) => texts.some((t) => re.test(t)));
}
