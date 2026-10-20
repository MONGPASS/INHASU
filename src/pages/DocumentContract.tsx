import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { SEO } from '../components/seo/SEO';
import { BRAND, COMPANY_INFO, DEPOSIT_ACCOUNT, DEPOSIT_PAYMENT_METHOD, resolveCancellationRows, resolveDepositMethod } from '../constants/company';
import '../styles/product-contract-document.css';
import { PRODUCT_CONTRACT_DEFAULT_SETTINGS, productContractTerms, productSignatureRecord, productSignatureStatus } from '../utils/productContractSignature';

export interface ContractTraveler {
    name?: string; passportName?: string; age?: number | string; birthdate?: string; phone?: string; gender?: string;
}
export interface ContractFlight { date?: string; time?: string; flight?: string }
interface ContractData {
    travelers?: ContractTraveler[];
    arrival?: ContractFlight; departure?: ContractFlight;
    region?: string; category?: string; issuedDate?: string;
    agreement?: { agreed?: boolean; name?: string; agreedAt?: string };
    signature?: { signedAt?: string; signerName?: string; termsVersion?: string; signImg?: string; hasImage?: boolean; snapshot?: any };
    customerSubmittedAt?: string;
}
interface ContractSettings {
    intro?: string; paymentMethod?: string; paymentDeadline?: string; includedText?: string; excludedText?: string;
    cancellationRows?: { period: string; fee: string }[]; signatureNote?: string;
}
export interface ContractPageData {
    reservation: {
        id: string; reservationNumber: string | null; productName: string; customerName: string; customerPhone?: string;
        travelers: number; startDate: string; endDate: string; totalPrice: number; depositAmount: number; balanceAmount: number;
        createdAt: string; confirmedAt?: string | null;
    };
    contract: ContractData;
    template?: { id: string; name: string; description?: string; documentSettings?: { contract?: ContractSettings } } | null;
    accommodations: Array<{ day: number; accommodation: { name: string; type?: string; location?: string } }>;
    guide: { name?: string; phone?: string; languages?: any; specialties?: any } | null;
    productIncluded?: string[]; productExcluded?: string[]; contractIncludedOverride?: boolean; contractExcludedOverride?: boolean;
    contractTerms?: ReturnType<typeof productContractTerms>;
    signatureRevision?: string;
}
const fallbackContract = PRODUCT_CONTRACT_DEFAULT_SETTINGS;
const LEGACY_CONTRACT_INTROS = [
    '本旅行条件書および下記の旅行条件に基づき、募集型企画旅行契約を締結いたします。',
    '본 여행 조건서 및 아래의 여행 조건에 따라 모집형 기획여행 계약을 체결합니다.',
    '본 여행 조건서 및 아래 여행 조건에 따라 모집형 기획여행 계약을 체결합니다.',
];
const resolveContractIntro = (saved: unknown): string => {
    const value = typeof saved === 'string' ? saved.trim() : '';
    return !value || LEGACY_CONTRACT_INTROS.includes(value) ? fallbackContract.intro : value;
};
const CANCELLATION_PREAMBLE = '본 상품은 현지 숙소·차량 예약이 완료되는 상품으로, 취소 시 국외여행 표준약관 제6조(특약)에 의거하여 아래 규정이 적용됩니다.';
const fmtDate = (iso?: string | null) => {
    if (!iso) return '-';
    try {
        const date = new Date(iso);
        return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return iso; }
};
const fmtMoment = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    if (!/[T ]\d{1,2}:\d{2}/.test(iso)) return fmtDate(iso);
    return date.toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};
const fmtWon = (amount?: number) => typeof amount === 'number' && Number.isFinite(amount) ? amount.toLocaleString('ko-KR') + '원' : '-';
const splitLines = (value?: string) => (value || '').split(/\r?\n|、|,/).map(value => value.trim()).filter(Boolean);
const dash = (value?: string) => value && String(value).trim() ? String(value) : '-';
const GENDER_KO: Record<string, string> = { '男性': '남성', '女性': '여성', 'その他': '기타' };
const normalizeGender = (value?: string) => value && GENDER_KO[value] || value || '';
const BrandMark = () => <svg width="32" height="32" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="45" rx="13" stroke="currentColor" strokeWidth="1.8" /><path d="M9 33L19 18L26 28L32 20L39 33Z" fill="currentColor" /></svg>;
type ContractRow = { label: string; value: React.ReactNode; note?: string; emphasis?: boolean };
const DetailRows = ({ rows }: { rows: ContractRow[] }) => <dl className="pc-detail-rows">{rows.map((row, index) => <div key={row.label + index}><dt>{row.label}</dt><dd className={row.emphasis ? 'pc-value-strong' : undefined}>{row.value}{row.note && <small>{row.note}</small>}</dd></div>)}</dl>;
const SectionHeading = ({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) => <header className="pc-section-heading"><p>{eyebrow}</p><h2>{children}</h2></header>;
const BlockHeading = ({ children }: { children: React.ReactNode }) => <h3 className="pc-block-heading">{children}</h3>;

export interface ContractDocumentViewProps {
    data: ContractPageData; formTravelers?: ContractTraveler[]; arrival?: ContractFlight; departure?: ContractFlight;
    agreed?: boolean; signerName?: string; saving?: boolean; saved?: boolean;
    onTravelerChange?: (index: number, field: keyof ContractTraveler, value: string) => void;
    onAddTraveler?: () => void; onRemoveTraveler?: (index: number) => void;
    onArrivalChange?: (value: ContractFlight) => void; onDepartureChange?: (value: ContractFlight) => void;
    onAgreedChange?: (value: boolean) => void; onSignerNameChange?: (value: string) => void;
    onSubmit?: () => void | Promise<void>; onPrint?: () => void;
    signaturePad?: React.ReactNode; signatureReady?: boolean;
}

/** Hand signature evidence and historical typed agreements stay distinct. */
export function ContractDocumentView(p: ContractDocumentViewProps) {
    const { data, saving = false, onPrint } = p;
    const signature = productSignatureStatus(data.contract);
    const stored = productSignatureRecord(data.contract)?.snapshot;
    const frozen = stored?.version === 1 && stored.document?.reservation?.id === data.reservation.id ? stored.document as ContractPageData : undefined;
    const displayData = frozen || data;
    const { reservation, guide, template } = displayData;
    const contract = data.contract || {};
    const reviewContract = displayData.contract || {};
    const formTravelers = p.formTravelers ?? contract.travelers ?? [];
    const arrival = p.arrival ?? contract.arrival ?? {};
    const departure = p.departure ?? contract.departure ?? {};
    const agreed = p.agreed === undefined ? contract.agreement?.agreed === true : p.agreed === true;
    const signerName = p.signerName ?? contract.agreement?.name ?? '';
    const submitted = contract.agreement?.agreed === true;
    const terms = displayData.contractTerms || productContractTerms();
    const company = terms.company || COMPANY_INFO, depositAccount = terms.depositAccount || DEPOSIT_ACCOUNT, brand = terms.brand || BRAND;
    const settings = { ...terms.defaults, ...(template?.documentSettings?.contract || {}) };
    const included = displayData.contractIncludedOverride ? displayData.productIncluded || [] : displayData.productIncluded?.length ? displayData.productIncluded : splitLines(settings.includedText);
    const excluded = displayData.contractExcludedOverride ? displayData.productExcluded || [] : displayData.productExcluded?.length ? displayData.productExcluded : splitLines(settings.excludedText);
    const includedDisplay = displayData.contractIncludedOverride ? included : included.length ? included : splitLines(terms.defaults.includedText);
    const excludedDisplay = displayData.contractExcludedOverride ? excluded : excluded.length ? excluded : splitLines(terms.defaults.excludedText);
    const reviewTravelers = frozen ? reviewContract.travelers || [] : formTravelers;
    const reviewArrival = frozen ? reviewContract.arrival || {} : arrival;
    const reviewDeparture = frozen ? reviewContract.departure || {} : departure;
    const issuedDate = reviewContract.issuedDate || reservation.createdAt?.split('T')[0] || '';
    const contractNumber = reservation.reservationNumber || reservation.id.slice(0, 8).toUpperCase();
    const paymentMethod = resolveDepositMethod(settings.paymentMethod);
    const balance = reservation.balanceAmount ?? (reservation.totalPrice - (reservation.depositAmount || 0));
    const prefix = 'pc-' + encodeURIComponent(reservation.id);
    const paymentRows: ContractRow[] = [
        { label: '여행경비', value: fmtWon(reservation.totalPrice), emphasis: true },
        { label: '예약금', value: fmtWon(reservation.depositAmount), note: paymentMethod + ' (입금 확인 후 예약 확정)' },
        { label: '잔금', value: fmtWon(balance), note: '현지에서 현금 결제' },
        { label: '지급 방법', value: '예약금: ' + paymentMethod + ' / 잔금: 현지에서 현금 결제' },
        ...(paymentMethod === DEPOSIT_PAYMENT_METHOD ? [{ label: '입금 계좌', value: depositAccount.bank + ' ' + depositAccount.number + ' (예금주 ' + depositAccount.holder + ')' }] : []),
        { label: '지급 기한', value: settings.paymentDeadline },
    ];
    const renderFlight = (label: string, value: ContractFlight, isDeparture: boolean) => <article className="pc-flight-summary">
        <h4>{label}</h4><DetailRows rows={[
            { label: '날짜', value: value.date ? fmtDate(value.date) : '미입력' },
            { label: isDeparture ? '몽골 출발' : '몽골 도착', value: value.time || '미입력' },
            { label: '항공편명', value: value.flight || '미입력' },
        ]} />
    </article>;
    const renderFlightFields = (label: string, fieldKey: string, value: ContractFlight, onChange?: (value: ContractFlight) => void) => <fieldset className="pc-input-flight">
        <legend>{label}</legend><div className="pc-field-grid">
            <label htmlFor={prefix + fieldKey + '-date'}>날짜<input id={prefix + fieldKey + '-date'} type="date" value={value.date || ''} onChange={event => onChange?.({ ...value, date: event.target.value })} /></label>
            <label htmlFor={prefix + fieldKey + '-time'}>시각<input id={prefix + fieldKey + '-time'} type="time" value={value.time || ''} onChange={event => onChange?.({ ...value, time: event.target.value })} /></label>
            <label className="pc-full-field" htmlFor={prefix + fieldKey + '-flight'}>편명<input id={prefix + fieldKey + '-flight'} value={value.flight || ''} onChange={event => onChange?.({ ...value, flight: event.target.value })} placeholder={fieldKey === 'arrival' ? '예: OM302 (인천→울란바토르)' : '예: OM301 (울란바토르→인천)'} /></label>
        </div>
    </fieldset>;
    return <main className="product-contract-page">
        <div className="product-contract-document">
            <section className="pc-card pc-contract-cover" aria-label="여행 계약 요약">
                <div className="pc-brand-row"><div className="pc-brand"><BrandMark /><span>MONGOLIA<br />MILKY WAY</span></div><span className="pc-document-kind">TRAVEL CONTRACT</span></div>
                <div className="pc-contract-title"><p>MONGOLIA MILKY WAY</p><h1>여행계약서</h1>{signature?.hasImage && signature.signedAt ? <div className="pc-agreement-badge">✓ 손서명 완료<time dateTime={signature.signedAt}>{fmtMoment(signature.signedAt)}</time></div> : submitted && <div className="pc-agreement-badge">✓ 전자 동의 완료{contract.agreement?.agreedAt && <time dateTime={contract.agreement.agreedAt}>{fmtMoment(contract.agreement.agreedAt)}</time>}</div>}</div>
                <DetailRows rows={[
                    { label: '계약자(여행자)', value: reservation.customerName },
                    { label: '여행지', value: reviewContract.region || reservation.productName },
                    { label: '여행 기간', value: fmtDate(reservation.startDate) + ' ~ ' + fmtDate(reservation.endDate) },
                    { label: '인원', value: String(reservation.travelers) + '명' },
                    { label: '예약 확정일', value: reservation.confirmedAt ? fmtDate(reservation.confirmedAt) : '별도 기록 없음' },
                    { label: '여행사', value: brand.name + ' 현지 여행사' },
                ]} />
                <p className="pc-cover-meta">발행일 {fmtDate(issuedDate)} · 계약 번호 {contractNumber}</p>
                <p className="pc-contract-intro">{resolveContractIntro(settings.intro)}</p>
                {signature && <p className="pc-signature-context">{frozen ? '서명 당시 계약 원본입니다. 이후 변경된 여행자·항공 정보는 아래 입력란에서 확인할 수 있습니다.' : '서명 원본은 서명 당시 내용으로 보관됩니다. 이 화면의 예약 정보는 현재 저장된 내용입니다.'}</p>}
            </section>

            <section className="pc-card" aria-label="여행자 항공 금액 정보">
                <SectionHeading eyebrow="CONTRACT DETAILS">여행자 · 항공 · 금액 정보</SectionHeading>
                <div className="pc-document-block"><BlockHeading>여행상품 정보</BlockHeading><DetailRows rows={[
                    { label: '여행상품명', value: reservation.productName }, { label: '여행지역', value: reviewContract.region || '-' },
                    { label: '여행 형태', value: reviewContract.category || '단독 프라이빗 투어' },
                    { label: '가이드', value: guide?.name ? guide.name + (guide.phone ? ' (' + guide.phone + ')' : '') : '한국어 가이드가 동행합니다' },
                    ...paymentRows,
                ]} /></div>
                <div className="pc-document-block"><BlockHeading>항공 정보</BlockHeading><div className="pc-flight-grid">{renderFlight('몽골 도착편', reviewArrival, false)}{renderFlight('몽골 출발편', reviewDeparture, true)}</div></div>
                <div className="pc-document-block"><BlockHeading>여행자 정보</BlockHeading>{reviewTravelers.length ? <div className="pc-traveler-summaries">{reviewTravelers.map((traveler, index) => <article className="pc-traveler-summary" key={index}><h4>여행자 {index + 1}</h4><DetailRows rows={[
                    { label: '성명', value: dash(traveler.name) }, { label: '여권 영문명', value: dash(traveler.passportName) },
                    { label: '생년월일', value: dash(traveler.birthdate) }, { label: '성별', value: normalizeGender(traveler.gender) || '-' },
                    { label: '연락처', value: dash(traveler.phone) },
                ]} /></article>)}</div> : <p className="pc-empty-information">등록된 여행자 상세 정보가 없습니다.</p>}</div>
                {!!displayData.accommodations?.length && <div className="pc-document-block"><BlockHeading>숙박</BlockHeading><div className="pc-stay-list">{displayData.accommodations.map((item, index) => <article key={String(item.day) + index}><span>{item.day}일차</span><div><strong>{item.accommodation?.name || '-'}</strong><p>{[item.accommodation?.type, item.accommodation?.location].filter(Boolean).join(' · ') || '-'}</p></div></article>)}</div></div>}
            </section>

            <section className="pc-card" aria-label="여행 조건과 취소 환불 규정">
                <SectionHeading eyebrow="TRAVEL CONDITIONS">여행 조건·유의 사항</SectionHeading>
                <div className="pc-document-block pc-inclusion-grid"><div><BlockHeading>여행 요금 포함 사항</BlockHeading><ul className="pc-bullet-list">{includedDisplay.map((value, index) => <li key={index}>{value}</li>)}</ul></div><div><BlockHeading>여행 요금 불포함 사항</BlockHeading><ul className="pc-bullet-list is-muted">{excludedDisplay.map((value, index) => <li key={index}>{value}</li>)}</ul></div></div>
                <div className="pc-document-block"><BlockHeading>취소·환불 규정</BlockHeading><p className="pc-terms-intro">{terms.cancellationPreamble || CANCELLATION_PREAMBLE}</p><DetailRows rows={resolveCancellationRows(settings.cancellationRows).map(row => ({ label: row.period, value: row.fee }))} /></div>
                <div className="pc-document-block"><BlockHeading>여행 조건·유의 사항</BlockHeading><ol className="pc-numbered-list">{terms.notices.map((value, index) => <li key={index}>{value}</li>)}</ol></div>
                <p className="pc-signature-note">{settings.signatureNote}</p>
            </section>

            <section className="pc-card pc-company-card" aria-label="여행사와 전자 동의 기록">
                <SectionHeading eyebrow="TRAVEL AGENCY">여행사 · 동의 기록</SectionHeading>
                <DetailRows rows={[
                    { label: '회사명', value: company.nameJa }, { label: '전화번호', value: company.phoneKR },
                    { label: '대표자', value: company.representative || company.ceo }, { label: '등록번호', value: company.registrationNumber },
                    { label: 'Web', value: company.website },
                ]} />
                <div className={'pc-agreement-record' + (submitted ? ' is-complete' : '')}><span>{submitted ? '전자 동의 완료' : '전자 동의 대기'}</span><strong>{submitted ? contract.agreement?.name || '동의자 이름 미등록' : '아래에서 내용을 확인하고 동의해 주세요.'}</strong>{submitted && contract.agreement?.agreedAt && <time dateTime={contract.agreement.agreedAt}>{fmtMoment(contract.agreement.agreedAt)}</time>}</div>
                <section className="pc-stored-signature" aria-label="고객 손서명 기록"><h3>{signature?.hasImage ? '고객 손서명' : signature ? '서명 원본 확인 필요' : '고객 손서명 미등록'}</h3>{signature?.signImg ? <img src={signature.signImg} alt="고객이 직접 작성한 계약서 서명 원본" /> : <p>{signature?.hasImage ? '손서명 원본은 안전하게 보관되어 있습니다. 인증된 관리자만 원본 이미지를 확인할 수 있습니다.' : signature ? '저장된 서명 기록은 있으나 이미지 원본을 확인할 수 없습니다. 담당자에게 확인해 주세요.' : submitted ? '기존 성명 동의 기록은 보존되어 있습니다. 아래에서 손서명을 추가할 수 있습니다.' : '아래 서명란에 직접 서명해 주세요.'}</p>}{signature && <p className="pc-signature-meta">{signature.signerName} · {signature.signedAt ? fmtMoment(signature.signedAt) : '서명 시각 확인 필요'}{signature.termsVersion && <span>약관 버전 {signature.termsVersion}</span>}</p>}</section>
                <button className="pc-button pc-button-secondary pc-no-print" type="button" onClick={onPrint}>인쇄 / PDF 저장</button>
            </section>

            <section className="pc-card pc-customer-form pc-no-print" aria-label="여행자 항공 정보 입력과 동의 제출">
                <SectionHeading eyebrow="CUSTOMER INFORMATION">고객 정보 확인 · 동의</SectionHeading>
                <p className="pc-form-intro">여권 정보와 왕복 항공편을 확인해 주세요. 입력하신 내용은 여행사로 제출됩니다.</p>
                {submitted && <div className="pc-submit-notice" role="status"><strong>제출이 완료되었습니다</strong><p>기재하신 내용을 여행사가 확인한 후 연락드리겠습니다. 변경한 내용은 다시 제출할 수 있습니다.</p></div>}
                <form onSubmit={event => { event.preventDefault(); if (!saving && agreed && signerName.trim() && (signature || p.signatureReady)) void p.onSubmit?.(); }}>
                    <fieldset className="pc-form-fields" disabled={saving}>
                        <legend className="pc-sr-only">여행자와 항공편 입력</legend>
                        {formTravelers.map((traveler, index) => <fieldset className="pc-traveler-input" key={index}>
                            <legend>여행자 {index + 1}</legend>
                            {formTravelers.length > 1 && <button type="button" className="pc-remove-traveler" aria-label={String(index + 1) + '번 여행자 삭제'} onClick={() => p.onRemoveTraveler?.(index)}>삭제</button>}
                            <div className="pc-field-grid">
                                <label htmlFor={prefix + '-name-' + index}>성명<input id={prefix + '-name-' + index} value={traveler.name || ''} onChange={event => p.onTravelerChange?.(index, 'name', event.target.value)} placeholder="홍길동" /></label>
                                <label htmlFor={prefix + '-passport-' + index}>여권 영문명<input id={prefix + '-passport-' + index} value={traveler.passportName || ''} onChange={event => p.onTravelerChange?.(index, 'passportName', event.target.value)} placeholder="HONG GILDONG" /></label>
                                <label htmlFor={prefix + '-birth-' + index}>생년월일<input id={prefix + '-birth-' + index} type="date" value={traveler.birthdate || ''} onChange={event => p.onTravelerChange?.(index, 'birthdate', event.target.value)} /></label>
                                <label htmlFor={prefix + '-gender-' + index}>성별<select id={prefix + '-gender-' + index} value={normalizeGender(traveler.gender)} onChange={event => p.onTravelerChange?.(index, 'gender', event.target.value)}><option value="">선택</option><option value="남성">남성</option><option value="여성">여성</option><option value="기타">기타</option></select></label>
                                <label className="pc-full-field" htmlFor={prefix + '-phone-' + index}>전화번호<input id={prefix + '-phone-' + index} type="tel" value={traveler.phone || ''} onChange={event => p.onTravelerChange?.(index, 'phone', event.target.value)} placeholder="010-1234-5678" /></label>
                            </div>
                        </fieldset>)}
                        <button type="button" className="pc-button pc-add-traveler" onClick={p.onAddTraveler}>+ 여행자 추가</button>
                        <div className="pc-form-flight-heading"><BlockHeading>항공편 정보 (항공권)</BlockHeading><p>공항 픽업·샌딩 준비에 사용합니다. 왕복 항공편의 날짜·시각·편명을 가능한 한 자세히 적어 주세요.</p></div>
                        <div className="pc-flight-grid">{renderFlightFields('도착편 (몽골 도착)', 'arrival', arrival, p.onArrivalChange)}{renderFlightFields('출발편 (몽골 출발)', 'departure', departure, p.onDepartureChange)}</div>
                        <label className="pc-agree-choice" htmlFor={prefix + '-agree'}><input id={prefix + '-agree'} type="checkbox" checked={agreed} onChange={event => p.onAgreedChange?.(event.target.checked)} /><span>여행 계약 내용, 여행 조건, 취소·환불 규정을 확인하였으며, <strong>이에 동의합니다.</strong></span></label>
                        <label className="pc-name-agreement" htmlFor={prefix + '-signer'}>서명 (성명)<input id={prefix + '-signer'} maxLength={80} value={signerName} onChange={event => p.onSignerNameChange?.(event.target.value)} placeholder="성명을 입력해 주세요" /></label>
                        {!signature && <section className="pc-draw-signature" aria-label="직접 손서명 입력"><h3>손서명</h3><p>계약 내용을 확인한 후 아래 칸에 손가락이나 마우스로 직접 서명해 주세요.</p>{p.signaturePad || <p className="pc-signature-placeholder">서명 입력란을 준비하고 있습니다.</p>}</section>}
                        <button className="pc-button pc-submit-button" type="submit" disabled={!agreed || !signerName.trim() || (!signature && !p.signatureReady) || saving}>{saving ? '제출 중...' : signature ? '고객 정보 다시 제출하기' : '동의하고 서명 제출하기'}</button>
                    </fieldset>
                </form>
            </section>
            <footer className="pc-document-footer"><strong>{company.nameEn}</strong><p>{company.website} · {company.email}</p></footer>
        </div>
    </main>;
}

function initialCustomerFields(data: ContractPageData) {
    const contract = data.contract || {};
    const existing = Array.isArray(contract.travelers) ? contract.travelers : [];
    const count = existing.length || Math.max(1, parseInt(String(data.reservation.travelers || '').replace(/[^0-9]/g, '')) || 1);
    return {
        travelers: Array.from({ length: count }, (_, index) => ({
            name: existing[index]?.name || (index === 0 ? data.reservation.customerName : '') || '',
            passportName: existing[index]?.passportName || '', birthdate: existing[index]?.birthdate || '',
            gender: normalizeGender(existing[index]?.gender),
            phone: existing[index]?.phone || (index === 0 ? data.reservation.customerPhone : '') || '',
        })),
        arrival: { date: contract.arrival?.date || '', time: contract.arrival?.time || '', flight: contract.arrival?.flight || '' },
        departure: { date: contract.departure?.date || '', time: contract.departure?.time || '', flight: contract.departure?.flight || '' },
        agreed: contract.agreement?.agreed === true, signerName: contract.agreement?.name || '',
    };
}

export function ContractSignaturePad({ disabled = false, onChange }: { disabled?: boolean; onChange: (image: string) => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stroke = useRef<{ pointer: number; x: number; y: number; length: number } | null>(null);
    const [drawn, setDrawn] = useState(false);
    const clear = () => {
        const canvas = canvasRef.current;
        canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        stroke.current = null; setDrawn(false); onChange('');
    };
    const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return { x: (event.clientX - bounds.left) * event.currentTarget.width / bounds.width, y: (event.clientY - bounds.top) * event.currentTarget.height / bounds.height };
    };
    const finish = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (stroke.current?.pointer !== event.pointerId) return;
        const meaningful = drawn || stroke.current.length >= 8;
        stroke.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (meaningful) { setDrawn(true); onChange(event.currentTarget.toDataURL('image/png')); }
    };
    return <div className={'pc-signature-pad' + (disabled ? ' is-disabled' : '')}>
        <div className="pc-canvas-wrap"><canvas ref={canvasRef} width={900} height={450} aria-label="고객 손서명 작성란" aria-describedby="pc-signature-instruction" tabIndex={0}
            onPointerDown={event => { if (disabled || event.button !== 0) return; event.preventDefault(); const position = point(event); stroke.current = { pointer: event.pointerId, ...position, length: 0 }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={event => {
                const previous = stroke.current;
                if (disabled || !previous || previous.pointer !== event.pointerId) return;
                const position = point(event), context = event.currentTarget.getContext('2d');
                if (!context) return;
                context.strokeStyle = '#0A1F2E'; context.lineWidth = 4; context.lineCap = 'round'; context.lineJoin = 'round';
                context.beginPath(); context.moveTo(previous.x, previous.y); context.lineTo(position.x, position.y); context.stroke();
                previous.length += Math.hypot(position.x - previous.x, position.y - previous.y); previous.x = position.x; previous.y = position.y;
                if (previous.length >= 8) setDrawn(true);
            }}
            onPointerUp={finish} onPointerCancel={finish} />{!drawn && <span className="pc-canvas-hint" aria-hidden="true">여기에 서명</span>}</div>
        <div className="pc-signature-pad-footer"><p id="pc-signature-instruction">직접 그린 서명만 저장됩니다. 실패한 경우 작성한 서명은 유지됩니다.</p><button type="button" disabled={disabled} onClick={clear}>서명 지우기</button></div>
    </div>;
}

export const DocumentContract: React.FC = () => {
    const { reservationId } = useParams();
    const [data, setData] = useState<ContractPageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formTravelers, setFormTravelers] = useState<ContractTraveler[]>([]);
    const [arrival, setArrival] = useState<ContractFlight>({});
    const [departure, setDeparture] = useState<ContractFlight>({});
    const [agreed, setAgreed] = useState(false);
    const [signerName, setSignerName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [signatureReady, setSignatureReady] = useState(false);
    const signatureDraftRef = useRef('');
    const identityRef = useRef(reservationId);
    identityRef.current = reservationId;
    const submitPending = useRef(false);
    const lifecycle = useRef(0);
    const printedRef = useRef(false);
    useEffect(() => {
        let stopped = false;
        lifecycle.current += 1;
        printedRef.current = false;
        submitPending.current = false;
        setLoading(true); setError(null); setData(null); setSaving(false); setSaved(false);
        setFormTravelers([]); setArrival({}); setDeparture({}); setAgreed(false); setSignerName('');
        signatureDraftRef.current = ''; setSignatureReady(false);
        if (!reservationId) { setError('URL을 확인해 주세요.'); setLoading(false); return; }
        (async () => {
            try {
                const result = await api.documents.contract.get(reservationId) as ContractPageData;
                if (stopped || identityRef.current !== reservationId) return;
                if (result?.reservation?.id !== reservationId) throw new Error('요청한 계약서 정보를 확인할 수 없습니다.');
                const fields = initialCustomerFields(result);
                setData(result); setFormTravelers(fields.travelers); setArrival(fields.arrival); setDeparture(fields.departure);
                setAgreed(fields.agreed); setSignerName(fields.signerName); setSaved(fields.agreed);
            } catch (failure: any) {
                if (!stopped && identityRef.current === reservationId) setError(failure.message || '계약서를 불러오지 못했습니다.');
            } finally {
                if (!stopped && identityRef.current === reservationId) setLoading(false);
            }
        })();
        return () => { stopped = true; lifecycle.current += 1; };
    }, [reservationId]);

    useEffect(() => {
        if (loading || error || !data || printedRef.current || data.reservation.id !== reservationId || new URLSearchParams(window.location.search).get('autoprint') !== '1') return;
        let stopped = false;
        requestAnimationFrame(() => { requestAnimationFrame(async () => {
            try { await document.fonts.ready; } catch { /* 시스템 폰트로 출력 */ }
            if (!stopped && !printedRef.current && identityRef.current === reservationId) { printedRef.current = true; window.print(); }
        }); });
        return () => { stopped = true; };
    }, [loading, error, data, reservationId]);

    useEffect(() => {
        const id = 'doc-noto-sans-kr';
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id; link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css';
        document.head.appendChild(link);
    }, []);

    const handleCustomerSubmit = async () => {
        if (submitPending.current || saving) return;
        if (!agreed) { alert('여행 계약 내용에 대한 동의가 필요합니다.'); return; }
        if (!signerName.trim()) { alert('서명란에 성함을 입력해 주세요.'); return; }
        if (!reservationId || !data || data.reservation.id !== reservationId) return;
        const existingSignature = productSignatureStatus(data.contract);
        const signatureImage = signatureDraftRef.current;
        if (!existingSignature && !signatureImage) { alert('서명란에 직접 서명해 주세요.'); return; }
        const submittedId = reservationId;
        const submittedLifecycle = lifecycle.current;
        const isCurrent = () => identityRef.current === submittedId && lifecycle.current === submittedLifecycle;
        const submittedTravelers = formTravelers.map(traveler => ({ ...traveler }));
        const submittedArrival = { ...arrival }, submittedDeparture = { ...departure };
        const agreement = { agreed: true, name: signerName.trim(), agreedAt: new Date().toISOString() };
        submitPending.current = true; setSaving(true);
        try {
            const result = await api.documents.contract.saveCustomer(submittedId, { travelers: submittedTravelers, arrival: submittedArrival, departure: submittedDeparture, agreement,
                ...(!existingSignature ? { signature: { agree: true, signerName: signerName.trim(), signImg: signatureImage, expectedRevision: data.signatureRevision } } : {}),
            });
            if (!isCurrent()) return;
            setSaved(true);
            setData(current => {
                if (current?.reservation.id !== submittedId) return current;
                const returned = result?.contract || {};
                const signature = current.contract.signature && returned.signature ? { ...current.contract.signature, ...returned.signature } : returned.signature || current.contract.signature;
                return { ...current, contract: { ...current.contract, travelers: submittedTravelers, arrival: submittedArrival, departure: submittedDeparture, agreement, ...returned, ...(signature ? { signature } : {}) } };
            });
            signatureDraftRef.current = ''; setSignatureReady(false);
            alert('계약 내용을 제출했습니다.');
        } catch (failure: any) {
            if (isCurrent()) alert('제출에 실패했습니다. ' + (failure.message || ''));
        } finally {
            if (isCurrent()) { submitPending.current = false; setSaving(false); }
        }
    };

    const ready = data?.reservation.id === reservationId;
    return <>
        <SEO title="해외여행 계약서" description="고객님 전용 여행 계약서입니다." robots="noindex, nofollow" />
        {loading || (!error && !ready) ? <main className="product-contract-page pc-load-state" aria-busy="true"><p>계약서를 불러오고 있습니다.</p></main>
            : error || !data ? <main className="product-contract-page pc-load-state"><div role="alert"><h1>계약서를 표시할 수 없습니다</h1><p>{error || 'URL을 확인해 주세요.'}</p></div></main>
            : <ContractDocumentView data={data} formTravelers={formTravelers} arrival={arrival} departure={departure} agreed={agreed} signerName={signerName} saving={saving} saved={saved} signatureReady={signatureReady}
                signaturePad={<ContractSignaturePad key={reservationId} disabled={saving} onChange={image => { signatureDraftRef.current = image; setSignatureReady(!!image); }} />}
                onTravelerChange={(index, field, value) => setFormTravelers(current => current.map((traveler, row) => row === index ? { ...traveler, [field]: value } : traveler))}
                onAddTraveler={() => setFormTravelers(current => [...current, { name: '', passportName: '', birthdate: '', gender: '', phone: '' }])}
                onRemoveTraveler={index => setFormTravelers(current => current.filter((_, row) => row !== index))}
                onArrivalChange={setArrival} onDepartureChange={setDeparture} onAgreedChange={setAgreed} onSignerNameChange={setSignerName}
                onSubmit={handleCustomerSubmit} onPrint={() => { try { window.print(); } catch { /* 인쇄 취소 */ } }} />}
    </>;
};
