// Shared date formatting helpers.
// Review/magazine timestamps come from D1 as either ISO strings, "YYYY-MM-DD HH:mm:ss",
// or "YYYY-MM-DD". Parsing Date(undefined/invalid) returns Invalid Date — guard against that.

const toValidDate = (raw: string | number | Date | null | undefined): Date | null => {
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Short numeric date: "2026. 04. 22." (legacy 'ja' locale: "2026/04/22").
 * Used in list cards where space is tight.
 */
export const formatShortDate = (raw: string | number | Date | null | undefined, locale: string = 'ko'): string => {
    const d = toValidDate(raw);
    if (!d) return '';
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    return locale.startsWith('ja') ? `${y}/${m}/${day}` : `${y}. ${m}. ${day}.`;
};

/**
 * Short date with abbreviated weekday in parentheses. Used on MyReviews cards.
 * "2026. 04. 22. (수)" in Korean.
 */
export const formatDateWithWeekday = (raw: string | number | Date | null | undefined, locale: string = 'ko'): string => {
    const d = toValidDate(raw);
    if (!d) return '';
    const base = formatShortDate(d, locale);
    const weekdayLocale = locale.startsWith('ja') ? 'ja-JP' : (locale.startsWith('ko') ? 'ko-KR' : locale);
    const weekday = d.toLocaleDateString(weekdayLocale, { weekday: 'short' });
    return `${base} (${weekday})`;
};

/**
 * Relative time for reviews/comments/activity. e.g. "방금", "3분 전", "2시간 전", then falls back to short date.
 */
export const formatRelativeTime = (raw: string | number | Date | null | undefined, locale: string = 'ko'): string => {
    const d = toValidDate(raw);
    if (!d) return '';
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return formatShortDate(d, locale);

    const min = Math.floor(diffMs / 60_000);
    const hr = Math.floor(diffMs / 3_600_000);
    const day = Math.floor(diffMs / 86_400_000);

    if (min < 1) return '방금';
    if (min < 60) return `${min}분 전`;
    if (hr < 24) return `${hr}시간 전`;
    if (day < 7) return `${day}일 전`;
    return formatShortDate(d, locale);
};

/** Date → 브라우저 로컬 캘린더 기준 "YYYY-MM-DD". 고객이 실제로 클릭한 날짜 칸을 그대로 보존한다. */
export const toLocalDateKey = (raw: string | number | Date | null | undefined): string => {
    const d = toValidDate(raw);
    if (!d) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const JST_DATE_PARTS = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
});

/**
 * 예약 출발일/종료일을 "YYYY-MM-DD"로 정규화한다.
 *
 * D1의 start_date/end_date는 두 가지 형태가 섞여 있다.
 *  - "YYYY-MM-DD"        : 관리자 입력·견적 전환 경로. 이미 의도한 캘린더 날짜.
 *  - ISO 타임스탬프      : 예전 예약 플로우가 로컬 자정 Date에 toISOString()을 씌운 값.
 *                          KST(UTC+9)에서는 전날 15:00Z로 저장되므로 앞 10자를 그대로
 *                          자르면 출발일이 하루 앞당겨져 보인다.
 * ISO 값은 영업·고객 기준 시간대(UTC+9 — Asia/Tokyo 는 서울과 같은 시각) 캘린더로 환산해, 관리자 브라우저
 * 시간대(몽골 UTC+8 등)와 무관하게 고객이 고른 날짜와 일치하게 만든다.
 */
export const toTourDateKey = (raw: string | number | Date | null | undefined): string => {
    if (!raw) return '';
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        // "YYYY-MM-DD HH:mm:ss" (시간대 표기 없음) → 날짜 부분이 이미 현지 날짜다.
        if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return trimmed.slice(0, 10);
    }
    const d = toValidDate(raw);
    if (!d) return typeof raw === 'string' ? raw.trim().slice(0, 10) : '';
    const parts = JST_DATE_PARTS.formatToParts(d);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    const y = get('year'), m = get('month'), day = get('day');
    return y && m && day ? `${y}-${m}-${day}` : toLocalDateKey(d);
};
