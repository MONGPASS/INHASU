import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MateJoinRequests } from '../../lib/api';

/**
 * 참가 요청 (join request) on a travel-mate post, shared by the PC and mobile detail screens.
 * A request only notifies the host: it never changes the post's member count or status.
 */

export const JOIN_CANCEL_CONFIRM = '참가 요청을 취소하시겠습니까?';

/** The line under the request button: what a request does, for each state of the visitor. */
export const joinNote = (s: { host: boolean; closed: boolean; mine: boolean }) =>
    s.host
        ? '내가 올린 모집글입니다. 참가 요청은 참가 인원에 자동으로 반영되지 않습니다. 댓글로 상의한 뒤 멤버가 정해지면 마이페이지에서 모집을 마감해 주세요.'
        : s.closed
            ? '이 모집글은 참가 요청 접수를 마감했습니다. 궁금한 점은 페이지 아래 댓글로 호스트에게 전할 수 있습니다.'
            : s.mine
                ? '요청이 호스트에게 알림으로 전달되었습니다. 참가 확정은 호스트와 상의해 결정됩니다.'
                : '요청은 호스트에게 알림으로 전달됩니다. 참가 확정은 호스트와 상의해 결정됩니다. 궁금한 점은 페이지 아래 댓글로 남겨 주세요.';

export interface JoinRequester {
    id: string;
    name: string;
    at?: string;
}

const NONE: MateJoinRequests = { count: 0, mine: false };
/** Server messages meant for the visitor are Korean (older builds: Japanese); anything else gets a generic line. */
const HAS_JA = /[぀-ヿ一-鿿가-힣]/;

const normalize = (raw: unknown): MateJoinRequests => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<MateJoinRequests>;
    return {
        count: Math.max(0, Number(r.count) || 0),
        mine: !!r.mine,
        requesters: Array.isArray(r.requesters) ? r.requesters : undefined,
    };
};

/**
 * @param userId signed-in user (null when logged out) — part of the cache key so `mine` follows the session.
 * @param ready  false while the session is still being resolved.
 */
export function useJoinRequest(postId: string | undefined, userId: string | null, ready = true) {
    const queryClient = useQueryClient();
    const key = ['travelMate', postId, 'requests', userId];
    const { data = NONE } = useQuery<MateJoinRequests>({
        queryKey: key,
        enabled: !!postId && ready,
        staleTime: 0,
        queryFn: () => api.travelMates.requests(postId as string).then(normalize).catch(() => NONE),
    });
    const [busy, setBusy] = useState(false);

    // Optimistic: the button flips at once and is rolled back when the server refuses.
    const change = async (want: boolean) => {
        if (!postId || !userId || busy) return;
        const prev = queryClient.getQueryData<MateJoinRequests>(key) ?? NONE;
        if (prev.mine === want) return;
        setBusy(true);
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<MateJoinRequests>(key, { ...prev, mine: want, count: Math.max(0, prev.count + (want ? 1 : -1)) });
        try {
            const res = want ? await api.travelMates.requestJoin(postId) : await api.travelMates.cancelJoin(postId);
            queryClient.setQueryData<MateJoinRequests>(key, (cur = NONE) => ({ ...cur, mine: want, count: typeof res?.count === 'number' ? res.count : cur.count }));
            // An admin sees the requester list too; reload it after their own change.
            if (prev.requesters) queryClient.invalidateQueries({ queryKey: key });
        } catch (e) {
            queryClient.setQueryData<MateJoinRequests>(key, prev);
            // The post may have been closed meanwhile (mobile keeps it in this query).
            queryClient.invalidateQueries({ queryKey: ['travelMate', postId], exact: true });
            const message = e instanceof Error ? e.message : '';
            alert(HAS_JA.test(message)
                ? message
                : want
                    ? '참가 요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
                    : '참가 요청을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setBusy(false);
        }
    };

    const requesters: JoinRequester[] | undefined = data.requesters?.map((r) => ({
        id: r.user_id,
        name: (r.user_name || '').trim() || '익명',
        at: r.created_at,
    }));

    return {
        count: data.count,
        mine: data.mine,
        /** Only defined for the post's host or an admin. */
        requesters,
        busy,
        ask: () => change(true),
        withdraw: () => change(false),
    };
}

export type JoinRequestState = ReturnType<typeof useJoinRequest>;
