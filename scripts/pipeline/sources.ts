/**
 * Veri kaynakları kayıt defteri.
 *
 * Her kaynağın nereden geldiği, lisansı ve atıfı burada tek yerde duruyor.
 * Ticari dağıtım öncesinde bakılacak yer bu dosya.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * npm script'leri paket kökünden çalışır. `import.meta` kullanmıyoruz çünkü
 * tsx bu dosyaları CJS olarak çözüyor ve orada `import.meta` yok.
 */
export const ROOT = process.cwd();

if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
  throw new Error(`Paket kökünden çalıştır (şu an: ${ROOT}). Örnek: npm run data:fetch`);
}

export const RAW_DIR = path.join(ROOT, 'data-raw');
export const BUILD_DIR = path.join(ROOT, 'data-build');

export interface Source {
  id: string;
  url: string;
  /** İndirilen dosya adı. */
  file: string;
  /** Zip ise içinden çıkarılacak dosya. */
  extract?: string;
  license: string;
  citation: string;
  what: string;
}

/**
 * Ahn, Ahnert, Bagrow, Barabási (2011)
 * "Flavor network and the principles of food pairing", Scientific Reports 1:196
 * https://doi.org/10.1038/srep00196
 *
 * s2 ve s3 doğrudan Springer'ın ek malzeme sunucusundan; üçlü TSV seti ise
 * makalenin yazarlarının yayımladığı bipartit veri. `normalize` adımı üçlüyü
 * s2'ye karşı çapraz doğruluyor (kenar ağırlıklarını yeniden hesaplayıp
 * karşılaştırıyor), böylece ayna kaynağın sadakati her çalıştırmada kanıtlanıyor.
 */
const AHN_CITATION =
  'Ahn Y-Y, Ahnert SE, Bagrow JP, Barabási A-L (2011) Flavor network and the ' +
  'principles of food pairing. Scientific Reports 1:196. doi:10.1038/srep00196';

export const SOURCES: Source[] = [
  {
    id: 'ahn-edges',
    url: 'https://static-content.springer.com/esm/art%3A10.1038%2Fsrep00196/MediaObjects/41598_2011_BFsrep00196_MOESM2_ESM.zip',
    file: 'srep00196-s2.zip',
    extract: 'srep00196-s2.csv',
    license: 'Springer Nature ek malzeme — makale CC BY-NC-SA 3.0',
    citation: AHN_CITATION,
    what: 'Flavor network kenar listesi: malzeme çifti + ortak bileşik sayısı (221.777 kenar)',
  },
  {
    id: 'ahn-recipes',
    url: 'https://static-content.springer.com/esm/art%3A10.1038%2Fsrep00196/MediaObjects/41598_2011_BFsrep00196_MOESM3_ESM.zip',
    file: 'srep00196-s3.zip',
    extract: 'srep00196-s3.csv',
    license: 'Springer Nature ek malzeme — makale CC BY-NC-SA 3.0',
    citation: AHN_CITATION,
    what: 'Tarif korpusu: mutfak etiketi + malzeme listesi (56.498 tarif)',
  },
  {
    id: 'ahn-corpus-split',
    url: 'https://yongyeol.com/data/scirep-cuisines-detail.zip',
    file: 'scirep-cuisines-detail.zip',
    license: 'CC BY 4.0 (paket içindeki LICENSE dosyası)',
    citation: AHN_CITATION,
    what: 'Aynı korpusun kaynağa göre ayrılmış hâli (allrecipes / epicurious / menupan) + bölge eşlemesi',
  },
  {
    id: 'ahn-ingr-comp',
    url: 'https://raw.githubusercontent.com/lingcheng99/Flavor-Network/master/data/ingr_comp.tsv',
    file: 'ingr_comp.tsv',
    license: 'Makale ek verisi türevi — atıf zorunlu',
    citation: AHN_CITATION,
    what: 'Bipartit malzeme↔bileşik bağları (36.781 satır)',
  },
  {
    id: 'ahn-comp-info',
    url: 'https://raw.githubusercontent.com/lingcheng99/Flavor-Network/master/data/comp_info.tsv',
    file: 'comp_info.tsv',
    license: 'Makale ek verisi türevi — atıf zorunlu',
    citation: AHN_CITATION,
    what: 'Bileşik künyesi: id, ad, CAS numarası (1.107 bileşik)',
  },
  {
    id: 'ahn-ingr-info',
    url: 'https://raw.githubusercontent.com/lingcheng99/Flavor-Network/master/data/ingr_info.tsv',
    file: 'ingr_info.tsv',
    license: 'Makale ek verisi türevi — atıf zorunlu',
    citation: AHN_CITATION,
    what: 'Malzeme künyesi: id, ad, kategori (1.530 malzeme)',
  },
];

export const raw = (file: string) => path.join(RAW_DIR, file);
export const build = (file: string) => path.join(BUILD_DIR, file);
