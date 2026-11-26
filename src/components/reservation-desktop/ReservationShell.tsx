import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DesktopLayout } from '../layout-desktop/DesktopLayout';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';
import { bareName, type BookingStepNo } from '../reservation-shared/bookingShared';

/** PC 예약 단계 이름·제목(디자인 ‘예약하기 — 1·2·3단계 (PC)’). 휴대폰은 bookingShared의 BK_HEAD를 쓴다. */
const STEPS = ['예약일·인원 선택', '예약자 정보·결제', '신청 완료'];
const HEAD: Record<BookingStepNo, { title: string; sub: string }> = {
    1: { title: '예약하기', sub: '여행 시작일과 인원을 고르면 결제 금액이 바로 계산돼요.' },
    2: { title: '예약자 정보·결제 확인', sub: '예약자 정보를 입력하고 예약금 입금 방법을 확인해 주세요.' },
    3: { title: '신청 완료', sub: '예약금 입금이 확인되면 예약이 확정돼요.' },
};

interface ReservationShellProps {
    step: BookingStepNo;
    productName?: string;
    /** 상품 상세로 가는 경로(1단계 ‘상품으로’·경로의 상품 이름). */
    productId?: string;
    /** 왼쪽 위 되돌아가기 단추(1단계 ‘상품으로’, 2단계 ‘이전 단계’). 없으면 단추를 뺀다. */
    back?: { label: string; onClick: () => void };
    children: ReactNode;
}

const crumb: CSSProperties = { color: SD.gray600, textDecoration: 'none' };

/**
 * PC 예약 1~3단계 공통 틀: 사이트 머리·바닥 안에 흰 머리 띠(되돌아가기 · 경로 · 제목 · 3단계 막대)와 회색 본문.
 * 단계마다 주소가 바뀌므로(/reservation/:id → /payment → /reservation-complete) 이 틀이 화면을 이어 준다.
 */
export function ReservationShell({ step, productName, productId, back, children }: ReservationShellProps) {
    const navigate = useNavigate();
    const { title, sub } = HEAD[step];
    const name = productName ? bareName(productName) : '';
    const go = (to: string) => (e: { preventDefault: () => void }) => {
        e.preventDefault();
        navigate(to);
    };

    return (
        <DesktopLayout>
            <div style={{ background: SD.gray50, color: SD.gray900 }}>
                <div style={{ background: SD.white, borderBottom: `1px solid ${SD.gray200}` }}>
                    <div style={{ ...SD_CONTAINER, paddingTop: 20, paddingBottom: 28 }}>
                        <nav aria-label="현재 위치" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, fontSize: 13, color: SD.gray600, whiteSpace: 'nowrap' }}>
                            {back && (
                                <button type="button" onClick={back.onClick}
                                    style={{ flex: 'none', height: 34, padding: '0 14px 0 10px', border: `1px solid ${SD.gray200}`, borderRadius: 9999, background: SD.white, display: 'inline-flex', alignItems: 'center', gap: 4,
                                        color: SD.gray900, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                    <SIcon name="chevronLeft" size={16} stroke={2} />{back.label}
                                </button>
                            )}
                            <a href="/" onClick={go('/')} style={crumb}>홈</a>
                            <span aria-hidden="true">›</span>
                            <a href="/products" onClick={go('/products')} style={crumb}>투어 상품</a>
                            {name && (
                                <>
                                    <span aria-hidden="true">›</span>
                                    {productId
                                        ? <a href={`/products/${productId}`} onClick={go(`/products/${productId}`)} style={{ ...crumb, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</a>
                                        : <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>}
                                </>
                            )}
                            <span aria-hidden="true">›</span>
                            <span style={{ color: SD.gray900, fontWeight: 700 }}>예약</span>
                        </nav>
                        <h1 style={{ margin: '24px 0 6px', fontSize: 30, fontWeight: 700, color: SD.gray900 }}>{title}</h1>
                        <p style={{ margin: 0, fontSize: 15, color: SD.gray600 }}>{sub}</p>
                        <ol aria-label="예약 단계" style={{ margin: '28px 0 0', padding: 0, listStyle: 'none', display: 'flex', gap: 12 }}>
                            {STEPS.map((label, i) => {
                                const n = i + 1;
                                const on = n === step;
                                const done = n < step;
                                return (
                                    <li key={label} aria-current={on || undefined} style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <span aria-hidden="true" style={{ height: 4, borderRadius: 9999, background: on || done ? SD.gray900 : SD.gray200 }} />
                                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: on || done ? SD.gray900 : SD.gray400 }}>
                                                STEP {n}
                                                {done && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="완료"><path d="M5 12l5 5 9-10" /></svg>
                                                )}
                                            </span>
                                            <span style={{ fontSize: 15, fontWeight: on ? 700 : 500, color: on ? SD.gray900 : done ? SD.gray700 : SD.gray500 }}>{label}</span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </div>
                <div style={{ ...SD_CONTAINER, paddingTop: 32, paddingBottom: 96 }}>
                    {children}
                </div>
            </div>
        </DesktopLayout>
    );
}
