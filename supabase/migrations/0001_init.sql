-- Tatbilim — başlangıç şeması
-- Aşama 1: tablolar, indeksler, RLS. Veri yüklemesi aşama 2'de (scripts/).

create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;      -- malzeme adı araması için

-- ═══════════════════════════════════════════════════════════════
-- ENUM'lar
-- ═══════════════════════════════════════════════════════════════

-- src/engine/types.ts → INGREDIENT_CATEGORIES ile birebir aynı sırada.
create type ingredient_category as enum (
  'protein', 'deniz', 'sarkuteri', 'sut', 'sebze', 'mantar', 'ot',
  'baharat', 'meyve', 'kuruyemis', 'tahil', 'baklagil', 'yag',
  'asit', 'tatlandirici', 'icecek', 'diger'
);

-- Malzemenin tabaktaki işlevi. Motor "hangi rol boş?" sorusunu bununla yanıtlar.
create type ingredient_role as enum (
  'ana',          -- ana malzeme (antrikot, tavuk göğsü)
  'aromatik',     -- soğan, sarımsak, defne
  'asit',         -- limon, nar ekşisi, sirke
  'tatlandirici', -- bal, pekmez, şeker
  'yag',          -- tereyağı, zeytinyağı
  'baglayici',    -- yumurta, un, krema — köprü/kıvam
  'baharat',
  'bitirici',     -- maydanoz, sumak, rendelenmiş peynir
  'zemin'         -- pilav, makarna, patates
);

create type pairing_kind as enum ('paylasilan', 'zit', 'geleneksel', 'kopru');

-- ═══════════════════════════════════════════════════════════════
-- Kimyasal katman
-- ═══════════════════════════════════════════════════════════════

create table compounds (
  id            bigserial primary key,
  slug          text not null unique,
  name          text not null,
  name_tr       text,
  pubchem_cid   bigint,
  cas_number    text,
  /*
   * Aşama 1'de motor 54 bileşik AİLESİ kullanıyor (src/data/aroma-classes.ts).
   * Aşama 2'de gerçek bileşikler yüklenirken her satır ait olduğu aileye
   * bu alanla bağlanacak; motor tarafında hiçbir şey değişmeyecek çünkü
   * hem aile hem bileşik sadece "sayı kümesi" olarak görünüyor.
   */
  family_slug   text,
  -- "meyvemsi", "yeşil", "karamel", "kükürtlü" gibi duyusal etiketler
  odor_tags     text[] not null default '{}',
  odor_desc     text,
  -- algı eşiği (ppb) — düşükse az miktarı bile baskındır
  threshold_ppb numeric,
  created_at    timestamptz not null default now()
);

create index on compounds using gin (odor_tags);

create table ingredients (
  id            bigserial primary key,
  slug          text not null unique,
  name_tr       text not null,
  name_en       text,
  category      ingredient_category not null,
  default_role  ingredient_role not null,
  -- bu malzemenin alabileceği diğer roller (antrikot 'ana', tereyağı 'yag'+'bitirici')
  roles         ingredient_role[] not null default '{}',
  -- karakteristik olduğu mutfaklar: tr, ege, guneydogu, karadeniz,
  -- levanten, balkan, yunan, iran, kafkas, ortaasya
  cuisines      text[] not null default '{tr}',

  -- ── tat vektörü, 0–10 ────────────────────────────────────────
  t_sweet       smallint not null default 0 check (t_sweet  between 0 and 10),
  t_sour        smallint not null default 0 check (t_sour   between 0 and 10),
  t_salty       smallint not null default 0 check (t_salty  between 0 and 10),
  t_bitter      smallint not null default 0 check (t_bitter between 0 and 10),
  t_umami       smallint not null default 0 check (t_umami  between 0 and 10),
  t_fat         smallint not null default 0 check (t_fat    between 0 and 10),
  t_heat        smallint not null default 0 check (t_heat   between 0 and 10),

  -- 1 gramın yemeği ne kadar etkilediği (safran 10, patates 1)
  potency       numeric(4,2) not null default 1.0 check (potency > 0),
  aroma_power   smallint not null default 5 check (aroma_power between 0 and 10),

  -- ── pratik alanlar ───────────────────────────────────────────
  is_staple     boolean not null default false,  -- "Elimde Ne Var?" hızlı kartlarında
  is_allergen   boolean not null default false,
  allergen_tags text[] not null default '{}',    -- gluten, laktoz, findik...
  diet_tags     text[] not null default '{}',    -- vejetaryen, vegan, helal...
  seasons       smallint[] not null default '{}',-- 1–12 ay
  cost_tier     smallint check (cost_tier between 1 and 3),
  image_url     text,

  -- ── köken/izlenebilirlik ─────────────────────────────────────
  source        text,        -- 'ahn2011' | 'flavordb2' | 'tr-manual'
  external_id   text,
  is_tr_local   boolean not null default false,  -- TR katmanı eklemesi mi
  notes         text,
  created_at    timestamptz not null default now()
);

create index on ingredients (category);
create index on ingredients (default_role);
create index on ingredients (is_staple) where is_staple;
create index ingredients_name_trgm on ingredients using gin (name_tr gin_trgm_ops);

create table ingredient_compounds (
  ingredient_id bigint not null references ingredients(id) on delete cascade,
  compound_id   bigint not null references compounds(id)   on delete cascade,
  -- bilinen konsantrasyon (varsa). Ahn verisi sadece varlık/yokluk içerir.
  concentration_ppm numeric,
  source        text,
  primary key (ingredient_id, compound_id)
);

create index on ingredient_compounds (compound_id);

-- ═══════════════════════════════════════════════════════════════
-- Flavor network — önceden hesaplanmış kenarlar
-- 1.500 malzeme = ~1.1M çift; runtime'da hesaplanamaz.
-- scripts/ tarafından üretilir, eşik altı kenarlar yazılmaz.
-- ═══════════════════════════════════════════════════════════════

create table ingredient_pairings (
  a_id          bigint not null references ingredients(id) on delete cascade,
  b_id          bigint not null references ingredients(id) on delete cascade,

  shared_count  integer not null default 0,   -- ham ortak bileşik sayısı (UI'da gösterilir)
  aroma_score   numeric(6,5) not null,        -- IDF ağırlıklı kosinüs ∈ [0,1]
  prior_npmi    numeric(6,5),                 -- tarif korpusundan NPMI ∈ [0,1] (clamp)
  kind          pairing_kind not null default 'paylasilan',
  -- en güçlü ortak bileşikler: [{slug, name_tr, weight}] — "neden?" ekranı için
  top_compounds jsonb not null default '[]',

  primary key (a_id, b_id),
  constraint pairing_ordered check (a_id < b_id)   -- her çift bir kez
);

create index on ingredient_pairings (a_id, aroma_score desc);
create index on ingredient_pairings (b_id, aroma_score desc);
create index on ingredient_pairings (a_id, prior_npmi desc nulls last);

-- ═══════════════════════════════════════════════════════════════
-- Tarifler
-- ═══════════════════════════════════════════════════════════════

create table recipes (
  id            bigserial primary key,
  slug          text not null unique,
  title         text not null,
  summary       text,
  cuisine       text,
  method        text,                          -- firin | ocak | izgara | haslama | ciğ
  difficulty    smallint not null default 1 check (difficulty between 1 and 3),
  total_minutes integer not null,
  servings      smallint not null default 4,
  meal_types    text[] not null default '{}',  -- kahvalti, ana_yemek, tatli, meze
  diet_tags     text[] not null default '{}',
  -- yemeğin toplam tat profili (recipe_ingredients'tan türetilir, cache)
  t_sweet numeric(4,2), t_sour numeric(4,2), t_salty numeric(4,2),
  t_bitter numeric(4,2), t_umami numeric(4,2), t_fat numeric(4,2), t_heat numeric(4,2),
  image_url     text,
  source        text,
  is_generated  boolean not null default false,  -- motor mu üretti
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index on recipes (total_minutes);
create index on recipes using gin (meal_types);
create index on recipes using gin (diet_tags);

create table recipe_ingredients (
  id            bigserial primary key,
  recipe_id     bigint not null references recipes(id) on delete cascade,
  ingredient_id bigint not null references ingredients(id) on delete restrict,
  amount        numeric,
  unit          text,                  -- g, ml, adet, yemek_kasigi, tutam
  grams         numeric,               -- normalize edilmiş — motor bunu kullanır
  role          ingredient_role not null,
  is_optional   boolean not null default false,
  is_core       boolean not null default false,  -- "1 eksik" hesabında sayılır mı
  note          text
);

create index on recipe_ingredients (recipe_id);
create index on recipe_ingredients (ingredient_id);

create table recipe_steps (
  recipe_id   bigint not null references recipes(id) on delete cascade,
  step_no     smallint not null,
  body        text not null,
  minutes     integer,
  technique   text,
  primary key (recipe_id, step_no)
);

-- ═══════════════════════════════════════════════════════════════
-- Kullanıcı katmanı
-- ═══════════════════════════════════════════════════════════════

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  font_scale    numeric(3,2) not null default 1.0,  -- erişilebilirlik tercihi
  allergen_tags text[] not null default '{}',
  diet_tags     text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create table pantry_items (
  user_id       uuid not null references auth.users(id) on delete cascade,
  ingredient_id bigint not null references ingredients(id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (user_id, ingredient_id)
);

create table user_dislikes (
  user_id       uuid not null references auth.users(id) on delete cascade,
  ingredient_id bigint not null references ingredients(id) on delete cascade,
  primary key (user_id, ingredient_id)
);

create table favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  recipe_id  bigint not null references recipes(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- ═══════════════════════════════════════════════════════════════
-- RLS
-- Katalog (malzeme/bileşik/eşleşme/tarif) herkese açık okunur.
-- Kullanıcı verisi yalnızca sahibine.
-- ═══════════════════════════════════════════════════════════════

alter table compounds             enable row level security;
alter table ingredients           enable row level security;
alter table ingredient_compounds  enable row level security;
alter table ingredient_pairings   enable row level security;
alter table recipes               enable row level security;
alter table recipe_ingredients    enable row level security;
alter table recipe_steps          enable row level security;

create policy "katalog okunur" on compounds            for select using (true);
create policy "katalog okunur" on ingredients          for select using (true);
create policy "katalog okunur" on ingredient_compounds for select using (true);
create policy "katalog okunur" on ingredient_pairings  for select using (true);
create policy "katalog okunur" on recipe_ingredients   for select using (true);
create policy "katalog okunur" on recipe_steps         for select using (true);

-- Tarifler: yayınlanmışlar herkese, kullanıcının kendi ürettikleri kendisine
create policy "tarif okunur" on recipes for select
  using (created_by is null or created_by = auth.uid());
create policy "kendi tarifini yazar" on recipes for insert
  with check (created_by = auth.uid());
create policy "kendi tarifini gunceller" on recipes for update
  using (created_by = auth.uid());

alter table profiles      enable row level security;
alter table pantry_items  enable row level security;
alter table user_dislikes enable row level security;
alter table favorites     enable row level security;

create policy "kendi profili" on profiles      for all using (id = auth.uid())      with check (id = auth.uid());
create policy "kendi kileri"  on pantry_items  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kendi sevmedikleri" on user_dislikes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kendi favorileri"   on favorites     for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- Yardımcı görünüm: yönsüz kenarları iki yönlü sorgulanabilir yap
-- ═══════════════════════════════════════════════════════════════

create view ingredient_pairings_bidirectional as
  select a_id as from_id, b_id as to_id, shared_count, aroma_score, prior_npmi, kind, top_compounds
  from ingredient_pairings
  union all
  select b_id as from_id, a_id as to_id, shared_count, aroma_score, prior_npmi, kind, top_compounds
  from ingredient_pairings;
