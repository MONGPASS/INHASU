/** 오늘 · 어제(지난 하루) · 최근 7일 · 최근 30일 · 최근 90일. 비교는 바로 앞의 같은 길이 기간. */
export type AdminTrafficPeriod = 'today' | 'yesterday' | '7d' | '30d' | '90d';
export type AdminTrafficChannel = '네이버 검색' | '네이버 블로그' | '인스타그램' | '페이스북' | '구글 검색' | '유튜브' | '카카오톡 채널' | '직접 방문' | '기타·추천';

export interface AdminTrafficTotals { visitors: number; sessions: number; pageViews: number; leads: number }
export type AdminTrafficData =
    | { configured: false; period: AdminTrafficPeriod }
    | {
        configured: true; period: AdminTrafficPeriod; generatedAt: string;
        /** GA4 figures; `leads` counts generate_lead events sent after a confirmed quote request. */
        current: AdminTrafficTotals; previous: AdminTrafficTotals;
        channels: { name: AdminTrafficChannel; sessions: number; leads: number }[];
    };
