import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { HOME_SETTING_KEY, defaultHomeSettings, parseHomeSettings, type HomeSettings } from '../components/home/homeSettings';

/**
 * 홈의 테마 상품·혜택 배너 설정(관리자 ‘홈 화면 관리’에서 저장). PC·휴대폰 홈이 함께 쓴다.
 * 읽는 동안은 `isPending`이고, 읽지 못했으면 기본값(낱말로 묶기 · 기본 배너)으로 홈을 그린다.
 */
export function useHomeSettings(): { settings: HomeSettings; isPending: boolean } {
    const query = useQuery<HomeSettings>({
        queryKey: ['homeSettings'],
        queryFn: async () => parseHomeSettings((await api.settings.get(HOME_SETTING_KEY))?.value),
        staleTime: 1000 * 60,
        refetchOnWindowFocus: 'always',
        retry: 1,
    });
    const fallback = useMemo(defaultHomeSettings, []);
    return { settings: query.data ?? fallback, isPending: query.isPending };
}
