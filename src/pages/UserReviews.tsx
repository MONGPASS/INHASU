import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { UserReviewsDesktop } from '../components/reviews-desktop/UserReviewsDesktop';
import { UserReviewsMobile } from '../components/reviews-mobile/UserReviewsMobile';

export const UserReviews: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) {
        return (
            <DesktopLayout>
                <UserReviewsDesktop />
            </DesktopLayout>
        );
    }
    return <UserReviewsMobile />;
};
