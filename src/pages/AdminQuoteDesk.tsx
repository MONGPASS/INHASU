import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
    const { tool: toolParam } = useParams<{ tool?: string }>();
    const navigate = useNavigate();
    const tool = findQuoteDeskTool(toolParam);

    const [phase, setPhase] = useState<Phase>('connecting');
    // seq 가 바뀌면 iframe 을 새로 만든다(같은 주소를 다시 불러와야 할 때).
    const [frame, setFrame] = useState(() => ({ src: quoteDeskFrameSrc(tool), seq: 0 }));
    const [frameLoading, setFrameLoading] = useState(true);
    const frameRef = useRef<HTMLIFrameElement>(null);
    // 안쪽 화면이 스스로 옮겨 간 메뉴. 이때는 주소만 맞추고 iframe 은 다시 불러오지 않는다.
    const followedKeyRef = useRef<string | null>(null);
    const shownKeyRef = useRef(tool.key);

    // 1) 관리자 세션으로 견적 도구를 연결한다(sessionStorage 에 관리자 값 저장).
    const connect = useCallback(async () => {
        setPhase('connecting');
        try {
            const value = await connectQuoteDesk();
            setPhase(value ? 'linked' : 'unset');
        } catch {
            setPhase('failed');
        }
    }, []);
    useEffect(() => { void connect(); }, [connect]);

    // 2) 주소의 메뉴가 바뀌면(관리자 메뉴에서 다른 화면을 고르면) 그 문서를 불러온다.
    useEffect(() => {
        if (shownKeyRef.current === tool.key) return;
        shownKeyRef.current = tool.key;
        if (followedKeyRef.current === tool.key) {
            followedKeyRef.current = null;
            return;
        }
        setFrame((prev) => ({ src: quoteDeskFrameSrc(tool), seq: prev.seq + 1 }));
        setFrameLoading(true);
        // tool 은 tool.key 로 정해진다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tool.key]);

    // 3) 안쪽 화면이 다른 견적 화면으로 넘어가면(예: 문의 → 견적서 만들기) 메뉴 표시와 주소를 맞춘다.
    const handleFrameLoad = () => {
        setFrameLoading(false);
        let path = '';
        try {
            path = frameRef.current?.contentWindow?.location.pathname ?? '';
        } catch {
            return; // 다른 출처로 나간 경우 — 읽을 수 없으니 그대로 둔다
        }
        const current = quoteDeskToolForPath(path);
        if (!current) return;

        // 바깥 창은 데스크톱 폭인데 안쪽(더 좁은 iframe)이 모바일 관리자로 넘어갔으면 데스크톱 화면으로 되돌린다.
        if (current.mobileDoc && normalizeDocPath(path) === current.mobileDoc && isDesktopViewport()) {
            try {
                frameRef.current?.contentWindow?.location.replace(`${current.doc}?m=0`);
                setFrameLoading(true);
            } catch { /* 그대로 둔다 */ }
            return;
        }

        if (current.key !== tool.key) {
            followedKeyRef.current = current.key;
            navigate(quoteDeskHref(current.key), { replace: true });
        }
    };

    // 안쪽 화면만 새로고침한다(안쪽 화면의 자체 새로고침 버튼은 메뉴와 함께 숨겨져 있다).
    const reloadFrame = () => {
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
        let url = tool.doc;
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
            title={tool.label}
            description={tool.description}
            showSearch={false}
            flush
            actions={
                <>
                    {phase === 'linked' && (
                        <button type="button" className="btn btn-ghost" onClick={reloadFrame}>
                            <Icon name="refresh" />새로고침
                        </button>
                    )}
                    <button type="button" className="btn btn-ghost" onClick={openStandalone}>
                        <Icon name="open_in_new" />새 창으로 열기
                    </button>
                </>
            }
        >
            {phase === 'linked' ? (
                <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#fff' }}>
                    <iframe
                        key={frame.seq}
                        ref={frameRef}
                        src={frame.src}
                        title={`맞춤 견적 · ${tool.label}`}
                        onLoad={handleFrameLoad}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, display: 'block' }}
                    />
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
