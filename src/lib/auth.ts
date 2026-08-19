/**
 * Kimlik doğrulama — e-posta ile tek kullanımlık kod.
 *
 * **Parola yok.** Kullanıcı e-postasını yazıyor, 6 haneli kod geliyor, onu
 * giriyor. Parola tutmamak hem kullanıcı için basit hem bizim için güvenli:
 * saklayacak, sızdıracak, sıfırlama akışı yazacak bir sır kalmıyor.
 *
 * Supabase yapılandırılmadıysa bütün fonksiyonlar `yapilandirilmadi` dönüyor
 * ve uygulama yerel modda çalışmaya devam ediyor — hesap zorunlu değil.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/store/profile';

export type AuthResult =
  | { ok: true }
  | { ok: false; reason: 'yapilandirilmadi' | 'gecersiz-eposta' | 'hata'; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** E-postaya giriş kodu gönderir. Hesap yoksa otomatik oluşturulur. */
export async function sendLoginCode(email: string): Promise<AuthResult> {
  const clean = email.trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return { ok: false, reason: 'gecersiz-eposta' };
  if (!isSupabaseConfigured || !supabase) return { ok: false, reason: 'yapilandirilmadi' };

  const { error } = await supabase.auth.signInWithOtp({
    email: clean,
    options: { shouldCreateUser: true },
  });
  return error ? { ok: false, reason: 'hata', message: error.message } : { ok: true };
}

/** Gelen kodu doğrular ve oturumu açar. */
export async function verifyLoginCode(email: string, code: string): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, reason: 'yapilandirilmadi' };

  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  if (error) return { ok: false, reason: 'hata', message: error.message };

  useProfile.getState().setSession(data.user?.id ?? null, data.user?.email ?? null);
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
  useProfile.getState().setSession(null, null);
}

/**
 * Uygulama açılışında çağrılır: kayıtlı oturum varsa profile yazar ve
 * oturum değişikliklerini dinler.
 */
export function initAuth(): () => void {
  if (!isSupabaseConfigured || !supabase) return () => {};

  supabase.auth.getSession().then(({ data }) => {
    useProfile.getState().setSession(data.session?.user.id ?? null, data.session?.user.email ?? null);
  });

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useProfile.getState().setSession(session?.user.id ?? null, session?.user.email ?? null);
  });

  return () => data.subscription.unsubscribe();
}

// ── Bulut eşitleme ─────────────────────────────────────────────────

/**
 * Yerel profili buluta yazar.
 *
 * Çakışma çözümü kasten basit: **son yazan kazanır**. Profil tek cihazdan
 * düzenlenen küçük bir veri; birleştirme mantığı kurmak bu ölçekte
 * gereksiz karmaşıklık olurdu.
 */
export async function pushProfile(): Promise<AuthResult> {
  const s = useProfile.getState();
  if (!supabase || !s.userId) return { ok: false, reason: 'yapilandirilmadi' };

  const { error } = await supabase.from('profiles').upsert({
    id: s.userId,
    email: s.email,
    adults: s.household.adults,
    children: s.household.children,
    dogs: s.household.dogs,
    cats: s.household.cats,
    diet_restrictions: s.diets,
    disliked_slugs: s.dislikedSlugs,
    appliances: s.appliances,
    onboarded_at: s.onboarded ? new Date().toISOString() : null,
  });

  return error ? { ok: false, reason: 'hata', message: error.message } : { ok: true };
}

/** Buluttaki profili cihaza çeker. Oturum açtıktan hemen sonra çağrılır. */
export async function pullProfile(): Promise<AuthResult> {
  const s = useProfile.getState();
  if (!supabase || !s.userId) return { ok: false, reason: 'yapilandirilmadi' };

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', s.userId)
    .maybeSingle();

  if (error) return { ok: false, reason: 'hata', message: error.message };
  if (!data) return { ok: true };

  useProfile.setState({
    household: {
      adults: data.adults ?? 2,
      children: data.children ?? 0,
      dogs: data.dogs ?? 0,
      cats: data.cats ?? 0,
    },
    diets: data.diet_restrictions ?? [],
    dislikedSlugs: data.disliked_slugs ?? [],
    appliances: data.appliances?.length ? data.appliances : ['ocak'],
    onboarded: Boolean(data.onboarded_at),
  });

  return { ok: true };
}
