import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MyPageDesktop } from '../components/mypage-desktop/MyPageDesktop';
import { MyMatesMobile } from '../components/mylists-mobile/MyMatesMobile';

export const MyTravelMates: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) {
        return (
            <DesktopLayout>
                <MyPageDesktop tab="travel-mates" />
            </DesktopLayout>
        );
    }
    return <MyMatesMobile />;
};
