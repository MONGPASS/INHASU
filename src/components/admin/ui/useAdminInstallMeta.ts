import { useEffect } from 'react';

/**
 * 관리자를 휴대폰 홈 화면에 아이콘으로 추가할 수 있게 하는 표시를 관리자 화면에서만 넣는다.
 * (고객 사이트에는 넣지 않는다. 관리자 화면을 벗어나면 지운다.)
 * - Android Chrome: 메뉴 → 홈 화면에 추가 / 앱 설치
 * - iPhone Safari: 공유 → 홈 화면에 추가
 * 주소창 없이 앱처럼 열리지만, 인터넷 연결 없이 쓰는 기능(오프라인 저장)은 없다.
 */
const TAGS = [
    '<link data-adm-install rel="manifest" href="/admin.webmanifest">',
    '<link data-adm-install rel="apple-touch-icon" href="/img/brand/admin-app-180.png">',
    '<meta data-adm-install name="apple-mobile-web-app-capable" content="yes">',
    '<meta data-adm-install name="mobile-web-app-capable" content="yes">',
    '<meta data-adm-install name="apple-mobile-web-app-title" content="은하수 관리자">',
    '<meta data-adm-install name="apple-mobile-web-app-status-bar-style" content="default">',
    '<meta data-adm-install name="theme-color" content="#FFFFFF">',
].join('');

let mounted = 0;

export function useAdminInstallMeta(): void {
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (mounted++ === 0) document.head.insertAdjacentHTML('beforeend', TAGS);
        return () => {
            if (--mounted === 0) document.head.querySelectorAll('[data-adm-install]').forEach(node => node.remove());
        };
    }, []);
}
