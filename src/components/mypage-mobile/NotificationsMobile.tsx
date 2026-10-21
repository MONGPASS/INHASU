import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification, type Notification } from '../../contexts/NotificationContext';
import { formatRelativeTime } from '../../utils/formatDate';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { NOTICE_TYPES } from '../mypage-desktop/myPageTheme';
import { parseDbTime } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { useMobileShell } from '../mobile/mobileShellContext';
import { D, M_HAIR, M_PAPER } from '../mobile/mobileTheme';
import { Ico, MEmpty, MLoading, MPills } from '../mobile/mobileUi';
import { NOTICE_TONE, groupNotices, noticeCta, noticeType } from './noticeMeta';

/**
 * 알림 (Claude Design: "M Notifications"): the signed-in user's notifications grouped by
 * day, with filter chips for the types that actually occur.
 */
export function NotificationsMobile() {
    const navigate = useNavigate();
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotification();
    const [filter, setFilter] = useState('all');
    // Captured once so render stays pure.
    const [now] = useState(() => Date.now());

    const types = Object.keys(NOTICE_TYPES).filter((t) => notifications.some((n) => noticeType(n) === t));
    const groups = useMemo(
        () => groupNotices(notifications.filter((n) => filter === 'all' || (filter === 'unread' ? !n.is_read : noticeType(n) === filter)), now),
        [notifications, filter, now],
    );

    const back = () => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/');
    };
    const open = async (n: Notification) => {
        if (!n.is_read) await markAsRead(n.id);
        if (n.link) {
            navigate(n.link);
            window.scrollTo(0, 0);
        }
    };

    return (
        <MobileShell>
            <NoticeBar unread={unreadCount} onBack={back} onReadAll={() => { void markAllAsRead(); }}>
                <MPills<string>
                    items={[['all', '전체'], ['unread', `안 읽음 ${unreadCount}`], ...types.map((t): [string, string] => [t, NOTICE_TYPES[t].label])]}
                    value={filter}
                    onChange={setFilter}
                    style={{ padding: '0 16px' }}
                />
            </NoticeBar>

            <section style={{ background: M_PAPER, minHeight: '60vh', padding: '16px 16px 36px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {loading ? (
                    <MLoading />
                ) : groups.length > 0 ? (
                    groups.map((g) => (
                        <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ padding: '0 4px', fontSize: 12, fontWeight: 700, color: MW.mute }}>{g.label}</span>
                            <div style={{ border: `1px solid ${MW.line}`, borderRadius: 20, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {g.items.map((n, i) => <NoticeRow key={n.id} n={n} first={i === 0} onOpen={() => { void open(n); }} />)}
                            </div>
                        </div>
                    ))
                ) : notifications.length > 0 ? (
                    <MEmpty text="해당하는 알림이 없습니다." />
                ) : (
                    <div style={{ padding: '56px 20px', borderRadius: 20, background: '#fff', border: `1px solid ${MW.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                        <span style={{ width: 56, height: 56, borderRadius: '50%', background: MW.mintBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Ico d={D.bell} size={26} color={MW.mintDeep} width={1.7} />
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>새 알림이 없습니다</span>
                        <span style={{ fontSize: 12, color: MW.mute }}>예약이나 견적에 변동이 있으면 알려 드립니다.</span>
                    </div>
                )}
            </section>
        </MobileShell>
    );
}

/**
 * Sticky title bar of the screen (design: back, title + unread count pill, "모두 읽음", filter chips).
 * Rendered inside MobileShell so it can sit right under the shell header.
 */
function NoticeBar({ unread, onBack, onReadAll, children }: { unread: number; onBack: () => void; onReadAll: () => void; children: ReactNode }) {
    const { stickyTop } = useMobileShell();
    const none = unread === 0;
    return (
        <div style={{ position: 'sticky', top: stickyTop, zIndex: 10, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${MW.line}`, display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', alignItems: 'center', gap: 6, padding: '0 12px 0 6px' }}>
                <button type="button" onClick={onBack} aria-label="뒤로" style={{ width: 44, height: 44, border: 0, borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                    <Ico d={D.back} size={22} width={2} />
                </button>
                <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap', minWidth: 0 }}>
                    알림
                    {!none && (
                        <span aria-label={`안 읽은 알림 ${unread}개`} style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, lineHeight: 1.5, color: MW.navy, background: '#3FC2A4', padding: '2px 8px', borderRadius: 999 }}>
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </h1>
                <button
                    type="button"
                    onClick={onReadAll}
                    disabled={none}
                    style={{ height: 34, padding: '0 12px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: none ? '#B8C4C1' : MW.navy, cursor: none ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                >
                    모두 읽음
                </button>
            </div>
            {children}
        </div>
    );
}

function NoticeRow({ n, first, onOpen }: { n: Notification; first: boolean; onOpen: () => void }) {
    const type = noticeType(n);
    const tone = NOTICE_TONE[type];
    const cta = noticeCta(n);
    return (
        <a
            href={n.link || '#'}
            onClick={(e) => { e.preventDefault(); onOpen(); }}
            style={{ position: 'relative', display: 'grid', gridTemplateColumns: '40px minmax(0,1fr)', gap: 12, padding: 16, borderTop: `1px solid ${first ? 'transparent' : M_HAIR}`, background: n.is_read ? '#FFFFFF' : '#F7FCFA', color: MW.navy, textDecoration: 'none' }}
        >
            <span style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', background: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico d={NOTICE_TYPES[type].d} color={tone.fg} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: tone.fg }}>{NOTICE_TYPES[type].label}</span>
                    <span style={{ fontSize: 11, color: MW.mute2 }}>{formatRelativeTime(parseDbTime(n.created_at))}</span>
                    {!n.is_read && <span aria-label="안 읽음" style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: MW.mint, flexShrink: 0 }} />}
                </span>
                <span style={{ fontSize: 14, fontWeight: n.is_read ? 700 : 900, lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</span>
                {n.message && (
                    <span style={{ fontSize: 12, lineHeight: 1.65, color: MW.mute, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.message}</span>
                )}
                {cta && <span style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>{cta} →</span>}
            </span>
        </a>
    );
}
