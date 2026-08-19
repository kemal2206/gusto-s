-- ════════════════════════════════════════════════════════════════════
-- Yemek kitabı: kaydedilenler, pişirilenler, sosyal medya videoları,
-- kullanıcının kendi tarifleri; paylaşım ve beğeni.
--
-- TELİF NOTU — bu şema kasten video içeriği saklamıyor.
-- `cookbook_items` yalnızca platformun kendi verdiği **kimliği** ve oEmbed'in
-- döndüğü künyeyi tutuyor: url, platform, video kimliği, başlık, hesap adı ve
-- kapak görselinin CDN adresi. Videonun kendisi, sesi, karesi ya da açıklama
-- metni hiçbir zaman bize kopyalanmıyor; kapak da indirilmiyor, platformun
-- sunucusundan gösteriliyor. Kullanıcı dokununca platformun uygulaması
-- açılıyor — yani gösterim değil, atıf yapıyoruz.
-- ════════════════════════════════════════════════════════════════════

-- ── Kitap ───────────────────────────────────────────────────────────
-- Kullanıcı başına tek satır. Arayüzde "Yemek Kitabım" tek bir yer olarak
-- görünüyor; ayrı tablo olmasının sebebi paylaşımın, beğeninin ve editör
-- seçiminin asılacağı bir kimliğe ihtiyaç duyulması.

create table if not exists public.cookbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Yemek Kitabım',
  bio text,
  is_public boolean not null default false,
  -- Paylaşım bağlantısındaki okunur kimlik; kitap gizliyken de duruyor.
  share_slug text unique,
  editor_pick boolean not null default false,
  -- Beğeni sayacı tabloda tutuluyor: her listede alt sorgu çalıştırmak
  -- ana sayfayı yavaşlatır. Tetikleyici güncel tutuyor.
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

-- ── İçerik ──────────────────────────────────────────────────────────

do $$ begin
  create type public.cookbook_item_kind as enum ('tarif', 'video', 'kendi');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.video_platform as enum ('youtube', 'tiktok', 'instagram', 'diger');
exception when duplicate_object then null;
end $$;

create table if not exists public.cookbook_items (
  id uuid primary key default gen_random_uuid(),
  cookbook_id uuid not null references public.cookbooks(id) on delete cascade,
  kind public.cookbook_item_kind not null,

  -- kind='tarif': uygulamanın kendi tarifi. Slug'la bağlıyoruz, id'yle değil:
  -- tarifler şimdilik pakette geliyor, veritabanında karşılığı yok.
  recipe_slug text,

  -- kind='video': yalnızca kimlik ve künye. İçerik yok.
  video_url text,
  video_platform public.video_platform,
  video_id text,
  video_title text,
  video_author text,
  video_thumb_url text,

  -- kind='kendi': kullanıcının yazdığı tarif.
  own_title text,
  own_summary text,
  -- [{ slug, grams, note, raw }] — slug katalogla eşleşenler için dolu,
  -- eşleşmeyen satır `raw` olarak duruyor. Böylece kısmen eşleşen tarif de
  -- "elimde ne var" ve besin hesabına girebiliyor.
  own_ingredients jsonb not null default '[]'::jsonb,
  own_steps jsonb not null default '[]'::jsonb,
  own_minutes integer,
  own_servings integer,

  -- Kaydedilenin cinsine göre otomatik atanan bölüm (tatli, kebap-izgara…).
  category_id text,
  -- Pişirildiyse en son ne zaman; "daha önce yaptıkların" bunu sıralıyor.
  cooked_at timestamptz,
  cook_count integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cookbook_items_book_idx on public.cookbook_items (cookbook_id, created_at desc);
create index if not exists cookbook_items_cooked_idx on public.cookbook_items (cookbook_id, cooked_at desc nulls last);
create index if not exists cookbook_items_category_idx on public.cookbook_items (cookbook_id, category_id);

-- Aynı şey iki kez eklenmesin.
create unique index if not exists cookbook_items_tarif_uq
  on public.cookbook_items (cookbook_id, recipe_slug) where recipe_slug is not null;
create unique index if not exists cookbook_items_video_uq
  on public.cookbook_items (cookbook_id, video_url) where video_url is not null;

-- ── Beğeni ──────────────────────────────────────────────────────────
-- Birincil anahtar (cookbook_id, user_id): bir hesap bir kitabı bir kez
-- beğenir. "En çok beğenilen" listesinin manipüle edilmesini bu engelliyor.

create table if not exists public.cookbook_likes (
  cookbook_id uuid not null references public.cookbooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cookbook_id, user_id)
);

create or replace function public.sync_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.cookbooks set like_count = like_count + 1 where id = new.cookbook_id;
  elsif tg_op = 'DELETE' then
    update public.cookbooks set like_count = greatest(0, like_count - 1) where id = old.cookbook_id;
  end if;
  return null;
end $$;

drop trigger if exists cookbook_likes_count on public.cookbook_likes;
create trigger cookbook_likes_count
  after insert or delete on public.cookbook_likes
  for each row execute function public.sync_like_count();

-- ── Satır düzeyi güvenlik ───────────────────────────────────────────

alter table public.cookbooks enable row level security;
alter table public.cookbook_items enable row level security;
alter table public.cookbook_likes enable row level security;

-- Kitap: sahibi her şeyi yapar; herkes yalnızca yayınlanmış kitabı okur.
create policy cookbooks_owner_all on public.cookbooks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy cookbooks_public_read on public.cookbooks
  for select using (is_public);

-- İçerik: aynı kural kitabı üzerinden devralınıyor.
create policy cookbook_items_owner_all on public.cookbook_items
  for all using (
    exists (select 1 from public.cookbooks c where c.id = cookbook_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.cookbooks c where c.id = cookbook_id and c.owner_id = auth.uid())
  );
create policy cookbook_items_public_read on public.cookbook_items
  for select using (
    exists (select 1 from public.cookbooks c where c.id = cookbook_id and c.is_public)
  );

-- Beğeni: giriş yapmış kullanıcı yalnızca kendi beğenisini yazar/siler.
create policy cookbook_likes_read on public.cookbook_likes for select using (true);
create policy cookbook_likes_write on public.cookbook_likes
  for insert with check (auth.uid() = user_id);
create policy cookbook_likes_delete on public.cookbook_likes
  for delete using (auth.uid() = user_id);

-- ── Keşif görünümü ──────────────────────────────────────────────────
-- Ana sayfadaki "en çok beğenilen" ve "editörün seçimi" bunu okuyor.
-- Boş kitap listeye girmiyor.

create or replace view public.public_cookbooks as
  select c.id, c.title, c.bio, c.share_slug, c.like_count, c.editor_pick, c.updated_at,
         (select count(*) from public.cookbook_items i where i.cookbook_id = c.id) as item_count
  from public.cookbooks c
  where c.is_public
    and exists (select 1 from public.cookbook_items i where i.cookbook_id = c.id);

-- Yeni kullanıcıya kitabını aç.
create or replace function public.ensure_cookbook() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.cookbooks (owner_id) values (new.id) on conflict (owner_id) do nothing;
  return new;
end $$;

drop trigger if exists on_profile_created_cookbook on public.profiles;
create trigger on_profile_created_cookbook
  after insert on public.profiles
  for each row execute function public.ensure_cookbook();
