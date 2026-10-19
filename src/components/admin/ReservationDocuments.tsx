import type { TemplateDay } from '../../pages/AdminTemplateManage';
import type { ReactNode } from 'react';

interface Props {
    days: TemplateDay[];
    source: string;
    ready: boolean;
    published: boolean;
    canPublish: boolean;
    itinerarySent: boolean;
    itineraryChanged?: boolean;
    itinerarySentAt: string;
    signed: boolean;
    contractSent: boolean;
    contractChanged?: boolean;
    contractSentAt: string;
    travelerCount: number;
    email: string;
    sending: boolean;
    templates: Array<{ id: string; name: string }>;
    templateId: string;
    applyingTemplate: boolean;
    onTemplate: (id: string) => void;
    onEdit: (kind: 'itinerary' | 'contract') => void;
    onPreview: (kind: 'itinerary' | 'contract', print?: boolean) => void;
    onPublish: () => void;
    onSend: (kind: 'itinerary' | 'contract') => void;
    onCopy: (kind: 'itinerary' | 'contract' | 'final') => void;
    onSendAll: () => void;
    onGuidePdf: () => void;
    copied: string | null;
    disabled?: boolean;
    inlineEditor?: ReactNode;
    hasUnsavedChanges?: boolean;
    onDraftPreview?: (kind: 'itinerary' | 'contract') => void;
}

export function ReservationDocuments(p: Props) {
    const blocked = p.disabled || p.sending || p.applyingTemplate || p.hasUnsavedChanges;
    return <section id="sec-docs" className="rw-documents card" aria-label="고객 문서 작업">
        <div className="card-head rw-section-head"><div><span className="rw-kicker">고객 문서</span><h2>확정 일정표 · 여행 계약서</h2><p>내용을 확인하고 저장한 뒤 고객에게 전달하세요.</p></div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={p.onGuidePdf} disabled={!p.ready || blocked}>가이드용 PDF</button>
        </div>
        <div className="rw-document-grid">
            <article className="rw-document-card">
                <div className="row" style={{ justifyContent: 'space-between' }}><h3>확정 일정표</h3><span className={`badge ${p.published ? 'b-green' : 'b-amber'}`}>{p.published ? '고객 공개됨' : p.ready ? '공개 대기' : '작성 필요'}</span></div>
                <p>{p.source}{p.days.length ? ` · ${p.days.length}일 일정` : ''}</p>
                <label className="rw-field"><span>일정 템플릿으로 시작</span><select className="inp" value={p.templateId} disabled={blocked} onChange={e => p.onTemplate(e.target.value)}><option value="">템플릿 선택</option>{p.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                <div className="rw-primary-actions"><button type="button" className="btn btn-ink" disabled={p.disabled || p.sending || p.applyingTemplate} onClick={() => p.onEdit('itinerary')}>{p.ready ? '일정 편집' : '상품 일정 불러와 작성'}</button><button type="button" className="btn btn-ghost" disabled={!p.ready || blocked || p.hasUnsavedChanges} onClick={() => p.onPreview('itinerary')}>고객 화면 미리보기</button></div>
                <div className="rw-secondary-actions"><button type="button" disabled={!p.ready || blocked} onClick={() => p.onPreview('itinerary', true)}>PDF 저장</button><button type="button" disabled={blocked || !p.ready || !p.canPublish} onClick={p.onPublish}>{p.published ? '공개 상태 확인' : '고객에게 공개'}</button><button type="button" disabled={blocked || !p.ready || !p.canPublish} onClick={() => p.onCopy('itinerary')}>{p.copied === 'itinerary-message' ? '안내문 복사됨' : '카카오톡 안내문 복사'}</button></div>
                {!p.canPublish && <p className="rw-inline-note">예약금 확인 후 예약이 확정되면 공개할 수 있습니다.</p>}
                <div className="rw-delivery"><span>{p.itineraryChanged ? '수정 후 재안내 필요' : p.itinerarySent ? `메일 발송 완료${p.itinerarySentAt ? ` · ${p.itinerarySentAt}` : ''}` : '메일 미발송'}</span><button type="button" className="btn btn-sm btn-blue" disabled={blocked || p.hasUnsavedChanges || !p.ready || !p.canPublish || !p.email} onClick={() => p.onSend('itinerary')}>{p.itineraryChanged ? '수정본 메일 발송' : p.itinerarySent ? '메일 재발송' : '일정표 메일 발송'}</button></div>
            </article>
            <article className="rw-document-card">
                <div className="row" style={{ justifyContent: 'space-between' }}><h3>여행 계약서</h3><span className={`badge ${p.signed ? 'b-green' : 'b-amber'}`}>{p.signed ? '고객 동의 완료' : p.contractSent ? '고객 동의 대기' : '전달 대기'}</span></div>
                <p>예약 금액과 여행 기간을 확인하고 고객 동의를 받으세요.</p>
                <div className="rw-contract-summary"><span>여행자 정보</span><strong>{p.travelerCount}명 입력됨</strong><span>계약 동의</span><strong>{p.signed ? '완료' : '미완료'}</strong></div>
                <div className="rw-primary-actions"><button type="button" className="btn btn-ink" disabled={p.disabled || p.sending || p.applyingTemplate} onClick={() => p.onEdit('contract')}>계약 조건 편집</button><button type="button" className="btn btn-ghost" disabled={blocked} onClick={() => p.onPreview('contract')}>고객 계약서 확인</button></div>
                <div className="rw-secondary-actions"><button type="button" disabled={blocked} onClick={() => p.onPreview('contract', true)}>PDF 저장</button><button type="button" disabled={blocked} onClick={() => p.onCopy('contract')}>{p.copied === 'contract-message' ? '안내문 복사됨' : '카카오톡 서명 요청문 복사'}</button></div>
                <p className="rw-inline-note">고객이 계약서에서 여행자·항공편 정보를 작성하고 동의하면 아래 주문 정보에 반영됩니다.</p>
                <div className="rw-delivery"><span>{p.contractChanged ? '수정 후 재안내 필요' : p.contractSent ? `메일 발송 완료${p.contractSentAt ? ` · ${p.contractSentAt}` : ''}` : '메일 미발송'}</span><button type="button" className="btn btn-sm btn-blue" disabled={blocked || !p.email} onClick={() => p.onSend('contract')}>{p.contractChanged ? '수정본 메일 발송' : p.contractSent ? '서명 요청 재발송' : '계약서 메일 발송'}</button></div>
            </article>
        </div>
        {p.inlineEditor}
        {p.hasUnsavedChanges && <div className="rw-inline-note" role="status" style={{ padding: '0 24px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}><span>작성 중 초안은 관리자 미리보기로 확인하세요. 고객 공개·발송은 저장 후 사용할 수 있습니다.</span>{p.onDraftPreview && <><button type="button" className="btn btn-ghost btn-sm" disabled={p.sending || p.applyingTemplate} onClick={() => p.onDraftPreview?.('itinerary')}>일정 초안 미리보기</button><button type="button" className="btn btn-ghost btn-sm" disabled={p.sending || p.applyingTemplate} onClick={() => p.onDraftPreview?.('contract')}>계약 초안 미리보기</button></>}</div>}
        {p.days.length > 0 && <details className="rw-schedule-summary"><summary>확정 일정 요약 보기 · {p.days.length}일</summary><div>{p.days.map((day, i) => <div className="rw-day-summary" key={`${day.day}-${i}`}><b>{day.day || i + 1}일차</b><div><strong>{day.title || day.region || '일정 제목 미입력'}</strong><p>{[day.summary, ...(day.activities || []).map(a => [a.time, a.title].filter(Boolean).join(' '))].filter(Boolean).join(' · ') || '상세 일정 미입력'}</p>{day.accommodation?.name && <small>숙소 · {day.accommodation.name}</small>}</div></div>)}</div></details>}
        <div className="rw-document-footer"><p>{p.email ? `메일 수신 · ${p.email}` : '메일 발송을 사용하려면 주문 정보에서 고객 이메일을 입력하세요.'}<br/>안내문 복사는 고객에게 자동 발송되지 않습니다.</p><div className="row" style={{ flexWrap: 'wrap' }}><button type="button" className="btn btn-ghost" disabled={blocked || !p.ready || !p.canPublish} onClick={() => p.onCopy('final')}>{p.copied === 'final-message' ? '복사됨' : '일정표·계약서 안내문 복사'}</button><button type="button" className="btn btn-blue" disabled={blocked || !p.email || (!p.canPublish && p.contractSent) || (p.itinerarySent && p.contractSent && !p.itineraryChanged && !p.contractChanged)} onClick={p.onSendAll}>{p.sending ? '발송 중…' : '미발송·수정본 메일 발송'}</button></div></div>
    </section>;
}
