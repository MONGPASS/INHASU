import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotImages } from '../../hooks/useSpotImages';
import { openKakaoConsultation } from '../../lib/consultation';
import { MW, MW_FONT_EN, MW_GRADIENT, MW_STICKY_TOP, cleanTitle, isUsableImage } from '../desktop-primitives/mwTokens';
import { JoinRequesterList } from './JoinRequesterList';
import { joinNote, type JoinRequestState } from './joinRequest';
import { AGE_LABEL, GENDER_LABEL, STATUS_LABEL, hideBroken, matePhoto, seatText, timeAgo, toMatePost, useMatePosts, type ApiMatePost, type MateStatus } from './matesData';
import { HostAvatar } from './TravelMatesDesktop';

/** Row shape of /api/travel-mates/:id/comments. */
export interface MateComment {
    id: string;
    user_id?: string;
    user_name?: string;
    user_image?: string;
    content?: string;
    created_at?: string;
}

interface Props {
    post: ApiMatePost;
    comments: MateComment[];
    /** Logged-in user id (null when logged out). */
    userId: string | null;
    userName: string;
    isOwner: boolean;
    /** Author or admin: may edit/delete the post and remove any comment on it. */
    canManage: boolean;
    /** 참가 요청: the visitor's own request and, for the host / an admin, who asked. */
    join: JoinRequestState;
    /** Resolves true when the comment was saved. */
    onPostComment: (content: string) => Promise<boolean>;
    onDeleteComment: (id: string) => void;
    onLogin: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const PANEL_BG = 'linear-gradient(160deg,#0F2A3B 0%,#1C8571 100%)';
const STATUS_PILL: Record<MateStatus, [string, string]> = {
    open: [MW.mintTint, MW.mintDeep],
    few: ['#FFF2DC', '#9A5B00'],
    done: [MW.chip, MW.mute],
};
const ICON = {
    cal: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
    ppl: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 010 6.5M18 14c2 .7 3 3 3 6',
    gen: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5 21c0-3.9 3.1-7 7-7s7 3.1 7 7',
    age: 'M12 3v4M8 7h8v4H8zM5 11h14v9H5zM5 15h14',
};
const MAX_MEMBER_DOTS = 10;

const hoverBorder = (base: string) => ({
    onMouseEnter: (e: MouseEvent<HTMLElement>) => (e.currentTarget.style.borderColor = MW.mint),
    onMouseLeave: (e: MouseEvent<HTMLElement>) => (e.currentTarget.style.borderColor = base),
});

export function TravelMateDetailDesktop({ post, comments, userId, userName, isOwner, canManage, join, onPostComment, onDeleteComment, onLogin, onEdit, onDelete }: Props) {
    const navigate = useNavigate();
    const { pick } = useSpotImages();
    const { data: all = [] } = useMatePosts();
    const p = useMemo(() => toMatePost(post), [post]);
    const [draft, setDraft] = useState('');
    const [posting, setPosting] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyTimer = useRef<number | undefined>(undefined);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }, [p.id]);
    useEffect(() => () => window.clearTimeout(copyTimer.current), []);

    const photo = matePhoto(p, pick);
    const title = cleanTitle(p.title) || p.title;
    const [sbg, sfg] = STATUS_PILL[p.status];
    const related = all.filter((x) => x.id !== p.id && (x.region === p.region || x.styles.some((s) => p.styles.includes(s)))).slice(0, 3);
    const hostPosts = p.userId ? all.filter((x) => x.userId === p.userId).length : 0;

    const facts = [
        { d: ICON.cal, label: '여행 기간', value: p.period, sub: p.nightsLabel },
        { d: ICON.ppl, label: '모집 인원', value: p.cap > 0 ? `${p.cap}명` : '미정', sub: p.cap > 0 ? `현재 ${p.joined}명 참가 중` : '' },
        { d: ICON.gen, label: '성별', value: GENDER_LABEL[p.gender] || GENDER_LABEL.any, sub: '' },
        { d: ICON.age, label: '희망 연령', value: p.ages.length ? p.ages.map((a) => AGE_LABEL[a] || a).join('·') : '제한 없음', sub: '' },
    ];

    // Host first, then joined members, then open seats.
    const members = Array.from({ length: Math.min(p.cap, MAX_MEMBER_DOTS) }, (_, k) =>
        k === 0
            ? { key: k, initial: p.initial, label: `${p.host} (호스트)`, bg: MW.mintLight, bd: '0', fg: MW.navy }
            : k < p.joined
                ? { key: k, initial: String(k + 1), label: '참가자', bg: MW.mintTint, bd: '0', fg: MW.navy }
                : { key: k, initial: '+', label: '빈자리', bg: 'transparent', bd: '1.5px dashed rgba(255,255,255,0.5)', fg: MW.mintTint },
    );
    const moreSeats = p.cap - members.length;
    const closed = p.status === 'done';

    const submit = async () => {
        const text = draft.trim();
        if (!text || posting) return;
        setPosting(true);
        const ok = await onPostComment(text);
        setPosting(false);
        if (ok) setDraft('');
    };

    const url = () => window.location.href;
    const copy = () => {
        navigator.clipboard?.writeText(url()).then(() => {
            setCopied(true);
            window.clearTimeout(copyTimer.current);
            copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
        }).catch(() => undefined);
    };
    const shareMore = () => {
        if (navigator.share) navigator.share({ title, url: url() }).catch(() => undefined);
        else copy();
    };

    const canPost = !!draft.trim() && !posting;

    return (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 104px', display: 'flex', flexDirection: 'column', gap: 32, color: MW.navy }}>
            <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 13, color: MW.mute, minWidth: 0 }}>
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ color: MW.mute, flexShrink: 0, textDecoration: 'none' }}>홈</a>
                <span>›</span>
                <a href="/travel-mates" onClick={(e) => { e.preventDefault(); navigate('/travel-mates'); }} style={{ color: MW.mute, flexShrink: 0, textDecoration: 'none' }}>동행 찾기</a>
                <span>›</span>
                <span style={{ color: MW.navy, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
            </nav>

            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 32 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: MW.mute }}>
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: sbg, color: sfg }}>{STATUS_LABEL[p.status]}</span>
                            <span style={{ fontWeight: 700, color: MW.mintDeep }}>{p.region}</span>
                            {p.posted && <><span>·</span><span>{p.posted}</span></>}
                            <span>·</span><span>조회 {p.views}</span>
                            <span>·</span><span>댓글 {comments.length}</span>
                            {canManage && (
                                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                    <button type="button" onClick={onEdit} {...hoverBorder(MW.line)} style={ownerBtn}>수정</button>
                                    <button type="button" onClick={onDelete} style={{ ...ownerBtn, color: MW.red, borderColor: '#F3C9C4' }}>삭제</button>
                                </span>
                            )}
                        </div>
                        <h1 style={{ margin: 0, fontSize: 'clamp(28px,3.6vw,40px)', fontWeight: 900, lineHeight: 1.3, wordBreak: 'break-word' }}>{title}</h1>
                    </div>

                    <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 28, overflow: 'hidden', background: PANEL_BG }}>
                        {isUsableImage(photo) && (
                            <img src={photo} onError={hideBroken} alt={p.image ? title : `${p.region} 이미지`} decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        <span style={{ position: 'absolute', left: 16, bottom: 16, display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px', borderRadius: 999, background: 'rgba(255,255,255,0.94)', fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, color: MW.navy, pointerEvents: 'none' }}>{p.period}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
                        {facts.map((f) => (
                            <div key={f.label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 18, borderRadius: 18, background: '#F7FAF9', border: '1px solid #EEF1EF' }}>
                                <span style={{ width: 40, height: 40, borderRadius: 12, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={MW.mintDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={f.d} /></svg>
                                </span>
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                                    <span style={{ fontSize: 12, color: MW.mute }}>{f.label}</span>
                                    <span style={{ fontSize: 16, fontWeight: 900 }}>{f.value}</span>
                                    {f.sub && <span style={{ fontSize: 12, color: MW.mute }}>{f.sub}</span>}
                                </span>
                            </div>
                        ))}
                    </div>

                    {p.styles.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 900 }}>여행 스타일</span>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {p.styles.map((s) => (
                                    <span key={s} style={{ height: 36, padding: '0 16px', display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: MW.mintBg, border: `1px solid ${MW.mintTint}`, fontSize: 13, fontWeight: 700, color: MW.mintDeep }}>#{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 32, borderTop: '1px solid #EEF1EF' }}>
                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>상세 내용</h2>
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, color: p.description ? MW.ink3 : MW.mute2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {p.description || '아직 설명이 없습니다.'}
                        </p>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '16px 18px', borderRadius: 16, background: MW.mintBg, border: `1px solid ${MW.mintTint}` }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={MW.mintDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
                                <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
                                <path d="M9 12l2 2 4-4" />
                            </svg>
                            <span style={{ fontSize: 13, lineHeight: 1.7, color: MW.ink3 }}>
                                <strong style={{ color: MW.navy }}>이 서비스는 개인 간 매칭입니다.</strong> 실제로 만나기 전에 댓글로 충분히 이야기를 나누고, 안전은 직접 확인해 주세요.
                            </span>
                        </div>
                    </div>

                    {/* Comments */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 32, borderTop: '1px solid #EEF1EF' }}>
                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
                            댓글 <span style={{ fontFamily: MW_FONT_EN, fontSize: 16, fontWeight: 600, color: MW.mintDeep }}>{comments.length}</span>
                        </h2>
                        {userId ? (
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <span style={{ ...avatar, background: MW_GRADIENT, color: MW.navy }}>{(userName || 'U').charAt(0).toUpperCase()}</span>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', border: `1.5px solid ${MW.line}`, borderRadius: 18, background: '#fff', overflow: 'hidden' }}>
                                    <textarea
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        rows={3}
                                        placeholder="질문이나 참가 의사를 편하게 댓글로 남겨 보세요"
                                        aria-label="댓글"
                                        style={{ border: 0, outline: 'none', resize: 'vertical', padding: '16px 18px 8px', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7, color: MW.navy, background: 'transparent' }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 10px 10px' }}>
                                        <button
                                            type="button"
                                            onClick={submit}
                                            disabled={!canPost}
                                            style={{ height: 38, padding: '0 20px', border: 0, borderRadius: 999, background: canPost ? MW.mint : MW.chip, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: canPost ? MW.navy : MW.mute2, cursor: canPost ? 'pointer' : 'default' }}
                                        >
                                            {posting ? '등록 중…' : '등록'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 20px', borderRadius: 18, border: `1.5px solid ${MW.line}` }}>
                                <span style={{ fontSize: 14, color: MW.mute }}>댓글을 쓰려면 로그인이 필요합니다.</span>
                                <button type="button" onClick={onLogin} style={{ height: 40, padding: '0 20px', border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', flexShrink: 0 }}>
                                    로그인
                                </button>
                            </div>
                        )}
                        {comments.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {comments.map((c) => {
                                    const name = (c.user_name || '').trim() || '익명';
                                    const isHost = !!p.userId && c.user_id === p.userId;
                                    const mine = !!userId && c.user_id === userId;
                                    const img = (c.user_image || '').trim();
                                    return (
                                        <div key={c.id} style={{ display: 'flex', gap: 12, padding: '16px 0', borderTop: '1px solid #EEF1EF' }}>
                                            <span style={{ ...avatar, position: 'relative', background: MW.mintTint, color: MW.mintDeep, overflow: 'hidden' }}>
                                                {name.charAt(0).toUpperCase()}
                                                {isUsableImage(img) && <img src={img} onError={hideBroken} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <strong style={{ fontSize: 14 }}>{name}</strong>
                                                    {isHost && <span style={{ fontSize: 10, fontWeight: 700, color: MW.navy, background: '#3FC2A4', padding: '2px 8px', borderRadius: 999 }}>HOST</span>}
                                                    <span style={{ fontSize: 12, color: MW.mute2 }}>{timeAgo(c.created_at)}</span>
                                                    {(mine || canManage) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onDeleteComment(c.id)}
                                                            onMouseEnter={(e) => (e.currentTarget.style.color = MW.red)}
                                                            onMouseLeave={(e) => (e.currentTarget.style.color = MW.mute2)}
                                                            style={{ marginLeft: 'auto', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: MW.mute2, cursor: 'pointer' }}
                                                        >
                                                            삭제
                                                        </button>
                                                    )}
                                                </span>
                                                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: MW.ink3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ padding: '36px 20px', borderRadius: 18, background: '#F7FAF9', textAlign: 'center', fontSize: 13, color: MW.mute }}>첫 댓글을 남겨 보세요</div>
                        )}
                    </div>
                </div>

                <aside style={{ flex: '0 1 330px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: MW_STICKY_TOP + 24 }}>
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, padding: 26, background: PANEL_BG, color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <span aria-hidden="true" style={{ position: 'absolute', right: -80, top: -80, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(109,219,190,0.35),rgba(109,219,190,0) 70%)', pointerEvents: 'none' }} />
                        <span style={{ position: 'relative', fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintLight }}>THIS TRIP</span>
                        {p.cap > 0 && (
                            <>
                                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 34, fontWeight: 600 }}>{p.joined}</span>
                                        <span style={{ fontSize: 14, color: MW.mintTint }}>/ {p.cap}명 참가 중</span>
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: MW.mintLight }}>{seatText(p)}</span>
                                </div>
                                <div style={{ position: 'relative', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {members.map((m) => (
                                        <span key={m.key} title={m.label} style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600, color: m.fg, background: m.bg, border: m.bd }}>
                                            {m.initial}
                                        </span>
                                    ))}
                                    {moreSeats > 0 && (
                                        <span style={{ height: 40, display: 'flex', alignItems: 'center', fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, color: MW.mintTint }}>+{moreSeats}</span>
                                    )}
                                </div>
                            </>
                        )}
                        {isOwner ? null : closed ? (
                            <div style={{ position: 'relative', height: 54, borderRadius: 999, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: MW.mintTint }}>
                                모집이 마감되었습니다
                            </div>
                        ) : userId && join.mine ? (
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ height: 54, borderRadius: 999, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: MW.mintDeep }}>
                                    ✓ 참가 요청 보냄
                                </div>
                                <button
                                    type="button"
                                    onClick={join.withdraw}
                                    disabled={join.busy}
                                    style={{ alignSelf: 'center', padding: 4, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: MW.mintTint, cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    요청 취소하기
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={userId ? join.ask : onLogin}
                                disabled={join.busy}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                style={{ position: 'relative', height: 54, border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                            >
                                {userId ? '참가 요청 보내기' : '로그인하고 참가 요청하기'}
                            </button>
                        )}
                        {join.requesters && <JoinRequesterList count={join.count} requesters={join.requesters} />}
                        <button
                            type="button"
                            onClick={openKakaoConsultation}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, border: '1px solid rgba(255,255,255,0.35)', borderRadius: 999, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg>
                            몽골리아 은하수에 여행 상담하기
                        </button>
                        <span style={{ position: 'relative', fontSize: 12, lineHeight: 1.6, color: MW.mintTint }}>
                            {joinNote({ host: isOwner, closed, mine: !!userId && join.mine })}
                        </span>
                    </div>

                    <div style={{ border: `1px solid ${MW.line}`, borderRadius: 24, padding: 22, background: '#fff', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintDeep }}>HOST</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <HostAvatar p={p} size={52} />
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                <span style={{ fontSize: 16, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.host}</span>
                                {p.hostInfo && <span style={{ fontSize: 12, color: MW.mute }}>{p.hostInfo}</span>}
                            </span>
                        </div>
                        {hostPosts > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0', borderTop: '1px solid #EEF1EF', borderBottom: '1px solid #EEF1EF' }}>
                                <span style={{ fontSize: 12, color: MW.mute }}>올린 모집글</span>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 600 }}>{hostPosts}</span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => navigate('/travel-mates')}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = MW.mint; e.currentTarget.style.color = MW.mintDeep; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = MW.line; e.currentTarget.style.color = MW.navy; }}
                            style={{ height: 44, border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                        >
                            동행 찾기 목록 보기
                        </button>
                    </div>

                    <div style={{ borderRadius: 24, padding: '20px 22px', background: '#F7FAF9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>공유</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" onClick={copy} {...hoverBorder(MW.line)} style={shareBtn}>{copied ? '복사됨' : '링크 복사'}</button>
                            <button type="button" onClick={shareMore} aria-label="다른 방법으로 공유" {...hoverBorder(MW.line)} style={{ ...shareBtn, width: 40, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MW.navy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <circle cx="18" cy="5" r="2.5" />
                                    <circle cx="6" cy="12" r="2.5" />
                                    <circle cx="18" cy="19" r="2.5" />
                                    <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {related.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 40, borderTop: '1px solid #EEF1EF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>SIMILAR TRIPS</span>
                            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>비슷한 모집글</h2>
                        </div>
                        <a href="/travel-mates" onClick={(e) => { e.preventDefault(); navigate('/travel-mates'); }} style={{ fontSize: 14, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap', textDecoration: 'none' }}>전체 보기 →</a>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: 22 }}>
                        {related.map((r) => {
                            const img = matePhoto(r, pick);
                            const rTitle = cleanTitle(r.title) || r.title;
                            return (
                                <a
                                    key={r.id}
                                    href={`/travel-mates/${r.id}`}
                                    onClick={(e) => { e.preventDefault(); navigate(`/travel-mates/${r.id}`); }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                    style={{ display: 'flex', flexDirection: 'column', gap: 10, color: MW.navy, textDecoration: 'none', minWidth: 0 }}
                                >
                                    <span style={{ position: 'relative', display: 'block', aspectRatio: '4/3', borderRadius: 20, overflow: 'hidden', background: PANEL_BG }}>
                                        {isUsableImage(img) && <img src={img} onError={hideBroken} alt={r.image ? rTitle : `${r.region} 이미지`} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>{r.region} · {r.period}</span>
                                    <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.5, wordBreak: 'break-word' }}>{rTitle}</span>
                                    {r.cap > 0 && <span style={{ fontSize: 12, color: MW.mute }}>{r.joined}/{r.cap}명 · {seatText(r)}</span>}
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}

const avatar: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: MW_FONT_EN,
    fontSize: 14,
    fontWeight: 600,
    flexShrink: 0,
};

const ownerBtn: CSSProperties = {
    height: 32,
    padding: '0 14px',
    border: `1px solid ${MW.line}`,
    borderRadius: 999,
    background: '#fff',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    color: MW.navy,
    cursor: 'pointer',
};

const shareBtn: CSSProperties = {
    height: 40,
    padding: '0 16px',
    border: `1px solid ${MW.line}`,
    borderRadius: 999,
    background: '#fff',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 700,
    color: MW.navy,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};
