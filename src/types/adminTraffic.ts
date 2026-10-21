export type AdminTrafficPeriod = 'today' | '7d' | '30d';
export type AdminTrafficChannel = '네이버 검색' | '네이버 블로그' | '인스타그램' | '구글 검색' | '유튜브' | '카카오톡 채널' | '직접 방문' | '기타·추천';

export interface AdminTrafficTotals { visitors: number; sessions: number; pageViews: number; leads: number }
export type AdminTrafficData =
    | { configured: false; period: AdminTrafficPeriod }
    | {
        configured: true; period: AdminTrafficPeriod; generatedAt: string;
        /** GA4 figures; `leads` counts generate_lead events sent after a confirmed quote request. */
        current: AdminTrafficTotals; previous: AdminTrafficTotals;
        channels: { name: AdminTrafficChannel; sessions: number; leads: number }[];
    };
