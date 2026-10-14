import React from 'react';
import { useTranslation } from 'react-i18next';
import { KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { KAKAO_BUBBLE, KAKAO_INK, KAKAO_YELLOW } from '../mobile/mobileTheme';

/**
 * 모든 고객 페이지에 항상 떠 있는 카카오톡 상담 바로가기 버튼.
 * 누르면 카카오톡 채널 채팅이 바로 열린다.
 * 위치는 index.css의 `.floating-line-btn`에서 제어 — 모바일 하단 메뉴 위에 표시한다.
 * (클래스 이름은 LINE 버튼 시절 것을 그대로 쓴다 — index.css·확정 일정표 인쇄 스타일이 참조한다.)
 */
export const FloatingConsultation: React.FC = () => {
    const { t } = useTranslation();
    const label = t('home.quick_links.line', '카카오톡 상담');

    return (
        <a
            href={KAKAO_CHANNEL_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className="floating-line-btn flex items-center justify-center w-[54px] h-[54px] rounded-full shadow-lg shadow-black/15 active:scale-95 transition-transform"
            style={{ background: KAKAO_YELLOW }}
        >
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
                <path fill={KAKAO_INK} d={KAKAO_BUBBLE} />
            </svg>
        </a>
    );
};
