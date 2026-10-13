import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MyPageDesktop } from '../components/mypage-desktop/MyPageDesktop';
import { NotificationsMobile } from '../components/mypage-mobile/NotificationsMobile';

export const MyNotifications: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) {
        return (
            <DesktopLayout>
                <MyPageDesktop tab="notifications" />
            </DesktopLayout>
        );
    }
    return <NotificationsMobile />;
};
