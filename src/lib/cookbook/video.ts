/**
 * Sosyal medya tarif videoları — link çözümleme.
 *
 * **Telif duruşu.** Videoyu kopyalamıyoruz. Kullanıcının yapıştırdığı
 * bağlantıdan platformu ve video kimliğini çıkarıyor, platformun kendi
 * **oEmbed** uçlarından künyeyi (başlık, hesap, kapak adresi) alıyoruz.
 * Kapak indirilmiyor, platformun sunucusundan gösteriliyor; dokununca
 * `Linking.openURL` ile platformun uygulaması açılıyor. Yani ne barındırma
 * ne yeniden yayın var — atıf var.
 *
 * Platform farkı önemli:
 *  - **YouTube ve TikTok** oEmbed uçları anahtarsız ve herkese açık.
 *  - **Instagram** oEmbed'i Meta onaylı uygulama + token istiyor. Onaysız
 *    çalışsın diye Reels'te künyeyi kullanıcının kendisi yazıyor; biz
 *    yalnızca bağlantıyı ve platform kimliğini tutuyoruz.
 *
 * Özel şema (`tiktok://`) yerine https bağlantısını açıyoruz: iOS ve
 * Android universal link'i kurulu uygulamaya yönlendiriyor, uygulama yoksa
 * tarayıcıda açılıyor. Özel şema kurulu değilse hata veriyor.
 */

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'diger';

export const PLATFORM_LABELS: Record<VideoPlatform, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  diger: 'Bağlantı',
};

export interface VideoRef {
  url: string;
  platform: VideoPlatform;
  /** Platformdaki kimlik — aynı videoyu iki kez eklememek için. */
  videoId?: string;
}

export interface VideoMeta extends VideoRef {
  title?: string;
  author?: string;
  thumbUrl?: string;
  /** Künye platformdan mı geldi, kullanıcı mı yazdı. */
  source: 'oembed' | 'elle';
}

const PATTERNS: { platform: VideoPlatform; re: RegExp }[] = [
  { platform: 'youtube', re: /(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/i },
  { platform: 'tiktok', re: /tiktok\.com\/(?:@[\w.-]+\/video\/|v\/|t\/)(\w+)/i },
  { platform: 'instagram', re: /instagram\.com\/(?:reel|reels|p|tv)\/([\w-]+)/i },
];

/** Bağlantıyı tanı. Tanınmayan bağlantı da kabul ediliyor — `diger` olarak. */
export function parseVideoUrl(input: string): VideoRef | null {
  const url = input.trim();
  if (!/^https?:\/\//i.test(url)) return null;

  for (const { platform, re } of PATTERNS) {
    const m = url.match(re);
    if (m) return { url: cleanUrl(url), platform, videoId: m[1] };
  }
  return { url: cleanUrl(url), platform: 'diger' };
}

/**
 * İzleme parametrelerini at.
 *
 * Paylaşılan bağlantılar `?igsh=…`, `?si=…` gibi kişiyi işaretleyen
 * parametreler taşıyor. Bunları saklamak hem gereksiz hem de kullanıcının
 * izini başkasına açık kitapta taşımak olur.
 */
function cleanUrl(url: string): string {
  const drop = ['si', 'igsh', 'igshid', 'utm_source', 'utm_medium', 'utm_campaign', 'feature', '_r', '_t'];
  try {
    const u = new URL(url);
    for (const k of drop) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}

const OEMBED: Partial<Record<VideoPlatform, (url: string) => string>> = {
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
};

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

/**
 * Künyeyi platformdan al.
 *
 * Başarısız olursa hata fırlatmıyor: bağlantı yine kaydedilebilsin diye
 * `source: 'elle'` ile geri dönüyor ve kullanıcı başlığı kendisi yazıyor.
 * Ağ yoksa da uygulama çalışmaya devam etmeli.
 */
export async function fetchVideoMeta(ref: VideoRef, timeoutMs = 6000): Promise<VideoMeta> {
  const endpoint = OEMBED[ref.platform];
  if (!endpoint) return { ...ref, source: 'elle' };

  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint(ref.url), { signal: control.signal });
    if (!res.ok) return { ...ref, source: 'elle' };

    const data = (await res.json()) as OEmbedResponse;
    return {
      ...ref,
      title: data.title?.trim() || undefined,
      author: data.author_name?.trim() || undefined,
      thumbUrl: data.thumbnail_url || undefined,
      source: 'oembed',
    };
  } catch {
    return { ...ref, source: 'elle' };
  } finally {
    clearTimeout(timer);
  }
}
