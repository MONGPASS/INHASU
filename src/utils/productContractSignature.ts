import { assignmentRecord, publicAssignmentContract } from './reservationAssignment.ts';
import { BRAND, COMPANY_INFO, CONTRACT_CANCELLATION_ROWS, CONTRACT_NOTICES, DEPOSIT_ACCOUNT, DEPOSIT_PAYMENT_METHOD, OTHER_NOTICES, PRIVACY_NOTICES } from '../constants/company.ts';

export const PRODUCT_CONTRACT_TERMS_VERSION = 'product-contract-v1-2026-10';
export const MAX_PRODUCT_SIGNATURE_LENGTH = 300_000;
export const PRODUCT_CONTRACT_DEFAULT_SETTINGS = {
    intro: '본 여행 조건서 및 아래 여행 조건에 따라 국외여행 계약을 체결합니다.',
    paymentMethod: DEPOSIT_PAYMENT_METHOD, paymentDeadline: '안내 메일에 기재된 기일까지',
    includedText: '숙박비, 식사비, 전용 차량, 드라이버, 한국어 가이드, 일정표에 기재된 체험 요금',
    excludedText: '국제선 항공권, 해외여행 보험, 개인 경비, 일정표에 기재되지 않은 식사',
    cancellationRows: CONTRACT_CANCELLATION_ROWS,
    signatureNote: '위 내용을 확인하고 이에 동의하여 본 계약을 체결합니다.',
};
export const PRODUCT_CONTRACT_CANCELLATION_PREAMBLE = '본 상품은 현지 숙소·차량 예약이 완료되는 상품으로, 취소 시 국외여행 표준약관 제6조(특약)에 의거하여 아래 규정이 적용됩니다.';
export const productContractTerms = () => ({ defaults: PRODUCT_CONTRACT_DEFAULT_SETTINGS, notices: [...CONTRACT_NOTICES, ...PRIVACY_NOTICES, ...OTHER_NOTICES], company: COMPANY_INFO, depositAccount: DEPOSIT_ACCOUNT, brand: BRAND, cancellationPreamble: PRODUCT_CONTRACT_CANCELLATION_PREAMBLE });
const record = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const text = (value: unknown, limit = 100) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

/** Only a bounded PNG data URL may become an image source or a new stored signature. */
export function productSignatureImage(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length > MAX_PRODUCT_SIGNATURE_LENGTH || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return undefined;
    try {
        const bytes = atob(value.slice(22));
        if (bytes.length < 45 || bytes.length > 225_000 || bytes.slice(0, 8) !== '\x89PNG\r\n\x1a\n' || bytes.slice(12, 16) !== 'IHDR') return undefined;
        const uint32 = (offset: number) => ((bytes.charCodeAt(offset) * 0x1000000) + (bytes.charCodeAt(offset + 1) << 16) + (bytes.charCodeAt(offset + 2) << 8) + bytes.charCodeAt(offset + 3));
        const width = uint32(16), height = uint32(20);
        if (width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 4_000_000 || !bytes.includes('IDAT') || bytes.slice(-8, -4) !== 'IEND') return undefined;
        return value;
    } catch { return undefined; }
}

export function productSignatureRecord(contract: unknown): Record<string, any> | undefined {
    const data = record(contract);
    for (const candidate of [data.signature, data.contract, data]) {
        const signature = record(candidate);
        if ((text(signature.signedAt) && Number.isFinite(Date.parse(signature.signedAt))) || text(signature.signImg, 1) || signature.hasImage === true) return signature;
    }
    return undefined;
}

/** Public metadata is accepted only by views, never when deciding whether to persist a new signature. */
export function productSignatureStatus(contract: unknown, allowPublicMetadata = true) {
    const signature = productSignatureRecord(contract);
    if (!signature) return undefined;
    const signImg = productSignatureImage(signature.signImg);
    return {
        signedAt: Number.isFinite(Date.parse(signature.signedAt)) ? text(signature.signedAt) : '', signerName: text(signature.signerName, 100), termsVersion: text(signature.termsVersion),
        hasImage: !!signImg || (allowPublicMetadata && signature.hasImage === true), ...(signImg ? { signImg } : {}),
    };
}

/** Same link-based contract data as before, with signature evidence kept administrator-only. */
export function publicProductContract(contract: unknown) {
    const data = record(contract), safe = publicAssignmentContract(data);
    const status = productSignatureStatus(data, false);
    delete safe.signature;
    for (const key of ['signImg', 'signedAt', 'signerName', 'termsVersion', 'snapshot', 'ip', 'ua']) delete safe[key];
    if (record(data.contract).signedAt || record(data.contract).signImg || record(data.contract).snapshot) delete safe.contract;
    if (status) {
        const { signImg: _privateImage, ...metadata } = status;
        safe.signature = metadata;
    }
    return safe;
}

export function validateProductSignature(input: unknown) {
    const body = record(input), signerName = text(body.signerName, 100);
    if (body.agree !== true) return { ok: false as const, error: '손서명 제출에 동의해 주세요.', status: 400 as const };
    if (!signerName || signerName.length > 80) return { ok: false as const, error: '서명자 성명을 확인해 주세요.', status: 400 as const };
    if (typeof body.signImg === 'string' && body.signImg.length > MAX_PRODUCT_SIGNATURE_LENGTH) return { ok: false as const, error: '서명 이미지가 너무 큽니다.', status: 413 as const };
    const signImg = productSignatureImage(body.signImg);
    if (!signImg) return { ok: false as const, error: '서명란에 직접 서명해 주세요.', status: 400 as const };
    return { ok: true as const, signerName, signImg };
}

/** General administrator updates may edit resources, never replay stale customer submissions or signature evidence. */
export function preserveProductCustomerEvidence(currentInput: unknown, incomingInput: unknown) {
    const current = assignmentRecord(currentInput), next = { ...assignmentRecord(incomingInput) };
    const customerKeys = Object.keys({ travelers: 0, arrival: 0, departure: 0, agreement: 0, customerSubmittedAt: 0, signature: 0, signImg: 0, signedAt: 0, signerName: 0, termsVersion: 0, snapshot: 0, ip: 0, ua: 0 });
    for (const key of customerKeys) {
        if (Object.prototype.hasOwnProperty.call(current, key)) next[key] = current[key];
        else delete next[key];
    }
    if (productSignatureRecord({ contract: current.contract }) || productSignatureRecord({ contract: next.contract })) {
        if (Object.prototype.hasOwnProperty.call(current, 'contract')) next.contract = current.contract;
        else delete next.contract;
    }
    return next;
}
