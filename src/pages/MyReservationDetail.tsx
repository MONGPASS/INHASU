import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { BookingDetailDesktop } from '../components/mypage-desktop/BookingDetailDesktop';
import { BookingDetailMobile } from '../components/mypage-mobile/BookingDetailMobile';

export const MyReservationDetail: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) {
        return (
            <DesktopLayout>
                <BookingDetailDesktop />
            </DesktopLayout>
        );
    }
    return <BookingDetailMobile />;
};
