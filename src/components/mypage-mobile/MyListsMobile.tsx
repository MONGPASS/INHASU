import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../contexts/NotificationContext';
import { useHomeData } from '../../hooks/useHomeData';
import { useWishlist } from '../../hooks/useWishlist';
import { toTourDateKey } from '../../utils/formatDate';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { HeaderTextButton, MatesPanel, NoticePanel, RecentPanel, ReviewsPanel, WishlistPanel } from '../mypage-desktop/MyLists.desktop';
import { useMe, useMyPageData, useRecentActions, type RecentItem } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { MLoading } from '../mobile/mobileUi';
import { SD, SIcon } from '../site-seed/seed';

/**
 * 휴대폰 찜 목록 · 최근 본 상품 · 동행 찾기 글 · 내 후기 · 알림(Claude Design ‘… — 모바일’).
 * ‘← 제목 (단추)’ 줄 + PC와 같은 부품(MyLists.desktop의 패널)을 휴대폰 크기(`compact`)로.
 */

function useGo() {
    const navigate = useNavigate();
    return (path: string) => {
        navigate(path);
        window.scrollTo(0, 0);
    };
}

function Screen({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    const go = useGo();
    return (
        <MobileShell title={title} onBack={() => go('/mypage')} brandHeader={false} footer={false} titleAction={action}>
            {children}
        </MobileShell>
    );
}

const PlusButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button type="button" aria-label={label} onClick={onClick}
        style={{ width: 44, height: 44, border: 'none', background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
        <SIcon name="plusLine" size={22} stroke={1.8} />
    </button>
);

export function WishlistMobile() {
    const go = useGo();
    const wishlist = useWishlist();
    const { data: home, isLoading } = useHomeData();
    const items = useMemo(() => {
        const byId = new Map(home.products.map((p) => [p.id, p]));
        return wishlist.ids.map((id) => byId.get(id)).filter((p): p is HomeProduct => !!p);
    }, [home.products, wishlist.ids]);
    return (
        <Screen title="찜 목록">
            {isLoading && wishlist.ids.length > 0 ? <MLoading pad={60} /> : <WishlistPanel compact items={items} onRemove={(p) => wishlist.toggle(p)} go={go} />}
        </Screen>
    );
}

export function RecentMobile() {
    const go = useGo();
    const { data: me } = useMe();
    const { recent } = useMyPageData(me);
    const actions = useRecentActions(me?.id);
    const wishlist = useWishlist();
    const { data: home } = useHomeData();
    const [now] = useState(() => Date.now());
    const productById = useMemo(() => new Map(home.products.map((p) => [p.id, p])), [home.products]);
    const items = recent.data ?? [];
    const fav = (it: RecentItem) =>
        wishlist.toggle(productById.get(it.productId) ?? { id: it.productId, name: it.title, price: it.price, category: it.category || '', mainImages: it.image ? [it.image] : [] });
    return (
        <Screen title="최근 본 상품" action={items.length > 0 ? <HeaderTextButton onClick={actions.clear}>전체 삭제</HeaderTextButton> : undefined}>
            <RecentPanel compact items={items} now={now} productById={productById} isFav={wishlist.has} onFav={fav}
                onRemove={actions.remove} onClearAll={actions.clear} loading={!me || recent.isPending} go={go} />
        </Screen>
    );
}

export function MyMatesMobile() {
    const go = useGo();
    const { data: me } = useMe();
    const { mates } = useMyPageData(me);
    return (
        <Screen title="동행 찾기 글" action={<PlusButton label="새 글 쓰기" onClick={() => go('/travel-mates/write')} />}>
            {me ? <MatesPanel compact me={me} posts={mates.data ?? []} loading={mates.isPending} go={go} /> : <MLoading pad={60} />}
        </Screen>
    );
}

export function MyReviewsMobile() {
    const go = useGo();
    const { data: me } = useMe();
    const { reviews, reservations } = useMyPageData(me);
    const { data: home } = useHomeData();
    const [today] = useState(() => toTourDateKey(new Date()));
    const productById = useMemo(() => new Map(home.products.map((p) => [p.id, p])), [home.products]);
    // 여행을 마쳤고 아직 후기를 쓰지 않은 상품 예약(후기 API와 같은 조건).
    const pending = useMemo(
        () => (reservations.data ?? []).filter((r) => r.source === 'reservation' && ['confirmed', 'paid', 'completed'].includes(r.status) && (r.status === 'completed' || (!!r.end && r.end < today)) && !r.reviewed),
        [reservations.data, today],
    );
    return (
        <Screen title="내 후기">
            {me ? <ReviewsPanel compact me={me} reviews={reviews.data ?? []} pending={pending} productById={productById} loading={reviews.isPending || reservations.isPending} go={go} /> : <MLoading pad={60} />}
        </Screen>
    );
}

export function NotificationsMobile() {
    const go = useGo();
    const { unreadCount, markAllAsRead } = useNotification();
    return (
        <Screen title="알림" action={unreadCount > 0 ? <HeaderTextButton onClick={() => markAllAsRead()}>모두 읽음</HeaderTextButton> : undefined}>
            <NoticePanel compact go={go} />
        </Screen>
    );
}
