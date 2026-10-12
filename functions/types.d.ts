import { D1Database, R2Bucket } from '@cloudflare/workers-types';

declare global {
    interface Env {
        DB: D1Database;
        BUCKET: R2Bucket;
        GOOGLE_CLIENT_ID: string;
        GOOGLE_CLIENT_SECRET: string;
        ENVIRONMENT: string;
        /** 맞춤 견적 도구의 공유 관리자 비밀번호(x-admin-token). 미설정일 수 있다. */
        ADMIN_TOKEN?: string;
        /** 'true'일 때만 예약 생성 시 PayPal 인보이스를 보낸다. 기본은 꺼짐(예약금은 계좌이체 + 입금 신고). */
        PAYPAL_ENABLED?: string;
    }
}
