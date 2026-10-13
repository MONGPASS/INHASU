import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MyPageDesktop } from '../components/mypage-desktop/MyPageDesktop';
import { MyTripsMobile } from '../components/mypage-mobile/MyTripsMobile';

export const MyReservations: React.FC = () => {
    const isDesktop = useIsDesktop();
    const [searchParams] = useSearchParams();
    // Old links used ?tab=quotes for the quote list.
    const quotes = searchParams.get('tab') === 'quotes';
    if (isDesktop) {
        return (
            <DesktopLayout>
                <MyPageDesktop tab={quotes ? 'estimates' : 'reservations'} />
            </DesktopLayout>
        );
    }
    return <MyTripsMobile tab={quotes ? 'quote' : 'bookings'} />;
};
