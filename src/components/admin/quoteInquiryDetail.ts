/**
 * 고객 통합 작업 화면 안의 견적 문의 상세 — 계산만 모은 곳(화면은 QuoteInquiryPanel.tsx).
 * 옛 도구 public/견적관리.html의 상세 창(openDrawer)·customerTimeline·updateStatus 검사와 결과가 같아야 한다
 * (tests/quote-customer-inquiry.test.mjs가 옛 함수와 비교한다). 화면 글자의 그림 문자(💬·🔔 등)만 뺐다.
 */
import type { InquiryRecord } from './quoteInbox';

export const paxText = (r: InquiryRecord): string => `성인 ${r.adult || 0}·아동 ${r.child || 0}·유아 ${r.infant || 0}`;
const nightTxt = (r: InquiryRecord): string => r.nights ? `${r.nights}박 ${Number(r.nights) + 1}일` : '-';

/** 고객이 수락했거나 이미 예약확정인 문의(옛 openDrawer의 accepted) */
export const inquiryAccepted = (r: InquiryRecord): boolean => !!(r.decision && r.decision.status === 'accepted') || (r.status || '신규') === '예약확정';
export const inquiryPublished = (r: InquiryRecord): boolean => !!(r.booking && r.booking.publishStatus === 'published');

/** 상태를 바꿀 수 없는 까닭(바꿀 수 있으면 ''). 옛 updateStatus의 예약확정 검사와 같다. */
export function statusBlock(r: InquiryRecord, next: string): string {
    if (next !== '예약확정') return '';
    const prev = r.status || '신규';
    if (!r.quote) return '견적서를 먼저 발행해야 예약확정할 수 있어요';
    if (!(r.decision && r.decision.status === 'accepted') && prev !== '예약확정') return '고객 수락을 먼저 기록해 주세요';
    if (!r.booking) return '예약관리를 시작하고 계약 정보를 저장해 주세요';
    if (!(r.booking.contract && r.booking.contract.signedAt)) return '고객 계약서 서명이 필요합니다';
    if (!r.booking.contractInfo || r.booking.contractInfo.depositStatus !== '입금완료') return '예약금 입금 확인이 필요합니다';
    return '';
}

/** 유효기간 7일 연장 — 아직 남아 있으면 그 날부터, 지났거나 없으면 지금부터 */
export function extendedQuoteExpiry(r: InquiryRecord, now: Date = new Date()): string {
    const base = r.quoteExpiresAt && new Date(r.quoteExpiresAt) > now ? new Date(r.quoteExpiresAt) : now;
    return new Date(base.getTime() + 7 * 86400000).toISOString();
}

/** 카톡으로 보내는 고객 링크(주소 고정 — CLAUDE.md 3.1) */
export const customerLinkUrl = (origin: string, token: string): string => `${origin}/${encodeURI('내견적.html')}?t=${token}`;

/** 비공개 첨부 주소(관리자 헤더로 받는다 — ?token= 링크는 쓰지 않는다) */
export const attachmentPath = (fileKey: string): string => `/api/file/${encodeURIComponent(fileKey).replace(/%2F/g, '/')}`;

/** ‘정보 복사’ 글 — 옛 도구와 한 글자도 다르지 않게 */
export function inquiryCopyText(r: InquiryRecord): string {
    return `[견적 문의] ${r.name}\n연락처: ${r.phone}\n이메일: ${r.email}${r.kakaoId ? `\n카톡ID: ${r.kakaoId}` : ''}\n인원: ${paxText(r)}\n일정: ${r.depart}~${r.return_} (${nightTxt(r)})\n타입: ${r.tripType}\n투어: ${r.destination}${r.destSpots && r.destSpots.length ? ` / 관심: ${r.destSpots.join(', ')}` : ''}\n시내숙소: ${r.cityStay || r.stay || '-'}\n투어게르: ${r.gerStay || '-'}\n차량: ${r.vehicle}\n항공권: ${(r.flightIn || r.flightOut) ? `IN ${r.flightIn || '미정'} / OUT ${r.flightOut || '미정'}` : '미발행'}${r.budget ? `\n예산: ${r.budget}` : ''}\n요청: ${r.request || '-'}`;
}

export interface InquiryInfoRow { key: string; label: string; value: string; sub?: string }
/** 문의 내용 표 — 옛 상세 창의 칸 순서 그대로(카톡 ID·예산은 있을 때만) */
export function inquiryInfoRows(r: InquiryRecord): InquiryInfoRow[] {
    const rows: InquiryInfoRow[] = [
        { key: 'phone', label: '휴대폰', value: r.phone || '-' },
        { key: 'email', label: '이메일', value: r.email || '-' },
    ];
    if (r.kakaoId) rows.push({ key: 'kakao', label: '카톡 ID', value: String(r.kakaoId) });
    rows.push(
        { key: 'pax', label: '인원', value: paxText(r) },
        { key: 'period', label: '일정', value: `${r.depart || '?'} ~ ${r.return_ || '?'} (${nightTxt(r)})` },
        { key: 'type', label: '여행타입', value: r.tripType || '-', sub: r.travelStyles && r.travelStyles.length ? `취향: ${r.travelStyles.join(', ')}` : undefined },
        { key: 'dest', label: '희망투어', value: r.destination || '-', sub: r.destSpots && r.destSpots.length ? `관심 지역: ${r.destSpots.join(', ')}` : undefined },
        { key: 'city', label: '시내 숙소', value: r.cityStay || r.stay || '-' },
        { key: 'ger', label: '투어 게르', value: r.gerStay || '-' },
        { key: 'vehicle', label: '차량', value: r.vehicle || '-' },
        { key: 'flight', label: '항공권', value: (r.flightIn || r.flightOut) ? `IN ${r.flightIn || '미정'} · OUT ${r.flightOut || '미정'}` : '미발행', sub: (r.flightIn || r.flightOut) ? undefined : '견적서에 미정으로 표시' },
    );
    if (r.budget) rows.push({ key: 'budget', label: '예산', value: String(r.budget) });
    return rows;
}

/** 고객 진행 타임라인 — 레코드에 남은 기록으로 ‘누가 · 언제 · 무엇을’(옛 견적관리 customerTimeline과 같다) */
export interface InquiryTimelineEvent { at: string; who: '고객' | '관리자' | '자동'; label: string }
const NOTI: Record<string, string> = {
    quote_notification_queued: '견적 확인 알림톡 발송 요청',
    quote_notification_skipped: '견적 알림톡 미발송 · 설정/전화번호 확인',
    itinerary_notification_queued: '확정일정표 확인 알림톡 발송 요청',
    itinerary_notification_skipped: '일정표 알림톡 미발송 · 설정/전화번호 확인',
};
export function inquiryTimeline(r: InquiryRecord): InquiryTimelineEvent[] {
    const ev: InquiryTimelineEvent[] = [];
    const b = r.booking || {};
    const acts: any[] = Array.isArray(r.activities) ? r.activities : [];
    if (r.receivedAt) ev.push({ at: r.receivedAt, who: '고객', label: '견적 문의 접수' });
    const quoteSent = r.quoteIssuedAt || (r.notify && r.notify.quoteSentAt);
    if (r.quote && quoteSent) ev.push({ at: quoteSent, who: '관리자', label: '견적서 발행' });
    acts.filter(a => a && Object.hasOwn(NOTI, a.type)).forEach(a => ev.push({ at: a.at, who: '자동', label: NOTI[a.type] }));
    if (r.decision && r.decision.status === 'accepted' && r.decision.acceptedAt) {
        ev.push(r.decision.source === 'customer'
            ? { at: r.decision.acceptedAt, who: '고객', label: "'이 견적으로 예약 진행하기' 클릭" }
            : { at: r.decision.acceptedAt, who: '관리자', label: '전화·카톡 수락 기록' });
    }
    if (b.depositRequest && b.depositRequest.status === 'requested' && b.depositRequest.requestedAt)
        ev.push({ at: b.depositRequest.requestedAt, who: '자동', label: '예약금·입금 계좌 안내 표시' });
    if (b.depositReport && b.depositReport.status === 'reported' && b.depositReport.reportedAt)
        ev.push({ at: b.depositReport.reportedAt, who: '고객', label: `입금 완료 신고 (입금자명 ${b.depositReport.name || '-'})` });
    const paidAct = acts.filter(a => a && a.type === 'payment_changed' && /예약금.*입금완료/.test(a.detail || '')).pop();
    if (paidAct) ev.push({ at: paidAct.at, who: '관리자', label: '예약금 입금 확인' });
    if (b.contractRequest && b.contractRequest.status === 'requested' && b.contractRequest.requestedAt)
        ev.push({ at: b.contractRequest.requestedAt, who: '자동', label: '계약서 서명·여행자 정보 요청 발송' });
    if (b.contract && b.contract.signedAt) ev.push({ at: b.contract.signedAt, who: '고객', label: '계약서 서명 완료' });
    if (b.travelerSubmission && b.travelerSubmission.submittedAt)
        ev.push({ at: b.travelerSubmission.submittedAt, who: '고객', label: `여행자 정보 제출 (${b.travelerSubmission.submittedCount || 0}명)` });
    (Array.isArray(r.changeRequests) ? r.changeRequests : []).forEach((x: any) => {
        const at = x && (x.at || x.requestedAt);
        if (at) ev.push({ at, who: '고객', label: `일정 변경 요청 (${(x.categories || []).join(', ') || '내용 확인'})${x.status === 'resolved' ? ' · 처리됨' : ''}` });
    });
    if (b.confirmedAt) ev.push({ at: b.confirmedAt, who: '관리자', label: '예약 확정' });
    if (b.publishedAt) ev.push({ at: b.publishedAt, who: '관리자', label: '확정 일정표 공개' });
    return ev.filter(e => e.at && !isNaN(new Date(e.at).getTime())).sort((a, c) => new Date(a.at).getTime() - new Date(c.at).getTime());
}

const pad = (n: number) => String(n).padStart(2, '0');
/** 타임라인 시각: 날짜만 저장된 기록은 MM.DD, 시각까지 있으면 MM.DD HH:mm(이 컴퓨터 시간) */
export function timelineTime(at: string): string {
    const d = new Date(at);
    const date = `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
    return String(at).length > 10 ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}
