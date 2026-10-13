import React from 'react';
import { SEO } from '../components/seo/SEO';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { InfoLayoutDesktop } from '../components/info/InfoLayoutDesktop';
import { ContactInfoBody } from '../components/info/ContactInfoBody';
import { ContactMobile } from '../components/support-mobile/ContactMobile';

export const Contact: React.FC = () => {
    const isDesktop = useIsDesktop();
    const seo = (
        <SEO
            title="문의"
            description="몽골리아 은하수(몽골 여행·몽골 투어 전문 현지 여행사) 문의 안내. 예약·결제·투어 내용에 관한 질문에 한국어 스태프가 카카오톡·채팅·이메일로 답변해 드립니다."
            canonical="/contact"
        />
    );

    // PC: the live contact panel as the body of the Info layout.
    if (isDesktop) {
        return (
            <InfoLayoutDesktop page="contactUs">
                {seo}
                <ContactInfoBody />
            </InfoLayoutDesktop>
        );
    }

    return (
        <>
            {seo}
            <ContactMobile />
        </>
    );
};
