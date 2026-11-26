import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { openKakaoConsultation } from '../../lib/consultation';
import { COMPANY_INFO } from '../../constants/company';
import { useHomeData } from '../../hooks/useHomeData';
import { toTourDateKey } from '../../utils/formatDate';
import { parseImage, type Accommodation, type ReservationDetail } from '../../utils/reservationDetail';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';
import { AccommodationDetailModal, GuideDetailModal } from '../common/DetailModals';
import { DepositReportPanel } from './DepositReportPanel';
import { TripThumb } from './MyPageHome.desktop';
import { DDAY_COLOR, bookingDetailView, boxButton, darkTagStyle, packageLabel, shortStamp, tagStyle } from './myBookingView';

/**
 * PC 예약 상세(Claude Design ‘마이페이지 — 예약 상세’·‘예약 상세 (예약 확정 후)’): 경로 · ← 예약 상세 · 상태 →
 * 왼쪽(상품 카드 · 결제 현황 · 숙소) + 오른쪽(여행 서류 · 담당 가이드 · 타임라인 · 문의). 입금 전에는 결제 현황에 입금 계좌와 ‘입금 완료’ 알리기,
 * 확정 뒤에는 결제 완료 꼬리표와 날짜별 숙소·가이드 카드(누르면 소개 창)가 나온다.
 */
export function BookingDetailDesktop() {
    const navigate = useNavigate();
    const { id = '' } = useParams();
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const [accModal, setAccModal] = useState<{ accommodation: Accommodation; day: number; date: string } | null>(null);
    const [today] = useState(() => toTourDateKey(new Date()));
    const { data: home } = useHomeData();

    const { data: reservation, isPending, error } = useQuery<ReservationDetail>({
        queryKey: ['myPage', 'reservation', id],
        enabled: !!id,
        retry: false,
        queryFn: () => api.reservations.get(id),
    });
    const v = useMemo(() => (reservation ? bookingDetailView(reservation, today) : null), [reservation, today]);
    const go = (to: string) => (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
        window.scrollTo(0, 0);
    };

    if (isPending) {
        return <div style={{ padding: 120, textAlign: 'center', color: SD.gray600, fontSize: 14, background: SD.gray50 }}>불러오는 중…</div>;
    }
    if (error || !reservation || !v) {
        return (
            <section style={{ background: SD.gray50, padding: '96px 24px 120px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: SD.gray900 }}>예약을 찾을 수 없어요</h1>
                <p style={{ margin: 0, fontSize: 14, color: SD.gray600 }}>주소를 확인하시거나 예약 내역에서 골라 주세요.</p>
                <a href="/mypage/reservations" onClick={go('/mypage/reservations')} style={{ ...boxButton('primary', 'medium'), marginTop: 10 }}>예약 내역으로</a>
            </section>
        );
    }

    const product = home.products.find((p) => p.id === reservation.productId);
    const image = product?.mainImages.find(isUsableImage) || '';
    const tags = [packageLabel(product), product?.category || ''].filter(Boolean);
    const { pb, stage } = v;
    const visibleHistory = showAllHistory ? v.history : v.history.slice(0, 3);
    const stayDate = (day: number) => {
        if (!v.start) return '';
        const d = new Date(`${v.start}T00:00:00`);
        d.setDate(d.getDate() + day - 1);
        return `${d.getMonth() + 1}월 ${d.getDate()}일(${'일월화수목금토'[d.getDay()]})`;
    };

    return (
        <main style={{ background: SD.gray50, color: SD.gray900, paddingBottom: 96 }}>
            <div style={{ ...SD_CONTAINER, paddingTop: 20 }}>
                <nav aria-label="현재 위치" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: SD.gray600 }}>
                    <a href="/" onClick={go('/')} style={crumb}>홈</a><span aria-hidden="true">›</span>
                    <a href="/mypage" onClick={go('/mypage')} style={crumb}>마이페이지</a><span aria-hidden="true">›</span>
                    <a href="/mypage/reservations" onClick={go('/mypage/reservations')} style={crumb}>예약 내역</a><span aria-hidden="true">›</span>
                    <span style={{ color: SD.gray900, fontWeight: 700 }}>예약 상세</span>
                </nav>
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <a href="/mypage/reservations" onClick={go('/mypage/reservations')} aria-label="예약 내역으로"
                        style={{ width: 40, height: 40, borderRadius: 9999, border: `1px solid ${SD.gray200}`, background: SD.white, color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SIcon name="chevronLeft" size={20} stroke={1.8} />
                    </a>
                    <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>예약 상세</h1>
                    <span style={{ marginLeft: 'auto', height: 32, padding: '0 14px', borderRadius: 9999, border: `1px solid ${SD.gray200}`, background: SD.white, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 9999, background: v.dot }} />{stage.label}
                    </span>
                </div>
            </div>

            <div style={{ ...SD_CONTAINER, marginTop: 24, display: 'flex', gap: 28, alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {/* 상품 카드 */}
                    <div style={card}>
                        <div style={{ display: 'flex', gap: 20 }}>
                            {image ? <img src={image} alt={reservation.productName} style={{ flex: 'none', width: 160, height: 120, borderRadius: 12, objectFit: 'cover', display: 'block' }} />
                                : <span aria-hidden="true" style={{ flex: 'none', width: 160, height: 120, borderRadius: 12, background: SD.gray100, color: SD.gray400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SIcon name="mapFold" size={36} stroke={1.4} /></span>}
                            <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                                {tags.length > 0 && <span style={{ display: 'flex', gap: 6 }}>{tags.map((t) => <span key={t} style={tagStyle}>{t}</span>)}</span>}
                                {reservation.productId
                                    ? <a href={`/products/${reservation.productId}`} onClick={go(`/products/${reservation.productId}`)} style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.35, color: SD.gray900, textDecoration: 'none' }}>{reservation.productName}</a>
                                    : <span style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.35 }}>{reservation.productName}</span>}
                                <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14, color: SD.gray700 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><SIcon name="calendarPlain" size={16} stroke={1.7} />{v.dates}</span>
                                    {v.people > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><SIcon name="user" size={16} stroke={1.7} />성인 {v.people}명</span>}
                                </span>
                            </div>
                        </div>
                        <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${SD.gray100}`, display: 'flex', marginLeft: -20, marginRight: -20 }}>
                            <Fact label="기간" value={v.length || '—'} />
                            <span style={{ width: 1, background: SD.gray100 }} />
                            <Fact label={v.dd === '여행 중' ? '지금' : '출발까지'} value={v.dd || stage.label} color={v.dd ? DDAY_COLOR : SD.gray500} />
                            <span style={{ width: 1, background: SD.gray100 }} />
                            <Fact label="예약 번호" value={v.number} />
                        </div>
                    </div>

                    {/* 결제 현황 */}
                    {pb && (
                        <section>
                            <SecHead title="결제 현황" />
                            <div style={card}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <span style={{ fontSize: 13, color: SD.gray600 }}>결제 완료</span>
                                        <span style={{ fontSize: 26, fontWeight: 700 }}>{won(v.paid)} <span style={{ fontSize: 14, fontWeight: 500, color: SD.gray500 }}>/ {won(pb.total)}</span></span>
                                    </span>
                                    <span style={{ fontSize: 13, color: SD.gray600 }}>
                                        {v.depositPaid && !v.balancePaid ? '현지에서 낼 잔금' : '남은 금액'} <strong style={{ color: SD.gray900 }}>{won(Math.max(0, pb.total - v.paid))}</strong>
                                    </span>
                                </div>
                                <ProgressBar percent={v.percent} height={8} />
                                <div style={{ marginTop: 8 }}>
                                    <PayRow label="예약금" sub={v.depositPaid ? '무통장입금 · 입금 확인 완료' : v.depositReported ? '무통장입금 · 담당자가 입금을 확인하고 있어요' : '무통장입금 · 입금 확인 후 예약 확정'}
                                        amount={pb.deposit} tag={v.depositPaid ? '결제 완료' : v.depositReported ? '입금 확인 중' : '미결제'} done={v.depositPaid} />
                                    <PayRow label="현지 결제" sub="몽골 도착 후 가이드에게 현금 전달" amount={pb.local}
                                        tag={v.balancePaid ? '결제 완료' : v.depositPaid ? '현지 결제 예정' : '미결제'} done={v.balancePaid} />
                                </div>
                                {v.depositPaid ? (
                                    <p style={{ margin: '14px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: SD.gray700 }}>
                                        <span style={{ color: SD.mint500, display: 'flex' }}><SIcon name="checkRound" size={18} stroke={1.8} /></span>
                                        {v.balancePaid ? '모든 결제가 끝났어요.' : '예약금 입금이 확인되어 예약이 확정됐어요.'}
                                    </p>
                                ) : <DepositReportPanel reservation={reservation} pc />}
                            </div>
                        </section>
                    )}

                    {/* 숙소 */}
                    <section>
                        <SecHead title="숙소" sub={v.stays.length > 0 ? `${v.stays.length}박` : '일정 확정 후 날짜별로 확정돼요'} />
                        {v.stays.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                {v.stays.map((s) => {
                                    const acc = s.accommodation;
                                    const img = parseImage(acc?.images);
                                    return (
                                        <button key={s.day} type="button" onClick={() => acc && setAccModal({ accommodation: acc, day: s.day, date: stayDate(s.day) })} disabled={!acc}
                                            style={{ ...tileBtn, padding: 14, cursor: acc ? 'pointer' : 'default' }}>
                                            <TripThumb src={isUsableImage(img) ? img : ''} alt="" size={72} icon="bedStay" />
                                            <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={darkTagStyle}>{s.day}일차</span>
                                                    {acc?.type && <span style={{ fontSize: 12, color: SD.gray600 }}>{acc.type}</span>}
                                                </span>
                                                <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc?.name || '숙소 준비 중'}</span>
                                            </span>
                                            {acc && <span style={{ flex: 'none', color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : <Pending icon="bedStay" title="숙소를 준비 중이에요" sub="일정이 확정되면 날짜별 숙소를 알려 드려요" />}
                    </section>
                </div>

                <aside aria-label="여행 서류와 문의" style={{ flex: '0 0 360px', display: 'flex', flexDirection: 'column', gap: 32 }}>
                    <section>
                        <SecHead title="여행 서류" />
                        <p style={{ margin: '-6px 0 12px', fontSize: 13, color: SD.gray600 }}>계약서와 일정표를 확인할 수 있어요.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <DocTile icon="mapFold" title="확정 일정표" ready="일정과 숙소를 확인해 보세요" pending="담당자가 작성하면 여기에 표시돼요" href={v.itineraryUrl} />
                            <DocTile icon="quoteDoc" title="해외여행 계약서" ready="계약 내용과 유의 사항을 확인해 보세요" pending="발행되면 메일로도 알려 드려요" href={v.contractUrl} />
                        </div>
                    </section>

                    <section>
                        <SecHead title="담당 가이드" />
                        {v.guide ? (
                            <button type="button" onClick={() => setGuideOpen(true)} style={{ ...tileBtn, padding: 16 }}>
                                <GuideFace src={v.guide.image} size={52} />
                                <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: SD.gray900 }}>{v.guide.name}</span>
                                    <span style={{ fontSize: 12, color: SD.gray600 }}>가이드 소개 보기</span>
                                </span>
                                <span style={{ flex: 'none', color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>
                            </button>
                        ) : (
                            <>
                                <p style={{ margin: '-6px 0 12px', fontSize: 13, color: SD.gray600 }}>출발 2주 전까지 확정돼요.</p>
                                <Pending icon="user" title="담당 가이드를 배정 중이에요" sub="확정되면 메일과 사이트 알림으로 알려 드려요" />
                            </>
                        )}
                    </section>

                    {v.history.length > 0 && (
                        <section>
                            <SecHead title="타임라인" />
                            <div style={{ ...card, padding: 20 }}>
                                <Timeline items={visibleHistory} />
                                {v.history.length > 3 && (
                                    <button type="button" onClick={() => setShowAllHistory((x) => !x)}
                                        style={{ marginTop: 16, paddingTop: 14, width: '100%', border: 'none', borderTop: `1px solid ${SD.gray100}`, background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: SD.gray700, cursor: 'pointer' }}>
                                        {showAllHistory ? '접기' : `전체 보기 (${v.history.length}건)`}
                                    </button>
                                )}
                            </div>
                        </section>
                    )}

                    <section style={{ padding: 20, borderRadius: 16, background: SD.white, border: `1px solid ${SD.gray200}` }}>
                        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>궁금한 점이 있으신가요?</h2>
                        <p style={{ margin: '0 0 14px', fontSize: 13, color: SD.gray600 }}>한국어 담당 직원이 24시간 안에 답변해 드려요.</p>
                        <ContactButtons />
                    </section>
                </aside>
            </div>

            <GuideDetailModal guide={v.guide} open={guideOpen} onClose={() => setGuideOpen(false)} />
            <AccommodationDetailModal accommodation={accModal?.accommodation || null} day={accModal?.day} date={accModal?.date} open={!!accModal} onClose={() => setAccModal(null)} />
        </main>
    );
}

const crumb: CSSProperties = { color: SD.gray600, textDecoration: 'none' };
const card: CSSProperties = { background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 16, padding: 24 };
const tileBtn: CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${SD.gray200}`, borderRadius: 14, background: SD.white,
    fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box', color: SD.gray900,
};

function Fact({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div style={{ flex: '1 1 0', minWidth: 0, padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: SD.gray600 }}>{label}</span>
            <strong style={{ fontSize: 17, color: color || SD.gray900, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</strong>
        </div>
    );
}

function SecHead({ title, sub }: { title: string; sub?: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: SD.gray900 }}>{title}</h2>
            {sub && <span style={{ fontSize: 13, color: SD.gray600 }}>{sub}</span>}
        </div>
    );
}

export function ProgressBar({ percent, height }: { percent: number; height: number }) {
    return (
        <div role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="결제 진행률"
            style={{ marginTop: 12, height, borderRadius: 9999, background: SD.gray100, overflow: 'hidden' }}>
            <span style={{ display: 'block', width: `${percent}%`, height: '100%', background: SD.gray900 }} />
        </div>
    );
}

export function PayRow({ label, sub, amount, tag, done, compact }: { label: string; sub: string; amount: number; tag: string; done: boolean; compact?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: compact ? '14px 0' : '16px 0', borderBottom: `1px solid ${SD.gray100}` }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 8, fontSize: compact ? 14 : 15, fontWeight: 700, color: SD.gray900 }}>
                    {label}<span style={done ? darkTagStyle : tagStyle}>{tag}</span>
                </span>
                <span style={{ fontSize: compact ? 11 : 12, color: SD.gray600 }}>{sub}</span>
            </span>
            <span style={{ flex: 'none', fontSize: compact ? 15 : 16, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums' }}>{won(amount)}</span>
        </div>
    );
}

export function DocTile({ icon, title, ready, pending, href, compact }: { icon: string; title: string; ready: string; pending: string; href: string; compact?: boolean }) {
    const inner = (
        <>
            <span style={{ flex: 'none', width: compact ? 36 : 40, height: compact ? 36 : 40, borderRadius: compact ? 10 : 12, background: SD.gray50, color: href ? SD.gray900 : SD.gray500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name={icon} size={compact ? 18 : 20} stroke={1.7} />
            </span>
            <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: compact ? 2 : 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: href ? SD.gray900 : SD.gray600 }}>
                    {title}{!href && <span style={tagStyle}>준비 중</span>}
                </span>
                <span style={{ fontSize: compact ? 11 : 12, color: SD.gray600 }}>{href ? ready : pending}</span>
            </span>
            {href && <span style={{ flex: 'none', color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>}
        </>
    );
    const box: CSSProperties = { display: 'flex', alignItems: 'center', gap: compact ? 12 : 14, padding: compact ? 14 : 16, border: `1px solid ${SD.gray200}`, borderRadius: compact ? 12 : 14, background: SD.white, textDecoration: 'none' };
    return href ? <a href={href} style={box}>{inner}</a> : <div style={box}>{inner}</div>;
}

export function Pending({ icon, title, sub }: { icon: string; title: string; sub: string }) {
    return (
        <div style={{ padding: '28px 20px', borderRadius: 14, border: `1px dashed ${SD.gray200}`, background: SD.white, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: SD.gray50, color: SD.gray700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SIcon name={icon} size={22} stroke={1.7} /></span>
            <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>{title}</span>
            <span style={{ fontSize: 12, color: SD.gray600 }}>{sub}</span>
        </div>
    );
}

export function GuideFace({ src, size }: { src?: string; size: number }) {
    return (
        <span style={{ flex: 'none', width: size, height: size, borderRadius: 9999, overflow: 'hidden', background: SD.gray100, color: SD.gray500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isUsableImage(src) ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <SIcon name="user" size={Math.round(size * 0.46)} stroke={1.6} />}
        </span>
    );
}

export function Timeline({ items, compact }: { items: Array<{ timestamp: string; description: string }>; compact?: boolean }) {
    return (
        <ol style={{ position: 'relative', margin: 0, padding: 0, listStyle: 'none' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 4, top: 10, bottom: 6, width: 2, background: SD.gray200 }} />
            {items.map((h, i) => (
                <li key={`${h.timestamp}-${i}`} style={{ position: 'relative', padding: `0 0 ${i === items.length - 1 ? 0 : compact ? 18 : 20}px ${compact ? 22 : 24}px` }}>
                    <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 5, width: 10, height: 10, borderRadius: 9999, boxSizing: 'border-box', background: i === 0 ? SD.gray900 : SD.white, border: i === 0 ? 'none' : `2px solid ${SD.gray200}` }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                        <span style={{ fontSize: compact ? 13 : 14, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? SD.gray900 : SD.gray700, lineHeight: 1.5 }}>{h.description}</span>
                        <span style={{ flex: 'none', fontSize: compact ? 11 : 12, color: SD.gray500, fontVariantNumeric: 'tabular-nums' }}>{shortStamp(h.timestamp)}</span>
                    </div>
                </li>
            ))}
        </ol>
    );
}

export function ContactButtons() {
    const btn: CSSProperties = { flex: '1 1 0', height: 44, border: `1px solid ${SD.gray200}`, borderRadius: 12, background: SD.white, color: SD.gray900, fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', cursor: 'pointer' };
    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={openKakaoConsultation} style={btn}><SIcon name="chatBubble" size={16} stroke={1.7} />카카오톡 상담</button>
            <a href={`mailto:${COMPANY_INFO.email}`} style={btn}><SIcon name="mailLine" size={16} stroke={1.7} />메일로 문의</a>
        </div>
    );
}
