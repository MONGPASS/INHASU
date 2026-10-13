import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface CategoryRow {
    id: string;
    name: string;
    type?: string;
    is_active?: unknown;
    order?: number;
}

/** Active tour categories (id = slug for /category/:id), in admin order. */
export function useProductCategories(enabled = true) {
    const { data = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['productCategories'],
        enabled,
        staleTime: 1000 * 60 * 60,
        queryFn: async () => {
            const data = await api.categories.list();
            const rows: CategoryRow[] = Array.isArray(data) ? data : [];
            return rows
                .filter((c) => c.id !== 'all' && c.is_active !== false && c.is_active !== 0 && (!c.type || c.type === 'product'))
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((c) => ({ id: c.id, name: c.name }));
        },
    });
    return data;
}
