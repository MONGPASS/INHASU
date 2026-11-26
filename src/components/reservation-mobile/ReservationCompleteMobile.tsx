import { useNavigate } from 'react-router-dom';
import { DEPOSIT_PAYMENT_METHOD, KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { MobileShell } from '../mobile/MobileShell';
import { SD, SIcon } from '../site-seed/seed';
import { bareName, fmtShort, type CompleteStepProps } from '../reservation-shared/bookingShared';
import { AccountCardMobile, CloseButton, InfoNote, PayBar, StepBars } from './BookingPartsMobile';

const PROGRESS = ['신청 완료', '예약금 입금', '입금 확인', '예약 확정'];

/**
 * 휴대폰 예약 3단계 신청 완료(디자인 ‘예약하기 3단계 신청 완료 — 모바일’):
 * 완료 안내 · 예약 번호 · 진행 4단계 → 지금 할 일(입금 계좌 복사 · 예약금) → 신청 내용 · 홈으로 · 카카오톡 → 아래 ‘입금 완료 알리기’(예약 상세로).
 */
export function ReservationCompleteMobile({ reservationId, productName, reservationNo, total, deposit, local, image, startDate, endDate, people }: CompleteStepProps) {
    const navigate = useNavigate();
    const go = (to: string) => {
        navigate(to);
        window.scrollTo(0, 0);
    };
    const detail = reservationId ? `/mypage/reservations/${reservationId}` : '/mypage/reservations';
    const range = startDate && endDate ? `${fmtShort(startDate)} → ${fmtShort(endDate)}` : '';
    const sub = [range, people ? `성인 ${people}명` : ''].filter(Boolean).join(' · ');

    return (
        <MobileShell title="신청 완료" onBack={() => go('/')} brandHeader={false} footer={false}
            titleAction={<CloseButton onClick={() => go('/')} />}
            bottomBar={<PayBar caption="" label="입금 완료 알리기" onAction={() => go(detail)} />}>
            <div style={{ background: SD.white, color: SD.gray900 }}>
                <StepBars step={3} />

                <section style={{ padding: '28px 20px 24px', borderBottom: `8px solid ${SD.gray50}`, textAlign: 'center' }}>
                    <span style={{ margin: '0 auto', width: 56, height: 56, borderRadius: 9999, background: SD.gray50, color: SD.mint500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    </span>
                    <h1 style={{ margin: '16px 0 8px', fontSize: 22, fontWeight: 700, color: SD.gray900 }}>예약 신청이 완료됐어요</h1>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: SD.gray600 }}>
                        마이페이지에서 투어 예약 내역을 확인할 수 있어요.<br />
                        예약금을 입금하면 담당자가 확인한 뒤 <strong style={{ color: SD.gray900 }}>예약이 확정</strong>돼요.
                    </p>
                    {reservationNo && (
                        <div style={{ marginTop: 16, height: 36, padding: '0 16px', borderRadius: 9999, background: SD.gray50, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: SD.gray600 }}>예약 번호</span>
                            <strong style={{ fontSize: 14, letterSpacing: '0.04em', color: SD.gray900 }}>{reservationNo}</strong>
                        </div>
                    )}
                    <ol aria-label="예약 진행 상태" style={{ margin: '24px 0 0', padding: 0, listStyle: 'none', display: 'flex' }}>
                        {PROGRESS.map((t, i) => {
                            const done = i === 0;
                            const now = i === 1;
                            return (
                                <li key={t} aria-current={now || undefined} style={{ position: 'relative', flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                    {i < PROGRESS.length - 1 && <span aria-hidden="true" style={{ position: 'absolute', top: 11, left: 'calc(50% + 15px)', right: 'calc(-50% + 15px)', height: 2, background: done ? SD.gray900 : SD.gray200 }} />}
                                    <span style={{ width: 24, height: 24, borderRadius: 9999, boxSizing: 'border-box', background: done ? SD.gray900 : SD.white, border: done ? 'none' : `2px solid ${now ? SD.gray900 : SD.gray200}`, color: SD.white,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                                        {now && <span style={{ width: 8, height: 8, borderRadius: 9999, background: SD.gray900 }} />}
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: done || now ? 700 : 500, color: done || now ? SD.gray900 : SD.gray500, whiteSpace: 'nowrap' }}>{t}</span>
                                </li>
                            );
                        })}
                    </ol>
                </section>

                <section style={{ padding: '20px 20px 24px', borderBottom: `8px solid ${SD.gray50}` }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 9999, background: SD.gray50, color: SD.gray900, fontSize: 11, fontWeight: 700 }}>지금 할 일</span>
                    <h2 style={{ margin: '10px 0 4px', fontSize: 18, fontWeight: 700, color: SD.gray900 }}>예약금을 입금해 주세요</h2>
                    <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: SD.gray600 }}>입금 후 마이페이지 예약 상세에서 ‘입금 완료’를 눌러 주세요.</p>
                    <AccountCardMobile deposit={deposit} />
                    <InfoNote>기한 안에 입금이 확인되지 않으면 예약이 취소될 수 있어요. 입금이 확인되면 알림톡으로 확정 소식을 보내 드려요.</InfoNote>
                </section>

                <section style={{ padding: '20px 20px 24px' }}>
                    <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: SD.gray900 }}>신청 내용</h2>
                    <div style={{ display: 'flex', gap: 12, paddingBottom: 14, borderBottom: `1px solid ${SD.gray100}` }}>
                        <span style={{ flex: 'none', width: 60, height: 60, borderRadius: 10, overflow: 'hidden', background: SD.gray100 }}>
                            {isUsableImage(image) && <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: SD.gray900, wordBreak: 'keep-all' }}>{productName ? bareName(productName) : '몽골 투어'}</span>
                            {sub && <span style={{ fontSize: 12, color: SD.gray600 }}>{sub}</span>}
                        </span>
                    </div>
                    <Row label="총 여행 금액" sub={people && total % people === 0 ? `${won(total / people)} × ${people}명` : undefined} amount={won(total)} />
                    <Row label="예약금" sub={`${DEPOSIT_PAYMENT_METHOD} · 지금 결제`} amount={won(deposit)} accent />
                    <Row label="현지 지불 잔금" sub="여행 중 가이드에게 현금 전달" amount={won(local)} last />
                    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => go('/')}
                            style={{ flex: '1 1 0', height: 48, borderRadius: 12, background: SD.white, border: `1px solid ${SD.gray200}`, color: SD.gray900, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                            홈으로
                        </button>
                        <a href={KAKAO_CHANNEL_CHAT_URL} target="_blank" rel="noopener noreferrer"
                            style={{ flex: '1 1 0', height: 48, borderRadius: 12, background: SD.white, border: `1px solid ${SD.gray200}`, boxSizing: 'border-box', color: SD.gray900, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            <SIcon name="kakao" size={16} stroke={1.8} />카카오톡 문의
                        </a>
                    </div>
                </section>
            </div>
        </MobileShell>
    );
}

function Row({ label, sub, amount, accent, last }: { label: string; sub?: string; amount: string; accent?: boolean; last?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${SD.gray100}` }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 13, color: SD.gray600 }}>{label}</span>
                {sub && <span style={{ fontSize: 11, color: SD.gray500 }}>{sub}</span>}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: accent ? SD.mint600 : SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{amount}</span>
        </div>
    );
}
