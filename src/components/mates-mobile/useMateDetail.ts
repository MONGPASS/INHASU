import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ApiMatePost } from '../mates-desktop/matesData';
import { useJoinRequest } from '../mates-desktop/joinRequest';
import type { MateComment } from '../mates-desktop/TravelMateDetailDesktop';
import { LIST_PATH, WRITE_PATH } from './matesMobileTheme';

interface MateUser {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
}

/**
 * Data and actions of the mobile post detail: the post, its comments, the session user,
 * the view counter, the join request and the comment / owner actions. Same API calls and rules as the PC
 * container in pages/TravelMateDetail.tsx.
 */
export function useMateDetail(id: string | undefined) {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const commentsKey = ['travelMate', id, 'comments'];

    // Always re-checked here: commenting and the owner actions depend on the current session.
    const { data: me, isLoading: meLoading } = useQuery<MateUser | null>({
        queryKey: ['authMe'],
        queryFn: () => api.auth.me(),
        staleTime: 0,
    });
    const user = me ?? null;

    const { data: post = null, isLoading: postLoading } = useQuery<ApiMatePost | null>({
        queryKey: ['travelMate', id],
        enabled: !!id,
        staleTime: 0,
        queryFn: () => api.travelMates.get(id as string).catch(() => null),
    });

    const { data: comments = [] } = useQuery<MateComment[]>({
        queryKey: commentsKey,
        enabled: !!id,
        staleTime: 0,
        queryFn: async () => {
            try {
                const res = await fetch(`/api/travel-mates/${id}/comments`);
                if (!res.ok) return [];
                const rows: unknown = await res.json();
                return Array.isArray(rows) ? (rows as MateComment[]) : [];
            } catch {
                return []; // comments are optional
            }
        },
    });

    const postId = post?.id;
    useEffect(() => {
        if (postId) api.travelMates.view(postId).catch(() => { /* view count is best-effort */ });
    }, [postId]);

    const join = useJoinRequest(id, user?.id ?? null, !meLoading);

    const isOwner = !!(user && post?.user_id && user.id === post.user_id);
    const canManage = isOwner || user?.role === 'admin';
    const goLogin = () => navigate('/login', { state: { from: location.pathname } });

    /** Resolves true when the comment was saved. */
    const postComment = async (content: string) => {
        if (!id) return false;
        if (!user) {
            goLogin();
            return false;
        }
        try {
            const res = await fetch(`/api/travel-mates/${id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    user_name: user.name || user.email?.split('@')[0] || '익명',
                    user_image: user.avatarUrl || '',
                    content,
                }),
            });
            if (!res.ok) return false;
            const created: MateComment = await res.json();
            queryClient.setQueryData<MateComment[]>(commentsKey, (prev = []) => [...prev, created]);
            return true;
        } catch (e) {
            console.error('Error posting comment:', e);
            return false;
        }
    };

    const deleteComment = async (commentId: string) => {
        if (!id || !confirm('이 댓글을 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/travel-mates/${id}/comments/${commentId}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) queryClient.setQueryData<MateComment[]>(commentsKey, (prev = []) => prev.filter((c) => c.id !== commentId));
            else alert('댓글을 삭제하지 못했습니다.');
        } catch (e) {
            console.error('Error deleting comment:', e);
        }
    };

    const editPost = () => navigate(`${WRITE_PATH}?edit=${id}`);
    const deletePost = async () => {
        if (!id || !confirm('이 게시글을 삭제하시겠습니까?')) return;
        try {
            await api.travelMates.delete(id);
            queryClient.invalidateQueries({ queryKey: ['travelMates'] });
            navigate(LIST_PATH);
        } catch (e) {
            console.error('Error deleting post:', e);
            alert('게시글을 삭제하지 못했습니다.');
        }
    };

    return {
        post,
        comments,
        loading: postLoading || meLoading,
        userId: user?.id ?? null,
        userName: user?.name || user?.email?.split('@')[0] || '',
        isOwner,
        canManage,
        join,
        goLogin,
        postComment,
        deleteComment,
        editPost,
        deletePost,
    };
}
