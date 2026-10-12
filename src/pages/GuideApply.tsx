import React from 'react';
import { SEO } from '../components/seo/SEO';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { InfoLayoutDesktop } from '../components/info/InfoLayoutDesktop';
import { InfoLayoutMobile } from '../components/info/InfoLayoutMobile';
import { GuideApplyForm } from '../components/info/GuideApplyForm';

export const GuideApply: React.FC = () => {
    const isDesktop = useIsDesktop();
    const seo = (
        <SEO
            title="가이드 모집"
            description="몽골리아 은하수(몽골 여행·몽골 투어 전문 현지 여행사)의 가이드 등록 신청 페이지입니다. 몽골 여행 공인 가이드로 등록을 신청할 수 있습니다."
            canonical="/guide-apply"
        />
    );

    if (isDesktop) {
        return (
            <>
                {seo}
                <InfoLayoutDesktop page="guideRecruit">
                    <GuideApplyForm />
                </InfoLayoutDesktop>
            </>
        );
    }

    return (
        <>
            {seo}
            <InfoLayoutMobile page="guideRecruit">
                <GuideApplyForm compact />
            </InfoLayoutMobile>
        </>
    );
};
