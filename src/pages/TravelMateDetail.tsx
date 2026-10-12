import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { TravelMateDetailDesktop, type MateComment } from '../components/mates-desktop/TravelMateDetailDesktop';
import type { ApiMatePost } from '../components/mates-desktop/matesData';
import { useJoinRequest } from '../components/mates-desktop/joinRequest';
import { TravelMateDetailMobile } from '../components/mates-mobile/TravelMateDetailMobile';

export const TravelMateDetail: React.FC = () => {
    const isDesktop = useIsDesktop();
    if (isDesktop) return <TravelMateDetailDesktopContainer />;
    return <TravelMateDetailMobile />;
};

interface MateUser {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
}

const TravelMateDetailDesktopContainer: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();
    const [post, setPost] = useState<ApiMatePost | null>(null);
    const [comments, setComments] = useState<MateComment[]>([]);
    const [currentUser, setCurrentUser] = useState<MateUser | null>(null);
    const [loading, setLoading] = useState(true);
    const join = useJoinRequest(id, currentUser?.id ?? null, !loading);

    useEffect(() => {
        let cancelled = false;
        if (!id) return;
        setLoading(true);
        (async () => {
            try {
                const [postData, me] = await Promise.all([
                    api.travelMates.get(id).catch(() => null),
                    api.auth.me().catch(() => null),
                ]);
                if (cancelled) return;
                setPost(postData);
                setCurrentUser(me);
                if (postData) api.travelMates.view(id).catch(() => { /* view count is best-effort */ });
                try {
                    const res = await fetch(`/api/travel-mates/${id}/comments`);
                    if (res.ok) {
                        const c = await res.json();
                        if (!cancelled) setComments(Array.isArray(c) ? c : []);
                    }
                } catch { /* comments are optional */ }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id]);

    if (loading || !post) {
        return (
            <DesktopLayout>
                <div style={{ padding: '120px 24px', textAlign: 'center', fontSize: 15, color: '#5C6B75' }}>
                    {loading ? '불러오는 중…' : '게시글을 찾을 수 없습니다'}
                </div>
            </DesktopLayout>
        );
    }

    const isOwner = !!(currentUser && post.user_id && currentUser.id === post.user_id);
    const canManage = isOwner || currentUser?.role === 'admin';
    const goLogin = () => navigate('/login', { state: { from: location.pathname } });

    const postComment = async (content: string) => {
        if (!id) return false;
        if (!currentUser) {
            goLogin();
            return false;
        }
        try {
            const res = await fetch(`/api/travel-mates/${id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    user_name: currentUser.name || currentUser.email?.split('@')[0] || '익명',
                    user_image: currentUser.avatarUrl || '',
                    content,
                }),
            });
            if (!res.ok) return false;
            const created: MateComment = await res.json();
            setComments((prev) => [...prev, created]);
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
            if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId));
            else alert('댓글을 삭제하지 못했습니다.');
        } catch (e) {
            console.error('Error deleting comment:', e);
        }
    };

    const onEdit = () => navigate(`/travel-mates/write?edit=${id}`);
    const onDelete = async () => {
        if (!id) return;
        if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
        try {
            await api.travelMates.delete(id);
            navigate('/travel-mates');
        } catch (e) {
            console.error('Error deleting post:', e);
            alert('게시글을 삭제하지 못했습니다.');
        }
    };

    return (
        <DesktopLayout>
            <TravelMateDetailDesktop
                post={post}
                comments={comments}
                userId={currentUser?.id ?? null}
                userName={currentUser?.name || currentUser?.email || ''}
                isOwner={isOwner}
                canManage={canManage}
                join={join}
                onPostComment={postComment}
                onDeleteComment={deleteComment}
                onLogin={goLogin}
                onEdit={onEdit}
                onDelete={onDelete}
            />
        </DesktopLayout>
    );
};
