import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MyPageDesktop } from '../components/mypage-desktop/MyPageDesktop';
import { WishlistMobile } from '../components/mylists-mobile/WishlistMobile';

export const Wishlist: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) {
        return (
            <DesktopLayout>
                <MyPageDesktop tab="wishlist" />
            </DesktopLayout>
        );
    }
    return <WishlistMobile />;
};
