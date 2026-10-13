import type { CSSProperties } from 'react';
import { DEPOSIT_PAYMENT_METHOD } from '../../constants/company';
import { MW, MW_FONT_EN, MW_GRADIENT, won } from '../desktop-primitives/mwTokens';
import { Ico } from '../mobile/mobileUi';
import { KakaoLink } from './BookingCard';
import { DepositAccountBox } from './DepositAccountBox';
import { BK_D, BK_HAIR, BK_NEXT_STEPS, BK_SOFT, bareName, type CompleteStepProps } from './bookingShared';

interface BookingDoneCardProps extends CompleteStepProps {
    pc: boolean;
    /** Opens the reservation in My Page, where the customer reports the deposit. */
    onMyBookings: () => void;
    onHome: () => void;
}

const rowKey: CSSProperties = { fontSize: 12, color: MW.mute, flexShrink: 0 };

/** 완료 screen (Claude Design: "Booking Done"): thanks, reservation number, deposit account, amounts and what happens next. */
export function BookingDoneCard({ pc, productName, email, reservationNo, total, deposit, local, onMyBookings, onHome }: BookingDoneCardProps) {
    const mark = pc ? 84 : 64;
    return (
        <div style={{ background: '#FFFFFF', borderRadius: pc ? 28 : 20, padding: pc ? '48px 32px 36px' : '32px 20px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: pc ? 18 : 14, textAlign: 'center' }}>
            <span style={{ width: mark, height: mark, borderRadius: '50%', background: MW_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico d={BK_D.tick} size={pc ? 38 : 30} width={2.6} />
            </span>
            <h2 style={{ margin: pc ? '6px 0 0' : '4px 0 0', fontSize: pc ? 26 : 20, fontWeight: 900, lineHeight: 1.45 }}>
                신청해 주셔서{pc ? ' ' : <br />}감사합니다
            </h2>
            <p style={{ margin: 0, fontSize: pc ? 14 : 13, lineHeight: 1.8, color: MW.mute, maxWidth: 460 }}>
                입력하신 이메일 주소
                {email && <>(<strong style={{ color: MW.navy, wordBreak: 'break-all' }}>{email}</strong>)</>}
                로 신청 내용을 보내 드립니다. 아래 계좌로 예약금을 입금하고, 마이페이지에서 '입금 완료'를 알려 주세요.
                <br />
                <strong style={{ color: MW.mintDeep }}>담당자가 확인한 뒤 예약이 확정됩니다.</strong>
            </p>

            {reservationNo && (
                <div style={pc
                    ? { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px', borderRadius: 999, background: MW.mintBg }
                    : { width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 16, background: MW.mintBg }}
                >
                    <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>예약 번호</span>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: pc ? 18 : 16, fontWeight: 600, letterSpacing: '0.04em' }}>{reservationNo}</span>
                </div>
            )}

            <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                <span style={{ fontSize: 13, fontWeight: 900, padding: '2px 0' }}>예약금 입금 계좌 ({DEPOSIT_PAYMENT_METHOD})</span>
                <DepositAccountBox pc={pc} amount={deposit} />
                <span style={{ fontSize: pc ? 12 : 11, lineHeight: 1.7, color: MW.mute }}>
                    입금 후 마이페이지 예약 상세에서 <strong style={{ color: MW.navy }}>'입금 완료'</strong>를 알려 주세요.
                </span>
            </div>

            <div style={{ width: '100%', maxWidth: 560, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: pc ? '6px 20px' : '4px 16px', borderRadius: 18, background: BK_SOFT, textAlign: 'left' }}>
                {productName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: `1px solid ${BK_HAIR}` }}>
                        <span style={rowKey}>선택한 투어</span>
                        <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', lineHeight: 1.5 }}>{bareName(productName)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '12px 0', borderBottom: `1px solid ${BK_HAIR}` }}>
                    <span style={rowKey}>총 여행 경비</span>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600 }}>{won(total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '12px 0', borderBottom: `1px solid ${BK_HAIR}` }}>
                    <span style={rowKey}>예약금 ({DEPOSIT_PAYMENT_METHOD})</span>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600 }}>{won(deposit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '12px 0' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={rowKey}>현지 지불 잔금</span>
                        <span style={{ fontSize: 11, color: MW.mute2 }}>현지에서 현금 결제</span>
                    </span>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600 }}>{won(local)}</span>
                </div>
            </div>

            <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                <span style={{ fontSize: 13, fontWeight: 900, padding: '6px 0 10px' }}>다음 단계</span>
                {BK_NEXT_STEPS.map((s, i) => (
                    <div key={s.t} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: `1px solid ${BK_HAIR}` }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: i ? MW.chip : MW.mint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, color: i ? MW.mute : MW.navy }}>{i + 1}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{s.t}</span>
                            <span style={{ fontSize: pc ? 12 : 11, lineHeight: 1.6, color: MW.mute }}>{s.d}</span>
                        </span>
                    </div>
                ))}
            </div>

            {pc ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                    <button type="button" onClick={onMyBookings} style={{ height: 52, padding: '0 26px', border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>예약 상세에서 입금 완료 알리기</button>
                    <button type="button" onClick={onHome} style={{ height: 52, padding: '0 26px', border: `1.5px solid ${MW.navy}`, borderRadius: 999, background: '#FFFFFF', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>홈으로 돌아가기</button>
                    <KakaoLink label="카카오톡으로 질문하기" height={52} style={{ padding: '0 22px 0 16px', fontSize: 15 }} />
                </div>
            ) : (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <button type="button" onClick={onMyBookings} style={{ height: 50, border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>예약 상세에서 입금 완료 알리기</button>
                    <KakaoLink label="카카오톡으로 질문하기" height={48} style={{ fontSize: 14 }} />
                    <button type="button" onClick={onHome} style={{ height: 46, border: 0, borderRadius: 999, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.mute, cursor: 'pointer' }}>홈으로 돌아가기</button>
                </div>
            )}
        </div>
    );
}
