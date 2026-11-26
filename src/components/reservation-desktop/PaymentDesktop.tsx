import type { CSSProperties, ReactNode } from 'react';
import { DEPOSIT_PAYMENT_METHOD, DEPOSIT_POLICY, KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { MW_STICKY_TOP, won } from '../desktop-primitives/mwTokens';
import { SD, SIcon } from '../site-seed/seed';
import { BK_CANCEL_NOTES, BK_PAY_NOTES, durationLabel, findOption, priceLines, type CustomerInfo, type PaymentStepProps } from '../reservation-shared/bookingShared';
import { AccountPanel, BookingSummaryAside, CalIcon, PeopleIcon, StepSection } from './BookingPartsDesktop';
import { rangeText } from './bookingDesktopText';
import { ReservationShell } from './ReservationShell';

/**
 * PC 예약 2단계(디자인 ‘예약하기 — 2단계 (PC)’): ① 선택한 여행 정보(변경) ② 예약자 정보 ③ 결제 금액 ④ 예약금 입금 안내 ⑤ 취소 규정 · 동의
 * + 오른쪽 예약 요약(동의해야 ‘예약 신청하기’가 켜진다). 상태·검사·신청은 pages/Payment.tsx(휴대폰과 같은 흐름).
 * 계좌번호는 신청을 마친 뒤 완료 화면·메일·마이페이지에서 안내한다(예전 방침 그대로).
 */
export function PaymentDesktop({
    product, isQuote, selectedStartDate, endDate, nights, days, totalPeople, baseOption, priceBreakdown, selectedAccomId, selectedVehicleId,
    customerInfo, setCustomerInfo, memo, setMemo, agreeToTerms, setAgreeToTerms, isProcessing, fieldError, onFieldEdit, onSubmit, onBack,
}: PaymentStepProps) {
    const general = fieldError && (fieldError.field === 'form' || fieldError.field === 'date') ? fieldError : null;
    const durationText = durationLabel(nights, days, product.duration);
    const range = selectedStartDate && endDate ? rangeText(selectedStartDate, endDate) : null;
    const per = baseOption?.pricePerPerson;
    const depositPer = baseOption?.depositPerPerson ?? 0;
    const typeLabel = product.packageType === 'full' ? '풀패키지' : product.packageType === 'value' ? '실속형' : '';
    const balance = Math.max(0, priceBreakdown.total - priceBreakdown.deposit);
    const accom = findOption(product.accommodationOptions, selectedAccomId);
    const vehicle = findOption(product.vehicleOptions, selectedVehicleId);
    const money = { total: priceBreakdown.total, deposit: priceBreakdown.deposit, balance, lines: priceLines(baseOption, totalPeople, accom, vehicle) };

    const errOf = (field: keyof CustomerInfo) => (fieldError?.field === field ? fieldError.msg : undefined);
    const edit = (field: keyof CustomerInfo, value: string) => {
        setCustomerInfo({ ...customerInfo, [field]: value });
        onFieldEdit(field);
    };
    const input = (field: keyof CustomerInfo): CSSProperties => ({
        width: '100%', height: 52, boxSizing: 'border-box', padding: '0 16px', border: `1px solid ${errOf(field) ? SD.red : SD.gray200}`, borderRadius: 12, fontFamily: 'inherit', fontSize: 15,
        color: SD.gray900, background: SD.white, outline: 'none',
    });
    const cta = !agreeToTerms ? '약관에 동의해 주세요' : isProcessing ? '처리 중…' : '예약 신청하기';

    return (
        <ReservationShell step={2} productName={product.name} productId={isQuote ? undefined : product.id} back={{ label: '이전 단계', onClick: onBack }}>
            <style>{'.bk2-input:focus{border-color:#212124 !important}'}</style>
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {general && (
                        <div role="alert" data-payment-field={general.field}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderRadius: 14, background: '#FDECEA', color: '#B3261E', fontSize: 14, fontWeight: 700 }}>
                            <SIcon name="info" size={18} stroke={2} />{general.msg}
                        </div>
                    )}

                    <StepSection no={1} title="선택한 여행 정보"
                        right={!isQuote && <button type="button" onClick={onBack} style={{ flex: 'none', height: 32, padding: '0 12px', border: `1px solid ${SD.gray200}`, borderRadius: 9999, background: SD.white, fontFamily: 'inherit', fontSize: 13, color: SD.gray700, cursor: 'pointer' }}>변경</button>}>
                        <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 12, background: SD.gray50, padding: '4px 20px' }}>
                            <InfoLine icon={<CalIcon />} label="여행 기간">
                                <strong style={{ color: SD.gray900 }}>{range || product.duration || '-'}</strong>
                                {range && durationText && <span style={{ color: SD.gray600 }}> · {durationText}</span>}
                            </InfoLine>
                            <InfoLine icon={<PeopleIcon />} label="인원" last>
                                <strong style={{ color: SD.gray900 }}>성인 {totalPeople}명</strong>
                                {per !== undefined && <span style={{ color: SD.gray600 }}> · 1인 {won(per)}</span>}
                            </InfoLine>
                        </div>
                    </StepSection>

                    <StepSection no={2} title="예약자 정보" sub="예약 확인과 현지 연락에 쓰여요. 여권 영문 이름과 같게 입력해 주세요.">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px 16px' }}>
                            <Field name="name" label="이름" required error={errOf('name')}>
                                <input className="bk2-input" type="text" value={customerInfo.name} onChange={(e) => edit('name', e.target.value)} placeholder="홍길동" autoComplete="name"
                                    aria-required aria-invalid={!!errOf('name')} style={input('name')} />
                            </Field>
                            <Field name="phone" label="휴대전화 번호" required error={errOf('phone')}>
                                <input className="bk2-input" type="tel" value={customerInfo.phone} onChange={(e) => edit('phone', e.target.value)} placeholder="010-0000-0000" autoComplete="tel"
                                    aria-required aria-invalid={!!errOf('phone')} style={input('phone')} />
                            </Field>
                            <Field name="email" label="이메일" required error={errOf('email')} note="예약 신청 내용과 입금 안내를 이 이메일로 보내 드려요." wide>
                                <input className="bk2-input" type="email" value={customerInfo.email} onChange={(e) => edit('email', e.target.value)} placeholder="example@email.com" autoComplete="email"
                                    aria-required aria-invalid={!!errOf('email')} style={input('email')} />
                            </Field>
                            <Field name="memo" label="요청·특이 사항" wide>
                                <textarea className="bk2-input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="음식 알레르기, 희망 옵션 등이 있으면 적어 주세요"
                                    style={{ width: '100%', height: 104, boxSizing: 'border-box', padding: '14px 16px', border: `1px solid ${SD.gray200}`, borderRadius: 12, fontFamily: 'inherit', fontSize: 15, color: SD.gray900, resize: 'none', outline: 'none' }} />
                            </Field>
                        </div>
                    </StepSection>

                    <StepSection no={3} title="결제 금액">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <MoneyLine label="총 여행 금액" sub={per !== undefined ? `${won(per)} × ${totalPeople}명` : undefined} amount={won(priceBreakdown.total)} divider />
                            {priceBreakdown.deposit > 0 && (
                                <MoneyLine
                                    label={<>지금 입금할 예약금<span style={{ marginLeft: 6, height: 20, padding: '0 7px', borderRadius: 6, background: SD.gray50, color: SD.gray900, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>{DEPOSIT_PAYMENT_METHOD}</span></>}
                                    sub={depositPer > 0 ? `1인 ${won(depositPer)} × ${totalPeople}명` : undefined} amount={won(priceBreakdown.deposit)} strong />
                            )}
                            {priceBreakdown.deposit > 0 && <MoneyLine label="현지에서 낼 잔금" sub="여행 중 담당 가이드에게 현금으로 전달" amount={won(balance)} />}
                        </div>
                    </StepSection>

                    <StepSection no={4} title="예약금 입금 안내">
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                            <span style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, background: SD.gray50, color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></svg>
                            </span>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 16, fontWeight: 700, color: SD.gray900 }}>{DEPOSIT_PAYMENT_METHOD}</span>
                                <span style={{ fontSize: 14, lineHeight: 1.7, color: SD.gray600 }}>신청 후 안내해 드리는 계좌로 예약금을 입금하고 마이페이지에서 ‘입금 완료’를 알려 주시면,<br />담당자가 확인한 뒤 예약이 확정돼요.</span>
                            </span>
                        </div>
                        <AccountPanel showNumber={false} />
                        {priceBreakdown.deposit > 0 && (
                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}>
                                <span style={{ fontSize: 14, color: SD.gray700 }}>입금할 예약금</span>
                                <span style={{ fontSize: 20, fontWeight: 700, color: SD.mint600, fontVariantNumeric: 'tabular-nums' }}>{won(priceBreakdown.deposit)}</span>
                            </div>
                        )}
                        <ol aria-label="진행 순서" style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {['예약금 입금', '‘입금 완료’ 알림', '담당자 확인·예약 확정'].map((t, i, all) => (
                                <li key={t} style={{ display: 'contents' }}>
                                    <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, padding: '0 12px', borderRadius: 12, background: SD.gray50, fontSize: 14, fontWeight: 700, color: SD.gray900, whiteSpace: 'nowrap' }}>
                                        <span style={{ flex: 'none', width: 22, height: 22, borderRadius: 9999, background: SD.gray900, color: SD.white, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                                        {t}
                                    </span>
                                    {i < all.length - 1 && <span aria-hidden="true" style={{ flex: 'none', display: 'flex', color: SD.gray400 }}><SIcon name="chevronRight" size={16} stroke={2} /></span>}
                                </li>
                            ))}
                        </ol>
                        <div style={{ marginTop: 16, padding: '18px 20px', borderRadius: 14, border: `1px solid ${SD.gray200}` }}>
                            <p style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: SD.gray900 }}><SIcon name="info" size={16} stroke={1.8} />입금 시 유의 사항</p>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: SD.gray600 }}>
                                {BK_PAY_NOTES.map((t) => <li key={t}>{t}</li>)}
                            </ul>
                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${SD.gray100}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <span style={{ fontSize: 13, color: SD.gray700 }}>결제에 관한 질문은 카카오톡으로 편하게 물어보세요.</span>
                                <a href={KAKAO_CHANNEL_CHAT_URL} target="_blank" rel="noopener noreferrer"
                                    style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 9999, background: SD.white, border: `1px solid ${SD.gray200}`, boxSizing: 'border-box', color: SD.gray900, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                                    <SIcon name="kakao" size={16} stroke={1.8} />카카오톡 문의
                                </a>
                            </div>
                        </div>
                    </StepSection>

                    <StepSection no={5} title="취소 규정">
                        <div style={{ padding: '18px 20px', borderRadius: 14, background: SD.gray50 }}>
                            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: SD.gray900 }}>예약금은 환불되지 않아요</p>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: SD.gray700 }}>{DEPOSIT_POLICY}</p>
                        </div>
                        <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: SD.gray600 }}>
                            {BK_CANCEL_NOTES.map((t) => <li key={t}>{t}</li>)}
                        </ul>
                    </StepSection>

                    <section data-payment-field="terms" style={{ background: SD.white, border: `1px solid ${agreeToTerms ? SD.gray900 : fieldError?.field === 'terms' ? SD.red : SD.gray200}`, borderRadius: 16, padding: '22px 32px' }}>
                        <style>{'.bk2-agree:focus-within{outline:2px solid #12B28C;outline-offset:4px;border-radius:8px}'}</style>
                        <label className="bk2-agree" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                            <input type="checkbox" checked={agreeToTerms} onChange={() => { setAgreeToTerms(!agreeToTerms); onFieldEdit('terms'); }}
                                style={{ position: 'absolute', width: 1, height: 1, margin: 0, opacity: 0, pointerEvents: 'none' }} />
                            <span aria-hidden="true" style={{ flex: 'none', width: 24, height: 24, borderRadius: 6, boxSizing: 'border-box', border: agreeToTerms ? 'none' : `1.5px solid ${SD.gray300}`, background: agreeToTerms ? SD.gray900 : SD.white,
                                color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {agreeToTerms && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}
                            </span>
                            <span style={{ fontSize: 14, lineHeight: 1.7, color: SD.gray700 }}>
                                <strong style={{ color: SD.gray900 }}>[필수] 예약 내용과 예약금 입금 안내를 확인했으며, 취소 규정에 동의합니다.</strong>{' '}
                                <a href="/terms-of-service" target="_blank" rel="noreferrer" style={{ color: SD.gray700 }}>이용약관</a>·<a href="/privacy-policy" target="_blank" rel="noreferrer" style={{ color: SD.gray700 }}>개인정보처리방침</a>
                            </span>
                        </label>
                        {fieldError?.field === 'terms' && <p role="alert" style={{ margin: '8px 0 0 38px', fontSize: 12, fontWeight: 700, color: SD.red }}>{fieldError.msg}</p>}
                    </section>
                </div>

                <BookingSummaryAside
                    product={product}
                    typeLabel={typeLabel}
                    durationText={durationText}
                    range={range ?? (product.duration || null)}
                    people={totalPeople}
                    perText={per !== undefined ? won(per) : undefined}
                    money={money}
                    stickyTop={MW_STICKY_TOP + 24}
                    cta={{ label: cta, onClick: () => { if (!isProcessing) onSubmit(); }, disabled: !agreeToTerms || isProcessing }}
                    note={fieldError && !general && fieldError.field !== 'terms'
                        ? <span role="alert" style={{ color: SD.red, fontWeight: 700 }}>{fieldError.msg}</span>
                        : '신청 후 예약금 입금 계좌를 안내해 드려요.'}
                />
            </div>
        </ReservationShell>
    );
}

function InfoLine({ icon, label, children, last = false }: { icon: ReactNode; label: string; children: ReactNode; last?: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${SD.gray200}` }}>
            <span style={{ flex: 'none', display: 'flex', color: SD.gray700 }}>{icon}</span>
            <span style={{ flex: 'none', width: 64, fontSize: 13, color: SD.gray600 }}>{label}</span>
            <span style={{ fontSize: 15 }}>{children}</span>
        </div>
    );
}

function Field({ name, label, required, error, note, wide, children }: { name: string; label: string; required?: boolean; error?: string; note?: string; wide?: boolean; children: ReactNode }) {
    return (
        <label data-payment-field={name} style={{ gridColumn: wide ? '1 / 3' : undefined, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: SD.gray900 }}>{label} {required && <span style={{ color: SD.red }}>*</span>}</span>
            {children}
            {error && <span role="alert" style={{ fontSize: 12, fontWeight: 700, color: SD.red }}>{error}</span>}
            {note && <span style={{ fontSize: 12, color: SD.gray600 }}>{note}</span>}
        </label>
    );
}

function MoneyLine({ label, sub, amount, strong, divider }: { label: ReactNode; sub?: string; amount: string; strong?: boolean; divider?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingBottom: divider ? 16 : 0, borderBottom: divider ? `1px solid ${SD.gray100}` : 'none' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: strong ? 700 : 400, color: strong ? SD.gray900 : SD.gray700 }}>{label}</span>
                {sub && <span style={{ fontSize: 12, color: SD.gray600 }}>{sub}</span>}
            </span>
            <span style={{ fontSize: strong ? 22 : 17, fontWeight: 700, color: strong ? SD.mint600 : SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{amount}</span>
        </div>
    );
}
