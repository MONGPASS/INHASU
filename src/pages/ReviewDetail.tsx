import React from 'react';
import { useParams } from 'react-router-dom';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { ReviewDetailDesktop } from '../components/reviews-desktop/ReviewDetailDesktop';
import { ReviewDetailMobile } from '../components/reviews-mobile/ReviewDetailMobile';

export const ReviewDetail: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) return <ReviewDetailDesktopContainer />;
    return <ReviewDetailMobileContainer />;
};

const ReviewDetailDesktopContainer: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    return (
        <DesktopLayout>
            {id && <ReviewDetailDesktop key={id} id={id} />}
        </DesktopLayout>
    );
};

const ReviewDetailMobileContainer: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    return id ? <ReviewDetailMobile id={id} /> : null;
};
