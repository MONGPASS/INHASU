import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSpotImages } from '../../hooks/useSpotImages';
import { MW, MW_FONT_EN, cleanTitle } from '../desktop-primitives/mwTokens';
import { JoinRequesterList } from '../mates-desktop/JoinRequesterList';
import { JOIN_CANCEL_CONFIRM, joinNote } from '../mates-desktop/joinRequest';
import { AGE_LABEL, GENDER_LABEL, STATUS_LABEL, matePhoto, seatText, timeAgo, toMatePost, type MatePost } from '../mates-desktop/matesData';
import { MobileShell } from '../mobile/MobileShell';
import { D, M_GRADIENT, M_HAIR, M_PAPER } from '../mobile/mobileTheme';
import { Ico, MEmpty, MLoading } from '../mobile/mobileUi';
import { DETAIL_STATUS_PILL, LIST_PATH, MATE_ICON, MAX_SEAT_DOTS, MINT_SOLID, PANEL_BG } from './matesMobileTheme';
import { MateAvatar, MatePhoto } from './matesMobileUi';
import { useMateDetail } from './useMateDetail';

/** Mobile post detail (Claude Design: "M Mate Detail" + "M Mate Action Bar"). */
export function TravelMateDetailMobile() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const detail = useMateDetail(id);
    const { post, loading, userId, join } = detail;
    const p = useMemo(() => (post ? toMatePost(post) : null), [post]);

    // One button: ask to join, or (after a confirm) take the request back.
    const toggleJoin = () => {
        if (!userId) {
            detail.goLogin();
            return;
        }
        if (!join.mine) join.ask();
        else if (window.confirm(JOIN_CANCEL_CONFIRM)) join.withdraw();
    };

    // Wait for the session too, so the login prompt never flashes for a signed-in user.
    const shown = loading ? null : p;
    return (
        <MobileShell
            title="모집 상세"
            bottomBar={shown ? <MateActionBar p={shown} isOwner={detail.isOwner} loggedIn={!!userId} requested={join.mine} busy={join.busy} onJoin={toggleJoin} onEdit={detail.editPost} /> : undefined}
        >
            {shown ? (
                <MateDetailBody key={shown.id} p={shown} detail={detail} />
            ) : loading ? (
                <MLoading pad={120} />
            ) : (
                <div style={{ padding: '20px 16px 0' }}>
                    <MEmpty text="게시글을 찾을 수 없습니다" action={{ label: '동행 찾기 목록 보기', onClick: () => navigate(LIST_PATH) }} />
                </div>
            )}
        </MobileShell>
    );
}

function MateDetailBody({ p, detail }: { p: MatePost; detail: ReturnType<typeof useMateDetail> }) {
    const navigate = useNavigate();
    const { pick } = useSpotImages();
    const { comments, userId, userName, isOwner, canManage, join } = detail;
    const [draft, setDraft] = useState('');
    const [focused, setFocused] = useState(false);
    const [posting, setPosting] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyTimer = useRef<number | undefined>(undefined);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [p.id]);
    useEffect(() => () => window.clearTimeout(copyTimer.current), []);

    const title = cleanTitle(p.title) || p.title;
    const [sbg, sfg] = DETAIL_STATUS_PILL[p.status];
    const goList = () => navigate(LIST_PATH);

    const facts = [
        { d: D.calendar, label: '여행 기간', value: p.period, sub: p.nightsLabel },
        { d: D.people, label: '모집 인원', value: p.cap > 0 ? `${p.cap}명` : '미정', sub: p.cap > 0 ? `현재 ${p.joined}명 참가 중` : '' },
        { d: MATE_ICON.gender, label: '성별', value: GENDER_LABEL[p.gender] || GENDER_LABEL.any, sub: '' },
        { d: MATE_ICON.age, label: '희망 연령', value: p.ages.length ? p.ages.map((a) => AGE_LABEL[a] || a).join('·') : '제한 없음', sub: '' },
    ];

    // Host first, then joined members, then open seats.
    const members = Array.from({ length: Math.min(p.cap, MAX_SEAT_DOTS) }, (_, k) => ({
        key: k,
        initial: k === 0 ? p.initial : '',
        bg: k === 0 ? MINT_SOLID : k < p.joined ? '#A3ECD6' : 'rgba(255,255,255,0.18)',
    }));
    const moreSeats = p.cap - members.length;

    const submit = async () => {
        const text = draft.trim();
        if (!text || posting) return;
        setPosting(true);
        const ok = await detail.postComment(text);
        setPosting(false);
        if (ok) setDraft('');
    };

    const url = () => window.location.href;
    const copy = () => {
        navigator.clipboard?.writeText(url()).then(() => {
            setCopied(true);
            window.clearTimeout(copyTimer.current);
            copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
        }).catch(() => undefined);
    };
    const shareMore = () => {
        if (navigator.share) navigator.share({ title, url: url() }).catch(() => undefined);
        else copy();
    };

    const canPost = !!draft.trim() && !posting;

    return (
        <section style={{ padding: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 22, color: MW.navy }}>
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <nav aria-label="현재 위치" style={{ display: 'flex', gap: 6, fontSize: 12, color: MW.mute, minWidth: 0, whiteSpace: 'nowrap' }}>
                    <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ color: MW.mute, flexShrink: 0, textDecoration: 'none' }}>홈</a>
                    <span>›</span>
                    <a href={LIST_PATH} onClick={(e) => { e.preventDefault(); goList(); }} style={{ color: MW.mute, flexShrink: 0, textDecoration: 'none' }}>동행 찾기</a>
                    <span>›</span>
                    <span style={{ color: MW.navy, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                </nav>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    <span style={{ flexShrink: 0, height: 24, padding: '0 10px', display: 'flex', alignItems: 'center', borderRadius: 999, background: sbg, color: sfg, fontSize: 11, fontWeight: 700 }}>{STATUS_LABEL[p.status]}</span>
                    <span style={{ fontWeight: 700, color: MW.mintDeep }}>{p.region}</span>
                    {p.posted && <><span>·</span><span>{p.posted}</span></>}
                    <span>·</span><span>조회 {p.views}</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, lineHeight: 1.4, textWrap: 'pretty', wordBreak: 'break-word' }}>{title}</h1>
                {canManage && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={detail.editPost} style={ownerBtn}>수정</button>
                        <button type="button" onClick={detail.deletePost} style={{ ...ownerBtn, color: MW.red, border: '1px solid #F3C9C4' }}>삭제</button>
                    </div>
                )}
            </div>

            <div style={{ position: 'relative', margin: '0 16px', aspectRatio: '4/3', borderRadius: 22, overflow: 'hidden', background: PANEL_BG }}>
                <MatePhoto src={matePhoto(p, pick)} alt={p.image ? title : `${p.region} 이미지`} eager />
                <span style={{ position: 'absolute', left: 12, bottom: 12, height: 30, padding: '0 12px', display: 'flex', alignItems: 'center', borderRadius: 999, background: 'rgba(255,255,255,0.94)', fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, color: MW.navy, pointerEvents: 'none' }}>{p.period}</span>
                <button type="button" onClick={shareMore} aria-label="공유" style={{ position: 'absolute', right: 10, top: 10, width: 40, height: 40, border: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                    <Ico d={MATE_ICON.share} size={18} />
                </button>
            </div>

            {/* This trip */}
            <div style={{ position: 'relative', overflow: 'hidden', margin: '0 16px', padding: 20, borderRadius: 22, background: PANEL_BG, color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <span aria-hidden="true" style={{ position: 'absolute', right: -60, top: -60, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(109,219,190,0.3),rgba(109,219,190,0) 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintLight }}>THIS TRIP</span>
                    {p.cap > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintLight }}>{seatText(p)}</span>}
                </div>
                {p.cap > 0 && (
                    <>
                        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
                            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 34, fontWeight: 600, lineHeight: 1 }}>{p.joined}</span>
                                <span style={{ fontSize: 13, color: MW.mintTint }}>/ {p.cap}명 참가 중</span>
                            </span>
                            <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                                {members.map((m) => (
                                    <span key={m.key} style={{ width: 30, height: 30, marginLeft: -8, borderRadius: '50%', border: '2px solid #16453F', boxSizing: 'border-box', background: m.bg, color: MW.navy, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.initial}</span>
                                ))}
                                {moreSeats > 0 && <span style={{ marginLeft: 6, fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, color: MW.mintTint }}>+{moreSeats}</span>}
                            </span>
                        </div>
                        <div style={{ position: 'relative', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
                            <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.round((p.joined / p.cap) * 100))}%`, background: `linear-gradient(90deg,${MW.mint},${MW.mintLight})`, borderRadius: 999 }} />
                        </div>
                    </>
                )}
                {join.requesters && <JoinRequesterList count={join.count} requesters={join.requesters} />}
                <button type="button" onClick={() => window.openChannelTalk?.()} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, border: '1px solid rgba(255,255,255,0.35)', borderRadius: 999, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Ico d={MATE_ICON.chat} size={16} color="#FFFFFF" />
                    몽골리아 은하수에 여행 상담하기
                </button>
                <span style={{ position: 'relative', fontSize: 11, lineHeight: 1.7, color: MW.mintTint }}>
                    {joinNote({ host: isOwner, closed: p.status === 'done', mine: join.mine })}
                    {!isOwner && p.status !== 'done' && join.mine && ' 버튼을 한 번 더 누르면 요청이 취소됩니다.'}
                </span>
            </div>

            <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                {facts.map((f) => (
                    <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 18, background: M_PAPER, border: `1px solid ${M_HAIR}`, minWidth: 0 }}>
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Ico d={f.d} size={18} color={MW.mintDeep} />
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ fontSize: 11, color: MW.mute }}>{f.label}</span>
                            <span style={{ fontSize: 15, fontWeight: 900, wordBreak: 'break-word' }}>{f.value}</span>
                            {f.sub && <span style={{ fontSize: 11, color: MW.mute2, whiteSpace: 'nowrap' }}>{f.sub}</span>}
                        </span>
                    </div>
                ))}
            </div>

            {p.styles.length > 0 && (
                <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 900 }}>여행 스타일</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {p.styles.map((s) => (
                            <span key={s} style={{ height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', borderRadius: 999, background: MW.mintBg, border: `1px solid ${MW.mintTint}`, fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>#{s}</span>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ margin: '0 16px', paddingTop: 22, borderTop: `1px solid ${M_HAIR}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h2 style={h2}>상세 내용</h2>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9, color: p.description ? MW.ink3 : MW.mute2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textWrap: 'pretty' }}>
                    {p.description || '아직 설명이 없습니다.'}
                </p>
                <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 16, background: MW.mintBg, border: `1px solid ${MW.mintTint}` }}>
                    <Ico d={MATE_ICON.shield} size={18} color={MW.mintDeep} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, lineHeight: 1.75, color: MW.ink3 }}>
                        <strong style={{ color: MW.navy }}>이 서비스는 개인 간 매칭입니다.</strong> 실제로 만나기 전에 댓글로 충분히 이야기를 나누고, 안전은 직접 확인해 주세요.
                    </span>
                </div>
            </div>

            {/* Host */}
            <div style={{ margin: '0 16px', padding: 16, borderRadius: 20, border: `1px solid ${MW.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <MateAvatar initial={p.initial} image={p.hostImage} size={48} fontSize={18} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>HOST</span>
                    <span style={{ fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.host}</span>
                    {p.hostInfo && <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.hostInfo}</span>}
                </span>
                <button type="button" onClick={goList} style={{ flexShrink: 0, height: 36, padding: '0 12px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>목록 보기</button>
            </div>

            {/* Comments */}
            <div style={{ margin: '0 16px', paddingTop: 22, borderTop: `1px solid ${M_HAIR}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h2 style={h2}>
                    댓글 <span style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 600, color: MW.mintDeep }}>{comments.length}</span>
                </h2>
                {userId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', border: `1.5px solid ${focused ? MW.mint : MW.line}`, borderRadius: 18, background: '#fff', overflow: 'hidden' }}>
                        <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            rows={3}
                            placeholder="질문이나 참가 의사를 편하게 댓글로 남겨 보세요"
                            aria-label="댓글"
                            style={{ border: 0, outline: 'none', boxShadow: 'none', resize: 'none', padding: '14px 16px 6px', fontFamily: 'inherit', fontSize: 16, lineHeight: 1.6, color: MW.navy, background: 'transparent' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0 8px 8px 16px' }}>
                            <span style={{ fontSize: 11, color: MW.mute2, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName ? `${userName} 이름으로 등록` : ''}</span>
                            <button type="button" onClick={submit} disabled={!canPost} style={{ flexShrink: 0, height: 36, padding: '0 18px', border: 0, borderRadius: 999, background: canPost ? MW.mint : MW.chip, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: canPost ? MW.navy : MW.mute2, cursor: canPost ? 'pointer' : 'default' }}>
                                {posting ? '등록 중…' : '등록'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 14px 14px 16px', border: `1.5px solid ${MW.line}`, borderRadius: 18, background: '#fff' }}>
                        <span style={{ fontSize: 13, lineHeight: 1.6, color: MW.mute }}>댓글을 쓰려면 로그인이 필요합니다.</span>
                        <button type="button" onClick={detail.goLogin} style={{ flexShrink: 0, height: 36, padding: '0 18px', border: 0, borderRadius: 999, background: M_GRADIENT, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>로그인</button>
                    </div>
                )}
                {comments.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {comments.map((c) => {
                            const name = (c.user_name || '').trim() || '익명';
                            const isHost = !!p.userId && c.user_id === p.userId;
                            const mine = !!userId && c.user_id === userId;
                            return (
                                <div key={c.id} style={{ display: 'flex', gap: 10, padding: '14px 0', borderTop: `1px solid ${M_HAIR}` }}>
                                    <MateAvatar initial={name.charAt(0).toUpperCase()} image={(c.user_image || '').trim()} size={34} fontSize={12} background={isHost ? MINT_SOLID : MW.mintTint} />
                                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', minWidth: 0 }}>
                                            <strong style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</strong>
                                            {isHost && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: MW.navy, background: MINT_SOLID, padding: '1px 7px', borderRadius: 999 }}>호스트</span>}
                                            <span style={{ flexShrink: 0, fontSize: 11, color: MW.mute2 }}>{timeAgo(c.created_at)}</span>
                                            {(mine || canManage) && (
                                                <button type="button" onClick={() => detail.deleteComment(c.id)} style={{ flexShrink: 0, marginLeft: 'auto', padding: '4px 0 4px 10px', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: MW.mute2, cursor: 'pointer' }}>삭제</button>
                                            )}
                                        </span>
                                        <span style={{ fontSize: 13, lineHeight: 1.7, color: MW.ink3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ padding: '28px 16px', borderRadius: 18, background: M_PAPER, textAlign: 'center', fontSize: 12, color: MW.mute }}>첫 댓글을 남겨 보세요</div>
                )}
            </div>

            <div style={{ margin: '0 16px', padding: '14px 16px', borderRadius: 18, background: M_PAPER, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 900 }}>공유</span>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={copy} style={{ ...shareBtn, border: `1px solid ${copied ? MW.mint : MW.line}`, background: copied ? MW.mintTint : '#fff', color: copied ? MW.mintDeep : MW.navy }}>{copied ? '✓ 복사됨' : '링크 복사'}</button>
                </div>
            </div>
        </section>
    );
}

/** Sticky bar that replaces the tab bar: dates, seats and the main action. */
function MateActionBar({ p, isOwner, loggedIn, requested, busy, onJoin, onEdit }: {
    p: MatePost;
    isOwner: boolean;
    loggedIn: boolean;
    /** The visitor already asked to join; pressing again withdraws the request. */
    requested: boolean;
    busy: boolean;
    onJoin: () => void;
    onEdit: () => void;
}) {
    const closed = p.status === 'done';
    const sent = loggedIn && requested;
    const cta: CSSProperties = { flex: 1, minWidth: 0, height: 50, padding: '0 10px', borderRadius: 999, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
    return (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 30, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${MW.line}`, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', color: MW.navy }}>
            <span style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: MW.mute }}>{p.period}</span>
                {p.cap > 0 && (
                    <span style={{ fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: MW_FONT_EN, color: closed ? MW.mute2 : MW.mintDeep }}>{p.joined}/{p.cap}</span>명 · {seatText(p)}
                    </span>
                )}
            </span>
            {isOwner ? (
                <button type="button" onClick={onEdit} style={{ ...cta, border: `1.5px solid ${MW.mint}`, background: '#FFFFFF', color: MW.navy, cursor: 'pointer' }}>모집글 수정하기</button>
            ) : closed ? (
                <button type="button" disabled style={{ ...cta, border: 0, background: MW.chip, color: MW.mute2, cursor: 'default' }}>모집이 마감되었습니다</button>
            ) : (
                <button
                    type="button"
                    onClick={onJoin}
                    disabled={busy}
                    aria-pressed={loggedIn ? sent : undefined}
                    style={{ ...cta, border: sent ? `1.5px solid ${MW.mint}` : 0, background: sent ? '#FFFFFF' : M_GRADIENT, color: MW.navy, cursor: 'pointer' }}
                >
                    {!loggedIn ? '로그인하고 참가 요청하기' : sent ? '✓ 참가 요청 보냄' : '참가 요청 보내기'}
                </button>
            )}
        </div>
    );
}

const h2: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 900, lineHeight: 1.35 };

const ownerBtn: CSSProperties = {
    height: 36,
    padding: '0 16px',
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
    height: 38,
    padding: '0 14px',
    border: `1px solid ${MW.line}`,
    borderRadius: 999,
    background: '#fff',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    color: MW.navy,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};
