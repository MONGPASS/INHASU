import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useMe } from '../mypage-desktop/useMyPageData';
import { mapReview, normalizeComments, parseJsonArray, useDesktopReviews, type RawComment, type RawReview } from '../reviews-desktop/reviewsData';

/** Fields /api/auth/me returns beyond the shared MeUser type. */
interface AuthUser {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    image?: string;
    avatar_url?: string;
    user_metadata?: { full_name?: string; avatar_url?: string };
}

export interface ReviewViewer {
    id: string;
    name: string;
    image?: string;
    isAdmin: boolean;
}

/**
 * Data and actions for the mobile review detail — the same API calls and comment shape as the
 * PC detail. The caller keys its component by review id, so state resets on prev / next.
 */
export function useReviewDetail(id: string) {
    const queryClient = useQueryClient();
    const { reviews } = useDesktopReviews();
    const { data: meData } = useMe();
    const [raw, setRaw] = useState<RawReview | null>(null);
    const [loading, setLoading] = useState(true);
    const [helpful, setHelpful] = useState(false);
    const [helpfulCount, setHelpfulCount] = useState<number | null>(null);
    const [helpfulBusy, setHelpfulBusy] = useState(false);
    const [posting, setPosting] = useState(false);

    const user = meData as AuthUser | null | undefined;
    const me = useMemo<ReviewViewer | null>(
        () =>
            user?.id
                ? {
                      id: user.id,
                      name: user.user_metadata?.full_name || user.name || user.email?.split('@')[0] || '여행자',
                      image: user.user_metadata?.avatar_url || user.avatar_url || user.image,
                      isAdmin: user.role === 'admin',
                  }
                : null,
        [user],
    );
    const uid = me?.id;

    useEffect(() => {
        let cancelled = false;
        api.reviews
            .get(id)
            .then((r) => {
                if (!cancelled && r && !r.error) setRaw(r);
            })
            .catch((e) => console.error('Review detail fetch error:', e))
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [id]);

    useEffect(() => {
        if (!uid) return;
        let cancelled = false;
        api.reviews
            .getHelpfulStatus(id)
            .then((state) => {
                if (cancelled) return;
                setHelpful(Boolean(state.helpful));
                if (state.helpful_count != null) setHelpfulCount(Number(state.helpful_count));
            })
            .catch((error) => console.error('Helpful status fetch error:', error));
        return () => {
            cancelled = true;
        };
    }, [id, uid]);

    const listIdx = reviews.findIndex((r) => r.id === id);
    const review = useMemo(() => {
        if (!raw) return null;
        const mapped = mapReview(raw, Math.max(0, listIdx));
        return helpfulCount === null ? mapped : { ...mapped, helpful: helpfulCount };
    }, [raw, listIdx, helpfulCount]);
    const comments = useMemo(() => normalizeComments(raw?.comments), [raw]);

    const others = reviews.filter((r) => r.id !== id);
    const sameTour = review ? others.filter((r) => r.productName === review.productName) : [];
    const more = [...sameTour, ...others.filter((r) => !sameTour.includes(r))].slice(0, 3);

    /** Resolves false when the request failed. */
    const toggleHelpful = async () => {
        if (helpfulBusy) return true;
        setHelpfulBusy(true);
        try {
            const result = await api.reviews.toggleHelpful(id);
            setHelpful(Boolean(result.helpful));
            setHelpfulCount(Number(result.helpful_count || 0));
            return true;
        } catch (error) {
            console.error('Failed to toggle helpful:', error);
            return false;
        } finally {
            setHelpfulBusy(false);
        }
    };

    /** Appends to the stored comment list; existing entries are kept untouched. */
    const postComment = async (text: string) => {
        const content = text.trim();
        if (!me || !raw || !content || posting) return false;
        setPosting(true);
        const nextComments = [
            ...parseJsonArray<RawComment>(raw.comments),
            { id: Date.now().toString(), author: me.name, content, date: new Date().toISOString(), userImage: me.image, userId: me.id },
        ];
        try {
            await api.reviews.update(id, { comments: nextComments });
            setRaw((cur) => (cur ? { ...cur, comments: nextComments } : cur));
            return true;
        } catch (error) {
            console.error('Failed to add comment:', error);
            return false;
        } finally {
            setPosting(false);
        }
    };

    const remove = async () => {
        await api.reviews.delete(id);
        queryClient.invalidateQueries({ queryKey: ['userReviews'] });
    };

    return {
        loading,
        review,
        comments,
        me,
        /** The review's author and admins may delete it (the API enforces the same rule). */
        canDelete: !!me && !!raw && (raw.user_id === me.id || me.isAdmin),
        helpful,
        helpfulBusy,
        posting,
        prev: listIdx > 0 ? reviews[listIdx - 1] : undefined,
        next: listIdx >= 0 ? reviews[listIdx + 1] : undefined,
        more,
        toggleHelpful,
        postComment,
        remove,
    };
}
