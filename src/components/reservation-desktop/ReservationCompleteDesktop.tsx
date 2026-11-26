import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEPOSIT_PAYMENT_METHOD, KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { SD, SIcon } from '../site-seed/seed';
import { bareName, type CompleteStepProps } from '../reservation-shared/bookingShared';
import { AccountPanel, CalIcon, PeopleIcon } from './BookingPartsDesktop';
import { rangeText } from './bookingDesktopText';
import { ReservationShell } from './ReservationShell';

const PROGRESS: { t: string; s: string }[] = [
    { t: '신청 완료', s: '지금' },
    { t: '예약금 입금', s: '고객님 차례' },
    { t: '입금 확인', s: '담당자' },
    { t: '예약 확정', s: '알림톡 발송' },
];

/**
 * PC 예약 3단계 신청 완료(디자인 ‘예약하기 — 3단계 신청 완료 (PC)’):
 * 완료 안내 · 예약 번호 · 진행 4단계 → 왼쪽 ‘지금 할 일’(예약금 · 입금 계좌 복사 · 예약 상세로) + 오른쪽 신청 내용 · 홈으로 · 카카오톡.
 */
export function ReservationCompleteDesktop({ reservationId, productName, reservationNo, total, deposit, local, image, startDate, endDate, people }: CompleteStepProps) {
    const navigate = useNavigate();
    const detail = reservationId ? `/mypage/reservations/${reservationId}` : '/mypage/reservations';
    const range = startDate && endDate ? rangeText(startDate, endDate) : '';

    return (
        <ReservationShell step={3} productName={productName}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <section style={{ background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 20, padding: '36px 40px 32px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
                        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                            <span style={{ flex: 'none', width: 52, height: 52, borderRadius: 16, background: SD.mint50, color: SD.mint500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                            </span>
                            <div>
                                <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 700, color: SD.gray900 }}>예약 신청이 완료됐어요</h2>
                                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: SD.gray600 }}>
                                    마이페이지에서 투어 예약 내역을 확인할 수 있어요.<br />
                                    아래 계좌로 예약금을 입금하면 담당자가 확인한 뒤 <strong style={{ color: SD.gray900 }}>예약이 확정</strong>돼요.
                                </p>
                            </div>
                        </div>
                        {reservationNo && (
                            <div style={{ flex: 'none', textAlign: 'right' }}>
                                <span style={{ display: 'block', fontSize: 12, color: SD.gray600 }}>예약 번호</span>
                                <strong style={{ display: 'block', marginTop: 4, fontSize: 18, letterSpacing: '0.04em', color: SD.gray900 }}>{reservationNo}</strong>
                            </div>
                        )}
                    </div>
                    <ol aria-label="예약 진행 상태" style={{ margin: '32px 0 0', padding: '24px 0 0', borderTop: `1px solid ${SD.gray100}`, listStyle: 'none', display: 'flex' }}>
                        {PROGRESS.map((p, i) => {
                            const done = i === 0;
                            const now = i === 1;
                            return (
                                <li key={p.t} aria-current={now || undefined} style={{ position: 'relative', flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                                    {i < PROGRESS.length - 1 && <span aria-hidden="true" style={{ position: 'absolute', top: 13, left: 'calc(50% + 18px)', right: 'calc(-50% + 18px)', height: 2, background: done ? SD.mint500 : SD.gray200 }} />}
                                    <span style={{ width: 28, height: 28, borderRadius: 9999, boxSizing: 'border-box', background: done ? SD.mint500 : SD.white, border: done ? 'none' : `2px solid ${now ? SD.mint500 : SD.gray200}`,
                                        color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>}
                                        {now && <span style={{ width: 10, height: 10, borderRadius: 9999, background: SD.mint500 }} />}
                                    </span>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <span style={{ fontSize: 14, fontWeight: done || now ? 700 : 500, color: done || now ? SD.gray900 : SD.gray500 }}>{p.t}</span>
                                        <span style={{ fontSize: 11, color: now ? SD.mint700 : SD.gray500 }}>{p.s}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </section>

                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    <section style={{ flex: '1 1 auto', minWidth: 0, background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 20, overflow: 'hidden' }}>
                        <div style={{ padding: '28px 32px 0' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: SD.mint50, color: SD.mint700, fontSize: 12, fontWeight: 700 }}>지금 할 일</span>
                            <h2 style={{ margin: '12px 0 4px', fontSize: 20, fontWeight: 700, color: SD.gray900 }}>예약금을 입금해 주세요</h2>
                            <p style={{ margin: 0, fontSize: 14, color: SD.gray600 }}>입금 후 마이페이지 예약 상세에서 ‘입금 완료’를 눌러 주세요.</p>
                        </div>
                        <div style={{ margin: '24px 32px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 20, borderBottom: `1px dashed ${SD.gray200}` }}>
                            <span style={{ fontSize: 14, color: SD.gray700 }}>입금할 예약금 <span style={{ color: SD.gray500 }}>· {DEPOSIT_PAYMENT_METHOD}</span></span>
                            <span style={{ fontSize: 32, fontWeight: 700, color: SD.mint600, fontVariantNumeric: 'tabular-nums' }}>{won(deposit)}</span>
                        </div>
                        <div style={{ margin: '20px 32px 0' }}><AccountPanel big /></div>
                        <p style={{ margin: '14px 32px 0', fontSize: 12, lineHeight: 1.6, color: SD.gray500 }}>기한 안에 입금이 확인되지 않으면 예약이 취소될 수 있어요. 입금이 확인되면 알림톡으로 확정 소식을 보내 드려요.</p>
                        <div style={{ padding: '24px 32px 28px' }}>
                            <button type="button" onClick={() => navigate(detail)}
                                style={{ width: '100%', height: 52, border: 'none', borderRadius: 10, background: SD.mint700, color: SD.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                                예약 상세에서 입금 완료 알리기
                            </button>
                        </div>
                    </section>

                    <aside aria-label="신청 내용" style={{ flex: '0 0 360px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <section style={{ background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 20, padding: '20px 22px' }}>
                            <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: SD.gray900 }}>신청 내용</h2>
                            <div style={{ display: 'flex', gap: 12, paddingBottom: 16, borderBottom: `1px solid ${SD.gray100}` }}>
                                <span style={{ flex: 'none', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: SD.gray100 }}>
                                    {isUsableImage(image) && <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                </span>
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: SD.gray900, wordBreak: 'keep-all' }}>{productName ? bareName(productName) : '몽골 투어'}</span>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: SD.gray600 }}>
                                        {range && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalIcon />{range}</span>}
                                        {!!people && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PeopleIcon />성인 {people}명</span>}
                                    </span>
                                </span>
                            </div>
                            <Row label="총 여행 금액" sub={people && total % people === 0 ? `${won(total / people)} × ${people}명` : undefined} amount={won(total)} />
                            <Row label="예약금" sub={`${DEPOSIT_PAYMENT_METHOD} · 지금 결제`} amount={won(deposit)} accent />
                            <Row label="현지 지불 잔금" sub="여행 중 가이드에게 현금 전달" amount={won(local)} last />
                        </section>
                        <button type="button" onClick={() => navigate('/')}
                            style={{ width: '100%', height: 52, border: `1px solid ${SD.gray300}`, borderRadius: 10, background: SD.white, color: SD.gray900, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                            홈으로
                        </button>
                        <a href={KAKAO_CHANNEL_CHAT_URL} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, color: SD.gray700, fontSize: 14, textDecoration: 'none' }}>
                            <SIcon name="kakao" size={18} stroke={1.7} />카카오톡으로 물어보기
                        </a>
                    </aside>
                </div>
            </div>
        </ReservationShell>
    );
}

function Row({ label, sub, amount, accent, last }: { label: string; sub?: string; amount: string; accent?: boolean; last?: boolean }): ReactNode {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${SD.gray100}` }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>{label}</span>
                {sub && <span style={{ fontSize: 12, color: SD.gray600 }}>{sub}</span>}
            </span>
            <span style={{ fontSize: accent ? 17 : 15, fontWeight: 700, color: accent ? SD.mint600 : SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{amount}</span>
        </div>
    );
}
