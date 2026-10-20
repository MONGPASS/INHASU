import { api } from '../../lib/api';

/**
 * 맞춤 견적 데스크 — INHASU 견적 관리 도구(public/*.html)를 통합 관리자 안에 끼워 넣기 위한 공용 정의.
 *
 * 견적 도구는 공유 비밀번호 하나로 동작한다: 페이지가 sessionStorage 의 값을 읽어
 * API 에 x-admin-token 헤더로 보낸다. 통합 관리자는 로그인한 관리자 세션으로 그 값을 받아
 * 같은 자리에 넣어 주기만 하면 되고, 견적 도구 쪽 코드는 바꾸지 않는다.
 */

/** 견적 도구가 관리자 값을 읽는 sessionStorage 키 (public/견적관리.html 등과 같은 이름). */
const STORAGE_KEY = 'leaders_admin_token';
let connectionGeneration = 0;
let connectionAccount = '';

export const QUOTE_DESK_BASE = '/admin/quote-desk';

export interface QuoteDeskTool {
    /** 주소 `/admin/quote-desk/:tool` 의 tool 값 */
    key: string;
    label: string;
    icon: string;
    /**
     * 끼워 넣을 정적 문서 주소. 확장자 없이 쓴다 — Cloudflare Pages 는 .html 주소를
     * 확장자 없는 주소로 308 보내고, 로컬 wrangler 는 .html 주소에서 오류가 난다.
     */
    doc: string;
    description: string;
    /** 이 메뉴에서 이어지는 화면. 안쪽 화면이 여기로 넘어가도 같은 메뉴로 표시한다. */
    related?: string[];
    /**
     * 좁은 화면(820px 이하)이면 스스로 모바일 화면으로 넘어가는 문서일 때, 그 모바일 문서 주소.
     * iframe 은 바깥 창보다 좁으므로, 바깥 창이 데스크톱 폭이면 `?m=0` 으로 데스크톱 화면을 유지한다.
     */
    mobileDoc?: string;
}

/** 견적관리.html 이 모바일 관리자로 넘어가는 기준 폭 (그 문서 맨 위 스크립트와 같은 값). */
const NARROW_MAX_WIDTH = 820;

export const QUOTE_DESK_TOOLS: QuoteDeskTool[] = [
    {
        key: 'inbox', label: '견적 문의', icon: 'request_quote', doc: '/견적관리',
        description: '견적 문의 접수 현황과 고객·예약 행동 알림',
        related: ['/견적관리-모바일'],
        mobileDoc: '/견적관리-모바일',
    },
    {
        key: 'bookings', label: '견적 예약 목록', icon: 'event_note', doc: '/예약목록',
        description: '예약 확정 고객의 계약·배정·차량·숙소 진행 상태',
        related: ['/예약관리'],
    },
    {
        key: 'builder', label: '견적서 만들기', icon: 'edit_document', doc: '/견적만들기',
        description: '코스를 불러와 견적서를 작성하고 고객 링크로 공유',
    },
    {
        key: 'courses', label: '코스 관리', icon: 'route', doc: '/코스관리',
        description: '견적서에 불러오는 코스(일정·명소·기본가)',
    },
    {
        key: 'itinerary', label: '일정 조각 관리', icon: 'timeline', doc: '/일정관리',
        description: '코스와 일정표에 끼워 넣는 일정 문구',
    },
    {
        key: 'spots', label: '여행지 관리', icon: 'place', doc: '/명소관리',
        description: '상품 일정표·예약 일정표·견적서에서 함께 쓰는 여행지 사진과 설명',
    },
    {
        key: 'resources', label: '가이드·숙소·차량', icon: 'groups', doc: '/리소스관리',
        description: '상품·예약 일정표와 배정에서 함께 쓰는 가이드·숙소·차량',
    },
];

export const quoteDeskHref = (key: string): string => `${QUOTE_DESK_BASE}/${key}`;

/** ID로 서버의 최신 예약을 연다. 다른 고객의 localStorage 전달값에 의존하지 않는다. */
export const quoteBookingHref = (id: string): string => `/admin/customer-workspace/quote/${encodeURIComponent(id)}`;

/** AdminLayout / AdminSidebar 의 activePage 값 */
export const quoteDeskPageId = (key: string): string => `quote-desk-${key}`;

/** 주소의 tool 값으로 메뉴를 찾는다. 없거나 모르는 값이면 첫 메뉴(견적 문의). */
export function findQuoteDeskTool(key?: string | null): QuoteDeskTool {
    return QUOTE_DESK_TOOLS.find((item) => item.key === key) ?? QUOTE_DESK_TOOLS[0];
}

/** 주소(pathname)를 문서 이름으로 맞춘다: 퍼센트 인코딩 해제, `.html`·끝의 `/` 제거. */
export function normalizeDocPath(pathname: string): string {
    let path = pathname;
    try { path = decodeURIComponent(pathname); } catch { /* 잘못된 인코딩은 원문으로 비교 */ }
    return path.replace(/\.html$/i, '').replace(/\/+$/, '');
}

/** 끼워 넣은 화면의 현재 주소(pathname)가 어느 메뉴인지 찾는다. 견적 도구 화면이 아니면 null. */
export function quoteDeskToolForPath(pathname: string): QuoteDeskTool | null {
    const path = normalizeDocPath(pathname);
    return QUOTE_DESK_TOOLS.find((item) => item.doc === path || item.related?.includes(path)) ?? null;
}

/** 바깥(관리자) 창이 데스크톱 폭인지 — 견적관리.html 의 모바일 판별과 같은 식. */
export function isDesktopViewport(): boolean {
    const width = Math.min(window.innerWidth || 9999, window.screen?.width || 9999);
    return width > NARROW_MAX_WIDTH;
}

/** iframe 에 넣을 주소. 바깥 창이 데스크톱 폭이면 모바일 화면으로 넘어가지 않게 `?m=0` 을 붙인다. */
export function quoteDeskFrameSrc(tool: QuoteDeskTool, bookingId?: string, quoteEditorId?: string, resourceType?: string): string {
    if (tool.key === 'resources' && ['guides', 'lodges', 'vehicles'].includes(resourceType || '')) return `${tool.doc}?resourceType=${resourceType}`;
    if (tool.key === 'builder' && bookingId) return `${tool.doc}?id=${encodeURIComponent(bookingId)}`;
    if (tool.key === 'inbox' && quoteEditorId) return `/견적관리-모바일?qe=${encodeURIComponent(quoteEditorId)}`;
    if (tool.key === 'bookings' && bookingId) return `/예약관리?id=${encodeURIComponent(bookingId)}`;
    if (tool.key === 'inbox' && bookingId) return `${tool.doc}?id=${encodeURIComponent(bookingId)}${isDesktopViewport() ? '&m=0' : ''}`;
    return tool.mobileDoc && isDesktopViewport() ? `${tool.doc}?m=0` : tool.doc;
}

/**
 * 관리자 세션으로 견적 도구를 연다: 서버에서 값을 받아 이 탭의 sessionStorage 에 넣는다.
 * 같은 탭·같은 출처의 iframe 은 sessionStorage 를 함께 쓰므로, 그 뒤에 끼워 넣은 견적 화면은
 * 자체 비밀번호 화면 없이 열린다. 서버에 ADMIN_TOKEN 이 설정되어 있지 않으면 null.
 */
export async function connectQuoteDesk(options: { accountId?: string; signal?: AbortSignal; isCurrent?: () => boolean } = {}): Promise<string | null> {
    if (options.accountId && options.accountId !== connectionAccount) { connectionGeneration++; connectionAccount = options.accountId; }
    const generation = connectionGeneration;
    const data = await api.auth.quoteDesk(options.signal);
    if (options.signal?.aborted || options.isCurrent?.() === false || generation !== connectionGeneration || (options.accountId && options.accountId !== connectionAccount)) return null;
    if (options.accountId && data.userId !== options.accountId) throw new Error('현재 관리자 계정으로 견적 데스크를 다시 연결해 주세요.');
    const value = typeof data?.token === 'string' && data.token ? data.token : null;
    if (value) {
        try { window.sessionStorage.setItem(STORAGE_KEY, value); } catch { /* 저장소를 쓸 수 없으면 견적 화면이 자체 로그인을 띄운다 */ }
    }
    return value;
}

/**
 * 견적 화면끼리 넘겨 주는 임시 데이터(localStorage). 관리자 값(adminToken)이 함께 들어 있고,
 * 예약관리.html 은 이것을 읽어 sessionStorage 를 다시 채우므로 로그아웃 때 같이 지워야 한다.
 */
const HANDOFF_KEYS = ['leaders_prefill', 'leaders_booking_prefill'];

/**
 * 관리자 로그아웃 때 견적 도구 쪽 값도 함께 지운다.
 * (새 창으로 열어 둔 견적 화면은 탭마다 sessionStorage 가 따로라서 그 탭을 닫을 때까지 남는다.)
 */
export function disconnectQuoteDesk(): void {
    connectionGeneration++; connectionAccount = '';
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    try { HANDOFF_KEYS.forEach((key) => window.localStorage.removeItem(key)); } catch { /* ignore */ }
}

/** 견적 문의 한 건 — 대시보드 요약에 쓰는 필드만. */
export interface QuoteDeskRequest {
    id: string;
    name?: string;
    status?: string;
    destination?: string;
    receivedAt?: string;
}

/** 견적 문의 목록(최신순). 견적 데스크가 설정되지 않았거나 불러오지 못하면 null. */
export async function fetchQuoteDeskRequests(): Promise<QuoteDeskRequest[] | null> {
    try {
        const value = await connectQuoteDesk();
        if (!value) return null;
        const res = await fetch('/api/requests', {
            headers: { 'x-admin-token': value },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.ok && Array.isArray(data.items) ? (data.items as QuoteDeskRequest[]) : null;
    } catch {
        return null;
    }
}
