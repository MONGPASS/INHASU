import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { openKakaoConsultation } from '../../lib/consultation';
import { GuideDetailModal, AccommodationDetailModal } from '../common/DetailModals';
import { toTourDateKey } from '../../utils/formatDate';
import {
    computeDays, formatDateShort, formatDateTime, parseArr, parseImage, paymentSummary, reservationStatusLabel,
    type Accommodation, type ReservationDetail,
} from '../../utils/reservationDetail';
import { BRAND, COMPANY_INFO } from '../../constants/company';
import { MW, MW_FONT_EN, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { DepositReportPanel } from '../mypage-desktop/DepositReportPanel';
import { ICON, TONE } from '../mypage-desktop/myPageTheme';
import { daysUntil } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { D, M_HAIR, M_PAPER } from '../mobile/mobileTheme';
import { Ico, MLoading, SubPageBar } from '../mobile/mobileUi';
import { DETAIL_ICON, HISTORY_ICON, softTone } from './tripFormat';

/** Timeline rows shown before "전체 보기". */
const HISTORY_PREVIEW = 2;

const tile: CSSProperties = { borderRadius: 20, background: '#FFFFFF', border: `1px solid ${MW.line}`, display: 'flex', alignItems: 'center', gap: 14, color: MW.navy, textDecoration: 'none', fontFamily: 'inherit', textAlign: 'left', width: '100%', boxSizing: 'border-box' };

/**
 * 예약 상세 (Claude Design: "M Booking Detail"): ticket card, payment status, documents,
 * guide, stays and timeline. Same query and rules as the PC BookingDetailDesktop.
 */
export function BookingDetailMobile() {
    const navigate = useNavigate();
    const { id = '' } = useParams();
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const [accModal, setAccModal] = useState<{ accommodation: Accommodation; day: number } | null>(null);
    const [today] = useState(() => toTourDateKey(new Date()));

    const { data: reservation, isPending, error } = useQuery<ReservationDetail>({
        queryKey: ['myPage', 'reservation', id],
        enabled: !!id,
        retry: false,
        queryFn: () => api.reservations.get(id),
    });

    const history = useMemo(() => [...(reservation?.history || [])].reverse(), [reservation]);
    const backToList = () => {
        navigate('/mypage/reservations');
        window.scrollTo(0, 0);
    };

    if (isPending) {
        return (
            <MobileShell>
                <SubPageBar title="예약 상세" onBack={backToList} />
                <MLoading pad={120} />
            </MobileShell>
        );
    }
    if (error || !reservation) {
        return (
            <MobileShell>
                <SubPageBar title="예약 상세" onBack={backToList} />
                <section style={{ padding: '72px 20px 96px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>예약을 찾을 수 없습니다</h2>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: MW.mute }}>URL을 확인하시거나 예약 내역에서 선택해 주세요.</p>
                    <button type="button" onClick={backToList} style={{ marginTop: 10, height: 46, padding: '0 22px', border: 0, borderRadius: 999, background: MW.mint, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>
                        예약 내역으로 돌아가기
                    </button>
                </section>
            </MobileShell>
        );
    }

    const number = reservation.reservationNumber || reservation.id.slice(0, 8).toUpperCase();
    const tone = softTone(reservation.status);
    const totalPeople = reservation.totalPeople ?? reservation.travelers ?? 0;
    const start = toTourDateKey(reservation.startDate);
    const end = toTourDateKey(reservation.endDate);
    const duration = computeDays(start, end);
    const dday = start && reservation.status !== 'cancelled' ? daysUntil(start, today) : -1;

    const { pb, depositPaid, balancePaid, paid, percent, depositStage } = paymentSummary(reservation);
    // 고객이 '입금 완료'를 신고했고 담당자 확인을 기다리는 중 → 상태 라벨이 '입금 확인 중'으로 바뀐다.
    const depositReported = depositStage === 'reported';
    const statusLabel = reservationStatusLabel(reservation.status, depositReported);

    // Document links always use the reservation UUID; stored URLs only flag that a document was issued.
    const itineraryUrl = reservation.itineraryUrl && ['confirmed', 'paid', 'completed'].includes(reservation.status) ? `/documents/itinerary/${reservation.id}` : '';
    const contractUrl = reservation.contractUrl ? `/documents/contract/${reservation.id}` : '';

    const guide = reservation.assignedGuide;
    const guideTags = [...parseArr(guide?.languages), ...parseArr(guide?.specialties).slice(0, 2)];
    const stays = reservation.dailyAccommodations || [];
    const visibleHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW);

    return (
        <MobileShell>
            <SubPageBar
                title="예약 상세"
                sub={<span style={{ fontFamily: MW_FONT_EN, fontSize: 10, color: MW.mute2 }}>#{number}</span>}
                onBack={backToList}
                right={(
                    <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 999, background: tone.bg, boxShadow: tone === TONE.plain ? `inset 0 0 0 1px ${tone.bd}` : undefined, fontSize: 12, fontWeight: 700, color: tone.fg, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone.fg }} />
                        {statusLabel}
                    </span>
                )}
            />

            <section style={{ background: M_PAPER, padding: '16px 16px 36px', display: 'flex', flexDirection: 'column', gap: 26 }}>
                {/* Ticket */}
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, background: `linear-gradient(160deg,${MW.mintDeep} 0%,${MW.navySoft} 100%)`, color: '#FFFFFF', padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <span style={{ position: 'absolute', right: -60, top: -60, width: 180, height: 180, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.12)', boxShadow: '0 0 0 22px rgba(255,255,255,0.04),0 0 0 44px rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
                    <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: MW.mintTint }}>
                        <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden="true"><path d={DETAIL_ICON.mountain} fill={MW.mintTint} /></svg>
                        {BRAND.nameEn.toUpperCase()}
                    </span>
                    {/* Two lines instead of the design's single line so real tour names are not cut off. */}
                    <span style={{ position: 'relative', fontSize: 22, fontWeight: 900, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{reservation.productName}</span>
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                            <Ico d={D.calendar} size={18} color="#FFFFFF" style={{ flexShrink: 0 }} />
                            {start ? `${formatDateShort(start)} ~ ${formatDateShort(end)}` : '일정 미정'}
                        </span>
                        {totalPeople > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, fontWeight: 700 }}>
                                <Ico d={D.people} size={18} color="#FFFFFF" />
                                {totalPeople}명
                            </span>
                        )}
                    </div>
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 14, borderTop: '1px dashed rgba(255,255,255,0.35)' }}>
                        <TicketStat label="기간" value={duration ? `${duration.nights}박 ${duration.days}일` : '—'} />
                        {dday >= 0 && <TicketStat label="출발까지" value={dday === 0 ? 'D-DAY' : `D-${dday}`} en align="center" />}
                        <TicketStat label="예약 번호" value={number} en align="flex-end" />
                    </div>
                </div>

                {/* Payment */}
                {pb && (
                    <Block d={DETAIL_ICON.wallet} title="결제 현황">
                        <div style={{ borderRadius: 20, background: '#FFFFFF', border: `1px solid ${MW.line}`, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18 }}>
                                <span style={{ position: 'relative', flexShrink: 0, width: 68, height: 68, borderRadius: '50%', background: `conic-gradient(${MW.mint} 0 ${percent}%,${M_HAIR} ${percent}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ width: 54, height: 54, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600, color: MW.mintDeep }}>{percent}%</span>
                                </span>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 12, color: MW.mute }}>결제 완료</span>
                                    <span style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0 6px', whiteSpace: 'nowrap' }}>
                                        <strong style={{ fontSize: 24, fontWeight: 900 }}>{won(paid)}</strong>
                                        <span style={{ fontSize: 12, color: MW.mute2 }}>/ {won(pb.total)}</span>
                                    </span>
                                    <span style={{ fontSize: 12, color: MW.mute }}>남은 금액 <strong style={{ color: MW.navy }}>{won(Math.max(0, pb.total - paid))}</strong></span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 18px 18px', borderTop: `1px solid ${M_HAIR}` }}>
                                <PayRow label="예약금" sub="계좌이체 (입금 확인 후 확정)" amount={pb.deposit} paid={depositPaid} checking={depositReported} />
                                <PayRow label="현지 결제" sub="현지에서 현금 결제" amount={pb.local} paid={balancePaid} />
                                {depositPaid ? (
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 14, background: MW.chip, fontSize: 13, fontWeight: 700, color: MW.mute2, whiteSpace: 'nowrap' }}>
                                        {balancePaid ? '결제 완료' : '잔금은 현지에서 결제'}
                                    </span>
                                ) : (
                                    // 계좌이체 + 입금 신고 — PC 예약 상세와 같은 패널(useDepositReport)을 쓴다.
                                    <DepositReportPanel reservation={reservation} pc={false} />
                                )}
                            </div>
                        </div>
                    </Block>
                )}

                {/* Documents */}
                <Block d={DETAIL_ICON.folder} title="여행 서류" sub="계약서와 일정표를 확인할 수 있습니다">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <DocTile d={DETAIL_ICON.map} title="확정 일정표" ready="일정과 숙소 확인" pending="준비 중 (담당자가 작성하면 표시됩니다)" href={itineraryUrl} />
                        <DocTile d={D.doc} title="해외여행 계약서" ready="계약 내용과 유의 사항 확인" pending="준비 중 (발행되면 메일로도 알려 드립니다)" href={contractUrl} />
                    </div>
                </Block>

                {/* Guide */}
                <Block d={DETAIL_ICON.guide} title="담당 가이드" sub={guide?.name ? undefined : '출발 2주 전까지 확정됩니다'}>
                    {guide?.name ? (
                        <button type="button" onClick={() => setGuideOpen(true)} style={{ ...tile, padding: 16, cursor: 'pointer' }}>
                            <span style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', background: `linear-gradient(135deg,${MW.mintDeep} 0%,#3FC2A4 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 17, fontWeight: 600, color: '#FFFFFF', flexShrink: 0 }}>
                                {isUsableImage(guide.image) ? <img src={guide.image} alt={guide.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : guide.name.charAt(0)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guide.name}</span>
                                <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[...guideTags, '자세히 보기'].join(' · ')}</span>
                            </span>
                            <Ico d={D.chevron} size={16} color={MW.mute2} style={{ flexShrink: 0 }} />
                        </button>
                    ) : (
                        <Pending d={DETAIL_ICON.user} title="담당 가이드를 배정 중입니다" sub="확정되는 대로 메일과 사이트 알림으로 알려 드립니다" />
                    )}
                </Block>

                {/* Stays */}
                <Block d={DETAIL_ICON.bed} title="숙소" sub={stays.length > 0 ? `${stays.length}박` : '일정 확정 후 날짜별로 확정됩니다'}>
                    {stays.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {stays.map((s) => {
                                const acc = s.accommodation;
                                const img = parseImage(acc?.images);
                                return (
                                    <button key={s.day} type="button" onClick={() => acc && setAccModal({ accommodation: acc, day: s.day })} style={{ ...tile, padding: 12, cursor: 'pointer' }}>
                                        <span style={{ position: 'relative', width: 80, height: 80, borderRadius: 14, overflow: 'hidden', background: MW.chip, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {isUsableImage(img)
                                                ? <img src={img} alt={acc?.name || ''} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                : <Ico d={DETAIL_ICON.bed} size={28} color={MW.mute2} />}
                                        </span>
                                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <span style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap', minWidth: 0 }}>
                                                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#FFFFFF', background: MW.mintDeep, padding: '2px 8px', borderRadius: 6 }}>{s.day}일차</span>
                                                {acc?.type && <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintDeep, background: MW.mintBg, border: `1px solid ${MW.mintTint}`, padding: '1px 8px', borderRadius: 6, overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.type}</span>}
                                            </span>
                                            <span style={{ fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc?.name || '—'}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>자세히 보기 →</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <Pending d={DETAIL_ICON.bed} title="숙소를 준비 중입니다" sub="일정 확정 후 날짜별로 확정됩니다" />
                    )}
                </Block>

                {/* Timeline */}
                {history.length > 0 && (
                    <Block d={DETAIL_ICON.history} title="타임라인">
                        <div style={{ borderRadius: 20, background: '#FFFFFF', border: `1px solid ${MW.line}`, padding: '6px 18px 4px', display: 'flex', flexDirection: 'column' }}>
                            {visibleHistory.map((h, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr)', gap: 12, padding: '14px 0', borderTop: `1px solid ${i ? M_HAIR : 'transparent'}` }}>
                                    <Ico d={HISTORY_ICON[h.type] || ICON.bookings} color={MW.mintDeep} style={{ marginTop: 2 }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: MW.ink2, overflowWrap: 'anywhere' }}>{h.description}</p>
                                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, color: MW.mute2 }}>{formatDateTime(h.timestamp)}</span>
                                    </div>
                                </div>
                            ))}
                            {history.length > HISTORY_PREVIEW && (
                                <button type="button" onClick={() => setShowAllHistory((v) => !v)} style={{ height: 46, border: 0, borderTop: `1px solid ${M_HAIR}`, background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.mute, cursor: 'pointer' }}>
                                    {showAllHistory ? '접기' : `전체 보기 (${history.length}건)`}
                                </button>
                            )}
                        </div>
                    </Block>
                )}

                {/* Help */}
                <div style={{ borderRadius: 22, background: MW.mintBg, border: `1px solid ${MW.mintTint}`, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 40, height: 40, borderRadius: 12, background: MW.mintDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Ico d={DETAIL_ICON.headset} color="#FFFFFF" />
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap' }}>궁금한 점이 있으신가요?</span>
                            <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap' }}>한국어 담당 직원이 24시간 응대</span>
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                        <button type="button" onClick={openKakaoConsultation} style={contactBtn}>
                            <Ico d={DETAIL_ICON.chat} size={18} />
                            카카오톡 상담
                        </button>
                        <a href={`mailto:${COMPANY_INFO.email}`} style={contactBtn}>
                            <Ico d={D.mail} size={18} />
                            메일 상담
                        </a>
                    </div>
                </div>
            </section>

            <GuideDetailModal guide={guide || null} open={guideOpen} onClose={() => setGuideOpen(false)} />
            <AccommodationDetailModal accommodation={accModal?.accommodation || null} day={accModal?.day} open={!!accModal} onClose={() => setAccModal(null)} />
        </MobileShell>
    );
}

const contactBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, border: `1px solid ${MW.line}`, borderRadius: 999, background: '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', boxSizing: 'border-box' };

/** Section with the design's icon heading and optional sub copy. */
function Block({ d, title, sub, children }: { d: string; title: string; sub?: string; children: ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 900 }}>
                    <Ico d={d} color={MW.mintDeep} />
                    {title}
                </h2>
                {sub && <span style={{ fontSize: 12, color: MW.mute, paddingLeft: 28 }}>{sub}</span>}
            </div>
            {children}
        </div>
    );
}

function TicketStat({ label, value, en, align = 'flex-start' }: { label: string; value: string; en?: boolean; align?: 'flex-start' | 'center' | 'flex-end' }) {
    return (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: align, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: MW.mintTint }}>{label}</span>
            <span style={en ? { fontFamily: MW_FONT_EN, fontSize: 14, fontWeight: 600 } : { fontSize: 14, fontWeight: 900 }}>{value}</span>
        </span>
    );
}

/** `checking`: the customer reported the transfer and staff have not confirmed it yet. */
function PayRow({ label, sub, amount, paid, checking }: { label: string; sub: string; amount: number; paid: boolean; checking?: boolean }) {
    const fg = paid ? MW.mintDeep : checking ? TONE.warn.fg : MW.red;
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {label}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: fg, background: paid ? MW.mintTint : checking ? TONE.warn.bg : '#FDECEA', padding: '2px 8px', borderRadius: 999 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: fg }} />
                        {paid ? '결제 완료' : checking ? '입금 확인 중' : '미결제'}
                    </span>
                </span>
                <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap' }}>{sub}</span>
            </span>
            <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 900 }}>{won(amount)}</span>
        </div>
    );
}

/** Document link; a dashed "준비 중" tile until the document has been issued. */
function DocTile({ d, title, ready, pending, href }: { d: string; title: string; ready: string; pending: string; href: string }) {
    const inner = (
        <>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: href ? MW.mintBg : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico d={d} size={22} color={href ? MW.mintDeep : MW.mute2} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', color: href ? MW.navy : MW.mute }}>
                    {title}
                    {!href && <span style={{ fontSize: 10, fontWeight: 700, color: TONE.warn.fg, background: TONE.warn.bg, padding: '2px 6px', borderRadius: 4 }}>준비 중</span>}
                </span>
                <span style={{ fontSize: 11, color: MW.mute, ...(href ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : { lineHeight: 1.5 }) }}>{href ? ready : pending}</span>
            </span>
            {href && <Ico d={D.chevron} size={16} color={MW.mute2} style={{ flexShrink: 0 }} />}
        </>
    );
    if (!href) return <div style={{ ...tile, padding: '14px 16px', background: 'transparent', borderStyle: 'dashed', borderColor: MW.line2 }}>{inner}</div>;
    return <a href={href} style={{ ...tile, padding: '14px 16px' }}>{inner}</a>;
}

/** Placeholder while the guide / stays are still being arranged. */
function Pending({ d, title, sub }: { d: string; title: string; sub: string }) {
    return (
        <div style={{ padding: '26px 20px', border: `1.5px dashed ${MW.line2}`, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', border: `1px solid ${MW.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <Ico d={d} size={24} color={MW.mintDeep} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
            <span style={{ fontSize: 12, color: MW.mute, lineHeight: 1.5 }}>{sub}</span>
        </div>
    );
}
