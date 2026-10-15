import { useEffect, useRef, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import type { AdminDeliveryData, AdminDeliveryKind } from '../../types/adminDelivery';
import './AdminDeliveryHistory.css';

const names: Record<AdminDeliveryKind, string> = { quote: '견적서', contract: '여행 계약서', itinerary: '확정 일정표', travel_notice: '여행 주의사항' };
const states: Record<string, string> = { accepted: '서비스 접수', failed: '발송 실패', unknown: '결과 확인 필요', sending: '발송 중', queued: '발송 요청 · 결과 미확인', legacy: '기존 발송 기록' };
const steps = [{ key: 'accepted', label: '예약 접수' }, { key: 'deposit', label: '예약금 확인' }, { key: 'contract', label: '계약 동의' },
    { key: 'schedule', label: '일정 준비' }, { key: 'published', label: '일정표 공개' }] as const;

/** The same workflow and delivery receipts accompany both product and quote bookings. */
export function AdminDeliveryHistory({ source, bookingId, revision = 0, busy = false, onOpenDocument, onData }: {
    source: 'product' | 'quote_booking'; bookingId: string; revision?: number; busy?: boolean;
    onOpenDocument?: (kind: AdminDeliveryKind) => void;
    onData?: (data: AdminDeliveryData) => void;
}) {
    const { user } = useUser();
    const account = user?.role === 'admin' ? user.id : '';
    const [snapshot, setSnapshot] = useState<{ scope: string; data: AdminDeliveryData } | null>(null);
    const [error, setError] = useState(''), [loading, setLoading] = useState(false), [attempt, setAttempt] = useState(0);
    const scope = `${account}:${source}:${bookingId}`;
    const current = useRef(scope); current.current = scope;
    const report = useRef(onData); report.current = onData;
    const data = snapshot?.scope === scope ? snapshot.data : null;
    useEffect(() => {
        if (!account) { setSnapshot(null); return; }
        const controller = new AbortController();
        let pending = false;
        const read = async () => {
            if (pending || controller.signal.aborted) return;
            pending = true; setLoading(true);
            try {
                const response = await fetch(`/api/admin/deliveries?source=${source}&id=${encodeURIComponent(bookingId)}`, { credentials: 'include', cache: 'no-store', signal: controller.signal });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || '발송 이력을 확인하지 못했습니다.');
                if (!Array.isArray(payload.items) || !Array.isArray(payload.warnings) || !payload.workflow || payload.bookingId !== bookingId || payload.source !== source) throw new Error('발송 이력 응답을 확인해 주세요.');
                if (!controller.signal.aborted && current.current === scope) { setSnapshot({ scope, data: payload }); setError(''); report.current?.(payload); }
            } catch (reason: any) { if (!controller.signal.aborted && current.current === scope) setError(reason?.message || '이력을 불러오지 못했습니다.'); }
            finally { if (!controller.signal.aborted && current.current === scope) { pending = false; setLoading(false); } }
        };
        void read();
        const focus = () => { if (!document.hidden) void read(); };
        const timer = window.setInterval(focus, 15000);
        window.addEventListener('focus', focus);
        return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', focus); };
    }, [account, bookingId, source, scope, revision, attempt]);
    return <section className="delivery-history" aria-label="문서 발송 이력">
        <header><div><h3>문서 발송 이력</h3><p>공개·발송·고객 동의를 각각 확인하세요.</p></div><button type="button" disabled={loading} onClick={() => setAttempt(v => v + 1)}>{loading ? '확인 중…' : '새로고침'}</button></header>
        {error && <p role="alert" className="delivery-error">{error}{data ? ' 마지막 확인한 자료입니다.' : ''}</p>}
        {data?.warnings.map(warning => <p key={warning} role="status" className="delivery-error">{warning}</p>)}
        {data && <>
            <ol className="delivery-workflow" aria-label="공통 예약 진행 순서">{steps.map(step => <li key={step.key} className={data.workflow[step.key] ? 'is-done' : ''}><span>{data.workflow[step.key] ? '✓' : '○'}</span>{step.label}</li>)}</ol>
            <p className="delivery-hint">서비스 접수는 실제 수신 완료와 다릅니다. 결과가 불확실한 발송은 서비스에서 확인한 뒤 처리하세요.</p>
            {!data.items.length ? <p className="delivery-empty">발송 이력이 없습니다.</p> : <ul className="delivery-list">{data.items.slice(0, 20).map(item => <li key={item.id}>
                <div><strong>{names[item.kind]}</strong><span className={`delivery-state is-${['failed', 'unknown', 'sending'].includes(item.state) ? item.state : 'normal'}`}>{states[item.state] || '결과 확인 필요'}</span></div>
                <p>{item.channel === 'email' ? '이메일' : item.channel === 'message' ? '메시지' : '카카오 알림톡'} · {Number.isFinite(Date.parse(item.at)) ? new Date(item.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '일시 미확인'}</p>
                {item.error && <p className="delivery-error">{item.error}</p>}
                {item.providerId && <p className="delivery-receipt">접수 번호: {item.providerId}</p>}
                {onOpenDocument && ['failed', 'accepted', 'legacy'].includes(item.state) && <button type="button" disabled={busy} onClick={() => onOpenDocument(item.kind)}>{item.state === 'failed' ? '확인·재시도' : '문서·재발송 확인'}</button>}
            </li>)}</ul>}
        </>}
        {!data && !error && <p role="status" className="delivery-empty">{account ? '발송 이력을 불러오고 있습니다…' : '관리자 계정을 확인해 주세요.'}</p>}
    </section>;
}
