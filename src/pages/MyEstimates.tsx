import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MyPageDesktop } from '../components/mypage-desktop/MyPageDesktop';
import { MyTripsMobile } from '../components/mypage-mobile/MyTripsMobile';

export const MyEstimates: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) {
        return (
            <DesktopLayout>
                <MyPageDesktop tab="estimates" />
            </DesktopLayout>
        );
    }
    return <MyTripsMobile tab="quote" />;
};
