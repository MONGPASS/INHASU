import { useEffect, useState } from 'react';

/** 클래스 이름 합치기(빈 값은 뺀다). */
export const cx = (...names: Array<string | false | null | undefined>): string => names.filter(Boolean).join(' ');

/** 관리자 휴대폰 폭(admin-tokens.css의 휴대폰 변수 블록과 같은 760px). */
export const ADMIN_NARROW_QUERY = '(max-width: 760px)';

/** 휴대폰 폭인지. 팝업을 아래 시트로 바꾸는 것처럼 부품 종류가 달라질 때만 쓴다(크기는 CSS 변수가 바꾼다). */
export function useAdminNarrow(): boolean {
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(ADMIN_NARROW_QUERY).matches);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const query = window.matchMedia(ADMIN_NARROW_QUERY);
        const update = () => setNarrow(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return narrow;
}

/** 부품 크기 이름(32·40·48 — 휴대폰은 40·48·52). */
export type AdminSize = 'sm' | 'md' | 'lg';
