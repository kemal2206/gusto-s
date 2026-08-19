# Veri hattı

Açık veriden uygulamaya giden yol. Dört adım, hepsi `npm run` ile tekrarlanabilir.

```bash
npm run data:fetch                  # 1. kaynakları indir (data-raw/)
npm run data:normalize              # 2. normalize et + çapraz doğrula (data-build/)
npm run data:families -- --write    # 3. aroma ailelerini gerçek bileşiklere bağla
npm run data:map -- --write         # 4. TR katalogu Ahn'a eşle, IDF hesapla
```

`data-raw/` ve `data-build/` sürüm kontrolüne girmiyor. Üretilen iki dosya
(`src/data/catalog/bilesik-eslesme.ts` ve `ahn-eslesme.ts`) giriyor — çalışma
zamanında gerekiyorlar ve elle düzenlenmemeleri gerekiyor.

---

## Kaynaklar ve lisans

| Kaynak | İçerik | Lisans |
|---|---|---|
| Springer SI 2 (`srep00196-s2.csv`) | 221.777 kenar: malzeme çifti + ortak bileşik sayısı | Makale eki |
| Springer SI 3 (`srep00196-s3.csv`) | 56.498 tarif, mutfak etiketli | Makale eki |
| `scirep-cuisines-detail.zip` | Aynı korpus, kaynağa göre ayrılmış | **CC BY 4.0** |
| `ingr_comp.tsv` | 36.781 bipartit malzeme↔bileşik bağı | Makale eki türevi |
| `comp_info.tsv` | 1.107 bileşik: ad + CAS | Makale eki türevi |
| `ingr_info.tsv` | 1.530 malzeme: ad + kategori | Makale eki türevi |

**Atıf (zorunlu):** Ahn Y-Y, Ahnert SE, Bagrow JP, Barabási A-L (2011).
*Flavor network and the principles of food pairing.* Scientific Reports 1:196.
doi:10.1038/srep00196

> **Ticari dağıtım öncesi bakılacak:** tarif korpusunun CC BY 4.0 lisansı ticari
> kullanıma açık, yalnızca atıf istiyor. Bileşik tabloları makalenin ek malzemesi;
> Scientific Reports 2011 içeriği CC BY-NC-SA 3.0 altında yayımlandı ve **NC =
> ticari kullanım yok** demek. Uygulama ücretli dağıtılacaksa bileşik verisinin
> ya izinle ya da ticari kullanıma açık başka bir kaynakla (ör. lisanslı FlavorDB
> erişimi, kendi GC-MS derlemesi) değiştirilmesi gerekiyor. Kod ve Türkçe katalog
> bizim; bağımlılık yalnızca bileşik tablolarında.

---

## Adım 2 — çapraz doğrulama

Bipartit üçlü (`ingr_comp` / `comp_info` / `ingr_info`) Springer'dan tek dosya
olarak inmiyor; GitHub aynasından geliyor. Aynanın sadakati her çalıştırmada
kanıtlanıyor: `ingr_comp.tsv`'den bütün kenar ağırlıkları yeniden hesaplanıp
Springer'ın `s2` dosyasıyla karşılaştırılıyor.

```
çapraz doğrulama: 221777 kenar kontrol edildi, 0 uyuşmazlık
```

Tek fark çıksa script hata verip duruyor — bozuk veriyle devam etmek sessiz
yanlış eşleşmeler üretir.

---

## Adım 3 — aile → bileşik

Aşama 1'de her malzemeye 54 "aroma ailesi"nden etiketler vermiştik. Şimdi her
ailenin temsil ettiği bileşikler Ahn künyesindeki gerçek id'lere çevriliyor.

Eşleştirme üç kademeli, çünkü yazım kuralları farklı:

| Bizim aday | Ahn'daki hâli | Kademe |
|---|---|---|
| `vanillin` | `vanillin` | tam |
| `anethole` | `trans-anethole` | çekirdek (stereo eki sıyrılır) |
| `limonene` | `limonene_(d-,l-,_and_dl-)` | içerme |
| `beta-caryophyllene` | `b-caryophyllene` | çekirdek (Ahn Yunan harfini tek harf yazıyor) |

**Sonuç: 54 ailenin 50'si bağlandı, 131 aday adının 118'i eşleşti, 106 bileşik.**

Bağlanamayan 4 aile — safranal, zencefil terpeni, toprak geosmini, zerdeçal
turmeronu — Ahn'ın 1.107 bileşiklik setinde gerçekten yok (set Fenaroli
kaynaklı ve sınırlı). Bu aileler ayrı adres alanında sentetik id kullanmaya
devam ediyor; motor çalışıyor, sadece o dört karakter kaba çözünürlükte.

---

## Adım 4 — TR katalog → Ahn

**169/192 malzeme eşleşti.** Eşleşenler yaklaşık aile setini bırakıp malzemenin
gerçek uçucu bileşik setine geçti.

Eşleme büyük ölçüde elle yazıldı (`OVERRIDES`), çünkü otomatik ad eşleştirmesi
burada yetmiyor ve yanlış eşleme sessizce kötü tarif üretir:

- **Kesim ayrımı:** bizde kuzu but / pirzola / incik / kıyma ayrı, Ahn'da tek
  `lamb`. Hangisinin hangi genel malzemeye bağlanacağı mutfak bilgisi.
- **Kültürel doğruluk:** Ahn'da yalnızca `pork_sausage` var. Dana/kuzu sucuğunu
  ona bağlamak hem kimyasal hem kültürel olarak yanlış olurdu → `null` bırakıldı.
  Pastırma da `cured_pork` değil `beef`e bağlandı.
- **Farklı bitki:** kızılcık (*Cornus mas*) ile cranberry aynı şey değil → `null`.

Eşleşmeyen 23 malzeme aile setinde kaldı; çoğu Türk mutfağına özgü ya da Ahn'da
hiç yok: patlıcan (!), nar, nar ekşisi, sucuk, çörekotu, yenibahar, kapari,
çam fıstığı, kestane, bakla, semizotu, roka, dut, kızılcık, hamsi, palamut…

### Doğrulama sinyali
Kuzu → `lamb` eşlemesi tutuyor mu? Motorun kuzu için çıkardığı en ayırt edici
ortak bileşik **4-etiloktanoik asit** — koyun etinin karakteristik bileşiği.
Eşleme doğru.

### IDF artık gerçek
Ağırlıklar Ahn'ın bileşik seti olan **1.525 malzemesinden** hesaplanıyor
(aşama 1'de 192 malzemeden hesaplanıyordu ve ayırt edicilik ölçülemiyordu).
Uygulamaya sadece kullandığımız 813 bileşiğin ağırlığı gidiyor.

---

## Bulunan iki gerçek

### 1. "Kapsamı binlere çıkarmak" bu veriyle mümkün değil
Ahn'ın 1.530 malzemesinden **yalnızca 381'i tariflerde geçiyor**. Kalan 1.149'u
aroma endüstrisi botanikleri: `magnolia_tripetala`, `chamaecyparis_pisifera_oil`,
`calyptranthes_parriculata`… Bunları katalog saymak sayıyı şişirir, mutfağı değil.

Gerçek genişletme potansiyeli: **264 aday** (tariflerde geçiyor, bileşik seti var,
katalogda yok). Listesi `data-build/genisletme-adaylari.json`. Frekans sıralı ilk
sıralar: `vegetable_oil`, `cane_molasses`, `lemon_juice`, `cocoa`, `chicken_broth`,
`yeast`, `soy_sauce`, `parmesan_cheese`, `tuna`…

Bunları katalog yapmak için Türkçe ad + tat vektörü + rol ataması gerekiyor;
otomatik üretilemez. Türk mutfağı açısından hepsi de gerekli değil (soya sosu,
cheddar, pecan…). Gerçekçi hedef: **elle seçilmiş 100–200 ekleme → ~300-400 malzeme.**

### 2. Tarif korpusu Türk mutfağı için kötü bir önsel
| Mutfak | Tarif |
|---|---|
| NorthAmerican | 41.524 |
| SouthernEuropean | 4.180 |
| … | … |
| **MiddleEastern** | **645** |

56.498 tarifin %73'ü Kuzey Amerika. Bundan NPMI hesaplayıp "Türk mutfağı
geleneği" demek yanlış olur — elle kürate ettiğimiz 388 kanonik çift bu iş için
daha doğru. Korpus yine değerli ama başka işler için: malzeme frekansı (yukarıdaki
264 adayın sıralaması), genel Batı mutfağı önseli, ve MiddleEastern alt kümesinin
(645 tarif) ayrı ve etiketli bir sinyal olarak kullanılması.

---

## Adım 1 — Supabase (senin yapman gereken)

Supabase hesabı/projesi oluşturmak bana kapalı. Şema, RLS politikaları ve
`.env.example` hazır; kalan üç iş:

```bash
# 1. supabase.com'da ücretsiz proje aç (bölge: Frankfurt / eu-central-1)

# 2. CLI ile bağla ve şemayı uygula
npx supabase login
npx supabase link --project-ref <proje-ref>
npx supabase db push        # supabase/migrations/0001_init.sql uygulanır

# 3. anahtarları .env'e yaz
cp .env.example .env        # sonra Project Settings → API'den doldur
```

Şemada bu turda değişenler: `ingredient_category` enum'u kodla eşitlendi,
`ingredients.cuisines` eklendi, `compounds.family_slug` eklendi (54 ailenin
gerçek bileşiklere bağlanma alanı).

Proje açılana kadar uygulama çalışmaya devam ediyor — `isSupabaseConfigured`
false olduğunda yerel katalog kullanılıyor.

---

## Adım 5 — Türk tarif korpusu

```bash
npm run data:tarif -- --write
```

**Kaynak:** Kaggle `bit104/turkish-recipes-structured` — 3.320 Türk tarifi,
nefisyemektarifleri.com içeriğinden yapılandırılmış. Şeması bizimkine neredeyse
birebir uyuyor: kategori, süre, zorluk, pişirme yöntemi, `{isim, miktar, birim}`
malzemeler, adım dizisi.

**Sonuç: 3.181 tarif alındı (%96 verim).**

İki dönüşüm yapılıyor:

1. **Malzeme adı → katalog slug'ı.** Üç kademeli: doğrudan ad, ASCII katlama
   (korpusta "sarimsak", "zeytinyagi" gibi yazımlar var), kelime içi arama
   ("mantar" → "kültür mantarı"). Üstüne ~120 elle yazılmış eş anlamlı ve
   yazım hatası düzeltmesi ("tereayağı", "sarıkmsak", "çerliston").
2. **Mutfak ölçüsü → gram.** su bardağı 200, yemek kaşığı 15, diş 4, tutam 1…
   "adet" malzemeye göre (yumurta 55 g, patlıcan 250 g), bilinmiyorsa kategoriye.

**Kalite kapıları:**
- Malzemelerinin %80'inden azı eşleşen tarif alınmıyor (128 tarif düştü)
- Adımı olmayan ya da 2'den az malzemeli tarif alınmıyor (10 tarif)
- Aynı slug elle yazılmış bir tarifle çakışırsa **elle yazılan kazanıyor**
  (20 tarif) — onlar çok bileşenli ve kürate edilmiş
- Süre alanı güvenilmez ("1 dk"lık kek tarifleri var): 5 dakikanın altı ve
  8 saatin üstü veri hatası sayılıp adım sayısından tahmin ediliyor
- Kaynağın 8 kaba kategorisi "ana yemek"te yığılıyordu; tarif **adından**
  daraltılıyor (çorba, börek, pilav, kebap, dolma, salata…)

### İncelenip alınmayan kaynaklar
| Kaynak | Karar |
|---|---|
| `mertbozkurt/turkish-recipe` (HF, MIT) | Aynı site kaynaklı, daha az yapılandırılmış — `bit104` bunu kapsıyor |
| `ezgicinkilic/turkish-recipe-sharing-platform` | 800K satır ama yalnızca tarif **adı + URL**; malzeme/adım yok |
| `ahsanneural/10k-south-asian-recipes` | 9.997 tarif + ayrı besin/adım tabloları. Değerli ama İngilizce; malzeme eşlemesi ve Türkçe adlandırma ayrı bir tur |
| `himanshikushwaha/global-cuisine-meals` | Yalnızca 261 yemek, malzeme listesi yok |
| `mohamedashraff22/arabic-menus` | Menü fotoğrafları, tarif değil |
| `ArSyra/arsyra-food` | HTTP 401 — kimlik doğrulama istiyor |
| TÜBİTAK ulusal besin veritabanı | Sayfa erişilebilir ama veri dosyası indirilebilir hâlde değil; besin değeri alanı henüz modelimizde yok |

> **Lisans:** korpus kazınmış içerikten türetilmiş. Kişisel kullanım için içe
> aktarıldı. Kamuya açık dağıtım öncesi kaynağın durumu netleştirilmeli.
