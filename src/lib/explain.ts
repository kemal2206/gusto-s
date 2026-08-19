/**
 * Motorun yapısal gerekçelerini Türkçe cümleye çevirir.
 *
 * Motor dilden bağımsız kalsın diye bu katman ayrı. Cümleler kısa ve somut:
 * "uyumlu" gibi boş bir kelime yerine sayı veriyoruz, kullanıcı kendi karar versin.
 */

import type { LinkKind, Reason, SuggestionLink, TasteAxis } from '@/engine';
import { ROLE_LABELS_TR } from '@/engine';

/** Tek ondalıklı, virgüllü — "6.3" değil "6,3". */
const nf = (x: number) => x.toFixed(1).replace('.', ',');

/**
 * Sayıya kesme işaretli ek getirirken ek, sayının OKUNUŞUNA göre değişir:
 * "8,0'dan" (sıfırdan) ama "8,2'den" (ikiden). Hep tek ondalık bastığımız için
 * belirleyici olan son rakam; on ihtimalin tablosu yeterli.
 */
const ABLATIVE: Record<string, string> = {
  '0': "'dan", // sıfırdan
  '1': "'den", // birden
  '2': "'den", // ikiden
  '3': "'ten", // üçten
  '4': "'ten", // dörtten
  '5': "'ten", // beşten
  '6': "'dan", // altıdan
  '7': "'den", // yediden
  '8': "'den", // sekizden
  '9': "'dan", // dokuzdan
};

const DATIVE: Record<string, string> = {
  '0': "'a", // sıfıra
  '1': "'e", // bire
  '2': "'ye", // ikiye
  '3': "'e", // üçe
  '4': "'e", // dörde
  '5': "'e", // beşe
  '6': "'ya", // altıya
  '7': "'ye", // yediye
  '8': "'e", // sekize
  '9': "'a", // dokuza
};

const lastDigit = (text: string) => text.slice(-1);

const ablative = (x: number) => {
  const s = nf(x);
  return s + (ABLATIVE[lastDigit(s)] ?? "'dan");
};

const dative = (x: number) => {
  const s = nf(x);
  return s + (DATIVE[lastDigit(s)] ?? "'a");
};

/** "Tatlılığı ... çıkarır" — cümle başı, belirtme hâli. */
const AXIS_ACCUSATIVE_TR: Record<TasteAxis, string> = {
  sweet: 'Tatlılığı',
  sour: 'Ekşiliği',
  salty: 'Tuzluluğu',
  bitter: 'Kekremsiliği',
  umami: 'Doyuruculuğu',
  fat: 'Yağlılığı',
  heat: 'Baharat şiddetini',
};

/** "…tuzluluk 5,2'ye çıkıyor" — yalın hâl. */
const AXIS_NOMINATIVE_TR: Record<TasteAxis, string> = {
  sweet: 'tatlılık',
  sour: 'ekşilik',
  salty: 'tuzluluk',
  bitter: 'kekremsilik',
  umami: 'doyuruculuk',
  fat: 'yağlılık',
  heat: 'baharat şiddeti',
};

export function explainReason(reason: Reason): string {
  switch (reason.kind) {
    case 'ortak-bilesik': {
      const list = reason.top.length ? ` (${reason.top.join(', ')})` : '';
      return `${reason.withName} ile ${reason.count} ortak aroma bileşiği${list}`;
    }
    case 'denge': {
      const verb = reason.to > reason.from ? 'çıkarır' : 'çeker';
      return (
        `${AXIS_ACCUSATIVE_TR[reason.axis]} ${ablative(reason.from)} ` +
        `${dative(reason.to)} ${verb} — hedef ${nf(reason.target)}`
      );
    }
    case 'gelenek':
      return `${reason.withName} ile tariflerde sık birlikte kullanılır`;
    case 'rol':
      return `Tabakta eksik olan "${ROLE_LABELS_TR[reason.role].toLocaleLowerCase('tr-TR')}" rolünü doldurur`;
    case 'zitlik':
      return `${reason.withName} ile zıt aroma profili — kontrast eşleşme`;
    case 'uyari-fazla':
      return (
        `Dikkat: ${AXIS_NOMINATIVE_TR[reason.axis]} ${dative(reason.value)} ` +
        `çıkıyor, sınır ${nf(reason.limit)}`
      );
  }
}

// ── Zincir bağları ─────────────────────────────────────────────────

export const LINK_LABEL: Record<LinkKind, string> = {
  kimya: 'KİMYA',
  gelenek: 'GELENEK',
  tat: 'DENGE',
};

/**
 * Bağı tek cümlede anlatır. Bu metin süs değil: kullanıcıya bu seçeneğin
 * neden karşısına geldiğini söyleyen tek şey.
 */
export function explainLink(link: SuggestionLink): string {
  switch (link.kind) {
    case 'kimya': {
      // Duyusal tarif varsa onu göster; yoksa bileşiğin kendi adı kalsın.
      const senses = (link.compounds ?? []).slice(0, 2).map((c) => c.senseTr || c.nameTr);
      const tail = senses.length ? ` · ${senses.join(', ')}` : '';
      return `${link.withName} ile ${link.strength} ortak aroma bileşiği${tail}`;
    }
    case 'gelenek':
      return `${link.withName} ile klasik eşleşme`;
    case 'tat':
      return 'Tabakta eksik kalan tadı tamamlıyor';
  }
}

/**
 * Skoru kelimeye çevirir. Yüzde göstermek yanıltıcı olurdu —
 * "%38 uyumlu" diye bir şey yok, sıralama içindeki yeri anlamlı.
 *
 * Eşikler aşama 3'te gerçek veriyle kalibre edilecek; şu an örnek veride
 * `prior` boş olduğu için skorlar sistematik olarak düşük çıkıyor.
 */
export function scoreLabel(score: number): { label: string; tone: 'success' | 'brandDeep' | 'muted' } {
  if (score >= 0.7) return { label: 'Çok iyi eşleşme', tone: 'success' };
  if (score >= 0.45) return { label: 'İyi eşleşme', tone: 'brandDeep' };
  return { label: 'Denenebilir', tone: 'muted' };
}
