import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    AdminBadge, AdminButton, AdminCard, AdminField, AdminIconButton, AdminMessage, AdminSegmented, AdminTextArea,
    IconCopy, IconDocumentText, IconDownload, IconExternal, IconPencil, IconTrash,
} from './ui';
import { adminConfirm, adminNotify } from './ui/adminFeedback';
import { INQUIRY_STATUSES, dateOnly, nextAction, type InquiryRecord } from './quoteInbox';
import {
    attachmentPath, customerLinkUrl, extendedQuoteExpiry, inquiryAccepted, inquiryCopyText, inquiryInfoRows, inquiryPublished,
    inquiryTimeline, statusBlock, timelineTime,
} from './quoteInquiryDetail';
import './QuoteInquiryPanel.css';

/**
 * 고객 통합 작업 화면 안의 견적 문의 상세(예약 전 고객) — 옛 `견적관리.html?workspace=1` iframe을 대신한다.
 * 같은 `PATCH/DELETE /api/requests/:id`(x-admin-token)를 쓰고 옛 상세 창(openDrawer)의 동작을 그대로 옮겼다:
 * 상태 버튼(예약확정 검사) · 예약 진행 기록 · 고객 진행 타임라인 · 문의 내용 · 상담 메모(칸을 벗어나면 저장) ·
 * 견적서 보기 / 고객 링크 복사 / 유효기간 7일 연장 / 고객 링크 재발급 · 삭제 · 정보 복사 · 견적서 만들기.
 * 바깥 화면(AdminQuoteDesk)은 ref의 flushAll()로 이동 전에 메모를 저장하고, onState로 저장 중·미저장을 받는다(옛 InhasuQuoteInquiryWorkspace와 같은 약속).
 */
export interface QuoteInquiryState { busy: boolean; dirty: boolean; error: string }
export interface QuoteInquiryFlush { ok: boolean; busy: boolean; dirty?: boolean; error?: string }
export interface QuoteInquiryHandle {
    flushAll: () => QuoteInquiryFlush;
    /** info(문의 내용)·notes(상담 메모)·log(타임라인)·docs(견적서 버튼)로 옮긴다 */
    navigate: (section: string) => boolean;
}
interface Props {
    record: InquiryRecord;
    /** 견적 관리자 값(x-admin-token) */
    token: string;
    onState: (state: QuoteInquiryState) => void;
    /** 서버에 저장한 뒤(바깥 고객 현황을 다시 읽게) */
    onSaved: () => void;
    onOpenBuilder: () => void;
    onOpenBooking: () => void;
    onDeleted: () => void;
}
type Saved = { ok: true; [key: string]: unknown } | { ok: false; error: string };

export const QuoteInquiryPanel = forwardRef<QuoteInquiryHandle, Props>(function QuoteInquiryPanel({ record, token, onState, onSaved, onOpenBuilder, onOpenBooking, onDeleted }, ref) {
    const id = String(record.id);
    const [local, setLocal] = useState<InquiryRecord>(record);
    const [memo, setMemo] = useState<string>(record.memo || '');
    const [memoError, setMemoError] = useState('');
    const [saving, setSaving] = useState(0);
    const [copied, setCopied] = useState(false);
    const savingRef = useRef(0);
    const memoRef = useRef(memo); memoRef.current = memo;
    const memoSaved = useRef<string>(record.memo || '');
    const memoErrorRef = useRef(memoError); memoErrorRef.current = memoError;
    const deleted = useRef(false);
    const infoRef = useRef<HTMLDivElement>(null);
    const memoInput = useRef<HTMLTextAreaElement>(null);
    const timelineRef = useRef<HTMLOListElement>(null);
    const makeRef = useRef<HTMLButtonElement>(null);
    const state = useRef(onState); state.current = onState;

    // 바깥에서 고객을 다시 읽으면 새 자료로 바꾼다. 저장 중이거나 고치던 메모는 그대로 둔다.
    useEffect(() => {
        if (savingRef.current) return;
        setLocal(record);
        const saved = record.memo || '';
        if (memoRef.current === memoSaved.current) { memoSaved.current = saved; setMemo(saved); }
    }, [record]);

    const dirty = memo !== memoSaved.current;
    useEffect(() => { state.current({ busy: saving > 0, dirty, error: dirty ? memoError : '' }); }, [saving, dirty, memoError]);
    useEffect(() => () => state.current({ busy: false, dirty: false, error: '' }), []);

    const persist = useCallback(async (patch: Record<string, unknown>, merge = true): Promise<Saved> => {
        savingRef.current++; setSaving(savingRef.current);
        if (merge) setLocal(old => ({ ...old, ...patch }));
        try {
            const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, { method: 'PATCH', cache: 'no-store',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify(patch) });
            if (res.status === 401) return { ok: false, error: '관리자 인증이 만료됐어요. 다시 로그인해 주세요.' };
            const j = await res.json().catch(() => ({}));
            if (!res.ok || !j.ok) return { ok: false, error: j.error || `서버 오류 (${res.status})` };
            setLocal(old => ({ ...old, ...(j.status ? { status: j.status } : {}), ...(Array.isArray(j.activities) ? { activities: j.activities } : {}) }));
            return { ok: true, ...j };
        } catch { return { ok: false, error: '서버에 연결할 수 없어요' }; }
        finally { savingRef.current--; setSaving(savingRef.current); }
    }, [id, token]);

    const saveMemo = useCallback(async (value: string) => {
        if (value === memoSaved.current || savingRef.current) return; // 저장 중에는 칸이 잠겨 다시 저장하지 않는다
        setMemoError('');
        const res = await persist({ memo: value });
        if (res.ok) { memoSaved.current = value; setMemoError(''); adminNotify('메모가 저장됐어요', 'success'); onSaved(); }
        else { const message = '메모 저장 실패: ' + res.error; setMemoError(message); adminNotify(message, 'error'); }
    }, [persist, onSaved]);

    useImperativeHandle(ref, () => ({
        flushAll() {
            if (deleted.current) return { ok: true, busy: false };
            const busy = savingRef.current > 0, isDirty = memoRef.current !== memoSaved.current;
            if (isDirty && memoErrorRef.current) return { ok: false, busy, dirty: true, error: memoErrorRef.current };
            if (!busy && isDirty) { void saveMemo(memoRef.current); return { ok: false, busy: true }; }
            return { ok: !busy, busy, dirty: isDirty };
        },
        navigate(section) {
            const target = section === 'notes' ? memoInput.current : section === 'log' ? timelineRef.current || infoRef.current : section === 'docs' ? makeRef.current : infoRef.current;
            if (!target) return false;
            target.focus?.({ preventScroll: true });
            // 편집기를 막 열면 바깥 화면이 다음 프레임에 맨 위로 올린다 — 그 뒤에 옮긴다.
            window.requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
            return true;
        },
    }), [saveMemo]);

    const r = local;
    const status = r.status || '신규';
    const accepted = inquiryAccepted(r);
    const published = inquiryPublished(r);
    const action = nextAction(r);
    const events = inquiryTimeline(r);
    const busy = saving > 0;

    const updateStatus = async (next: string) => {
        if (busy || next === status) return;
        const blocked = statusBlock(r, next);
        if (blocked) { adminNotify(blocked, 'error'); return; }
        const prev = status;
        const res = await persist({ status: next });
        if (res.ok) { adminNotify(`상태가 "${next}"(으)로 저장됐어요`, 'success'); onSaved(); return; }
        setLocal(old => ({ ...old, status: prev }));
        adminNotify('상태 저장 실패: ' + res.error, 'error');
    };
    // 서버 acceptQuote: 고객 현황의 [고객이 예약하겠대요]와 같은 저장(수락 기록 + 견적의 예약금·계좌가 담긴 예약).
    const recordAccept = async () => {
        if (!await adminConfirm({ title: '예약 진행 기록', confirmLabel: '기록하기',
            message: `${r.name || '고객'}님의 예약 진행을 기록할까요?\n견적에 예약금이 있으면 고객 페이지에 예약금·계좌 안내가 바로 표시됩니다.` })) return;
        const res = await persist({ acceptQuote: true }, false);
        if (res.ok) { adminNotify('예약 진행을 기록했어요. 예약금이 있으면 고객 페이지에 입금 안내가 표시됩니다.', 'success'); onSaved(); }
        else adminNotify('수락 기록 저장 실패: ' + res.error, 'error');
    };
    const extendQuote = async () => {
        const quoteExpiresAt = extendedQuoteExpiry(r);
        const res = await persist({ quoteExpiresAt });
        if (res.ok) { adminNotify('견적 유효기간을 7일 연장했어요', 'success'); onSaved(); }
        else { setLocal(old => ({ ...old, quoteExpiresAt: r.quoteExpiresAt })); adminNotify('유효기간 연장 실패: ' + res.error, 'error'); }
    };
    const rotateLink = async () => {
        if (!await adminConfirm({ title: '고객 링크 재발급', confirmLabel: '재발급', message: '기존 고객 링크는 즉시 사용할 수 없게 됩니다. 새 링크를 발급할까요?' })) return;
        const res = await persist({ rotateCustomerLink: true }, false);
        const next = res.ok && typeof res.token === 'string' ? res.token : '';
        if (next) { setLocal(old => ({ ...old, token: next })); adminNotify('새 고객 링크를 발급했어요', 'success'); onSaved(); }
        else adminNotify('고객 링크 재발급 실패: ' + ((!res.ok && res.error) || '응답 오류'), 'error');
    };
    const copyLink = () => {
        navigator.clipboard.writeText(customerLinkUrl(window.location.origin, String(r.token)))
            .then(() => adminNotify('고객 링크가 복사됐어요 — 카톡으로 보내세요', 'success'))
            .catch(() => adminNotify('복사 실패 — 주소를 직접 복사해 주세요', 'error'));
    };
    const copyInfo = () => {
        navigator.clipboard.writeText(inquiryCopyText(r))
            .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); })
            .catch(() => adminNotify('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.', 'error'));
    };
    const remove = async () => {
        if (!await adminConfirm({ title: '문의 삭제', danger: true, confirmLabel: '삭제',
            message: `"${r.name || '-'}" 님의 문의를 삭제할까요?\n발행된 견적서 링크도 함께 사라지며, 되돌릴 수 없습니다.` })) return;
        savingRef.current++; setSaving(savingRef.current);
        try {
            const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, { method: 'DELETE', cache: 'no-store', headers: { 'x-admin-token': token } });
            const j = await res.json().catch(() => ({}));
            if (res.status === 401) { adminNotify('관리자 인증이 만료됐어요. 다시 로그인해 주세요.', 'error'); return; }
            if (!j.ok) { adminNotify('삭제 실패: ' + (j.error || '서버 오류'), 'error'); return; }
            deleted.current = true;
            adminNotify('삭제되었습니다', 'success');
        } catch { adminNotify('삭제 실패 — 서버 연결을 확인하세요', 'error'); return; }
        finally { savingRef.current--; setSaving(savingRef.current); }
        onDeleted();
    };
    // 비공개 첨부는 관리자 헤더로 받아 이 컴퓨터에 저장한다(주소에 관리자 값을 넣지 않는다).
    const download = async () => {
        try {
            const res = await fetch(attachmentPath(String(r.fileKey)), { headers: { 'x-admin-token': token }, cache: 'no-store' });
            if (!res.ok) throw new Error(String(res.status));
            const url = URL.createObjectURL(await res.blob());
            const link = document.createElement('a');
            link.href = url; link.download = String(r.fileName || '첨부파일');
            document.body.appendChild(link); link.click(); link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch { adminNotify('첨부 파일을 받지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'error'); }
    };
    const openDoc = (page: string) => window.open(`/${page}?t=${encodeURIComponent(String(r.token))}`, '_blank', 'noopener');

    return (
        <fieldset className="qip" disabled={busy} aria-busy={busy || undefined}>
            <legend className="qip-legend">{r.name || '고객'} 견적 문의 · {dateOnly(r.receivedAt)} 접수{r.tripType ? ` · ${r.tripType}` : ''}</legend>
            <div className="qip-grid">
                <div className="qip-main">
                    <AdminCard title="진행 상태" description={`${dateOnly(r.receivedAt)} 접수${r.tripType ? ` · ${r.tripType}` : ''}`}>
                        <AdminSegmented label="문의 상태" size="md" value={status} onChange={value => { void updateStatus(value); }}
                            items={INQUIRY_STATUSES.map(s => ({ value: s as string, label: s }))} />
                        {r.quote && <AdminMessage tone={action ? 'info' : 'positive'} className="qip-next"
                            title={action ? `지금 할 일: ${action.label}` : r.booking ? '현재 처리할 필수 단계가 없습니다' : '고객 수락 후 예약관리를 시작할 수 있어요'}
                            actions={<>
                                <AdminButton variant="secondary" size="sm" disabled={!accepted} title={accepted ? undefined : '고객 수락을 먼저 기록하세요'} onClick={onOpenBooking}>
                                    {r.booking ? '예약관리 열기' : '예약관리 시작'}
                                </AdminButton>
                                {published && r.token && <AdminButton variant="secondary" size="sm" trailing={<IconExternal />} onClick={() => openDoc('확정일정표')}>공개 일정표 보기</AdminButton>}
                            </>}>
                            {action?.detail}
                        </AdminMessage>}
                        {r.quote && !accepted && <AdminMessage tone="cautionary" className="qip-accept" title="고객이 카톡·전화로 “예약 진행할게요” 하면 여기서 기록하세요"
                            actions={<AdminButton variant="primary" size="sm" onClick={() => { void recordAccept(); }}>예약 진행 기록</AdminButton>} />}
                    </AdminCard>

                    <AdminCard title="문의 내용">
                        <div ref={infoRef} tabIndex={-1} className="qip-info">
                            <dl className="qip-dl">
                                {inquiryInfoRows(r).map(row => <div key={row.key} className="qip-row">
                                    <dt>{row.label}</dt>
                                    <dd>{row.value}{row.sub && <small>{row.sub}</small>}</dd>
                                </div>)}
                                {r.fileName && <div className="qip-row">
                                    <dt>첨부</dt>
                                    <dd>{r.fileKey
                                        ? <AdminButton variant="weak" size="sm" leading={<IconDownload />} onClick={() => { void download(); }}>{String(r.fileName)} 받기</AdminButton>
                                        : <>{String(r.fileName)}<small>파일명만 전달됨</small></>}</dd>
                                </div>}
                            </dl>
                            {r.request && <p className="qip-request">{String(r.request)}</p>}
                        </div>
                    </AdminCard>

                    <AdminCard title="상담 메모" description="관리자만 보는 내부 기록입니다. 칸을 벗어나면 저장됩니다.">
                        <AdminField label="상담 메모" error={dirty && memoError ? memoError : null} hint={dirty ? '저장되지 않은 메모가 있습니다' : undefined}>
                            {(fieldId, describedBy) => <AdminTextArea ref={memoInput} id={fieldId} aria-describedby={describedBy} minRows={4} maxRows={14} value={memo}
                                placeholder="상담 메모 (예: 7/2 통화, 홉스골 추가 원함)"
                                onChange={event => { setMemo(event.target.value); setMemoError(''); }}
                                onBlur={event => { void saveMemo(event.target.value); }} />}
                        </AdminField>
                    </AdminCard>
                </div>

                <div className="qip-side">
                    {r.quote && r.token && <AdminCard title="견적서 · 고객 링크"
                        description={<>견적서 발행됨{r.quoteExpiresAt ? ` · 유효기간 ${new Date(r.quoteExpiresAt).toLocaleDateString('ko-KR')}` : ''}</>}>
                        <div className="qip-links">
                            <AdminButton variant="secondary" size="sm" leading={<IconDocumentText />} onClick={() => openDoc('견적서')}>견적서 보기</AdminButton>
                            <AdminButton variant="secondary" size="sm" leading={<IconCopy />} onClick={copyLink}>고객 링크 복사</AdminButton>
                            <AdminButton variant="secondary" size="sm" onClick={() => { void extendQuote(); }}>유효기간 7일 연장</AdminButton>
                            <AdminButton variant="secondary" size="sm" onClick={() => { void rotateLink(); }}>고객 링크 재발급</AdminButton>
                        </div>
                    </AdminCard>}
                    <AdminCard title="고객 진행 타임라인">
                        {events.length ? <ol ref={timelineRef} tabIndex={-1} className="qip-timeline">
                            {events.map((event, index) => <li key={`${event.at}:${index}`} className={`qip-event${event.who === '고객' ? ' is-customer' : ''}${index === events.length - 1 ? ' is-latest' : ''}`}>
                                <span className="qip-dot" aria-hidden="true" />
                                <span className="qip-event-body"><b>{event.label}</b><small>{timelineTime(event.at)} · {event.who}</small></span>
                                {index === events.length - 1 && <AdminBadge tone="info">최근</AdminBadge>}
                            </li>)}
                        </ol> : <p className="qip-empty">아직 남은 진행 기록이 없습니다.</p>}
                    </AdminCard>
                </div>
            </div>

            <div className="qip-footer">
                <AdminIconButton variant="outlined" label="문의 삭제" onClick={() => { void remove(); }}><IconTrash /></AdminIconButton>
                <AdminButton variant="secondary" leading={<IconCopy />} onClick={copyInfo}>{copied ? '복사됨' : '정보 복사'}</AdminButton>
                <AdminButton ref={makeRef} variant="primary" leading={<IconPencil />} onClick={onOpenBuilder}>{r.quote ? '견적서 수정' : '견적서 만들기'}</AdminButton>
            </div>
        </fieldset>
    );
});
