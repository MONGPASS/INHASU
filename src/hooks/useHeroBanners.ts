import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface ApiBanner {
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

/** Undefined means not loaded; only a successful empty array means no saved banners. */
export function useHeroBanners() {
    return useQuery<ApiBanner[]>({
        queryKey: ['heroBanners'],
        queryFn: async () => {
            const data = await api.banners.get();
            if (!Array.isArray(data?.banners)) throw new Error('배너 응답을 확인할 수 없습니다.');
            return data.banners;
        },
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: 'always',
        refetchInterval: 60_000,
    });
}
