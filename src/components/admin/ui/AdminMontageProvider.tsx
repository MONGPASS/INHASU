import React from 'react';
import { ThemeProvider } from '@montage-ui/core';
// Montage 테마 변수(theme.css)와 은하수 민트 덮어쓰기. global.css(전역 초기화)는 기존 관리자·고객 화면을 바꾸므로 쓰지 않는다.
import '../../../styles/admin-montage-brand.css';

/**
 * 관리자 화면에서 Montage 부품(@montage-ui/core·icon)을 쓰기 위한 테마 범위.
 * - 다크 모드를 켜지 않으므로 밝은 테마로 고정되고 테마 쿠키를 쓰지 않는다.
 * - 기본 전역 스타일(body 바탕색)은 끈다. 바탕은 admin-montage.css가 정한다.
 */
export const AdminMontageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ThemeProvider disableDefaultGlobalStyle>{children}</ThemeProvider>
);
