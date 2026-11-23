import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReservationDocContent } from './ReservationDocumentEditor';
import { AdminButton } from './ui';
import { buildReservationDraftPreview, contractDraftPreviewHtml, type ReservationPreviewContext } from '../../utils/reservationDraftPreview';

export function ReservationDraftPreview({ content, dates, context, mode, accountId, onClose }: {
    content: ReservationDocContent; dates: { startDate: string; endDate: string }; context?: ReservationPreviewContext;
    mode: 'itinerary' | 'contract'; accountId?: string | null; onClose: () => void;
}) {
    const [nonce] = useState(() => crypto.randomUUID());
    const frame = useRef<HTMLIFrameElement>(null);
    const [ready, setReady] = useState(mode === 'contract');
    const quote = useMemo(() => buildReservationDraftPreview(content, dates, context), [content, dates, context]);
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.nonce !== nonce) return;
            if (event.data.type === 'inhasu-admin-preview-ready' && accountId && event.data.userId === accountId) {
                frame.current.contentWindow?.postMessage({ type: 'inhasu-admin-preview-content', nonce, quote }, window.location.origin); setReady(true);
            }
            if (event.data.type === 'inhasu-admin-preview-close') onClose();
        };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('message', receive); window.addEventListener('keydown', escape);
        return () => { window.removeEventListener('message', receive); window.removeEventListener('keydown', escape); };
    }, [nonce, accountId, quote, onClose]);
    return <div role="dialog" aria-modal="true" aria-label="저장 전 문서 초안 미리보기" className="ri-preview">
        <header className="ri-preview-head"><div className="ri-preview-title"><strong>{mode === 'contract' ? '계약 조건' : '확정 일정표'} · 저장 전 초안</strong><div className="ri-preview-note">이 화면은 관리자에게만 표시되며 고객 공개·발송과 분리됩니다.</div></div><AdminButton variant="secondary" onClick={() => frame.current?.contentWindow?.print()} disabled={!ready}>PDF 저장</AdminButton><AdminButton variant="primary" onClick={onClose}>편집으로 돌아가기</AdminButton></header>
        <iframe ref={frame} title="관리자 문서 초안" sandbox="allow-scripts allow-same-origin allow-modals" className="ri-preview-frame"
            src={mode === 'itinerary' ? `/확정일정표?reservationId=administrator-local-preview&preview=1&m=0&adminDraft=${nonce}` : undefined}
            srcDoc={mode === 'contract' ? contractDraftPreviewHtml(content, dates, context) : undefined} />
    </div>;
}
