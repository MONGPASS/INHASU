import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface GuideIntro {
    title: string;
    body: string;
    chips: string[];
}

export const DEFAULT_GUIDE_INTRO: GuideIntro = {
    title: '한국어 가이드 동행',
    body: '한국어로 소통하는 가이드가 동행합니다. 몽골의 자연과 문화를 깊이 이해하고, 고객의 눈높이에서 정성껏 안내해 드립니다.',
    chips: ['한국어 가이드', '경력 10년 이상', '현지 가이드'],
};

/**
 * Fetches the site-wide guide intro card content (settings key: `guide_intro`).
 *
 * Admin can edit this once via the settings page and the new copy appears on
 * every product detail (both mobile and PC). Falls back to a sensible default
 * if the setting is missing or unreadable.
 */
export function useGuideIntro(): GuideIntro {
    const { data } = useQuery<GuideIntro>({
        queryKey: ['settings', 'guide_intro'],
        queryFn: async () => {
            try {
                const res = await api.settings.get('guide_intro');
                // settings.get returns { key, value } where value is JSON string or object.
                const raw = res?.value ?? res;
                let parsed: Partial<GuideIntro> = {};
                if (typeof raw === 'string') {
                    try { parsed = JSON.parse(raw); } catch { /* keep default */ }
                } else if (raw && typeof raw === 'object') {
                    parsed = raw as Partial<GuideIntro>;
                }
                return {
                    title: parsed.title || DEFAULT_GUIDE_INTRO.title,
                    body: parsed.body || DEFAULT_GUIDE_INTRO.body,
                    chips: Array.isArray(parsed.chips) && parsed.chips.length > 0
                        ? parsed.chips
                        : DEFAULT_GUIDE_INTRO.chips,
                };
            } catch {
                return DEFAULT_GUIDE_INTRO;
            }
        },
        staleTime: 1000 * 60 * 30, // 30 min cache — guide intro rarely changes
    });
    return data ?? DEFAULT_GUIDE_INTRO;
}
