import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Category } from '../types/category';
import { isPublishedMagazine } from '../constants/seo';
import { withPublicProductPrice, type PublicProductPriceFields } from '../utils/publicProductPrice';

/**
 * Safely ensures a value is always a string array.
 * Handles: parsed arrays, JSON strings, single strings, undefined/null.
 */
function ensureStringArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter((v: any) => typeof v === 'string' && v.length > 0);
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed.filter((v: any) => typeof v === 'string' && v.length > 0);
        } catch {
            // Not valid JSON, treat as single URL if it looks like one
            if (val.startsWith('/') || val.startsWith('http')) return [val];
        }
    }
    return [];
}

interface CategoryTab {
    id: string;
    name: string;
    title: string;
    subtitle: string;
    bannerImage: string;
}

interface Product extends PublicProductPriceFields {
    id: string;
    name: string;
    category: string;
    price: number;
    originalPrice?: number;
    isPopular: boolean;
    isFeatured: boolean;
    status?: string;
    packageType: 'full' | 'value' | null;
    mainImages: string[];
    duration: string;
    tags: string[];
}

interface Magazine {
    id: string;
    title: string;
    description: string;
    category: string;
    image: string;
    isActive: boolean;
}

export interface HomeData {
    products: Product[];
    tabs: CategoryTab[];
    magazines: Magazine[];
    categories: Category[];
}

export const useHomeData = () => {
    const { data: queryData, isLoading, error } = useQuery({
        queryKey: ['homeData'],
        queryFn: async () => {
            // Fetch all data in parallel using Promise.all
            const [productsData, bannersData, magazinesData, categoriesData] = await Promise.all([
                api.products.summary(),
                api.banners.get(),
                api.magazines.list(),
                api.categories.list()
            ]);

            const products: Product[] = (Array.isArray(productsData) ? productsData : []).map((p: any) => ({
                ...withPublicProductPrice(p),
                id: p.id,
                name: p.name,
                category: p.category,
                originalPrice: undefined,
                isPopular: !!(p.isPopular ?? p.is_popular),
                isFeatured: !!(p.isFeatured ?? p.is_featured),
                status: p.status,
                packageType: p.packageType === 'full' || p.packageType === 'value' ? p.packageType : null,
                mainImages: ensureStringArray(p.mainImages || p.main_images),
                duration: p.duration,
                tags: p.tags || []
            }));

            const tabsArray = Array.isArray(bannersData?.categoryTabs) ? bannersData.categoryTabs : [];
            const tabs: CategoryTab[] = tabsArray.map((t: any) => ({
                id: t.id,
                name: t.name,
                title: t.title,
                subtitle: t.subtitle,
                bannerImage: t.image_url || t.bannerImage || ''
            }));

            const magazines: Magazine[] = (Array.isArray(magazinesData) ? magazinesData.filter(isPublishedMagazine) : []).map((m: any) => ({
                id: m.id,
                title: m.title,
                description: m.subtitle || m.description || '', // mapped from subtitle
                category: m.category,
                image: m.thumbnail || m.image || '', // mapped from thumbnail
                isActive: isPublishedMagazine(m)
            }));

            // Process categories (filter out magazines or 'all')
            const categories: Category[] = (Array.isArray(categoriesData) ? categoriesData : [])
                .filter((c: any) => c.is_active !== false && c.is_active !== 0 && c.id !== 'all' && (!c.type || c.type === 'product'))
                .sort((a: any, b: any) => (a.sort_order ?? a.order ?? 0) - (b.sort_order ?? b.order ?? 0))
                .map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    icon: c.icon,
                    description: c.description || '',
                    order: c.sort_order ?? c.order ?? 0,
                    isActive: c.is_active !== false && c.is_active !== 0,
                    type: c.type || 'product',
                    landing_hero_images: ensureStringArray(c.landing_hero_images),
                    landing_hero_image: c.landing_hero_image || undefined
                }));

            return { products, tabs, magazines, categories };
        },
        staleTime: 1000 * 30, // 30 seconds
        gcTime: 1000 * 60 * 30,   // 30 minutes
        refetchOnWindowFocus: 'always',
        refetchInterval: 60_000,
    });

    // Provide default empty values to match previous interface
    const data: HomeData = queryData || {
        products: [],
        tabs: [],
        magazines: [],
        categories: []
    };

    return { data, isLoading, error };
};
