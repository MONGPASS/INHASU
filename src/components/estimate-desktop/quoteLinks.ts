/**
 * 견적 요청을 마친 고객의 "내 견적" 전용 링크.
 * Google 로그인과 소유권 확인을 거쳐 진행 상황 → 견적서 → 입금 신고 → 계약서 서명 → 확정일정표를 확인한다.
 * 받은 링크는 이 브라우저(localStorage)에 최근 5건까지 보관해 `/custom-estimate`와
 * 완료 화면(새로고침 포함)에서 다시 보여 준다.
 */

export interface QuoteLink {
    /** 서버가 발급한 고객 조회 값(`POST /api/requests` 응답). */
    token: string;
    name: string;
    /** ISO 8601 */
    createdAt: string;
}

/** 완료 화면에 넘기는 값. 요약(brief·rows·memo)은 방금 제출한 탭에만 있다. */
export interface QuoteDoneState extends QuoteLink {
    brief?: { trip: string; tour: string; phone: string };
    /** 요청 내용 전체(라벨, 값). */
    rows?: Array<[string, string]>;
    /** 카카오톡 상담에 붙여 넣을 요청 내용. */
    memo?: string;
}

const LINKS_KEY = 'mw_quote_links';
const MAX_LINKS = 5;
const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * 내 견적 주소. `/내견적.html?t=<값>` 형식은 카카오 알림톡 템플릿에 고정돼 있어 바꾸면 안 된다.
 * 한글 파일명은 메신저에서 링크가 끊기지 않도록 인코딩해 둔다(옛 견적 요청 폼과 같은 표기).
 */
export const myQuotePath = (token: string) => `/${encodeURI('내견적.html')}?t=${encodeURIComponent(token)}`;
export const myQuoteUrl = (token: string) => `${window.location.origin}${myQuotePath(token)}`;

const asLink = (v: unknown): QuoteLink | null => {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    if (typeof o.token !== 'string' || !TOKEN_RE.test(o.token)) return null;
    return {
        token: o.token,
        name: typeof o.name === 'string' ? o.name.slice(0, 40) : '',
        createdAt: typeof o.createdAt === 'string' ? o.createdAt : '',
    };
};

/** 최근 요청 순. 저장소를 쓸 수 없으면(사생활 보호 모드 등) 빈 목록. */
export function readQuoteLinks(): QuoteLink[] {
    try {
        const saved: unknown = JSON.parse(localStorage.getItem(LINKS_KEY) || '[]');
        if (!Array.isArray(saved)) return [];
        return saved.map(asLink).filter((l): l is QuoteLink => l !== null).slice(0, MAX_LINKS);
    } catch {
        return [];
    }
}

export const latestQuoteLink = (): QuoteLink | null => readQuoteLinks()[0] ?? null;

export function saveQuoteLink(link: QuoteLink) {
    try {
        const next = [link, ...readQuoteLinks().filter((l) => l.token !== link.token)].slice(0, MAX_LINKS);
        localStorage.setItem(LINKS_KEY, JSON.stringify(next));
    } catch {
        /* 저장소를 쓸 수 없어도 완료 화면의 링크는 그대로 보인다 */
    }
}

/**
 * 완료 화면이 보여 줄 견적: 라우터 state(방금 제출) → 없으면 이 브라우저에 보관한 최근 링크.
 * 둘 다 없으면 null(견적 요청 화면으로 돌려보낸다).
 */
export function resolveQuoteDone(state: unknown): QuoteDoneState | null {
    const link = asLink(state);
    if (!link) return latestQuoteLink();
    const s = state as Partial<QuoteDoneState>;
    const text = (v: unknown) => (typeof v === 'string' ? v : '');
    const rows = Array.isArray(s.rows)
        ? s.rows.filter((r): r is [string, string] => Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'string')
        : undefined;
    return {
        ...link,
        brief: s.brief ? { trip: text(s.brief.trip), tour: text(s.brief.tour), phone: text(s.brief.phone) } : undefined,
        rows,
        memo: text(s.memo) || undefined,
    };
}

/** 2026-10-12T03:00:00Z → 10월 12일. 날짜를 알 수 없으면 ''. */
export const quoteLinkDate = (createdAt: string) => {
    const d = new Date(createdAt);
    return createdAt && !Number.isNaN(d.getTime()) ? `${d.getMonth() + 1}월 ${d.getDate()}일` : '';
};

/** 클립보드 복사. 권한이 없거나 오래된 브라우저면 임시 입력창으로 한 번 더 시도한다. */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(area);
            return ok;
        } catch {
            return false;
        }
    }
}
