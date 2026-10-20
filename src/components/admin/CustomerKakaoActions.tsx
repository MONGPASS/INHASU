import { useEffect, useRef, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import type { AdminDeliveryKind } from '../../types/adminDelivery';
import { Icon } from './console/Icon';
import './CustomerKakaoActions.css';

interface Notice {
    kind: AdminDeliveryKind; label: string; available: boolean; reason?: string; description?: string;
    cooldownUntil?: string;
    lastAttempt?: { state: string; at: string; error?: string } | null;
}
interface Snapshot {
    source: 'product' | 'quote_booking'; bookingId: string;
    recipient: { name: string; phone: string }; notices: Notice[];
}
const descriptions: Record<AdminDeliveryKind, string> = {
    quote: '작성한 견적서를 확인할 수 있는 링크를 보냅니다.',
    contract: '계약서 확인·서명과 여행자 정보 입력을 안내합니다.',
    itinerary: '공개된 확정 일정표 링크를 보냅니다.',
    travel_notice: '여행 주의사항과 준비물 안내를 보냅니다.',
};
const states: Record<string, string> = { accepted: '발송 서비스 접수', failed: '발송 실패', unknown: '결과 확인 필요', sending: '발송 처리 중' };
const noticeKinds = new Set(['quote', 'contract', 'itinerary', 'travel_notice']);
const timeLabel = (at: string) => Number.isFinite(Date.parse(at)) ? new Date(at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';

/** Each explicit button sends one saved customer notice. Merely opening this panel never sends. */
export function CustomerKakaoActions({ source, bookingId, disabled = false, disabledReason, revision = 0, beforeSend, onBusyChange, onResult, onHistory }: {
    source: Snapshot['source']; bookingId: string; disabled?: boolean; disabledReason?: string; revision?: string | number;
    beforeSend?: () => boolean; onBusyChange?: (busy: boolean) => void; onResult?: () => void; onHistory?: () => void;
}) {
    const { user } = useUser();
    const account = user?.role === 'admin' ? user.id : '';
    const scope = JSON.stringify([account, source, bookingId]);
    const current = useRef(scope); current.current = scope;
    const callbacks = useRef({ beforeSend, onBusyChange, onResult }); callbacks.current = { beforeSend, onBusyChange, onResult };
    const [snapshot, setSnapshot] = useState<{ scope: string; data: Snapshot } | null>(null);
    const [error, setError] = useState<{ scope: string; text: string } | null>(null);
    const [feedback, setFeedback] = useState<{ scope: string; text: string; failed: boolean } | null>(null);
    const [loading, setLoading] = useState(false), [attempt, setAttempt] = useState(0);
    const [sendState, setSendState] = useState<{ scope: string; kind: string } | null>(null);
    const sending = sendState?.scope === scope ? sendState.kind : '';
    const lock = useRef(''), keys = useRef(new Map<string, string>());
    const [now, setNow] = useState(Date.now());
    const data = snapshot?.scope === scope ? snapshot.data : null;
    const path = `/api/admin/customer-notices/${source}/${encodeURIComponent(bookingId)}`;

    useEffect(() => {
        const reportBusy = callbacks.current.onBusyChange;
        reportBusy?.(false);
        return () => { reportBusy?.(false); };
    }, [scope]);

    useEffect(() => {
        if (!account) return;
        const controller = new AbortController();
        const read = async () => {
            setLoading(true);
            try {
                const response = await fetch(path, { credentials: 'include', cache: 'no-store', signal: controller.signal });
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || '카카오 알림 발송 상태를 불러오지 못했습니다.');
                if (body.source !== source || body.bookingId !== bookingId || !body.recipient || !Array.isArray(body.notices)
                    || body.notices.some((item: Notice) => !noticeKinds.has(item.kind) || typeof item.available !== 'boolean')) throw new Error('카카오 알림 응답을 확인해 주세요.');
                if (!controller.signal.aborted && current.current === scope) { setSnapshot({ scope, data: body }); setError(null); setNow(Date.now()); }
            } catch (reason: any) {
                if (!controller.signal.aborted && current.current === scope) setError({ scope, text: reason?.message || '발송 상태를 확인하지 못했습니다.' });
            } finally { if (!controller.signal.aborted && current.current === scope) setLoading(false); }
        };
        void read();
        const focus = () => { if (!document.hidden && !lock.current) setAttempt(value => value + 1); };
        window.addEventListener('focus', focus);
        return () => { controller.abort(); window.removeEventListener('focus', focus); };
    }, [account, source, bookingId, path, scope, revision, attempt]);
    const cooling = !!data?.notices.some(notice => notice.cooldownUntil && Date.parse(notice.cooldownUntil) > now);
    useEffect(() => {
        if (!cooling) return;
        const timer = window.setInterval(() => {
            const tick = Date.now(); setNow(tick);
            if (data?.notices.every(notice => !notice.cooldownUntil || Date.parse(notice.cooldownUntil) <= tick)) setAttempt(value => value + 1);
        }, 1000);
        return () => window.clearInterval(timer);
    }, [cooling, data]);

    const send = async (notice: Notice) => {
        if (!account || disabled || loading || error?.scope === scope || !notice.available || lock.current === scope || (notice.cooldownUntil && Date.parse(notice.cooldownUntil) > Date.now())) return;
        if (callbacks.current.beforeSend && !callbacks.current.beforeSend()) return;
        lock.current = scope; setSendState({ scope, kind: notice.kind }); setFeedback(null); callbacks.current.onBusyChange?.(true);
        const keyScope = `${scope}:${notice.kind}`;
        let key = keys.current.get(keyScope);
        if (!key) { key = crypto.randomUUID(); keys.current.set(keyScope, key); }
        try {
            const response = await fetch(path, { method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: notice.kind, idempotencyKey: key }) });
            const body = await response.json();
            if (body.state === 'accepted' || body.state === 'failed') keys.current.delete(keyScope);
            if (current.current !== scope) return;
            if (response.ok && body.ok && body.state === 'accepted') {
                const receipt = body.duplicate ? `${notice.label}: 이미 접수된 발송입니다.` : `${notice.label} 카카오 발송을 접수했습니다. 실제 수신 여부는 발송 서비스에서 확인할 수 있습니다.`;
                setFeedback({ scope, text: body.warning ? `${receipt} ${body.warning}` : receipt, failed: !!body.warning });
            } else {
                setFeedback({ scope, text: body.error || (body.state === 'unknown' || body.state === 'sending' ? '발송 결과를 확인 중입니다. 발송 이력에서 결과를 확인해 주세요.' : '카카오 알림을 발송하지 못했습니다.'), failed: true });
            }
        } catch {
            if (current.current === scope) setFeedback({ scope, text: '발송 응답을 확인하지 못했습니다. 중복 발송을 피하도록 발송 이력에서 접수 여부를 먼저 확인해 주세요.', failed: true });
        } finally {
            if (lock.current === scope) lock.current = '';
            if (current.current === scope) { setSendState(null); callbacks.current.onBusyChange?.(false); callbacks.current.onResult?.(); setAttempt(value => value + 1); }
        }
    };

    return <section className="cw-kakao" aria-label="고객 카카오 알림 발송" aria-busy={!!sending}>
        <header><span className="cw-kakao-icon"><Icon name="chat_bubble_outline" /></span><div><h3>고객에게 카카오 알림 보내기</h3><p>{data ? `${data.recipient.name || '고객'} · ${data.recipient.phone || '전화번호 미등록'}` : '등록된 고객의 수신번호와 발송 상태를 확인합니다.'}</p></div>{onHistory && <button type="button" className="cw-text-button" disabled={disabled || !!sending} onClick={onHistory}>발송 이력<Icon name="chevron_right" /></button>}</header>
        {error?.scope === scope && <div className="cw-kakao-feedback is-error" role="alert">{error.text}<button type="button" disabled={disabled || loading || !!sending} onClick={() => setAttempt(value => value + 1)}>다시 확인</button></div>}
        {feedback?.scope === scope && <p className={`cw-kakao-feedback${feedback.failed ? ' is-error' : ''}`} role={feedback.failed ? 'alert' : 'status'}>{feedback.text}</p>}
        {disabledReason && <p className="cw-kakao-blocked" role="status">{disabledReason}</p>}
        {!data && error?.scope !== scope && <p className="cw-kakao-loading" role="status">{account ? '발송 가능한 알림을 확인하고 있습니다…' : '관리자 로그인이 필요합니다.'}</p>}
        {data && <div className="cw-kakao-list">{data.notices.map(notice => {
            const seconds = notice.cooldownUntil ? Math.max(0, Math.ceil((Date.parse(notice.cooldownUntil) - now) / 1000)) : 0;
            const blocked = disabled || loading || !!sending || !notice.available || error?.scope === scope || seconds > 0;
            return <article className="cw-kakao-notice" key={notice.kind}>
                <div><h4>{notice.label}</h4><p>{notice.description || descriptions[notice.kind]}</p>
                    {notice.lastAttempt && <small className={`cw-kakao-last is-${notice.lastAttempt.state}`}>{states[notice.lastAttempt.state] || '결과 확인 필요'}{timeLabel(notice.lastAttempt.at) && ` · ${timeLabel(notice.lastAttempt.at)}`}</small>}
                    {notice.reason && !notice.available && <small className="cw-kakao-reason">{notice.reason}</small>}
                </div>
                <button type="button" className="cw-kakao-send" disabled={!!blocked} title={disabledReason || (!notice.available ? notice.reason : undefined)} aria-label={`${notice.label} 카카오 알림 발송`} onClick={() => void send(notice)}><Icon name="send" />{sending === notice.kind ? '접수 중…' : seconds > 0 ? `${seconds}초 후 재발송` : notice.lastAttempt?.state === 'accepted' ? '다시 보내기' : '카카오 발송'}</button>
            </article>;
        })}</div>}
        <p className="cw-kakao-hint">버튼을 누르면 등록된 고객에게 바로 발송합니다.</p>
    </section>;
}
