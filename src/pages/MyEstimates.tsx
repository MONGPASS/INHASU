import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MyPageDesktop } from '../components/mypage-desktop/MyPageDesktop';
import { MyQuotesMobile } from '../components/mypage-mobile/MyQuotesMobile';

export const MyEstimates: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) {
        return (
            <DesktopLayout>
                <MyPageDesktop tab="estimates" />
            </DesktopLayout>
        );
    }
    return <MyQuotesMobile />;
};
