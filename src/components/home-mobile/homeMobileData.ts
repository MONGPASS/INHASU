import { useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { BRAND } from '../../constants/company';
import { won } from '../desktop-primitives/mwTokens';
import type { HomeProduct } from '../home-desktop/homeDesktopData';

interface ApiBanner {
    id: string;
    image?: string;
    image_url?: string;
    pc_image?: string;
    pcImage?: string;
    tag?: string;
    title?: string;
    subtitle?: string;
    link?: string;
    pc_title?: string;
    pcTitle?: string;
    pc_subtitle?: string;
    pcSubtitle?: string;
    pc_tag?: string;
    pcTag?: string;
}

export interface HeroSlide {
    key: string;
    img: string;
    eyebrow: string;
    title: string;
    sub: string;
    label: string;
    path: string;
}

/** Poster of the custom-estimate hero film; the only bundled photo for the custom tour banners. */
export const CUSTOM_TOUR_IMAGE = '/media/estimate-journey/poster.webp';

// Strings the admin tooling inserts as placeholders that we should never display.
const DEFAULT_TEXTS = new Set(['New Tag', 'new tag', '새로운 배너 타이틀', '배너 설명을 입력하세요', 'Premium Trip']);
export const cleanAdminText = (v?: string) => {
    const s = (v || '').trim();
    return s && !DEFAULT_TEXTS.has(s) ? s : '';
};

/** Banner links are stored as absolute production URLs; route them in-app. */
export const toPath = (link?: string, fallback = '/products') => {
    const l = (link || '').trim();
    if (!l) return fallback;
    try {
        const u = new URL(l, window.location.origin);
        // 옛 도메인(mongolryokou.com)으로 저장된 배너 링크도 사이트 내부 경로로 처리한다.
        if (u.hostname === window.location.hostname || u.hostname.endsWith(BRAND.domain) || u.hostname.endsWith('mongolryokou.com')) {
            return u.pathname + u.search;
        }
        return l;
    } catch {
        return l.startsWith('/') ? l : fallback;
    }
};

/** Client-side navigation for in-app paths; a full page load for anything external. */
export function useGo() {
    const navigate = useNavigate();
    return useCallback((path: string) => {
        if (/^https?:\/\//.test(path)) window.location.assign(path);
        else navigate(path);
    }, [navigate]);
}

/** `href` + click handler for an anchor that should route in-app. */
export const linkTo = (go: (path: string) => void, path: string) => ({
    href: path,
    onClick: (e: MouseEvent) => {
        e.preventDefault();
        go(path);
    },
});

const FALLBACK: HeroSlide = {
    key: 'fallback',
    img: CUSTOM_TOUR_IMAGE,
    eyebrow: 'CUSTOM TOUR',
    title: '나만의 특별한 여행 플랜,\n1분 만에 요청하세요',
    sub: '한국어 담당 직원이 24시간 이내에 답변드립니다.',
    label: '견적 무료',
    path: '/custom-estimate',
};

/** Hero slides from the admin's main banners (mobile copy first, PC copy as a fallback). */
export function useHeroSlides(products: HomeProduct[]) {
    const { data: banners, isLoading } = useQuery<ApiBanner[]>({
        queryKey: ['heroBannersMobile'],
        queryFn: async () => {
            const data = await api.banners.get();
            return Array.isArray(data?.banners) ? data.banners : [];
        },
        staleTime: 1000 * 60 * 5,
    });

    const slides: HeroSlide[] = !banners || banners.length === 0
        ? [FALLBACK]
        : banners.slice(0, 6).map((b, i) => {
            const path = toPath(b.link);
            // Banners that point at a tour pick up its category, length and price.
            const productId = path.match(/^\/products\/([^/?#]+)/)?.[1];
            const product = productId ? products.find((p) => p.id === productId) : undefined;
            const tag = cleanAdminText(b.tag) || cleanAdminText(b.pc_tag || b.pcTag);
            const sub = cleanAdminText(b.subtitle) || cleanAdminText(b.pc_subtitle || b.pcSubtitle);
            return {
                key: b.id || String(i),
                // The legacy mobile banner image has its copy baked into the picture; the PC image
                // is the clean photo meant to sit under overlaid text, so it comes first.
                img: b.pc_image || b.pcImage || b.image || b.image_url || '',
                eyebrow: tag || (product ? [product.category, product.duration].filter(Boolean).join(' · ') : ''),
                title: cleanAdminText(b.title) || cleanAdminText(b.pc_title || b.pcTitle) || product?.name || '몽골 여행',
                sub: sub || (product ? `${won(product.price)}~` : ''),
                label: product?.category || '몽골 여행',
                path,
            };
        });

    return { slides, isLoading };
}
