import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MyPageDesktop } from '../components/mypage-desktop/MyPageDesktop';
import { MyPageMobile } from '../components/mypage-mobile/MyPageMobile';

export const MyPage: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) {
        return (
            <DesktopLayout>
                <MyPageDesktop />
            </DesktopLayout>
        );
    }
    return <MyPageMobile />;
};
