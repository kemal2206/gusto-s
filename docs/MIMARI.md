# Tatbilim — Mimari

> Türk mutfağı ve komşularına odaklı, bilimsel temelli yemek uygulaması.
> Malzemeleri paylaştıkları **aroma bileşiklerine**, **tat vektörlerine** ve
> **mutfak geleneğine** göre eşleştirir; her öneriyi gerekçesiyle gösterir.

**Sürüm:** 0.2 · **Tarih:** 2026-08-17

---

## 1. Karar özeti

| Konu | Karar |
|---|---|
| Platform | Expo SDK 57 · RN 0.86 · React 19.2 · expo-router 57 (`Tabs` → `expo-router/js-tabs`) |
| Dil | TypeScript strict |
| Veritabanı | Supabase (Postgres) — şema hazır, proje açılması bekliyor |
| Aroma verisi | 169 malzeme gerçek bileşik seti (Ahn 2011) + 23 malzeme aile tahmini |
| Öneri motoru | Kural tabanlı skor + **zincir kuralı** (saf TS, React/Supabase bağımsız) |
| Stil | Design token + StyleSheet primitifleri |
| Sunucu state | TanStack Query · Yerel state: Zustand (henüz kullanılmadı) |

---

## 2. Bilimsel temel

Uygulama **üç bağımsız sinyali** birden hesaplar. Tek bir "doğru" skor yoktur:

1. **Kimya — paylaşılan uçucu bileşikler.** İki malzeme ne kadar çok bileşik
   paylaşıyorsa genelde o kadar iyi eşleşir. Batı mutfağında istatistiksel olarak
   doğrulanmış. *(Ahn, Ahnert, Bagrow, Barabási — "Flavor network and the principles
   of food pairing", Scientific Reports 1:196, 2011)*
2. **Tat dengesi.** 7 eksenli tat vektörü ile hedef profile olan mesafe.
   Yağı asit keser, tuz taşır, tatlı ekşiyi tutar.
3. **Mutfak geleneği.** Aynı çalışma Doğu Asya'da bileşik paylaşımının birlikte
   kullanımla **negatif** korelasyonlu olduğunu gösteriyor — yani kimya tek başına
   yetmez. Kuzu ile kuru nane neredeyse hiç bileşik paylaşmaz ama Türk mutfağında
   ayrılmazlar. Bu sinyal olmadan motor Türk mutfağını yanlış modelliyor.

Motor ayrıca `mode: 'benzerlik' | 'zitlik'` destekler; zıtlık modu gelenek sinyaliyle
kapılanır, yoksa "domates + vanilya" gibi saçmalıklar tepeye çıkar.

---

## 3. Bileşen mimarisi — Lezzet Lab'ın kalbi

Bir yemek tek bir malzeme yığını değil, her biri **kendi yöntemi ve kendi tat
hedefi** olan bileşenlerden oluşuyor:

| Bileşen | Ne yapar |
|---|---|
| `ana` | Tabağın merkezi. Yağ → aromatik → baharat → bitirici |
| `sos` | Üzerine/yanına. Taban → yağ → aromatik → baharat |
| `garnitur` | Yanındaki tabak. Taban → asit → yağ → bitirici |

### Neden bu gerekiyordu
Tek düz zincirde uskumru seçtikten sonra salatalık öneriliyordu ve kullanıcı
haklı olarak "bunları nasıl birleştireceğim?" diye soruyordu. Salatalık balığın
İÇİNE girmiyor — yanındaki salataya giriyor.

Artık motora giden şey şu:

```ts
{
  components:  aktifBilesen.picks,          // denge ve tutarlılık BURADA ölçülür
  pairedWith:  digerBilesenler.picks,       // aroma uyumuna girer, profile karışmaz
  archetypeId: aktifBilesen.archetypeId,
}
```

Salatalık `garnitur` bileşeninde seçiliyor; balık `pairedWith` tarafında duruyor.
"Düz antrikot + yaban mersinli sos" da aynı yapı: bir `ana`, bir `sos`.
**En küçük yemek tek bileşendir** — sadece ızgara et de geçerli bir sonuç.

### Zincir kuralı
Kullanıcıya gösterilen her seçeneğin, o bileşende seçtiklerinden en az biriyle
gösterilebilir bir bağı olmak zorunda. Bağsız aday listeye girmez.

| Bağ | Koşul | Kullanıcıya görünen |
|---|---|---|
| `kimya` | aroma ≥ 0.12 ve ortak bileşik > 0 | "Kuzu but ile 35 ortak aroma bileşiği · 4-etiloktanoik asit" |
| `gelenek` | önsel ≥ 0.25 | "Yoğurt ile klasik eşleşme" |
| `tat` | denge kazancı ≥ 0.05 | "Tabakta eksik kalan tadı tamamlıyor" |

### Tutarlılık (çoğunluk bağı)
Tek malzemeye bağlı olmak yetmiyor. `coherence` = adayın bağlı olduğu malzeme
sayısı / toplam. Skorda +0.18 ağırlık alıyor, %50 altındakiler eleniyor — ama
**gevşetmeli**: eşiği geçen 3'ten az aday kalırsa kapı açılıyor. Kartlarda
"TABAKTAKİ 4 MALZEMENİN 3'ÜYLE BAĞLI" yazıyor.

### Akrabalık cezası
Taze nane ile kuru nane neredeyse aynı bileşik setine sahip; motor ikisini de
mükemmel eşleşme sanıyordu. `akrabalik.ts` içinde 30 grup var (nane, kekik,
domates-salça, yoğurt-ayran-labne, susam-tahin…). Aynı gruptan ikinci malzeme
**0.45 ceza** alıyor — sert filtre değil, çünkü limon + limon kabuğu gerçekten
birlikte kullanılıyor.

---

## 4. Motor (`src/engine`)

Saf TypeScript. React, Expo ve Supabase bağımlılığı **yok**; aynı kod hem uygulamada
hem `scripts/` veri hattında çalışır.

| Dosya | Sorumluluk |
|---|---|
| `types.ts` | `Ingredient`, `TasteVector`, `DishState`, `Suggestion`, `SuggestionLink` |
| `affinity.ts` | IDF ağırlıklı kosinüs, NPMI, kenar indeksi |
| `balance.ts` | Tat profili, arketipler, `counterpointTarget`, `optimizeDose` |
| `lookup.ts` | Aroma verisine tek erişim noktası (hazır kenar ↔ anlık hesap) |
| `bridge.ts` | İki malzeme arasında **bağlayıcı** (köprü) bulma |
| `score.ts` | Bileşik skor + zincir kuralı + gerekçe üretimi |

### 4.1 Aroma benzerliği
```
w(c) = ln(1 + N / df(c))                     IDF: yaygın bileşik bilgi taşımaz

aroma(a,b) = Σ_{c ∈ Ca∩Cb} w(c)²
             ────────────────────────────────  ∈ [0,1]
             √(Σ_{c∈Ca} w(c)²) · √(Σ_{c∈Cb} w(c)²)
```

### 4.2 Sos, etin İÇİNDE değil ÜZERİNDE
`DishState` ikiye ayrılır:
```ts
components  // dengelenen hazırlık
pairedWith  // yanına/altına gideni (et, pilav, ekmek)
```
`pairedWith` tat profiline **karışmaz** — 250 g eti 120 g sosla aynı kaba koyunca
sosun tatlılığı ölçülemez hâle geliyordu. Ama iki işi var: aroma uyumuna girer ve
`counterpointTarget()` ile hedefi kaydırır (*yağlı et daha ekşi sos ister*).

### 4.3 Doz optimizasyonu
Her aday, rolün **pratik aralığında** 6 dozda denenip hedefe en çok yaklaştıranı
seçilir. Sınır olmadan matematik saçmalıyordu: "2 g pirinç" ya da "100 g tereyağı"
hedefe daha yakın çıkıyor ama mutfakta anlamsız.

### 4.4 Bileşik skor
```
score(x) = W.aroma·aromaWithDish + W.balance·balanceGain
         + W.prior·culinaryPrior + W.role·roleFit + anchorBonus − ceza

Zincir varsayılanı (CHAIN_WEIGHTS): aroma .30 · denge .27 · gelenek .33 · rol .10
Preset'ler (kullanıcı tercihi):     Kimyasal .55 / Denge .55 / Geleneksel .50
```
Zincirde ağırlıklar dengeli: yalnızca tat dengesine bakınca kuzunun üstüne kuru nane
değil kuru domates çıkıyor, ki bu Türk mutfağı açısından yanlış.

Diyet ve alerji **skor değil sert filtre**. Hiçbir ağırlık bunları geçemez.

### 4.5 Bağlayıcı (köprü)
```
bridge(a,b) = argmax_x H(aroma(a,x), aroma(b,x))     H = harmonik ortalama
              koşul: min(aroma(a,x), aroma(b,x)) ≥ eşik
```
Harmonik ortalama, tek uca yapışan malzemeyi ödüllendirmesin diye seçildi.

---

## 5. Veri katmanı

### 5.1 Bileşik verisi — iki katman
Ayrıntılı süreç: **[VERI-HATTI.md](VERI-HATTI.md)**

| Katman | Malzeme | Kaynak |
|---|---|---|
| Gerçek bileşik seti | **169** | Ahn et al. (2011), doğrulanmış bipartit veri |
| Aroma ailesi tahmini | **23** | Elle atanmış 54 aile; Türk mutfağına özgü ürünler |

54 ailenin 50'si gerçek bileşik id'lerine bağlandı (106 bileşik). Bağlanamayan
4 aile (safranal, zencefil, geosmin, turmeron) Ahn setinde gerçekten yok ve
**ayrı adres alanında** sentetik id kullanıyor — `SYNTHETIC_COMPOUND_BASE`.
Bu ayrım kritik: aile id'si 5 ile bileşik id'si 5 karışırsa motor sessizce
yanlış eşleşme üretir.

IDF ağırlıkları **1.525 dokümanlık** gerçek korpustan (aşama 1'de 192'ydi).
Uygulamaya kullanılan 813 bileşiğin ağırlığı paketleniyor.

Doğrulama sinyali: kuzu için en ayırt edici ortak bileşik **4-etiloktanoik asit** —
koyun etinin karakteristik bileşiği. Eşleme tutuyor.

### 5.2 Katalog
```
src/data/catalog/
├── raw.ts             tip + kısa anahtar sözlüğü
├── hayvansal.ts       et, kümes, deniz, şarküteri, süt (44)
├── sebze-ot.ts        sebze, mantar, yeşillik, ot (51)
├── baharat-sivi.ts    baharat, ekşi, tatlandırıcı, yağ, içecek (46)
├── kuru-gida.ts       tahıl, bakliyat, kuruyemiş, kuru meyve (32)
├── meyve.ts           taze meyve (19)
├── gelenek.ts         388 kanonik Türk eşleşmesi (prior sinyali)
├── bilesik-eslesme.ts ÜRETİLMİŞ · 54 aile → gerçek bileşik id
├── ahn-eslesme.ts     ÜRETİLMİŞ · TR slug → Ahn id, bileşik seti, IDF
├── gorseller.ts       malzeme → emoji
└── index.ts           id ataması, adres alanı ayrımı, kenar hesabı
```

Her malzemede: TR + EN ad (aşama 2'nin join anahtarı), kategori, roller,
7 eksenli tat vektörü, `potency`, `aromaPower`, aroma aileleri, mutfak etiketleri,
alerjen ve kiler bayrağı.

192 malzeme → 18.336 çift, uygulama açılışında bir kez hesaplanıyor (milisaniyeler).
Eşik altı ve geleneksel bağı olmayanlar atılınca **11.010 kenar** kalıyor
(gerçek bileşik setleri aile tahmininden çok daha zengin: aşama 1'de 3.145'ti).

**Aşama 2'de:** ~15.000 malzemede çift sayısı 100 milyona çıkar ve cihazda
hesaplanamaz; hesap Supabase `ingredient_pairings` tablosuna taşınacak.
Motor arayüzü (`PairingIndex`) aynı kalacağı için ekran kodu değişmeyecek.

### 5.3 Malzeme görselleri
`gorseller.ts` her slug'a bir emoji veriyor; eşleşmesi olmayanlar kategori
simgesine düşüyor. Fotoğraf yerine emoji seçilmesinin sebebi pratik: 192 malzeme
için fotoğraf lisanslamak, indirmek ve önbelleğe almak ayrı bir iş; emoji offline
çalışıyor, sıfır byte yer kaplıyor, her boyutta net.

`Ingredient.imageUrl` dolduğu anda `IngredientAvatar` otomatik fotoğrafa geçer —
aşama 2'de tek alanın doldurulması yeterli, arayüz kodu değişmiyor.

### 5.4 Supabase şeması
[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) —
tablolar, indeksler, RLS politikaları hazır. Henüz uygulanmadı.

---

## 6. Tasarım sistemi

Referans: ödüllü ama sade uygulamaların ortak dili — geniş beyaz alan, güçlü
tipografik hiyerarşi, **gölge yerine saç teli çizgi**, tek vurgu rengi, harf
aralıklı küçük "eyebrow" etiketler, bölüm numaraları, veride tablo hizalı sayılar.

| Token | HEX | Kullanım | Beyaz üstü |
|---|---|---|---|
| `brand` | `#e6103b` | Birincil buton, aktif sekme, ilerleme | 4.67:1 (AA) |
| `brandDeep` | `#961238` | Başlık, küçük vurgulu yazı | **8.62:1 (AAA)** |
| `ink` | `#141414` | Gövde metni | 18.5:1 (AAA) |
| `surface` | `#ffffff` | Zemin | — |

Yazı tipi **Inter**. Tip ölçeği (0.2'de küçültüldü):
display 27 · h1 23 · h2 18 · h3 16 · gövde 15 · buton 17 · etiket 13 · eyebrow 11

### 6.1 Sayfa başlığı yok
Hiçbir ekranın tepesinde büyük sayfa başlığı yok. Bağlam, içeriğin ilk bloğundaki
numaralı `Eyebrow` + `h2` ikilisiyle veriliyor. Kazanç somut: her ekranda bir
başlık yüksekliği kadar dikey alan içeriğe kalıyor.

### 6.2 İmza bileşenler
- **`IngredientAvatar`** — her malzemenin yanındaki küçük yuvarlak görsel.
  `imageUrl` varsa fotoğrafı, yoksa emoji katmanını gösterir (bkz. 5.4).
- **`Eyebrow`** — `01 —— NE PİŞİYOR` biçiminde numaralı bölüm etiketi.
- **`PickCard`** — görsel + aday + bağ etiketi (`KİMYA`/`GELENEK`/`DENGE`) + gerekçe.
- **`ProgressLine`** — ekranın tepesinde 3px saç teli ilerleme.

> **Kaldırıldı:** `TasteMeter` (7 eksenli tat dengesi grafiği). Lezzet Lab artık
> grafik göstermiyor; denge bilgisi her adayın gerekçe satırında metin olarak
> zaten var. Motor tarafındaki hesap (`dishProfile`, `evaluateBalance`) duruyor.

### 6.2 Erişilebilirlik kısıtları
- Minimum dokunma alanı **52×52** (platform standardı 44)
- Bir ekranda tek birincil eylem; iç içe filtre yok; hamburger menü yok
- Her ikonun yanında yazı var; renk tek başına anlam taşımaz
- Seçili durum üç sinyalle: çerçeve kalınlığı + zemin + ✓
- Sistem yazı ölçeği 1.6x'e kadar destekli, düzen kırılmıyor

---

## 7. Ekranlar

```
src/app/
├── (tabs)/index.tsx    Ana Sayfa — arama, kategori şeridi, yatay tarif rayları
├── (tabs)/canim.tsx    Canım Ne İstiyor
├── (tabs)/dolabim.tsx  Elimde Ne Var — arama + kategori şeridi
├── (tabs)/lab.tsx      Lezzet Lab — bileşen mimarisi (bölüm 3)
├── ara.tsx             Tarif arama (ad, özet ve MALZEME adında)
├── kategori/[id].tsx   Kategori tarif listesi + mutfak filtresi
├── tarif/[slug].tsx    Tarif detayı — bileşen bileşen, adımlarıyla
└── dolap-sonuc.tsx     Kiler eşleştirmesi: tam çıkan / 1 eksik / 2 eksik
```

Ana sayfa düzeni referans bir tasarımdan uyarlandı: üstte arama, altında yatay
kaydırmalı **tarif rayları**. Kullanıcıya seçim yaptırmıyor, doğrudan tarifleri
gösteriyor. Fotoğraf olmadığı için kart görseli kategoriye göre sabit yumuşak
zemin + emoji; `Recipe.imageUrl` geldiğinde düzen değişmeden fotoğrafa geçecek.

### 7.1 Ana sayfa
Dört bölüm, bu sırayla:

1. **Hoş geldin** — kısa karşılama
2. **Senin mutfağın** — geçmişe göre kişiselleştirme. `favouriteMain()` en sık
   kullanılan ana malzemeyi çıkarıyor (en az 3 tabak ve %30 pay şartıyla; bir kez
   tavuk pişirene "sen tavukçusun" demek yanlış olur). "Kurduğun 10 tabağın 6'sı
   tavuk but" der ve o malzemeyle 3 kısayol sunar. Geçmiş yoksa yönlendirici bir kart.
3. **Tatbilim** — üç ana giriş
4. **Kategoriler** — görselli 2 sütunlu ızgara. Sekizi de Lezzet Lab zincirine
   parametreyle giriyor (`/lab?grup=et&slugs=…&karakter=…`); hiçbiri boş ekrana çıkmıyor.

### 7.2 Geçmiş
`src/lib/store/history.ts` — Zustand + AsyncStorage. Tabak özet ekranına ulaşınca
bir kayıt yazılıyor (ana malzeme, grup, karakter). Son 100 kayıt tutuluyor,
cihazdan dışarı çıkmıyor, tek amacı ana sayfadaki kişiselleştirme.

### 7.3 Elimde ne var
Kategoriler üstte yatay kaydırılabilir şerit (emoji + ad + seçim sayacı);
yalnızca açık kategorinin malzemeleri listeleniyor. 192 malzemeyi alt alta
dökmek yerine tek seferde bir kategori — kaydırma mesafesi kısa kalıyor.

---

## 8. Durum ve yol haritası

| Aşama | İçerik | Durum |
|---|---|---|
| 1 | Mimari, şema, tasarım sistemi, motor | ✅ |
| 2 | Veri hattı: indirme, doğrulama, bileşik eşlemesi, IDF | ✅ (adım 1–4) |
| 3 | Motor kalibrasyonu + birim testleri | |
| 4 | Tarif verisi, tarif detay ekranı, kaydetme | |
| 5 | "Canım Ne İstiyor?" sonuç ekranı | |
| 6 | "Elimde Ne Var?" eşleştirme + ikame önerileri | |
| 7 | Erişilebilirlik denetimi, offline cache, ikon seti, yayın | |

### Aşama 2 kapsamı
1. Supabase projesi + `0001_init.sql` uygulanması
2. FlavorDB2 / Ahn et al. veri setinin indirilip normalize edilmesi
3. 54 aroma ailesinin gerçek bileşik id'lerine açılması (`compounds` tablosu)
4. TR katalogunun `nameEn` üzerinden açık veriye eşlenmesi, kapsamın
   192'den binlere çıkarılması (TR öncelikli kalarak)
5. `prior` sinyalinin elle kürate 388 çiftten tarif korpusu NPMI'sine geçmesi
6. `ingredient_pairings` tablosunun sunucuda hesaplanması
7. Uygulamanın `LOOKUP`'ı yerel hesaptan Supabase'e çevirmesi (tek dosya)

### Bilerek yapılmayanlar
- **Karanlık tema** — hedef kullanıcı için yüksek kontrastlı açık tema öncelikli
- **Kimlik doğrulama** — favori/kiler kaydı gerekene kadar gereksiz sürtünme
- **İkon ve görseller** — hâlâ Expo şablonundan
- **Tarif verisi** — Lab kompozisyon kuruyor, pişirme adımı üretmiyor

---

## 9. Çalıştırma

```bash
npm start          # Expo geliştirme sunucusu
npm run smoke      # motoru terminalde çalıştır — zinciri baştan sona yürütür
npm run typecheck  # tsc --noEmit
```

Supabase için `.env` (aşama 2):
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```
Yoksa uygulama çökmez — `isSupabaseConfigured` false olur, yerel katalog kullanılır.
