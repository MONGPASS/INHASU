/**
 * 견적 문의 목록(`/admin/quote-desk/inbox`) 계산 — 옛 도구 public/견적관리.html의 목록·요약·행동 알림 규칙을 그대로 옮겼다.
 * 자료는 같은 `GET /api/requests`(x-admin-token)이고 이 화면은 읽기만 한다. 한 건을 고치는 일은 고객 통합 작업 화면에서 한다.
 * 다음 할 일(nextAction)은 옛 도구와 같아야 한다 — tests/quote-inbox.test.mjs가 옛 문서의 함수와 결과를 비교한다.
 */
export type InquiryRecord = Record<string, any> & { id: string | number };

export const INQUIRY_STATUSES = ['신규', '진행중', '예약확정', '완료', '보류'] as const;
export type InquiryStatus = typeof INQUIRY_STATUSES[number];

export const statusOf = (r: InquiryRecord): string => r.status || '신규';

export interface InquiryAction { label: string; detail: string }

/** 고객·예약이 기다리는 다음 할 일(옛 도구 nextAction과 같은 순서·문구). 없으면 null. */
export function nextAction(r: InquiryRecord): InquiryAction | null {
    const accepted = !!(r.decision && r.decision.status === 'accepted');
    if (accepted && !r.booking) return { label: '예약 진행 요청', detail: '고객이 견적을 수락했습니다 · 예약관리를 시작하세요' };
    if (!r.booking) return null;
    const b = r.booking, ci = b.contractInfo || {}, paid = ci.depositStatus === '입금완료';
    const signed = !!(b.contract && b.contract.signedAt), confirmed = r.status === '예약확정';
    if (!paid && !(b.depositRequest && b.depositRequest.status === 'requested')) return { label: '예약금 안내 필요', detail: '예약정보를 확인하고 예약금 안내를 보내세요' };
    if (!paid && b.depositReport && b.depositReport.status === 'reported') return { label: '입금 신고 확인', detail: `고객이 입금 완료를 알렸습니다 (입금자명 ${b.depositReport.name || '-'}) · 예약관리에서 입금 확인을 누르면 계약서·여행자 정보 요청까지 자동 진행됩니다` };
    if (!paid) return { label: '예약금 입금 대기', detail: '고객이 카톡으로 입금을 알리면 예약관리에서 입금 확인을 누르세요' };
    if (!signed && !(b.contractRequest && b.contractRequest.status === 'requested')) return { label: '계약서 요청 필요', detail: '예약금 확인 완료 · 고객에게 서명을 요청하세요' };
    if (!signed) return { label: '계약서 서명 대기', detail: '고객에게 서명 요청을 보냈습니다' };
    if (!confirmed) return { label: '예약 확정 필요', detail: '고객 서명 완료 · 내용을 확인하고 예약을 확정하세요' };
    if (b.publishStatus !== 'published') return { label: '일정표 공개 준비', detail: '배정을 완료한 뒤 확정 일정표를 공개하세요' };
    return null;
}

/** 행동 알림의 급함: 관리자가 지금 눌러야 하는 일(urgent) · 고객을 기다리는 일(waiting) · 그 밖(next) */
export function actionTone(label: string): 'urgent' | 'waiting' | 'next' {
    return /확정 필요|확인|요청 필요|안내 필요/.test(label) ? 'urgent' : /대기/.test(label) ? 'waiting' : 'next';
}

const pad = (n: number) => String(n).padStart(2, '0');
/** 이 컴퓨터 시간 기준 YYYY-MM-DD(옛 도구 dateOnly와 같음). 날짜가 아니면 '-'. */
export function dateOnly(value: unknown): string {
    const d = new Date(value as string);
    return isNaN(d.getTime()) ? '-' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const paxSum = (r: InquiryRecord): number => (Number(r.adult) || 0) + (Number(r.child) || 0) + (Number(r.infant) || 0);
export const nightText = (r: InquiryRecord): string => r.nights ? `${r.nights}박 ${Number(r.nights) + 1}일` : '-';
export const budgetText = (r: InquiryRecord): string => String(r.budget || '-').replace('1인 ', '');

/** 출발까지 남은 날(출발일이 없거나 잘못됐으면 null) */
export function dDay(r: InquiryRecord, now: Date = new Date()): number | null {
    if (!r.depart) return null;
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const d = new Date(r.depart); if (isNaN(d.getTime())) return null; d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/** 출발 7일 안인데 아직 신규·진행중인 문의 */
export function isUrgent(r: InquiryRecord, now: Date = new Date()): boolean {
    const dd = dDay(r, now);
    return dd !== null && dd >= 0 && dd <= 7 && ['신규', '진행중'].includes(statusOf(r));
}

/** 요청 내용 한 줄: 희망 투어 · 여행 타입 + 요청 앞 26자 */
export function requestSnippet(r: InquiryRecord): string {
    const text = String(r.request || '').replace(/\n/g, ' ');
    return text.length > 26 ? text.slice(0, 26) + '…' : text;
}

export interface InboxSummary {
    total: number;
    byStatus: Record<InquiryStatus, number>;
    today: number;
    doneThisMonth: number;
    actions: Array<{ record: InquiryRecord; action: InquiryAction }>;
}

export function inboxSummary(records: InquiryRecord[], now: Date = new Date()): InboxSummary {
    const byStatus = Object.fromEntries(INQUIRY_STATUSES.map(s => [s, records.filter(r => statusOf(r) === s).length])) as Record<InquiryStatus, number>;
    const todayKey = dateOnly(now), month = todayKey.slice(0, 7);
    return {
        total: records.length,
        byStatus,
        today: records.filter(r => dateOnly(r.receivedAt) === todayKey).length,
        doneThisMonth: records.filter(r => statusOf(r) === '완료' && dateOnly(r.receivedAt).slice(0, 7) === month).length,
        actions: records.map(record => ({ record, action: nextAction(record) })).filter((x): x is { record: InquiryRecord; action: InquiryAction } => !!x.action),
    };
}

/** 상태 필터: 전체(all) · 행동이 필요한 문의(action) · 상태 하나 */
export type InboxFilter = 'all' | 'action' | InquiryStatus;
export type InboxSort = 'receivedDesc' | 'receivedAsc' | 'departAsc' | 'departDesc' | 'nameAsc';

export const INBOX_SORTS: Array<{ value: InboxSort; label: string }> = [
    { value: 'receivedDesc', label: '접수 최신순' },
    { value: 'receivedAsc', label: '접수 오래된순' },
    { value: 'departAsc', label: '출발일 빠른순' },
    { value: 'departDesc', label: '출발일 늦은순' },
    { value: 'nameAsc', label: '이름순' },
];

const SORT_RULE: Record<InboxSort, [string, 1 | -1]> = {
    receivedDesc: ['receivedAt', -1], receivedAsc: ['receivedAt', 1], departAsc: ['depart', 1], departDesc: ['depart', -1], nameAsc: ['name', 1],
};

/** 필터·검색·정렬을 적용한 목록(옛 도구 visibleRows와 같은 검색 칸·같은 문자열 비교) */
export function visibleInquiries(records: InquiryRecord[], options: { filter: InboxFilter; search: string; sort: InboxSort }): InquiryRecord[] {
    const search = options.search.trim().toLowerCase();
    let rows = records.slice();
    if (options.filter === 'action') rows = rows.filter(r => nextAction(r));
    else if (options.filter !== 'all') rows = rows.filter(r => statusOf(r) === options.filter);
    if (search) rows = rows.filter(r => [r.name, r.phone, r.destination, r.tripType, r.request, r.memo, r.email].some(v => String(v || '').toLowerCase().includes(search)));
    const [key, dir] = SORT_RULE[options.sort] ?? SORT_RULE.receivedDesc;
    return rows.sort((a, b) => {
        const va = String(a[key] ?? ''), vb = String(b[key] ?? '');
        return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
}

/** 지난번에 본 목록과 비교한 새 문의·새 고객 행동(자동 새로 고침 알림). 처음 불러올 때는 비교하지 않는다. */
export interface InboxSeen { ids: Set<string>; actionKeys: Set<string> }
export function inboxSeen(records: InquiryRecord[]): InboxSeen {
    return {
        ids: new Set(records.map(r => String(r.id))),
        actionKeys: new Set(records.flatMap(r => { const a = nextAction(r); return a ? [`${r.id}:${a.label}`] : []; })),
    };
}
export function inboxArrivals(previous: InboxSeen | null, records: InquiryRecord[]): { fresh: InquiryRecord[]; freshActions: Array<{ record: InquiryRecord; action: InquiryAction }> } {
    if (!previous) return { fresh: [], freshActions: [] };
    return {
        fresh: records.filter(r => !previous.ids.has(String(r.id))),
        freshActions: records.flatMap(record => { const action = nextAction(record); return action && !previous.actionKeys.has(`${record.id}:${action.label}`) ? [{ record, action }] : []; }),
    };
}

/** 알림 문구(옛 도구 토스트와 같은 내용) */
export function arrivalMessage(arrivals: ReturnType<typeof inboxArrivals>): string {
    if (arrivals.fresh.length) {
        const first = arrivals.fresh[0];
        return `새 견적 문의 ${arrivals.fresh.length}건 도착 — ${first.name || '이름 없음'}님${arrivals.fresh.length > 1 ? ' 외' : ''}`;
    }
    if (arrivals.freshActions.length) {
        const first = arrivals.freshActions[0];
        return `${first.record.name || '고객'}님 · ${first.action.label}`;
    }
    return '';
}

/** `GET /api/requests` 응답에서 목록만(형식이 다르면 오류) */
export function readInquiryList(body: unknown): InquiryRecord[] {
    const items = (body as { ok?: boolean; items?: unknown })?.ok === true ? (body as { items?: unknown }).items : null;
    if (!Array.isArray(items)) throw new Error('견적 문의 목록 형식이 올바르지 않습니다.');
    return items.filter((item): item is InquiryRecord => !!item && typeof item === 'object' && !Array.isArray(item) && (item as InquiryRecord).id != null);
}
