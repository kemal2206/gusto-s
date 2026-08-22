/**
 * Türk ve komşu mutfağı içecekleri — elle yazıldı.
 *
 * İçe aktarılan korpusun "içecek" kategorisi neredeyse tamamen zayıflama
 * kürü ve şurup içeriğiydi; kapıyı kapattık. İçe aktarıcı yalnızca elle
 * onayladığımız iki içeceği geçiriyor (`05-tarif-ithal.ts`, DRINK_ALLOWLIST).
 * Sofrada gerçekten içilen şeyleri buraya kendimiz yazdık: menü kurucunun
 * beşinci tabağı ağırlıkla buradan geliyor.
 */

import type { RawRecipe } from './types';

export const TR_ICECEK: RawRecipe[] = [
  { s: 'ev-ayrani', n: 'Ev Ayranı', c: 'icecek', m: 5, d: 1, srv: 4,
    sum: 'Köpüklü ayranın sırrı soğuk su ve iyi çırpılmış yoğurt.',
    me: 'karistir', ar: 'hafif-ferah',
    ing: [['yogurt', 500], ['su', 500], ['tuz', 4], ['kuru-nane', 1]],
    st: ['Yoğurdu geniş bir kapta telle çırparak pürüzsüzleştir.',
         'Buzlu suyu azar azar ekleyip her seferinde çırp.',
         'Tuzu ekle, köpük tutana kadar çırpmayı sürdür.',
         'Bakır tasa dök, istersen üzerine bir tutam kuru nane serp.'] },

  { s: 'naneli-limonata', n: 'Naneli Limonata', c: 'icecek', m: 20, d: 1, srv: 6,
    sum: 'Limonu kabuğuyla rendelemek aromayı taşıyan yağı da içeri alıyor.',
    me: 'karistir', ar: 'hafif-ferah',
    ing: [['limon', 300], ['limon-kabugu', 6], ['seker', 200], ['su', 1500], ['nane', 15]],
    st: ['Limonların kabuğunu ince rendele, suyunu sık.',
         'Şekeri 500 ml suda eritip kabuk rendesini içine at, 10 dakika beklet.',
         'Limon suyunu ve kalan soğuk suyu ekle.',
         'Taze naneyi avuç içinde ezip at, buzdolabında 1 saat dinlendir, süzerek servis et.'] },

  { s: 'nar-serbeti', n: 'Nar Şerbeti', c: 'icecek', m: 25, d: 1, srv: 6,
    sum: 'Osmanlı sofrasının klasiği; karanfil ve tarçın narın tanenini yumuşatıyor.',
    me: 'haslama', ar: 'hafif-ferah',
    ing: [['nar', 600], ['seker', 180], ['su', 1200], ['karanfil', 2], ['tarcin', 2], ['limon', 30]],
    st: ['Nar tanelerini suyla birlikte kaynatıp 10 dakika kısık ateşte tut.',
         'Karanfil ve tarçını ekleyip ocaktan al, kapağı kapalı soğumaya bırak.',
         'Süzgeçten geçir, tanelere bastırarak suyunu al.',
         'Şekeri ve limon suyunu ekle, tamamen soğuduktan sonra buzla servis et.'] },

  { s: 'demirhindi-serbeti', n: 'Demirhindi Şerbeti', c: 'icecek', m: 30, d: 1, srv: 6,
    sum: 'Ramazan sofralarının ekşi şerbeti; erik ve limon aynı işi görüyor.',
    me: 'haslama', ar: 'hafif-ferah',
    ing: [['kuru-erik', 250], ['su', 1500], ['seker', 150], ['limon', 40], ['karanfil', 2]],
    st: ['Kuru erikleri sıcak suda 2 saat beklet.',
         'Suyuyla birlikte kaynatıp 15 dakika pişir.',
         'Ezip süz, posayı at.',
         'Şeker, limon suyu ve karanfili ekle; soğutup servis et.'] },

  { s: 'visne-serbeti', n: 'Vişne Şerbeti', c: 'icecek', m: 25, d: 1, srv: 6,
    sum: 'Vişnenin ekşisi yağlı bir ana yemekten sonra damağı temizliyor.',
    me: 'haslama', ar: 'hafif-ferah',
    ing: [['visne', 500], ['su', 1200], ['seker', 200], ['limon', 20]],
    st: ['Vişneleri çekirdekleriyle birlikte suda 12 dakika kaynat.',
         'Ocaktan al, üzeri kapalı soğut.',
         'Süz, meyveyi bastırarak suyunu çıkar.',
         'Şeker ve limon suyunu ekleyip karıştır, buzdolabında beklet.'] },

  { s: 'kayisi-hosafi', n: 'Kayısı Hoşafı', c: 'icecek', m: 25, d: 1, srv: 6,
    sum: 'Etli yemeğin yanında geleneksel olan hoşaf, tatlıdan önce içiliyor.',
    me: 'haslama', ar: 'hafif-ferah',
    ing: [['kuru-kayisi', 250], ['su', 1400], ['seker', 80], ['karanfil', 1], ['limon', 20]],
    st: ['Kuru kayısıları yıkayıp suda 1 saat beklet.',
         'Aynı suyla birlikte kaynat, 10 dakika kısık ateşte pişir.',
         'Şeker ve karanfili ekle, 2 dakika daha pişir.',
         'Ocaktan alıp limon suyunu ekle, soğuk servis et.'] },

  { s: 'uzum-hosafi', n: 'Üzüm Hoşafı', c: 'icecek', m: 20, d: 1, srv: 6,
    sum: 'Kuru üzümün doğal tatlısı yettiği için az şeker istiyor.',
    me: 'haslama', ar: 'hafif-ferah',
    ing: [['kuru-uzum', 200], ['su', 1400], ['seker', 50], ['tarcin', 1], ['limon', 20]],
    st: ['Kuru üzümleri iyice yıka.',
         'Suyla birlikte kaynatıp 10 dakika pişir.',
         'Şeker ve tarçını ekle, karıştırıp ocaktan al.',
         'Limon suyunu ekleyip soğut.'] },

  { s: 'ayva-kompostosu', n: 'Ayva Kompostosu', c: 'icecek', m: 40, d: 1, srv: 6,
    sum: 'Ayva pişerken pembeleşiyor; karanfil bu rengin yanına kokusunu koyuyor.',
    me: 'haslama', ar: 'hafif-ferah',
    ing: [['ayva', 600], ['su', 1200], ['seker', 150], ['karanfil', 2], ['limon', 30]],
    st: ['Ayvaları soyup dilimle, kararmasın diye limonlu suya at.',
         'Su, şeker ve karanfili kaynat.',
         'Ayvaları ekleyip kısık ateşte 25 dakika, yumuşayana kadar pişir.',
         'Suyunda soğumaya bırak, soğuk servis et.'] },

  { s: 'salep', n: 'Salep', c: 'icecek', m: 20, d: 1, srv: 4,
    sum: 'Sürekli karıştırmak şart: salep dibi tutan bir içecek.',
    me: 'karistir', ar: 'kremali-sos',
    ing: [['sut', 1000], ['salep-tozu', 20], ['seker', 60], ['tarcin', 2]],
    st: ['Salep tozunu şekerle kuru kuruya karıştır — böylece topaklanmıyor.',
         'Soğuk sütün içine yavaşça ekleyip telle çırp.',
         'Orta ateşte, sürekli karıştırarak kaynama noktasına getir.',
         'Kıvamı koyulaşınca ocaktan al, üzerine tarçın serperek sıcak servis et.'] },

  { s: 'sicak-cikolata', n: 'Sıcak Çikolata', c: 'icecek', m: 15, d: 1, srv: 4,
    sum: 'Bitter çikolata ve bir tutam tuz tadı derinleştiriyor.',
    me: 'karistir', ar: 'kremali-sos',
    ing: [['sut', 800], ['bitter-cikolata', 120], ['kakao', 10], ['seker', 30], ['tuz', 1]],
    st: ['Sütü kısık ateşte ısıt, kaynatma.',
         'Doğranmış çikolatayı ekleyip karıştırarak erit.',
         'Kakao, şeker ve tuzu ekle, telle çırparak pürüzsüzleştir.',
         '2 dakika daha karıştırıp fincanlara paylaştır.'] },

  { s: 'turk-kahvesi', n: 'Türk Kahvesi', c: 'icecek', m: 8, d: 2, srv: 2,
    sum: 'Köpük kaynatmakla değil, ısıyı yavaş vermekle çıkıyor.',
    me: 'haslama', ar: 'hafif-ferah',
    ing: [['kahve', 14], ['su', 140], ['seker', 8]],
    st: ['Soğuk suyu cezveye koy, kahveyi ve şekeri üzerine ekle.',
         'Ocağa koymadan önce iyice karıştır.',
         'En kısık ateşte, karıştırmadan yavaşça ısıt.',
         'Köpük kabarmaya başlayınca köpüğü fincanlara paylaştır, cezveyi 10 saniye daha tutup boşalt.'] },

  { s: 'demli-cay', n: 'Demli Çay', c: 'icecek', m: 20, d: 1, srv: 6,
    sum: 'Çaydanlığın altındaki suyun kaynamaya devam etmesi demin sırrı.',
    me: 'haslama', ar: 'hafif-ferah',
    ing: [['siyah-cay', 12], ['su', 1500]],
    st: ['Alt demliği doldurup kaynat.',
         'Üst demliğe çayı koy, üzerine kaynar sudan bir miktar dök.',
         'Alt demliği yeniden doldur, üst demliği üzerine otur.',
         'Kısık ateşte 15 dakika demlenmeye bırak; ince belli bardağa önce dem, sonra su koy.'] },

  { s: 'zencefilli-limonlu-cay', n: 'Zencefilli Limonlu Çay', c: 'icecek', m: 15, d: 1, srv: 4,
    sum: 'Ağır bir sofradan sonra mideyi rahatlatan sıcak içecek.',
    me: 'haslama', ar: 'hafif-ferah',
    ing: [['zencefil', 25], ['limon', 60], ['bal', 40], ['su', 1000], ['tarcin', 1]],
    st: ['Zencefili ince dilimle.',
         'Suyu kaynat, zencefil ve tarçını atıp 10 dakika kısık ateşte demle.',
         'Ocaktan al, biraz ılıyınca limon suyunu ve balı ekle.',
         'Süzerek bardaklara paylaştır.'] },

  { s: 'sutlu-tarcin', n: 'Tarçınlı Sıcak Süt', c: 'icecek', m: 10, d: 1, srv: 4,
    sum: 'Çocuklu sofralarda tatlıdan sonra en kolay içecek.',
    me: 'karistir', ar: 'kremali-sos',
    ing: [['sut', 800], ['bal', 40], ['tarcin', 3], ['vanilya', 1]],
    st: ['Sütü tarçın çubuğu ya da toz tarçınla birlikte ısıt.',
         'Kaynamaya yakın ocaktan al.',
         'Bal ve vanilyayı ekleyip karıştır.',
         'Süzüp sıcak servis et.'] },
];
