# Görsel üretimi — şartname ve üretim hattı

Amaç: 3.686 tarifin fotoğrafsız olanlarına, yemeği tanınır bırakan, profesyonel
çekilmiş izlenimi veren görsel üretmek.

Neden gerekli: fotoğrafı olmayan tariflerde arayüz `loremflickr.com`'a düşüyor
(9 yerde — `recipe-tile.tsx:29`, `tarif/[slug].tsx:101`, `canim.tsx:471,581,633`,
`index.tsx:193,309`, `lab.tsx:387`, `ingredient-avatar.tsx:40`). O servis "food"
etiketli **rastgele bir internet fotoğrafı** döndürüyor; yani şu anda o
tariflerde gösterilen görselin yemekle hiçbir ilgisi yok.

Promptlar elle yazılmıyor, **üretiliyor**:

```
npm run data:gorsel                     dağılım raporu
npm run data:gorsel -- --incele manti   tek tarifin promptu
npm run data:gorsel -- --ornek 12       çeşitlilik örneklemi
npm run data:gorsel -- --supheli        kategori/yöntem hatası taraması
npm run data:gorsel -- --write          fotoğrafsız tarifler (2.964)
npm run data:gorsel -- --write --hepsi  korpusun tamamı (3.477)
```

Çıktılar ayrı dosyalara gidiyor, biri diğerinin üstüne binmiyor:

| Dosya | Kapsam |
|---|---|
| `data-build/gorsel-promptlari.jsonl` | 2.964 — fotoğrafı olmayan tarifler |
| `data-build/gorsel-promptlari-hepsi.jsonl` | 3.477 — gerçek fotoğrafı olan 513 tarif dâhil |

İkincisi, yemek.com'un eski fotoğraflarının değiştirilmesine karar verilirse
hazır dursun diye üretiliyor.

Kaynak: [`scripts/pipeline/11-gorsel-prompt.ts`](../scripts/pipeline/11-gorsel-prompt.ts)

---

## Temel kural: ad **ve** tanım, ikisi birden

İlk sürüm "adına güvenme, görünüşünü tarif et" diyordu. Yarısı doğruydu ve
yarısı pahalıya mal oldu.

Doğru olan kısım: fiziksel tanım verilen mantı karesi gerçekten mantı çıktı,
ravioliye kaymadı. Yanlış olan kısım: tanımı adın **yerine** koymuştum. Ölçülen
sonuç:

| Prompt ne dedi | Model ne üretti |
|---|---|
| "yoğurt ve nane karıştırılmış" (ad geçmiyor) | bardakta yoğurt |
| "kıyma, ızgara" (ad geçmiyor) | tepside köfte |

Model **Adana kebabını biliyor**; ona "kıymadan yapılmış ızgara" demek bildiği
şeyi saklamak oluyor. Doğrusu ikisi birden:

```
The dish is Adana Kebabı (Adana Kebabi), a traditional Turkish grilled kebab.
Made with ground lamb, lamb tail fat, urfa pepper, garlic, cooked over charcoal…
```

- **Ad** gestalt'ı çağırıyor — yemeğin bütünsel biçimi, dizilişi, kimliği.
- **Tanım** tarifin gerçek malzemesine sadık kalmayı zorluyor, modelin
  genel-geçer bir restoran tabağına kaymasını engelliyor.
- **ASCII biçim** de veriliyor ("Künefe (Kunefe)"): Türkçe harfli ad da
  tanınıyor ama ASCII yazım eğitim verisinde çok daha sık geçiyor.

Ad olmadan tanım genel bir yemek üretiyor; tanım olmadan ad tarifle ilgisiz bir
tabak üretiyor.

### Adla çelişen her şey ayıklanmalı

Ad prompta girince, onunla çelişen alanlar hemen görünür oldu:

- **Künefe** cam tatlı kâsesine düşüyordu. Kabı kimliğinin parçası olan
  tarifler için `DISH_VESSEL` sözlüğü var — künefe kendi bakır tavasında,
  Türk kahvesi fincanda, güveç toprak kapta.
- **Ayran** yöntem cümlesinden "mixed together, rustic and uneven" alıyordu;
  bir bardak ayran için tam tersi doğru. İçecekte yöntem cümlesi hiç
  kullanılmıyor.
- **Ayrana "no foam" gidiyordu.** Fine dining köpüğünü engellemek için
  konmuştu ama ayranın köpüğü yemeğin kendisi, Türk kahvesinde ise doğru
  demlemenin işareti.

## Neyin değiştiği, neyin değişmediği

Çeşitlilik ile kaos arasındaki fark, neyin serbest bırakıldığında.

| | |
|---|---|
| **DEĞİŞİR** | açı · kap · zemin · aksesuar · ışığın yönü |
| **SABİT** | ışığın yumuşaklığı · objektif · renk · gerçekçilik · süs kuralı · güvenli kırpma alanı |

Sabit kalan kısım "fotoğraf dili" — 3.000 karenin aynı uygulamaya ait
görünmesini o sağlıyor. Değişen kısım ızgaranın stok fotoğraf kataloğu gibi
görünmesini engelliyor.

**Çeşitlilik rastgele değil, slug'ın hash'inden.** `Math.random()` iki şeyi
bozardı: aynı tarif yeniden üretilince farklı prompt çıkardı, ve hangi karenin
neden öyle çıktığı izlenemezdi. Her boyut ayrı tuz kullanıyor — tek hash'le
seçilse zemin ile kap birbirine kilitlenir, korpus boyunca aynı ikili tekrar
ederdi.

## Açı: 90° sabit, tek istisna içecek

Üç sürüm denendi:

| Sürüm | Sonuç |
|---|---|
| Kategoriye göre 0°/45°/90° | Tek tek kareler iyi, **ızgarada dağınık** |
| 0° yerine 15° | Boşluk sorunu çözüldü, dağınıklık çözülmedi |
| **90° sabit** | Izgara toplu |

Aynı listede farklı açılar yan yana gelince göz bir düzen bulamıyor.
Kütüphane ölçeğinde **tutarlılık, kare başına en iyi açıdan daha değerli**.
Tepeden çekim ayrıca iki farklı kırpmaya en dayanıklı açı.

İçecek istisna: bardağı tepeden çekince sadece bir daire görünüyor, bardağın
kendisi ve köpüğü kayboluyor. 16 içecek karesi 15°/45°'de kalıyor.

Ölçülen dağılım: **90° 2.948 · 15° 12 · 45° 4**

### Katı tepeden kuralı

"Camera directly overhead" tek başına yetmiyordu: model kareleri sık sık
70-80°'ye kaydırıyor, kamera hafifçe öne eğiliyordu. Tek tek bakınca fark
edilmiyor ama ızgarada eğik kare hemen sırıtıyor — zaten tek açıya inmemizin
sebebi buydu, gevşek bir 90° o kazancı geri veriyor.

İşe yarayan kısım sıfat değil **ölçüt**. Gerçek tepeden çekimde yuvarlak tabak
tam daire görünür; en ufak eğilmede elips olur, kâsenin iç duvarı görünür,
masanın uzak kenarı kadraja girer:

```
The camera's optical axis is exactly perpendicular to the table — a true
bird's-eye flat-lay. A round plate or bowl must render as a perfect circle,
never an ellipse. No side wall of the vessel is visible, no interior wall of
the bowl, no perspective convergence, no horizon line, no far edge of the
table, no background wall. If anything in the frame suggests the camera is
tilted even slightly forward, it is wrong.
```

Yedi negatif de yalnızca 90° karelere ekleniyor: `no three-quarter view`,
`no angled or tilted camera`, `no elliptical or oval plate rim`,
`no visible horizon`, `no background wall`, `no perspective distortion`,
`no side view of the vessel`.

İçecek kareleri bu bloğu almıyor — onlar zaten alçak açıda.

**Denetimde de aynı ölçüt kullanılabilir:** tabağın kenarı daire değil elips
görünüyorsa kare reddedilir. Gözle bakarken "biraz eğik mi acaba" diye
düşündürmeyen, tek bakışta karar verilebilen bir kural.

## Çeşitliliği artık tabak taşıyor

Açı sabitlenince çeşitlilik yükü buraya geçti. Tepeden çekimde kare zaten
tabağın kendisi; rengi ve deseni değişmezse 2.900 kare aynı beyaz daireye
dönüyor.

18 sır ve desen: düz mat beyaz, benekli kırık beyaz, kobalt, adaçayı yeşili,
terracotta, **mavi-beyaz çini**, **Kütahya florali**, tozlu pembe, antrasit
mat, hardal sarısı, kenarında ince kobalt çizgi, çatlaklı fildişi, yanık
turuncu, zeytin yeşili yaprak motifli, turkuaz, mavi geometrik bordürlü krem,
patlıcan moru, kum rengi mat.

**Renk yalnızca opak seramiğe uygulanıyor — %54,9.** İki sınıf dışarıda:

| Sınıf | Neden |
|---|---|
| Şeffaf (cam bardak, cam kâse, kavanoz) | Rengi içindeki yemek belirliyor |
| Sabit malzeme (bakır, döküm, arduvaz, ahşap, emaye, hasır, toprak güveç) | Malzeme rengini zaten söylüyor |

Bu ikisine renk verilirse prompt kendisiyle çelişiyor: "dövme bakır tepsi,
çini desenli" cümlesi modele ne yapacağını söylemiyor.

Seramik kap tanımlarındaki sabit renkler de temizlendi ("beyaz porselen tabak"
→ "porselen tabak"), yoksa sır seçimiyle çakışıyordu.

## Geleneksel sunum — %65 kapsama

Künefeyi tek tek yazmak 2.964 tarifte ölçeklenmiyor. Oysa Türkçede yemeğin adı
kabını da neredeyse her zaman söylüyor. `refineCategory` ile aynı mimaride 41
kurallık bir katman var:

| Ad | Kap |
|---|---|
| …güveç | iki kulplu toprak güveç, kendi kabında fokurdayarak |
| künefe | dövme bakır künefe tavası |
| sütlaç | üstü ızgarada kızarmış toprak kâse |
| lahmacun, pide, gözleme | uzun ahşap tahta |
| …kebabı, adana, urfa, iskender | lavaş serili dövme bakır tepsi |
| börek | bakır tepsi, porsiyonlara kesilmiş |
| midye dolma | bakır tepside sıra sıra, limonla |
| çay / kahve / ayran | ince belli bardak / fincan / köpüklü bardak |

**Ad tek başına yetmediği yerde ikinci koşul var.** "Tas Kebabı" sulu yemek,
"Söğürme Kebabı" fırın yemeği — üçü de lavaş serili bakır tepsiye konuyordu.
Kebap kuralı artık pişirme yöntemine de bakıyor; ızgara değilse kural düşüyor.

Aynı sınıftan iki düzeltme daha: `çörek` kalıbı "Çörek Otlu Peynirli Omlet"i
tel ızgaraya koyuyordu (çörek otu baharat, hamur işi değil) ve kurabiye pasta
ayağında duruyordu.

**Kalıplar `kelimeBasi`/`tamKelime` ile kuruluyor. Buraya düz regex yazma** —
`/kek/` "Keşkek" ile eşleşiyor, bu hata bu projede bir kere yapıldı.

Kapsanmayan %35, kabı yöntem ve kategori havuzlarından alıyor.

## Kap ve zemin havuzları

- **59 farklı kap.** Alüminyum ve sıradan metal tepsi **yok**: yerlerine dövme
  bakır tepsi, krem emaye borcam, bakır sahan, toprak güveç.
- **22 farklı zemin** — ahşap (6), taş (7), karo (3, çini dâhil), kumaş-dokuma
  (4), bakır levha (1). Tatlı, kahvaltı ve içecek kendi eğilimli havuzlarını
  kullanıyor.

## Süs denetimi otomatik

"Tarifte maydanoz yoksa fotoğrafta maydanoz olmayacak" kuralı elle
yazılamıyordu. Üreteç bunu `allSlugs`'tan türetiyor: modelin sık uydurduğu
süslerin listesi var, tarifte karşılığı yoksa negatif prompta giriyor.

Liste kapsamlı değil **kapsamı ayrılmış**: tatlıya "no parsley, no olives"
göndermenin bilgi değeri yok ve uzun negatif liste modelde önemli maddeyi
zayıflatıyor. Denemede menemen'de tam bu gerekmişti — tarifte peynir yok ama
karede beyaz bir akıntı çıktı ve peynir mi yumurta akı mı ayırt edilemedi.
**Belirsiz kare, gözle denetimi pahalılaştırıyor.**

## Kırpma — sayı, "bol boşluk bırak" değil

İlk denemede "generous even margin" talimatı tutmadı; kaplar kareyi kenardan
kenara doldurdu. Gerçek kısıt arayüzden çıkıyor:

- hero `100% × 320` → **1,22:1 yatay** kırpıyor → yüksekliğin ortadaki **%82**'si kalır
- tile `168 × 250` → **0,67:1 dikey** kırpıyor → genişliğin ortadaki **%67**'si kalır

Yani yemek karenin **ortadaki %67 genişlik × %82 yükseklik** dikdörtgenine
sığmalı. Prompt bu sayıyı yazıyor. Tile'da altta 52 piksellik siyah yazı şeridi
de var, kritik parça oraya denk gelmemeli.

Çıktı: **1:1 kare, 1536×1536.** Yerel tutulacak, hotlink edilmeyecek.

## Bilinen açık: DISH_LOOK

`DISH_LOOK` sözlüğünde elle yazılmış fiziksel tanımı olan tarif **5**; kalan
2.960 tarif genel tanıma düşüyor. Genel tanım fena değil — malzemeler gramaja
göre sıralanıp İngilizce adlarıyla veriliyor (katalogda 251/251 dolu), pişirme
yöntemi görünüşe çevriliyor ("oven-baked with a browned, slightly crisp top").
Ama tanınırlık, elle yazılmış tanımın çok altında.

Kalite/emek dengesinin en iyi olduğu yer burası: **en çok açılan tariflerden
başlayarak `DISH_LOOK` doldurmak**, üretilen kare sayısını artırmaktan daha
değerli.

## Üretimden önce: 159 şüpheli kayıt

`npm run data:gorsel -- --supheli`

Üreteç `categoryId` ve `method` alanlarına güveniyor; ikisi de korpusta hatalı
olabiliyor ve hata **görselde çok daha görünür** hâle geliyor. Yanlış
kategorideki tarif şu an sadece yanlış listede duruyor; görsel eklenince yanlış
kaba girip yanlış açıdan çekiliyor.

| Tarama | Sayı | Sonucu |
|---|---|---|
| Tatlı kategorisinde, tuzlu malzeme taşıyan | 25 | Cam tatlı kâsesinde, tam yandan çekilecek |
| Soğuk yemek adı, sıcak pişirme yöntemi | 134 | Salata döküm tavada servis edilecek |

Toplam **159 tarif — üretilecek 2.965 karenin %5,4'ü.** Üretim para harcıyor ve
yanlış kayda harcanan para geri gelmiyor; bu liste önce temizlenmeli.

Örnekler: `keskek` ve `nohutlu-keskek` tatlı kategorisinde (keşkek tatlı değil),
`girit-usulu-cacik` ve `coleslaw-salatasi` yöntemi `tava` (ikisi de pişmiyor).

*Not: tarama gürültüyü azaltmak için `kabak`, `nohut` ve `zeytinyagi`
işaretlerini kullanmıyor — bal kabağı tatlısı, aşure ve baklava üçünü de meşru
şekilde içeriyor.*

---

## Deneme turu kaydı (6 tarif)

İlk tur elle yazılmış tek zeminli/tek açılı şartnameyle üretildi. Sonuçlar:

| Tarif | Ölçtüğü | Sonuç |
|---|---|---|
| Mercimek çorbası | Şartname çalışıyor mu | ✅ Geçti |
| Kayseri mantısı | Modelin Türk mutfağı sınırı | ✅ Kimlik tuttu; kenarda halka dizilim artefaktı, boyut iri |
| Karnıyarık | Musakkaya karışma + tepeden açı | ✅ İkisi de sorunsuz — tepeden çalışıyor |
| Mücver | Gerçek 2014 fotoğrafına karşı A/B | Karşılaştırma yapılmadı |
| Menemen | Kap disiplini + süs disiplini | ❌ Tahta eklendi, gölge sertleşti, beyaz akıntı belirsiz |
| Şehriyeli pilav | Tek renk yemek iştah açıcı olur mu | ✅ Geçti, süs eklemedi |

**Turdan çıkan üç şartname değişikliği** (hepsi üretece işlendi):

1. Aksesuar havuzu kategoriye bağlandı. Global havuz baklavanın yanına ekmek
   dilimi koyuyordu; menemen'e ekmek yazınca model kesme tahtası ekledi ve
   varyansın girdiği kapı orası oldu.
2. Işığın **yönü** serbest, **yumuşaklığı** sabit. Menemen'deki sertlik tam
   buradan gelmişti.
3. Boşluk talimatı sayıya döndü (%67 × %82).

---

## İlk parti sonucu — 13 kare

Parti-1'in 13 karesi üretildi (Seedream, fal.ai) ve **önceki turlarda başarısız
olan üçü de düzeldi**:

| Kare | Önceki tur | Bu tur |
|---|---|---|
| **Adana Kebabı** | tepside köfte | Lavaş üstünde iki uzun şiş, dövme bakır tepsi, yeşil boyalı ahşap — doğru |
| **Ev Ayranı** | bardakta yoğurt | Köpük başlığı belirgin, nane serpintili, çini karo üzerinde — doğru |
| **Kayseri Mantısı** | halka dizilim artefaktı | Köşelerinden büzülmüş paketçikler, sarımsaklı yoğurt, biberli yağ, nane, sumak |

**Elips testi geçti.** Baktığım karelerde yuvarlak kap tam daire çıkıyor;
kamera öne eğilmemiş. Katı tepeden kuralı işini yapıyor.

**Tabak sırrı görünür şekilde çalışıyor.** Mantı karesi reçetedeki sırla geldi
— "mavi geometrik bordürlü krem" kâse, koyu yeşil mermer zemin. Sır ve zemin
boyutları prompttan çıkıp kareye geçiyor.

### Bulunan tek eksik: çözünürlük

Promptta 1536×1536 yazıyor ama gelen kareler **1024×1024**. Hero tam genişlik ×
320pt olduğu için 3x yoğunluklu bir telefonda ~1170 piksel gerekiyor; 1024
biraz büyütülerek basılıyor. yemek.com'un 940 pikselinden iyi ama tam değil.

Üretim turunda API çağrısında boyut açıkça 1536 (ya da 2K) istenmeli —
`12-gorsel-uret.ts` içindeki `FAL_SIZE` bunu zaten gönderiyor; sağlayıcının
alan adı farklıysa oradan düzeltilecek.

### Uygulamaya bağlandı

13 görsel `assets/tarif/<slug>.jpg` altında; 1200 piksele indirilip JPEG'e
çevrildi (10,4 MB → 2,5 MB, %76 küçülme).

Bağlantı `src/data/recipes/gorsel-yerel.ts` üzerinden. Metro yalnızca sabit
dizgi alan `require()` çağrılarını paketlediği için sözlük elle yazılıyor;
üretilebilir ama dinamik olamaz.

Görsel sırası: **yerel görsel → `Recipe.imageUrl` → yer tutucu.** Üçüncü
basamak hâlâ `loremflickr` ve hâlâ yanlış; sözlük doldukça kendiliğinden
boşalıyor.

Birkaç yüz görselden sonra bu yaklaşım ölçeklenmiyor — 2.964 kare pakete
gömülemez. O noktada görseller Supabase Storage'a ya da bir CDN'e taşınıp
`imageUrl` üzerinden gelmeli.

### Eşlemede çıkan tuzak

Dosya adları başlıktan türetilmiş, slug'dan değil. İki tarif **aynı başlığı**
taşıyor:

```
"Kırmızı Mercimek Çorbası"  →  mercimek-corbasi  ve  kirmizi-mercimek-corbasi
"Terbiyeli Tavuk Çorbası"   →  iskembe-alternatifi-tavuk-suyu  ve  terbiyeli-tavuk-corbasi
```

Dosya adı ikisini ayırt edemiyor. Doğru olan, promptu kullanılan tarif — yani
Parti-1 listesindeki. Eşleme o listeye kısıtlanarak yapıldı, 13/13 tekil.

Sonraki partilerde dosyaların **slug ile** adlandırılması bu belirsizliği
tamamen kaldırır; `12-gorsel-uret.ts` zaten öyle yazıyor
(`data-build/gorseller/<slug>.jpg`).
