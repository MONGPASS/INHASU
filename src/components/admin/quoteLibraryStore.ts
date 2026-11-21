/**
 * 견적 자료실(`/api/data/:key`) 읽기·쓰기 — 옛 견적 도구의 public/presets.js(cloudPull·cloudPush)와 같은 약속.
 * - 읽기는 관리자 값(x-admin-token)과 함께 보내 비공개 칸까지 받는다.
 * - 쓰기는 마지막으로 읽은 updatedAt을 `?base=`로 보내 그 사이 다른 기기가 저장했으면 409를 받는다. 덮어쓰기는 `?force=1`.
 * - 같은 브라우저의 옛 도구가 서버에 닿지 못할 때 쓰는 캐시(localStorage `leaders_*`)도 옛 도구처럼 함께 고친다.
 */
import { decodeImage, encodeWebP } from '../../utils/upload';

export type QuoteLibraryKey = 'spots' | 'spot_cats' | 'courses' | 'snippets' | 'snippet_cats' | 'guides' | 'drivers' | 'lodges' | 'lodge_cats' | 'vehicles';

const CACHE_KEYS: Record<QuoteLibraryKey, string> = {
    spots: 'leaders_spots', spot_cats: 'leaders_spot_cats', courses: 'leaders_courses',
    snippets: 'leaders_snippets', snippet_cats: 'leaders_snippet_cats',
    guides: 'leaders_guides', drivers: 'leaders_drivers', lodges: 'leaders_lodges', lodge_cats: 'leaders_lodge_cats', vehicles: 'leaders_vehicles',
};

const writeCache = (key: QuoteLibraryKey, data: unknown) => {
    try { window.localStorage.setItem(CACHE_KEYS[key], JSON.stringify(data)); } catch { /* 저장소를 쓸 수 없는 창 */ }
};

export interface QuoteLibraryRead { data: unknown; updatedAt: string | null }

export class QuoteLibraryError extends Error {
    readonly status: number;
    constructor(message: string, status = 0) { super(message); this.status = status; }
}

export async function readQuoteLibrary(key: QuoteLibraryKey, token: string, signal?: AbortSignal): Promise<QuoteLibraryRead> {
    const res = await fetch(`/api/data/${key}`, { cache: 'no-store', headers: token ? { 'x-admin-token': token } : {}, signal });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new QuoteLibraryError(body?.error ? `자료를 불러오지 못했습니다: ${body.error}` : `자료를 불러오지 못했습니다(${res.status}).`, res.status);
    if (body.data != null) writeCache(key, body.data);
    return { data: body.data ?? null, updatedAt: body.updatedAt ?? null };
}

export type QuoteLibraryWrite = { ok: true; updatedAt: string | null } | { ok: false; conflict: true };

/** base가 null이면 서버에 아직 자료가 없던 상태다(옛 도구와 같이 빈 값으로 보낸다). */
export async function writeQuoteLibrary(key: QuoteLibraryKey, data: unknown, token: string, options: { base: string | null; force?: boolean }): Promise<QuoteLibraryWrite> {
    const query = options.force ? 'force=1' : `base=${encodeURIComponent(options.base ?? '')}`;
    const res = await fetch(`/api/data/${key}?${query}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify(data),
    });
    if (res.status === 409) return { ok: false, conflict: true };
    const body = await res.json().catch(() => null);
    if (res.status === 401) throw new QuoteLibraryError('관리자 인증이 만료됐어요. 화면을 새로 고친 뒤 다시 저장해 주세요.', 401);
    if (!res.ok || !body?.ok) throw new QuoteLibraryError(body?.error ? `저장하지 못했습니다: ${body.error}` : `저장하지 못했습니다(${res.status}).`, res.status);
    writeCache(key, data);
    return { ok: true, updatedAt: body.updatedAt ?? null };
}

/**
 * 견적 공개 사진 올리기 — 옛 여행지 관리와 같이 가로 maxWidth 이하 WebP로 줄여 `/api/upload?folder=images`(R2 FILES `images/`)에 올리고
 * 공개 주소(`/api/img/…`)를 돌려준다. 사이트 이미지(`/api/site-upload`, BUCKET)와는 다른 저장소다.
 */
export async function uploadQuoteImage(file: File, token: string, maxWidth: number, quality: number): Promise<string> {
    const image = await decodeImage(file);
    let webp: File;
    try {
        const scale = Math.min(1, maxWidth / image.width);
        webp = await encodeWebP(image.source, Math.round(image.width * scale), Math.round(image.height * scale), quality, 'spot');
    } finally {
        image.release();
    }
    const form = new FormData();
    form.append('file', webp, 'spot.webp');
    const res = await fetch('/api/upload?folder=images', { method: 'POST', body: form, headers: { 'x-admin-token': token } });
    const body = await res.json().catch(() => null);
    if (res.status === 401) throw new QuoteLibraryError('관리자 인증이 만료됐어요. 화면을 새로 고친 뒤 다시 올려 주세요.', 401);
    if (!res.ok || !body?.ok || !body.url) throw new QuoteLibraryError(body?.error ? `사진을 올리지 못했습니다: ${body.error}` : '사진을 올리지 못했습니다.', res.status);
    return String(body.url);
}
