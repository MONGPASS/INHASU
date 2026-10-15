import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { AdminDeliveryHistory } from '../components/admin/AdminDeliveryHistory';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import {
    connectQuoteDesk,
    findQuoteDeskTool,
    isDesktopViewport,
    normalizeDocPath,
    quoteDeskFrameSrc,
    quoteDeskHref,
    quoteDeskPageId,
    quoteDeskToolForPath,
} from '../components/admin/quoteDesk';

/**
 * 맞춤 견적 데스크 — `/admin/quote-desk/:tool?`
 *
 * 견적 관리 도구(public/견적관리.html 등)를 다시 만들지 않고, 관리자 레이아웃 안에
 * 같은 출처 iframe 으로 끼워 넣는다. 로그인만 통합한다: 관리자 세션으로 견적 도구의
 * 관리자 값을 받아 sessionStorage 에 넣은 뒤 iframe 을 그리므로, 안쪽 화면은 자체
 * 비밀번호 화면 없이 열린다(안쪽 화면의 자체 메뉴는 public/admin-embed.js 가 숨긴다).
 */

// connecting: 관리자 세션으로 연결 중 · linked: iframe 표시 · unset: 서버에 ADMIN_TOKEN 없음 · failed: 연결 실패
type Phase = 'connecting' | 'linked' | 'unset' | 'failed';

export const AdminQuoteDesk: React.FC = () => {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const activeAccount = useRef(accountId); activeAccount.current = accountId;
    const { tool: toolParam } = useParams<{ tool?: string }>();
    const [searchParams] = useSearchParams();
    const bookingId = ['bookings', 'inbox', 'builder'].includes(toolParam || '') ? searchParams.get('id') || undefined : undefined;
    const quoteEditorId = toolParam === 'inbox' ? searchParams.get('qe') || undefined : undefined;
    const navigate = useNavigate();
    const tool = findQuoteDeskTool(toolParam);

    const [phase, setPhase] = useState<Phase>('connecting');
    const [linkedAccount, setLinkedAccount] = useState('');
    const linked = phase === 'linked' && linkedAccount === accountId && !!accountId;
    const connectionRequest = useRef(0);
    const connectController = useRef<AbortController | null>(null);
    // seq 가 바뀌면 iframe 을 새로 만든다(같은 주소를 다시 불러와야 할 때).
    const [frame, setFrame] = useState(() => ({ src: quoteDeskFrameSrc(tool, bookingId, quoteEditorId), seq: 0 }));
    const [frameLoading, setFrameLoading] = useState(true);
    const frameRef = useRef<HTMLIFrameElement>(null);
    // 안쪽 화면이 스스로 옮겨 간 메뉴. 이때는 주소만 맞추고 iframe 은 다시 불러오지 않는다.
    const followedKeyRef = useRef<string | null>(null);
    const followedHrefRef = useRef('');
    const frameKey = `${tool.key}:${bookingId || ''}:${quoteEditorId || ''}`;
    const shownKeyRef = useRef(frameKey);
    const [editorNotice, setEditorNotice] = useState('');
    const [showDeliveries, setShowDeliveries] = useState(false);
    const blockedReason = useRef({ busy: false, error: '' });
    const handledAttempt = useRef('');
    const syncFrameLocation = useRef<() => void>(() => {});
    type EditorWindow = Window & { QuoteEditorState?: {
        getState: () => { dirty: boolean; busy: boolean; error?: string };
        flushAll: () => { ok: boolean; dirty?: boolean; busy: boolean; error?: string };
        approveLeaveOnce?: () => void;
    } };
    const flushFrame = useCallback(() => {
        try {
            const inner = frameRef.current?.contentWindow as EditorWindow | null;
            if (!inner || inner.location.origin !== window.location.origin) return { ok: true, busy: false };
            return inner.QuoteEditorState?.flushAll() || { ok: true, busy: false };
        } catch { return { ok: false, busy: false, error: '견적 편집 상태를 확인하지 못했습니다. 내용을 저장한 뒤 이동해 주세요.' }; }
    }, []);
    const sendAccount = useCallback(() => {
        frameRef.current?.contentWindow?.postMessage({ type: 'inhasu-editor-account', version: 1,
            userId: user?.role === 'admin' ? user.id : '' }, window.location.origin);
    }, [user?.id, user?.role]);
    useEffect(() => {
        sendAccount();
        const receive = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
            if (event.data?.type === 'inhasu-editor-ready' && event.data.version === 1) sendAccount();
            if (event.data?.type === 'inhasu-editor-state' && event.data.version === 1) {
                if (!event.data.busy && !event.data.error) setEditorNotice('');
                syncFrameLocation.current();
            }
        };
        window.addEventListener('message', receive);
        return () => window.removeEventListener('message', receive);
    }, [sendAccount]);
    const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => {
        if (currentLocation.pathname === nextLocation.pathname && currentLocation.search === nextLocation.search) return false;
        if (followedKeyRef.current && nextLocation.pathname + nextLocation.search === followedHrefRef.current) return false; // Same child document, only synchronizing its address.
        const result = flushFrame();
        blockedReason.current = { busy: result.busy, error: result.error || '초안을 보관하지 못했습니다.' };
        return result.busy || !result.ok;
    }, [flushFrame]));
    useEffect(() => {
        if (blocker.state === 'unblocked') { handledAttempt.current = ''; return; }
        if (blocker.state !== 'blocked' || handledAttempt.current === blocker.location.key) return;
        handledAttempt.current = blocker.location.key;
        if (blockedReason.current.busy) { setEditorNotice('저장·발송·사진 업로드가 끝난 뒤 이동해 주세요.'); blocker.reset(); }
        else if (window.confirm(blockedReason.current.error + '\n\n초안을 보관하지 못한 상태로 이동할까요?')) blocker.proceed();
        else blocker.reset();
    }, [blocker]);
    useEffect(() => {
        const unload = (event: BeforeUnloadEvent) => {
            const result = flushFrame();
            if (result.busy || !result.ok) { event.preventDefault(); event.returnValue = ''; }
        };
        window.addEventListener('beforeunload', unload);
        return () => window.removeEventListener('beforeunload', unload);
    }, [flushFrame]);

    // 1) 관리자 세션으로 견적 도구를 연결한다(sessionStorage 에 관리자 값 저장).
    const connect = useCallback(async () => {
        const request = ++connectionRequest.current;
        connectController.current?.abort();
        const controller = new AbortController(); connectController.current = controller;
        if (!accountId) return;
        setPhase('connecting');
        try {
            const value = await connectQuoteDesk({ accountId, signal: controller.signal, isCurrent: () => activeAccount.current === accountId });
            if (!controller.signal.aborted && request === connectionRequest.current && activeAccount.current === accountId) { setLinkedAccount(accountId); setPhase(value ? 'linked' : 'unset'); }
        } catch {
            if (!controller.signal.aborted && request === connectionRequest.current && activeAccount.current === accountId) setPhase('failed');
        }
    }, [accountId]);
    useEffect(() => { void connect(); return () => { connectionRequest.current++; connectController.current?.abort(); }; }, [connect]);

    // 2) 주소의 메뉴가 바뀌면(관리자 메뉴에서 다른 화면을 고르면) 그 문서를 불러온다.
    useEffect(() => {
        if (shownKeyRef.current === frameKey) return;
        shownKeyRef.current = frameKey;
        if (followedKeyRef.current === tool.key) {
            followedKeyRef.current = null;
            followedHrefRef.current = '';
            return;
        }
        setFrame((prev) => ({ src: quoteDeskFrameSrc(tool, bookingId, quoteEditorId), seq: prev.seq + 1 }));
        setFrameLoading(true);
        // tool 은 tool.key 로 정해진다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [frameKey]);

    // 3) 안쪽 화면이 다른 견적 화면으로 넘어가면(예: 문의 → 견적서 만들기) 메뉴 표시와 주소를 맞춘다.
    const handleFrameLoad = () => {
        setFrameLoading(false);
        sendAccount();
        let path = '', innerId = '', innerEditor = '';
        try {
            path = frameRef.current?.contentWindow?.location.pathname ?? '';
            innerId = new URLSearchParams(frameRef.current?.contentWindow?.location.search).get('id') || '';
            innerEditor = new URLSearchParams(frameRef.current?.contentWindow?.location.search).get('qe') || '';
        } catch {
            return; // 다른 출처로 나간 경우 — 읽을 수 없으니 그대로 둔다
        }
        const current = quoteDeskToolForPath(path);
        if (!current) return;

        // 바깥 창은 데스크톱 폭인데 안쪽(더 좁은 iframe)이 모바일 관리자로 넘어갔으면 데스크톱 화면으로 되돌린다.
        if (current.mobileDoc && normalizeDocPath(path) === current.mobileDoc && isDesktopViewport() && !innerEditor) {
            try {
                frameRef.current?.contentWindow?.location.replace(`${current.doc}?m=0`);
                setFrameLoading(true);
            } catch { /* 그대로 둔다 */ }
            return;
        }

        const detailId = (current.key === 'bookings' && normalizeDocPath(path) === '/예약관리') || current.key === 'builder' ? innerId : '';
        const editorId = current.key === 'inbox' ? innerEditor : '';
        if (current.key !== tool.key || (['bookings', 'builder'].includes(current.key) && detailId !== (bookingId || '')) || editorId !== (quoteEditorId || '')) {
            followedKeyRef.current = current.key;
            followedHrefRef.current = quoteDeskHref(current.key) + (detailId ? `?id=${encodeURIComponent(detailId)}` : editorId ? `?qe=${encodeURIComponent(editorId)}` : '');
            navigate(followedHrefRef.current, { replace: true });
        }
    };
    syncFrameLocation.current = handleFrameLoad;

    // 안쪽 화면만 새로고침한다(안쪽 화면의 자체 새로고침 버튼은 메뉴와 함께 숨겨져 있다).
    const reloadFrame = () => {
        const result = flushFrame();
        if (result.busy) { setEditorNotice('저장·발송·사진 업로드가 끝난 뒤 새로고침해 주세요.'); return; }
        if (!result.ok && !window.confirm((result.error || '초안을 보관하지 못했습니다.') + '\n\n초안을 보관하지 못한 상태로 새로고침할까요?')) return;
        if (!result.ok) (frameRef.current?.contentWindow as EditorWindow | null)?.QuoteEditorState?.approveLeaveOnce?.();
        setFrameLoading(true);
        try {
            const inner = frameRef.current?.contentWindow;
            if (inner) {
                inner.location.reload();
                return;
            }
        } catch { /* 아래에서 iframe 을 새로 만든다 */ }
        setFrame((prev) => ({ ...prev, seq: prev.seq + 1 }));
    };

    // 새 창으로 열기: 지금 안쪽에 떠 있는 화면을 단독으로 연다.
    // noopener 를 붙이지 않는다 — 새 창이 이 탭의 sessionStorage(관리자 값)를 이어받아야 자체 로그인 화면이 뜨지 않는다.
    const openStandalone = () => {
        let url = quoteDeskFrameSrc(tool, bookingId, quoteEditorId);
        try {
            const inner = frameRef.current?.contentWindow?.location;
            if (inner && inner.origin === window.location.origin) url = `${inner.pathname}${inner.search}`;
        } catch { /* 기본 문서로 연다 */ }
        window.open(url, '_blank');
    };

    return (
        <AdminLayout
            activePage={quoteDeskPageId(tool.key)}
            eyebrow="맞춤 견적"
            title={bookingId && tool.key === 'bookings' ? '견적 예약 상세' : tool.label}
            description={bookingId && tool.key === 'bookings' ? '선택한 고객의 입금·계약·배정·일정표를 관리합니다.' : tool.description}
            flush
            actions={
                <>
                    {tool.key === 'inbox' && (
                        <button type="button" className="btn btn-blue" onClick={() => navigate(quoteDeskHref('builder'))}>
                            <Icon name="add" />견적 작성
                        </button>
                    )}
                    <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/reservations?type=quote_booking')}>
                        <Icon name="arrow_back" />통합 예약 목록
                    </button>
                    {linked && (
                        <button type="button" className="btn btn-ghost" onClick={reloadFrame}>
                            <Icon name="refresh" />새로고침
                        </button>
                    )}
                    {linked && tool.key === 'bookings' && bookingId && <button type="button" className="btn btn-ghost" onClick={() => setShowDeliveries(v => !v)}>발송 이력</button>}
                    <button type="button" className="btn btn-ghost" onClick={openStandalone}>
                        <Icon name="open_in_new" />새 창으로 열기
                    </button>
                </>
            }
        >
            {editorNotice && <div role="status" style={{ padding: '12px 20px', background: '#fff5e8', color: '#80521b' }}>{editorNotice}</div>}
            {linked ? (
                <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#fff' }}>
                    <iframe
                        key={frame.seq}
                        ref={frameRef}
                        src={frame.src}
                        title={`맞춤 견적 · ${tool.label}`}
                        onLoad={handleFrameLoad}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, display: 'block' }}
                    />
                    {showDeliveries && tool.key === 'bookings' && bookingId && <aside className="quote-delivery-panel" aria-label="견적 예약 발송 이력">
                        <button type="button" onClick={() => setShowDeliveries(false)}>이력 닫기</button>
                        <AdminDeliveryHistory source="quote_booking" bookingId={bookingId} onOpenDocument={kind => {
                            setShowDeliveries(false);
                            try {
                                const doc = frameRef.current?.contentDocument;
                                const target = doc?.getElementById(kind === 'contract' ? 'requestContract' : kind === 'travel_notice' ? 'sendTravelNotice' : 'publishBtn') || doc?.querySelector('.action-bar');
                                target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                (target as HTMLElement | null)?.focus();
                            } catch { setEditorNotice('현재 예약 화면의 문서 발송 버튼에서 내용을 확인해 주세요.'); }
                        }} />
                    </aside>}
                    {frameLoading && (
                        <div
                            role="status"
                            aria-live="polite"
                            style={{
                                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                                background: 'rgba(247,248,250,0.82)', pointerEvents: 'none',
                            }}
                        >
                            <span className="row" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                                <Icon name="progress_activity" className="spin" />화면을 불러오는 중
                            </span>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 32 }}>
                    {phase === 'connecting' && (
                        <span className="row" role="status" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                            <Icon name="progress_activity" className="spin" />견적 데스크에 연결하는 중
                        </span>
                    )}

                    {phase === 'unset' && (
                        <div className="card card-pad" style={{ maxWidth: 560 }}>
                            <div className="empty" style={{ padding: '18px 8px 10px' }}>
                                <Icon name="lock" />
                                <p style={{ color: 'var(--text-strong)', fontSize: 16, fontWeight: 800 }}>견적 데스크가 아직 연결되지 않았습니다</p>
                                <p style={{ lineHeight: 1.7, fontWeight: 500 }}>
                                    서버에 견적 관리자 비밀번호(환경 변수 <b>ADMIN_TOKEN</b>)가 설정되어 있지 않아
                                    견적 문의·예약 화면을 이 관리자 안에서 열 수 없습니다.
                                    Cloudflare Pages의 설정 &gt; 환경 변수에 <b>ADMIN_TOKEN</b>을 등록하고 다시 배포한 뒤 새로고침해 주세요.
                                </p>
                            </div>
                            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
                                <button type="button" className="btn btn-ink" onClick={() => { void connect(); }}>
                                    <Icon name="refresh" />다시 확인
                                </button>
                            </div>
                        </div>
                    )}

                    {phase === 'failed' && (
                        <div className="card card-pad" style={{ maxWidth: 560 }}>
                            <div className="empty" style={{ padding: '18px 8px 10px' }}>
                                <Icon name="warning" />
                                <p style={{ color: 'var(--text-strong)', fontSize: 16, fontWeight: 800 }}>견적 데스크에 연결하지 못했습니다</p>
                                <p style={{ lineHeight: 1.7, fontWeight: 500 }}>
                                    관리자 로그인이 만료되었거나 서버에 연결할 수 없습니다. 다시 시도해도 같으면 다시 로그인해 주세요.
                                </p>
                            </div>
                            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
                                <button type="button" className="btn btn-ink" onClick={() => { void connect(); }}>
                                    <Icon name="refresh" />다시 시도
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={() => { window.location.href = '/admin/login'; }}>
                                    <Icon name="login" />다시 로그인
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </AdminLayout>
    );
};
