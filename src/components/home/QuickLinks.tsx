import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getOptimizedImageUrl } from '../../utils/cloudflareImage';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';

import productsIcon from '../../assets/products_icon_v2.png';
import estimateIcon from '../../assets/custom_estimate_icon_v2.png';
import companionIcon from '../../assets/companion_search_icon_v2.png';

import reviewsIcon from '../../assets/my_reviews.png';

interface QuickLink {
    id: string;
    icon: string;
    image?: string;
    label: string;
    path: string;
}

const KAKAO_ICON = '/assets/icons/kakaotalk.webp';
/** 예전에 관리자 화면에서 등록한 LINE 상담 링크(옛 저장값). 카카오톡 채널로 바꿔 보여 준다. */
const isLegacyLineLink = (path?: string) => /line\.(me|ee)|lin\.ee/i.test(String(path || ''));

export const QuickLinks: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    // 퀵메뉴 클릭 — 외부 URL/전화/채널톡은 채팅을 바로 열고, 나머지는 라우팅
    const handleClick = (path?: string) => {
        const p = (path || '').trim();
        if (!p || p === '#') return;
        if (/^(https?:|tel:|mailto:)/i.test(p)) { window.open(p, '_blank', 'noopener,noreferrer'); return; }
        if (p === 'channeltalk' || p === 'channel-talk') { window.openChannelTalk?.(); return; }
        navigate(p);
    };

    const DEFAULT_LINKS: QuickLink[] = useMemo(() => [
        { id: 'link-1', icon: 'grid_view', image: productsIcon, label: t('home.quick_links.products'), path: '/products' },
        { id: 'link-2', icon: 'receipt_long', image: estimateIcon, label: t('home.quick_links.custom_estimate'), path: '/custom-estimate' },
        { id: 'link-3', icon: 'groups', image: companionIcon, label: t('home.quick_links.travel_mates'), path: '/travel-mates' },

        { id: 'link-5', icon: 'auto_stories', image: '/assets/icons/travel guide.webp', label: t('home.quick_links.guide'), path: '/travel-guide' },
        { id: 'link-6', icon: 'star', image: reviewsIcon, label: t('home.quick_links.reviews'), path: '/reviews' },
    ], [t]);

    const { data: links = DEFAULT_LINKS } = useQuery({
        queryKey: ['quickLinks', t('home.quick_links.products')],
        queryFn: async () => {
            try {
                const data = await api.quickLinks.list();
                // DB에 충분한 데이터가 있을 때만 사용 (3개 미만이면 기본값 사용)
                if (data && Array.isArray(data) && data.length >= 3) {
                    return data.map((l: any) => ({
                        id: l.id,
                        icon: l.icon,
                        image: l.image,
                        label: l.label,
                        path: l.path
                    }));
                }
            } catch (error) {
                console.error('Error fetching quick links:', error);
            }
            return DEFAULT_LINKS;
        },
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 24,
    });

    // 카카오톡 상담 바로가기 — 이미 등록돼 있지 않으면 마지막에 추가 (누르면 카카오톡 채널 채팅이 바로 열림)
    const displayLinks = useMemo(() => {
        const kakaoLabel = t('home.quick_links.line', '카카오톡 상담');
        // DB에 남아 있는 옛 LINE 링크는 카카오톡 채널 링크로 바꿔 보여 준다.
        const mapped = (links as QuickLink[]).map((l) => (isLegacyLineLink(l.path)
            ? { ...l, image: KAKAO_ICON, label: kakaoLabel, path: KAKAO_CHANNEL_CHAT_URL }
            : l));
        const hasKakao = mapped.some((l) => /pf\.kakao\.com/i.test(String(l.path || '')));
        if (hasKakao) return mapped;
        return [
            ...mapped,
            { id: 'link-kakao', icon: 'chat', image: KAKAO_ICON, label: kakaoLabel, path: KAKAO_CHANNEL_CHAT_URL },
        ];
    }, [links, t]);

    return (
        <section className="px-5 py-2 mb-6 relative group">
            <div className="grid grid-cols-3 gap-4">
                {displayLinks.map((link) => (
                    <button
                        key={link.id}
                        onClick={() => handleClick(link.path)}
                        className={`flex flex-col items-center gap-2 group relative`}
                    >
                        <div className="w-16 h-16 flex items-center justify-center group-active:scale-95 transition-all overflow-hidden p-2">
                            {link.image ? (
                                <img
                                    src={getOptimizedImageUrl(link.image, 'iconSmall')}
                                    alt={link.label}
                                    width={64}
                                    height={64}
                                    loading="lazy"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <span className="material-symbols-outlined text-primary text-2xl font-light">{link.icon}</span>
                            )}
                        </div>
                        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{link.label}</span>
                    </button>
                ))}
            </div>
        </section>
    );
};
