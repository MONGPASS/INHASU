import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEPOSIT_PAYMENT_METHOD, DEPOSIT_POLICY, KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { won } from '../desktop-primitives/mwTokens';
import { MobileShell } from '../mobile/MobileShell';
import { SD, SIcon } from '../site-seed/seed';
import { BK_CANCEL_NOTES, BK_PAY_NOTES, durationLabel, fmtShort, type CustomerInfo, type PaymentStepProps } from '../reservation-shared/bookingShared';
import { AccountCardMobile, CloseButton, MSection, PayBar, StepBars } from './BookingPartsMobile';

/**
 * 휴대폰 예약 2단계(디자인 ‘예약하기 2단계 — 모바일’): ① 선택한 여행 정보 ② 예약자 정보 ③ 결제 금액 ④ 예약금 입금 안내 ⑤ 취소 규정·동의
 * → 아래 결제 줄(예약금 · 예약 신청하기, 동의해야 켜짐). 검사·신청·메일은 pages/Payment.tsx(PC와 같은 흐름).
 * 계좌번호는 신청을 마친 뒤 완료 화면·메일·마이페이지에서 안내한다(예전 방침, PC와 같음).
 */
export function PaymentMobile({
    product, isQuote, selectedStartDate, endDate, nights, days, totalPeople, baseOption, priceBreakdown,
    customerInfo, setCustomerInfo, memo, setMemo, agreeToTerms, setAgreeToTerms, isProcessing, fieldError, onFieldEdit, onSubmit, onBack,
}: PaymentStepProps) {
    const navigate = useNavigate();
    const general = fieldError && (fieldError.field === 'form' || fieldError.field === 'date') ? fieldError : null;
    const durationText = durationLabel(nights, days, product.duration);
    const range = selectedStartDate && endDate ? `${fmtShort(selectedStartDate)} → ${fmtShort(endDate)}` : product.duration || '';
    const per = baseOption?.pricePerPerson;
    const depositPer = baseOption?.depositPerPerson ?? 0;
    const balance = Math.max(0, priceBreakdown.local || priceBreakdown.total - priceBreakdown.deposit);

    const errOf = (field: keyof CustomerInfo) => (fieldError?.field === field ? fieldError.msg : undefined);
    const edit = (field: keyof CustomerInfo, value: string) => {
        setCustomerInfo({ ...customerInfo, [field]: value });
        onFieldEdit(field);
    };
    // 글자 16px: 그보다 작으면 iOS가 입력할 때 화면을 확대한다.
    const input = (field: keyof CustomerInfo): CSSProperties => ({
        width: '100%', height: 50, boxSizing: 'border-box', padding: '0 14px', border: `1px solid ${errOf(field) ? SD.red : SD.gray200}`, borderRadius: 12, fontFamily: 'inherit', fontSize: 16,
        color: SD.gray900, background: SD.white, outline: 'none',
    });
    const close = () => navigate(!isQuote && product.id ? `/products/${product.id}` : '/');
    const label = !agreeToTerms ? '약관 동의 필요' : isProcessing ? '처리 중…' : '예약 신청하기';
    const barError = fieldError && fieldError.field !== 'terms' && !general ? fieldError.msg : '';

    return (
        <MobileShell title="예약자 정보·결제" onBack={onBack} brandHeader={false} footer={false}
            titleAction={<CloseButton onClick={close} />}
            bottomBar={(
                <PayBar
                    caption={<><strong style={{ color: SD.gray900 }}>지금 결제</strong> · 예약금</>}
                    amount={won(priceBreakdown.deposit)}
                    label={label}
                    width={170}
                    disabled={!agreeToTerms || isProcessing}
                    onAction={() => { if (!isProcessing) onSubmit(); }}
                    hint={barError ? <span role="alert" style={{ fontSize: 12, fontWeight: 700, color: SD.red }}>{barError}</span> : undefined}
                />
            )}>
            <div style={{ background: SD.white, color: SD.gray900 }}>
                <StepBars step={2} />
                {general && (
                    <div role="alert" data-payment-field={general.field}
                        style={{ margin: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderRadius: 12, background: '#FDECEA', color: '#B3261E', fontSize: 14, fontWeight: 700 }}>
                        <SIcon name="info" size={16} stroke={2} />{general.msg}
                    </div>
                )}

                <MSection no={1} title="선택한 여행 정보">
                    <div style={{ borderRadius: 12, background: SD.gray50 }}>
                        <InfoRow icon={<SIcon name="calendarCheck" size={16} stroke={1.8} />} label="여행 기간" divider>
                            {range}{range && durationText && selectedStartDate && <span style={{ fontWeight: 400, color: SD.gray600 }}> · {durationText}</span>}
                        </InfoRow>
                        <InfoRow icon={<SIcon name="user" size={16} stroke={1.8} />} label="인원">
                            성인 {totalPeople}명{per !== undefined && <span style={{ fontWeight: 400, color: SD.gray600 }}> · 1인 {won(per)}</span>}
                        </InfoRow>
                    </div>
                </MSection>

                <MSection no={2} title="예약자 정보">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Field name="name" label="이름" required error={errOf('name')}>
                            <input type="text" value={customerInfo.name} onChange={(e) => edit('name', e.target.value)} placeholder="홍길동" autoComplete="name" aria-required aria-invalid={!!errOf('name')} style={input('name')} />
                        </Field>
                        <Field name="phone" label="휴대전화 번호" required error={errOf('phone')} note="입금 확인 알림톡을 이 번호로 보내 드려요.">
                            <input type="tel" value={customerInfo.phone} onChange={(e) => edit('phone', e.target.value)} placeholder="010-0000-0000" autoComplete="tel" aria-required aria-invalid={!!errOf('phone')} style={input('phone')} />
                        </Field>
                        <Field name="email" label="이메일" required error={errOf('email')} note="예약 신청 내용을 이 이메일로 보내 드려요.">
                            <input type="email" value={customerInfo.email} onChange={(e) => edit('email', e.target.value)} placeholder="example@email.com" autoComplete="email" aria-required aria-invalid={!!errOf('email')} style={input('email')} />
                        </Field>
                        <Field name="memo" label="요청·특이 사항">
                            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="음식 알레르기, 희망 옵션 등이 있으면 적어 주세요"
                                style={{ width: '100%', height: 96, boxSizing: 'border-box', padding: '12px 14px', border: `1px solid ${SD.gray200}`, borderRadius: 12, fontFamily: 'inherit', fontSize: 16, color: SD.gray900, resize: 'none', outline: 'none' }} />
                        </Field>
                    </div>
                </MSection>

                <MSection no={3} title="결제 금액">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, paddingBottom: 14, borderBottom: `1px solid ${SD.gray100}` }}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 14, color: SD.gray700 }}>총 여행 금액</span>
                            {per !== undefined && <span style={{ fontSize: 12, color: SD.gray600 }}>{won(per)} × {totalPeople}명</span>}
                        </span>
                        <span style={{ fontSize: 17, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums' }}>{won(priceBreakdown.total)}</span>
                    </div>
                    {priceBreakdown.deposit > 0 && (
                        <>
                            <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 12, background: SD.gray50, border: `1px solid ${SD.gray200}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>지금 입금할 예약금</span>
                                    <span style={{ fontSize: 11, color: SD.gray600 }}>{DEPOSIT_PAYMENT_METHOD}{depositPer > 0 ? ` · 1인 ${won(depositPer)} × ${totalPeople}명` : ''}</span>
                                </span>
                                <span style={{ fontSize: 20, fontWeight: 700, color: SD.mint600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(priceBreakdown.deposit)}</span>
                            </div>
                            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <span style={{ fontSize: 14, color: SD.gray700 }}>현지에서 낼 잔금</span>
                                    <span style={{ fontSize: 12, color: SD.gray600 }}>몽골 도착 후 가이드에게 현금 전달</span>
                                </span>
                                <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(balance)}</span>
                            </div>
                        </>
                    )}
                </MSection>

                <MSection no={4} title="예약금 입금 안내" sub="신청 후 안내해 드리는 계좌로 예약금을 입금하면 담당자가 확인하여 입금 확인 알림톡을 보내 드려요.">
                    <AccountCardMobile deposit={priceBreakdown.deposit} showNumber={false} />
                    <ol aria-label="진행 순서" style={{ margin: '16px 0 0', padding: '14px 16px', borderRadius: 12, background: SD.gray50, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {['예약금 입금', '마이페이지에서 ‘입금 완료’ 알림', '담당자 확인 후 예약 확정'].map((t, i) => (
                            <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: SD.gray900 }}>
                                <span style={{ flex: 'none', width: 20, height: 20, borderRadius: 9999, boxSizing: 'border-box', background: i === 0 ? SD.gray900 : SD.white, color: i === 0 ? SD.white : SD.gray700,
                                    border: i === 0 ? 'none' : `1.5px solid ${SD.gray200}`, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                                {t}
                            </li>
                        ))}
                    </ol>
                    <ul style={{ margin: '14px 0 0', padding: '0 0 0 18px', fontSize: 12, lineHeight: 1.8, color: SD.gray600 }}>
                        {BK_PAY_NOTES.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                    <a href={KAKAO_CHANNEL_CHAT_URL} target="_blank" rel="noopener noreferrer"
                        style={{ marginTop: 14, height: 44, borderRadius: 12, background: SD.white, border: `1px solid ${SD.gray200}`, boxSizing: 'border-box', color: SD.gray900, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
                        <SIcon name="kakao" size={16} stroke={1.8} />결제 문의는 카카오톡으로
                    </a>
                </MSection>

                <MSection no={5} title="취소 규정" last dataField="terms">
                    <div style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${SD.gray200}`, borderLeft: `4px solid ${SD.gray900}` }}>
                        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: SD.gray900 }}>예약금은 환불되지 않아요</p>
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: SD.gray700 }}>{DEPOSIT_POLICY}</p>
                    </div>
                    <ul style={{ margin: '12px 0 0', padding: '0 0 0 18px', fontSize: 12, lineHeight: 1.8, color: SD.gray600 }}>
                        {BK_CANCEL_NOTES.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                    <style>{'.bkm-agree:focus-within{outline:2px solid #12B28C;outline-offset:2px}'}</style>
                    <label className="bkm-agree"
                        style={{ position: 'relative', marginTop: 18, padding: 14, border: `1px solid ${agreeToTerms ? SD.gray900 : fieldError?.field === 'terms' ? SD.red : SD.gray200}`, borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={agreeToTerms} onChange={() => { setAgreeToTerms(!agreeToTerms); onFieldEdit('terms'); }}
                            style={{ position: 'absolute', width: 1, height: 1, margin: 0, opacity: 0, pointerEvents: 'none' }} />
                        <span aria-hidden="true" style={{ flex: 'none', width: 22, height: 22, borderRadius: 7, boxSizing: 'border-box', border: agreeToTerms ? 'none' : `1.5px solid ${SD.gray300}`, background: agreeToTerms ? SD.gray900 : SD.white,
                            color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {agreeToTerms && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}
                        </span>
                        <span style={{ fontSize: 13, lineHeight: 1.6, color: SD.gray700 }}>
                            <strong style={{ color: SD.gray900 }}>[필수] 예약 내용과 입금 안내를 확인했으며, 취소 규정에 동의합니다.</strong>{' '}
                            <a href="/terms-of-service" target="_blank" rel="noreferrer" style={{ color: SD.gray700 }}>이용약관</a>·<a href="/privacy-policy" target="_blank" rel="noreferrer" style={{ color: SD.gray700 }}>개인정보처리방침</a>
                        </span>
                    </label>
                    {fieldError?.field === 'terms' && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: SD.red }}>{fieldError.msg}</p>}
                </MSection>
            </div>
        </MobileShell>
    );
}

function InfoRow({ icon, label, children, divider = false }: { icon: ReactNode; label: string; children: ReactNode; divider?: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 14px', borderBottom: divider ? `1px solid ${SD.gray100}` : 'none' }}>
            <span style={{ color: SD.gray700, display: 'flex' }}>{icon}</span>
            <span style={{ flex: 'none', fontSize: 13, color: SD.gray600 }}>{label}</span>
            <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: SD.gray900, textAlign: 'right' }}>{children}</span>
        </div>
    );
}

function Field({ name, label, required, error, note, children }: { name: string; label: string; required?: boolean; error?: string; note?: string; children: ReactNode }) {
    return (
        <label data-payment-field={name} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: SD.gray900 }}>{label} {required && <span style={{ color: SD.gray900 }}>*</span>}</span>
            {children}
            {error && <span role="alert" style={{ fontSize: 12, fontWeight: 700, color: SD.red }}>{error}</span>}
            {note && <span style={{ fontSize: 12, color: SD.gray600 }}>{note}</span>}
        </label>
    );
}
