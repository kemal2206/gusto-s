# Tatbilim

Türk mutfağını **kimyasıyla birlikte** anlatan mobil uygulama.

Malzemelerin paylaştığı aroma bileşiklerinden bir *flavor network* kurar, üstüne tat
dengesi hesabını ve mutfak geleneğini ekler. "Şunu ekle" derken **neden** olduğunu da
söyler — ve hiçbir zaman gerekçesiz bir seçenek göstermez.

## Lezzet Lab — zincir

Kullanıcı ana malzemeyi seçer, nasıl bir tat istediğini söyler, sonra rol rol malzeme
seçerek tabağı kurar. **Her adımda gösterilen seçeneğin, o ana kadar seçtiklerinden
en az biriyle gösterilebilir bir bağı vardır** — bağsız aday listeye hiç girmez.

```
Kuzu but 250 g  →  "Doyurucu olsun"  →  Neyle pişirelim?

   Tereyağı          ~10 g   [ZİNCİRE BAĞLI]
     KİMYA   Kuzu but ile 1 ortak aroma ailesi · yağ, mum, hafif kızarmış
     GELENEK Kuzu but ile klasik eşleşme

   Kuyruk yağı       ~10 g   [ZİNCİRE BAĞLI]
     KİMYA   Kuzu but ile 2 ortak aroma ailesi · yağ · kavrulmuş, fındıksı
```

Seçim yapıldıkça sonraki adımın listesi yeniden hesaplanır ve tat dengesi ölçeri
canlı güncellenir.

## Ekranlar

| Sekme | Ne yapar |
|---|---|
| Ana Sayfa | Hoş geldin · senin mutfağın · Tatbilim girişleri · görselli kategoriler |
| Canım Ne İstiyor | Adım adım soru → tarif filtresi |
| Elimde Ne Var | Yatay kategori şeridi; açık kategorinin malzemeleri |
| Lezzet Lab | Adım adım tabak kurma zinciri |

Hiçbir ekranın tepesinde büyük sayfa başlığı yok — bağlam içeriğin ilk bloğunda.
Her malzemenin yanında küçük görseli var (emoji katmanı; `imageUrl` dolunca
otomatik fotoğrafa geçer).

**Senin mutfağın:** kurduğun tabaklar cihazda tutuluyor. 10 tabağın 6'sı tavuksa
ana sayfa tavuk önerileriyle açılıyor.

## Veri

| | |
|---|---|
| Malzeme | **192** — Türk mutfağı ve komşuları (Levanten, Balkan, İran, Kafkas, Ege) |
| Gerçek bileşik setli | **169** — Ahn et al. (2011) veri setine eşlendi |
| Aroma bileşiği | **813** — IDF ağırlıkları 1.525 dokümanlık korpustan |
| Eşleşme bağı | **11.010** — aroma kosinüsü ve/veya geleneksel eşleşme |
| Geleneksel çift | **388** — elle kürate kanonik Türk kombinasyonları |

Bileşik verisi Ahn Y-Y ve ark. (2011) *Flavor network and the principles of food
pairing*, Scientific Reports 1:196 veri setinden geliyor ve indirilen aynanın
sadakati her çalıştırmada 221.777 kenar üzerinden doğrulanıyor.
Ayrıntı: [docs/VERI-HATTI.md](docs/VERI-HATTI.md)

## Kurulum

```bash
npm install
npm start
```

Telefonda **Expo Go** ile QR kodu okut.

## Komutlar

```bash
npm run smoke
```

Motoru terminalde çalıştırır: iki farklı zinciri baştan sona yürütür, her adımda
adayları ve bağ gerekçelerini basar.

```bash
npm run typecheck
```

## Yapı

```
src/engine/       saf TS lezzet motoru (React/Supabase bağımsız)
src/data/         aroma aileleri + malzeme katalogu + geleneksel eşleşmeler
src/theme/        tasarım token'ları
src/components/   arayüz primitifleri (TasteMeter, PickCard, Eyebrow…)
src/app/          expo-router ekranları
src/lib/          Supabase istemcisi, Türkçe açıklama katmanı, Lab akışı
supabase/         şema ve RLS politikaları
docs/MIMARI.md    mimari kararlar, motor matematiği, yol haritası
```

## Tasarım

Renkler: `#e6103b` (marka) · `#961238` (başlık, AAA kontrast) · `#141414` · `#ffffff`
Yazı tipi: Inter · Gölge yok, saç teli çizgi var · Numaralı bölüm etiketleri

Hedef kullanıcı 70 yaşında ve telefona yeni alışıyor olabilir:
minimum dokunma alanı 52×52, ekran başına tek birincil eylem, iç içe filtre yok,
her ikonun yanında yazı, renk tek başına anlam taşımaz.

## Bilimsel temel

Ahn, Ahnert, Bagrow, Barabási (2011), *Flavor network and the principles of food
pairing*, Scientific Reports 1:196.

Batı mutfağında paylaşılan bileşik sayısı ile birlikte kullanım pozitif, Doğu Asya'da
negatif korelasyonlu. Yani kimya tek başına yetmez — bu yüzden motor üç sinyali birden
hesaplar: **kimya**, **tat dengesi**, **mutfak geleneği**.
