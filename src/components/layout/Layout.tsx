import React from 'react';
import { useLocation } from 'react-router-dom';
import { DesktopLayout } from '../layout-desktop/DesktopLayout';
import { MobileShell } from '../mobile/MobileShell';
import { useIsDesktop } from '../../hooks/useIsDesktop';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { pathname } = useLocation();
    const isDesktop = useIsDesktop();

    // Desktop: render PC shell (DesktopHeader + content + DesktopFooter).
    if (isDesktop) {
        return <DesktopLayout>{children}</DesktopLayout>;
    }

    // Below 1024px: mobile app shell. Home shows the search box and menu row;
    // the other routes on this layout get a back bar instead.
    if (pathname === '/') {
        return <MobileShell home>{children}</MobileShell>;
    }
    return <MobileShell title={pathname === '/about' ? '회사 소개' : '투어 상품'}>{children}</MobileShell>;
};
