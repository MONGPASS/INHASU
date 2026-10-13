import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MyPageDesktop } from '../components/mypage-desktop/MyPageDesktop';
import { RecentMobile } from '../components/mylists-mobile/RecentMobile';

export const RecentlyViewed: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) {
        return (
            <DesktopLayout>
                <MyPageDesktop tab="recently-viewed" />
            </DesktopLayout>
        );
    }
    return <RecentMobile />;
};
