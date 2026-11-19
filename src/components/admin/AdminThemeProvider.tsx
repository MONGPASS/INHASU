import React, { useEffect } from 'react';
import { ThemeProvider } from '@montage-ui/core';
// Montage 색·글자·모서리 변수(:root의 --semantic-*, --atomic-*, --typography-* …)만 불러온다.
// 저장소에 같은 이름의 변수가 없어 고객 화면 값과 부딪히지 않는다.
// 전체 초기화 CSS(reset.css·global.css)는 고객 화면에 새어 나가지 않도록 여기서 불러오지 않는다.
// 이 파일은 App.tsx가 관리자 경로에서만 lazy로 읽으므로 고객 화면 번들에는 들어가지 않는다.
import '@montage-ui/core/theme.css';

/**
 * 관리자 영역(`/admin` 아래, AdminLayout 바깥)을 Montage ThemeProvider로 감싼다.
 * - 밝은 화면만 쓴다(enableDarkMode 끔). 테마 쿠키는 /admin 경로·현재 호스트로 한정한다.
 * - Montage 기본 전역 스타일(body 바탕색)은 끈다. 관리자 바탕은 admin-tokens.css의 --adm-canvas가 정한다.
 * - 관리자를 벗어나면 <html>에 남긴 data-theme·color-scheme을 지운다.
 */
const AdminThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    useEffect(() => () => {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.style.removeProperty('color-scheme');
    }, []);
    return (
        <ThemeProvider disableDefaultGlobalStyle cookie={{ domain: 'none', path: '/admin' }}>
            {children}
        </ThemeProvider>
    );
};

export default AdminThemeProvider;
