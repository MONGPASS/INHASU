import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MyPageDesktop } from '../components/mypage-desktop/MyPageDesktop';
import { MyReviewsMobile } from '../components/mylists-mobile/MyReviewsMobile';

export const MyReviews: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) {
        return (
            <DesktopLayout>
                <MyPageDesktop tab="my-reviews" />
            </DesktopLayout>
        );
    }
    return <MyReviewsMobile />;
};
