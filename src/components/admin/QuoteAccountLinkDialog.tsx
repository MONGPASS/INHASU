import { useEffect, useRef, useState } from 'react';
import { adminNotify } from './ui/adminFeedback';
import { AdminButton, AdminCheckbox, AdminTextInput } from './ui';
import '../../styles/reservation-inline.css';

export function QuoteAccountLinkDialog({ requestId, customerName, onClose }: { requestId: string; customerName: string; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [reference, setReference] = useState('');
    const [account, setAccount] = useState<{ accountId: string; email: string } | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);

    const submit = async () => {
        if (busy || (account && !confirmed)) return;
        setBusy(true); setError('');
        try {
            const response = await fetch('/api/customer-access/staff-review/' + (account ? 'approve' : 'lookup'), {
                method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, reference: reference.trim(), ...(account ? { accountId: account.accountId, identityConfirmed: confirmed } : {}) }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '요청번호를 확인해 주세요.');
            if (account) { adminNotify('이 견적을 고객 계정에 연결했습니다.'); onClose(); }
            else setAccount({ accountId: result.accountId, email: result.email });
        } catch (reason) { setError(reason instanceof Error ? reason.message : '처리하지 못했습니다. 다시 시도해 주세요.'); }
        finally { setBusy(false); }
    };

    return <dialog ref={dialog} className="adm-dialog qald-dialog" aria-labelledby="quote-account-title" onClose={onClose}
        onCancel={event => { if (busy) event.preventDefault(); }}>
        <form onSubmit={event => { event.preventDefault(); void submit(); }}>
            <h2 id="quote-account-title" className="adm-dialog-title">고객 계정 연결</h2>
            <p className="adm-dialog-message">{customerName} 고객이 받은 연결 요청번호를 입력해 주세요.</p>
            <label className="qald-field">연결 요청번호
                <AdminTextInput autoFocus autoComplete="off" required maxLength={12} pattern="[a-fA-F0-9]{12}"
                    value={reference} disabled={busy} onChange={event => {
                        setReference(event.target.value.toUpperCase()); setAccount(null); setConfirmed(false); setError('');
                    }} />
            </label>
            {account && <div className="adm-dialog-message">
                <p>연결할 Google 계정 <strong>{account.email}</strong></p>
                <AdminCheckbox className="qald-confirm" checked={confirmed} disabled={busy} onChange={setConfirmed} label="예약 당시 연락처나 기존 상담 대화로 예약자 본인을 확인했습니다." />
            </div>}
            {error && <p role="alert" className="adm-dialog-message">{error}</p>}
            <div className="adm-dialog-foot">
                <AdminButton variant="secondary" disabled={busy} onClick={onClose}>닫기</AdminButton>
                <AdminButton type="submit" variant="primary" disabled={busy || reference.trim().length !== 12 || (!!account && !confirmed)}>
                    {busy ? '처리 중…' : account ? '이 계정에 연결' : '요청번호 확인'}
                </AdminButton>
            </div>
        </form>
    </dialog>;
}
