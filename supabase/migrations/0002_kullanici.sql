-- Tatbilim — kullanıcı katmanı
--
-- Tasarım kararı: tarifler şu an uygulamanın içinde (TypeScript verisi) ve
-- **slug** ile adreslenir. Kullanıcı tabloları da bu yüzden `recipe_slug text`
-- tutuyor, `recipes(id)` yabancı anahtarı değil. Tarifler ileride veritabanına
-- taşındığında slug yine birincil kimlik kalacağı için bu tablolar değişmez.
--
-- 0001'deki `favorites` tablosu bigint recipe_id kullanıyordu ve hiç
-- doldurulmadı; yerini `saved_recipes` alıyor.

-- ═══════════════════════════════════════════════════════════════
-- Profil — açılış sorularının cevapları burada
-- ═══════════════════════════════════════════════════════════════

alter table profiles
  add column if not exists email text,
  -- Hane: porsiyon ölçeklemesi bunun üzerinden yapılıyor
  add column if not exists adults smallint not null default 2 check (adults between 0 and 20),
  add column if not exists children smallint not null default 0 check (children between 0 and 20),
  add column if not exists dogs smallint not null default 0,
  add column if not exists cats smallint not null default 0,
  -- Diyet kısıtları: vegan, vejetaryen, pesketaryen, glutensiz, laktozsuz, domuzsuz
  add column if not exists diet_restrictions text[] not null default '{}',
  -- Sevilmeyen malzeme slug'ları — tarif önerilerinden çıkarılır
  add column if not exists disliked_slugs text[] not null default '{}',
  -- Mutfak ekipmanı: firin, ocak, mikrodalga, fritoz, blender, dusuk-tencere, air-fryer
  add column if not exists appliances text[] not null default '{ocak}',
  add column if not exists onboarded_at timestamptz;

comment on column profiles.disliked_slugs is
  'Alerjiden farklı: kullanıcı sevmiyor diye eleniyor. Alerjen bilgisi ayrıca allergen_tags''ta.';

-- ═══════════════════════════════════════════════════════════════
-- Kullanıcı etkinliği
-- ═══════════════════════════════════════════════════════════════

create table if not exists saved_recipes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  recipe_slug text not null,
  saved_at    timestamptz not null default now(),
  primary key (user_id, recipe_slug)
);

/*
 * Pişirme günlüğü.
 *
 * Ana sayfadaki "Senin mutfağın" bölümü bunu okuyor: 10 tabağın 6'sı tavuksa
 * tavuk tarifleri öne çıkıyor. `main_slug` ana malzeme, `recipe_slug` varsa
 * hazır tariften, yoksa Lab'de kurulmuş bir tabak.
 */
create table if not exists cooked_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  recipe_slug text,
  main_slug   text not null,
  category_id text,
  cooked_at   timestamptz not null default now()
);

create index if not exists cooked_log_user_time on cooked_log (user_id, cooked_at desc);
create index if not exists cooked_log_user_main on cooked_log (user_id, main_slug);

/*
 * Arama günlüğü — "en çok aradıklarıyla bağlantılı" öneriler için.
 * Serbest metin tutuluyor; eşleşen tarif/malzeme varsa o da yazılıyor.
 */
create table if not exists search_log (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  query        text not null,
  matched_slug text,
  searched_at  timestamptz not null default now()
);

create index if not exists search_log_user_time on search_log (user_id, searched_at desc);

create table if not exists grocery_items (
  user_id       uuid not null references auth.users(id) on delete cascade,
  ingredient_slug text not null,
  grams         numeric not null default 0,
  from_recipes  text[] not null default '{}',
  checked       boolean not null default false,
  added_at      timestamptz not null default now(),
  primary key (user_id, ingredient_slug)
);

/*
 * Kaydedilen menüler — "Bana menü hazırla" çıktısı.
 * Bölümler jsonb: [{ slot: 'ana-yemek', recipeSlug: 'karniyarik' }, …]
 */
create table if not exists saved_menus (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  occasion   text,
  guests     smallint not null default 4,
  courses    jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists saved_menus_user on saved_menus (user_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════
-- RLS — hepsi yalnızca sahibine
-- ═══════════════════════════════════════════════════════════════

alter table saved_recipes enable row level security;
alter table cooked_log    enable row level security;
alter table search_log    enable row level security;
alter table grocery_items enable row level security;
alter table saved_menus   enable row level security;

create policy "kendi kayıtları" on saved_recipes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kendi günlüğü" on cooked_log for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kendi aramaları" on search_log for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kendi listesi" on grocery_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kendi menüleri" on saved_menus for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- Kayıt olunca profil satırı otomatik açılsın
-- ═══════════════════════════════════════════════════════════════

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
