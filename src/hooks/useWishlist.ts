import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';

interface WishlistRow {
    product_id: string;
}

export interface WishlistProduct {
    id: string;
    name: string;
    price: number;
    category: string;
    mainImages: string[];
}

const KEY = ['wishlistIds'];

/**
 * Server-side wishlist (same API as ProductDetail's heart button).
 * Logged-out users get an empty list; toggling sends them to /login.
 */
export function useWishlist() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const { data: ids = [] } = useQuery<string[]>({
        queryKey: KEY,
        queryFn: async () => {
            const me = await api.auth.me();
            if (!me) return [];
            const rows = await api.wishlist.list();
            return Array.isArray(rows) ? (rows as WishlistRow[]).map((r) => r.product_id) : [];
        },
        staleTime: 1000 * 60,
    });

    const toggle = useCallback(async (p: WishlistProduct) => {
        const me = await api.auth.me();
        if (!me) {
            showToast('warning', '찜하려면 로그인해 주세요.');
            navigate('/login');
            return;
        }
        const on = ids.includes(p.id);
        queryClient.setQueryData<string[]>(KEY, (cur = []) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]));
        try {
            if (on) {
                await api.wishlist.remove(p.id);
            } else {
                await api.wishlist.add({
                    product_id: p.id,
                    title: p.name,
                    image: p.mainImages[0],
                    price: p.price,
                    category: p.category,
                    type: 'product',
                });
            }
        } catch (e) {
            console.error('Wishlist toggle error:', e);
            showToast('error', on ? '찜 해제에 실패했습니다.' : '찜 추가에 실패했습니다.');
            queryClient.invalidateQueries({ queryKey: KEY });
        }
    }, [ids, navigate, queryClient, showToast]);

    return { ids, has: (id: string) => ids.includes(id), toggle, count: ids.length };
}
