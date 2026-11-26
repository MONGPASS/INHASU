import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { won } from '../desktop-primitives/mwTokens';
import { QKakaoLink } from '../estimate-desktop/QuoteSeedParts';
import { SD, SIcon } from '../site-seed/seed';
import { chipStyle } from './myBookingView';
import {
    QUOTE_STEP_NAMES, quoteDays, quoteDocPath, quoteImage, quoteMoney, quotePeriodText, quoteRequestNo, quoteRequestRows, quoteStage, quoteTitle, quoteTokenOf, quoteValidUntil,
    shortDate, type QuoteTab,
} from './myQuoteView';
import type { MyQuote } from './useMyPageData';

/**
 * 마이페이지 견적 내역 · 견적 상세(Claude Design ‘마이페이지 — 견적 내역’). PC는 오른쪽 판에, 휴대폰(`compact`)은 화면 전체에 그린다.
 * 목록 → 줄을 누르면 같은 주소에 `?id=`가 붙어 상세(진행 4단계 · 견적서 요약 · 요청 내용). 견적서 원본·수정 요청·예약 결정은
 * 알림톡과 같은 내 견적 화면(`/내견적.html?t=…`)에서 한다.
 */

type Go = (path: string) => void;

const card: CSSProperties = { background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 16 };
const TABS: Array<{ key: 'all' | QuoteTab; label: string }> = [
    { key: 'all', label: '전체' },
    { key: 'writing', label: '작성 중' },
    { key: 'arrived', label: '견적 도착' },
    { key: 'booked', label: '예약 진행' },
];

function Steps({ step, big, style }: { step: number; big?: boolean; style?: CSSProperties }) {
    return (
        <ol aria-label="견적 진행 상태" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', gap: big ? 10 : 6, ...style }}>
            {QUOTE_STEP_NAMES.map((l, j) => (
                <li key={l} aria-current={j === step || undefined} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: big ? 8 : 6 }}>
                    <span aria-hidden="true" style={{ height: big ? 4 : 3, borderRadius: 9999, background: j <= step ? SD.gray900 : SD.gray200 }} />
                    <span style={{ fontSize: big ? 13 : 12, fontWeight: j === step ? 700 : 500, color: j <= step ? SD.gray900 : SD.gray400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</span>
                </li>
            ))}
        </ol>
    );
}

// ───────────────────────── 목록 ─────────────────────────

export function QuoteListPanel({ quotes, loading, go, onOpen, compact = false }: { quotes: MyQuote[]; loading: boolean; go: Go; onOpen: (q: MyQuote) => void; compact?: boolean }) {
    const [tab, setTab] = useState<'all' | QuoteTab>('all');
    const staged = useMemo(() => quotes.map((q) => ({ q, stage: quoteStage(q) })), [quotes]);
    const count = (k: 'all' | QuoteTab) => (k === 'all' ? staged.length : staged.filter((x) => x.stage.tab === k).length);
    const shown = staged.filter((x) => tab === 'all' || x.stage.tab === tab);
    const link = (to: string) => ({ href: to, onClick: (e: MouseEvent) => { e.preventDefault(); go(to); } });

    const tabs = (
        <div role="tablist" aria-label="견적 상태" className={compact ? 'mq-scroll' : undefined}
            style={compact
                ? { display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '12px 20px', borderBottom: `1px solid ${SD.gray100}` }
                : { marginTop: 20, display: 'flex', gap: 6 }}>
            {compact && <style>{'.mq-scroll::-webkit-scrollbar{display:none}'}</style>}
            {TABS.map((t) => {
                const on = tab === t.key;
                return (
                    <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                        style={{ flex: 'none', height: compact ? 34 : 36, padding: compact ? '0 12px' : '0 14px', borderRadius: 9999, border: `1px solid ${on ? SD.gray900 : SD.gray200}`,
                            background: on ? SD.gray900 : SD.white, color: on ? SD.white : SD.gray700, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {t.label} <span style={{ fontWeight: 500, opacity: 0.7 }}>{loading ? '' : count(t.key)}</span>
                    </button>
                );
            })}
        </div>
    );

    const rows = shown.map(({ q, stage }) => {
        const no = quoteRequestNo(q);
        const people = q.headcount ? (/^\d+명$/.test(q.headcount) ? `성인 ${q.headcount}` : q.headcount) : '';
        const meta = [quotePeriodText(q.period), people].filter(Boolean).join(' · ');
        const sideLabel = stage.tab === 'arrived' ? '견적 도착' : stage.tab === 'booked' ? '예약 금액' : stage.tab === 'writing' ? '견적서 도착' : '';
        const sideValue = stage.tab === 'arrived' ? '견적서 확인' : stage.tab === 'booked' ? (q.booking?.payTotal ? won(q.booking.payTotal) : '진행 중') : stage.tab === 'writing' ? '24시간 이내' : stage.label;
        const open = (e?: MouseEvent) => { e?.preventDefault(); onOpen(q); };
        return (
            <article key={q.id} style={{ padding: compact ? '18px 0' : '22px 0', borderTop: compact ? 'none' : `1px solid ${SD.gray100}`, borderBottom: compact ? `1px solid ${SD.gray100}` : 'none' }}>
                <div style={{ display: 'flex', gap: compact ? 12 : 18, alignItems: compact ? 'center' : 'flex-start' }}>
                    <button type="button" onClick={() => onOpen(q)} aria-label={`${quoteTitle(q.destination)} 상세`}
                        style={{ flex: 'none', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex' }}>
                        <img src={quoteImage(q.destination)} alt="" style={{ width: compact ? 72 : 88, height: compact ? 72 : 88, borderRadius: compact ? 10 : 12, objectFit: 'cover', display: 'block', opacity: stage.tab === 'done' ? 0.6 : 1 }} />
                    </button>
                    <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={chipStyle(stage.chip, compact ? 'sm' : 'md')}>{stage.label}</span>
                            <span style={{ fontSize: 12, color: SD.gray500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {[no && `요청 번호 ${no}`, q.createdAt && `${shortDate(q.createdAt)} 요청`].filter(Boolean).join(' · ')}
                            </span>
                        </span>
                        <a href="#" onClick={open} style={{ fontSize: compact ? 15 : 16, fontWeight: 700, color: SD.gray900, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{quoteTitle(q.destination)}</a>
                        {meta && <span style={{ fontSize: compact ? 12 : 13, color: SD.gray600 }}>{meta}</span>}
                    </div>
                    {compact ? (
                        <span style={{ flex: 'none', color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>
                    ) : (
                        <div style={{ flex: 'none', width: 200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                            <span style={{ textAlign: 'right' }}>
                                {sideLabel && <span style={{ display: 'block', fontSize: 11, color: SD.gray600 }}>{sideLabel}</span>}
                                <strong style={{ display: 'block', marginTop: 2, fontSize: 18, color: stage.tab === 'arrived' || stage.tab === 'booked' ? SD.mint600 : stage.tab === 'done' ? SD.gray500 : SD.gray900 }}>{sideValue}</strong>
                            </span>
                            <button type="button" onClick={() => onOpen(q)}
                                style={stage.tab === 'arrived'
                                    ? { height: 36, padding: '0 16px', border: 'none', borderRadius: 10, background: SD.mint500, color: SD.white, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
                                    : { height: 36, padding: '0 14px', border: `1px solid ${SD.gray200}`, borderRadius: 10, background: SD.white, color: SD.gray700, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                {stage.tab === 'arrived' ? '견적서 보기' : stage.tab === 'booked' ? '예약 보기' : '요청 내용 보기'}
                            </button>
                        </div>
                    )}
                </div>
                {compact && sideLabel && (
                    <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: SD.gray50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ fontSize: 12, color: SD.gray600 }}>{sideLabel}</span>
                        <strong style={{ fontSize: 15, color: stage.tab === 'arrived' || stage.tab === 'booked' ? SD.mint600 : SD.gray900 }}>{sideValue}</strong>
                    </div>
                )}
                {stage.step >= 0 && <Steps step={stage.step} style={{ margin: compact ? '12px 0 0' : '16px 0 0 106px' }} />}
            </article>
        );
    });

    const empty = !loading && shown.length === 0 && (
        <div style={{ padding: compact ? '48px 0 40px' : '48px 20px 40px', borderTop: compact ? 'none' : `1px solid ${SD.gray100}`, textAlign: 'center' }}>
            <span aria-hidden="true" style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 16, background: SD.gray50, color: SD.gray500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name="quoteDoc" size={26} stroke={1.6} />
            </span>
            <p style={{ margin: '16px 0 4px', fontSize: 16, fontWeight: 700, color: SD.gray900 }}>{staged.length === 0 ? '아직 견적 요청이 없어요' : '이 상태의 견적이 없어요'}</p>
            <p style={{ margin: 0, fontSize: 13, color: SD.gray600, lineHeight: 1.6 }}>일정·인원·가고 싶은 곳만 알려 주시면 24시간 안에 견적서를 보내 드려요.</p>
            <a {...link('/custom-estimate')} style={{ marginTop: 20, height: 44, padding: '0 20px', borderRadius: 10, background: SD.mint500, color: SD.white, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>맞춤 견적 요청하기</a>
        </div>
    );

    if (compact) {
        return (
            <div style={{ background: SD.white, color: SD.gray900 }}>
                {tabs}
                <div style={{ padding: '0 20px' }}>
                    {loading ? <p style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: SD.gray600, margin: 0 }}>불러오는 중…</p> : rows}
                    {empty}
                </div>
            </div>
        );
    }
    return (
        <section style={{ ...card, padding: '28px 28px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: SD.gray900 }}>견적 내역 <span style={{ color: SD.gray500 }}>{loading ? '' : staged.length}</span></h2>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: SD.gray600 }}>맞춤 견적 요청과 도착한 견적서를 확인할 수 있어요.</p>
                </div>
                <a {...link('/custom-estimate')} style={{ flex: 'none', height: 40, padding: '0 16px', borderRadius: 10, border: `1px solid ${SD.gray300}`, background: SD.white, color: SD.gray900, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                    <SIcon name="plusLine" size={16} stroke={2} />새 견적 요청
                </a>
            </div>
            {tabs}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
                {loading ? <p style={{ padding: '40px 0', borderTop: `1px solid ${SD.gray100}`, textAlign: 'center', fontSize: 14, color: SD.gray600, margin: 0 }}>불러오는 중…</p> : rows}
                {empty}
            </div>
        </section>
    );
}

// ───────────────────────── 상세 ─────────────────────────

export function QuoteDetailPanel({ q, onBack, compact = false }: { q: MyQuote; onBack: () => void; compact?: boolean }) {
    const stage = quoteStage(q);
    const token = q.source === 'request' ? quoteTokenOf(q.href) : '';
    const no = quoteRequestNo(q);
    const { data, isPending, isError } = useQuery<Record<string, unknown>>({
        queryKey: ['myPage', 'quoteDetail', token],
        enabled: !!token,
        retry: false,
        queryFn: async () => {
            const res = await fetch(`/api/my/${encodeURIComponent(token)}`, { credentials: 'same-origin', cache: 'no-store' });
            const body = await res.json().catch(() => null);
            if (!res.ok || !body?.ok) throw new Error('unavailable');
            return body;
        },
    });
    const hasQuote = !!data?.quote && (stage.tab === 'arrived' || stage.tab === 'booked' || stage.tab === 'done');
    const money = data ? quoteMoney(data) : null;
    const days = data ? quoteDays(data) : [];
    const valid = data ? quoteValidUntil(data) : '';
    const reqRows = data ? quoteRequestRows(data) : [];
    const people = q.headcount ? (/^\d+명$/.test(q.headcount) ? `성인 ${q.headcount}` : q.headcount) : '';
    const mine = q.href;
    const priceRow = (k: string, v: string, sub?: string, last?: boolean) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${SD.gray100}`, fontSize: 14 }}>
            <span style={{ color: SD.gray600 }}>{k}{sub && <span style={{ fontSize: 12, color: SD.gray500 }}> ({sub})</span>}</span>
            <span style={{ fontWeight: 700, color: SD.gray900, textAlign: 'right' }}>{v}</span>
        </div>
    );
    const total = money?.contract?.total || (money && money.perEco ? money.perEco * money.pax : 0);
    const priceRows = money ? [
        ...(money.contract ? [] : [
            money.perEco ? priceRow('1인 금액', `${won(money.perEco)}${money.perFull && money.perFull !== money.perEco ? ` (풀패키지 ${won(money.perFull)})` : ''}`) : null,
        ]),
        priceRow('인원', money.pax ? `${money.pax}명` : people || '-'),
        priceRow('예약금', won(money.contract ? money.contract.deposit : money.deposit * money.pax), '지금 결제 · 무통장입금'),
        priceRow('잔금', money.contract ? won(money.contract.balance) : money.perEco ? won((money.perEco - money.deposit) * money.pax) : '견적서에서 확인', '현지 결제 · 현금', true),
    ].filter(Boolean) : [];

    const header = (
        <section style={compact ? { padding: '20px', borderBottom: `8px solid ${SD.gray50}` } : { ...card, padding: '24px 28px' }}>
            <div style={{ display: 'flex', gap: compact ? 14 : 18, alignItems: 'center' }}>
                <img src={quoteImage(q.destination)} alt="" style={{ flex: 'none', width: compact ? 64 : 72, height: compact ? 64 : 72, borderRadius: 12, objectFit: 'cover', display: 'block' }} />
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={chipStyle(stage.chip)}>{stage.label}</span>
                        <span style={{ fontSize: 12, color: SD.gray500 }}>{[no && `요청 번호 ${no}`, q.createdAt && `${shortDate(q.createdAt)} 요청`].filter(Boolean).join(' · ')}</span>
                    </span>
                    <h2 style={{ margin: 0, fontSize: compact ? 18 : 20, fontWeight: 700, color: SD.gray900, wordBreak: 'keep-all' }}>{quoteTitle(q.destination)}</h2>
                    <span style={{ fontSize: 13, color: SD.gray600 }}>{[quotePeriodText(q.period), people].filter(Boolean).join(' · ')}</span>
                </div>
            </div>
            {stage.step >= 0 && <Steps big step={stage.step} style={{ marginTop: 22 }} />}
        </section>
    );

    const docCard = hasQuote ? (
        <section aria-label="견적서" style={compact ? { padding: '24px 20px', borderBottom: `8px solid ${SD.gray50}` } : { ...card, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: SD.gray500 }}>QUOTATION</span>
                    <h3 style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700, color: SD.gray900 }}>맞춤 견적서</h3>
                    {valid && <p style={{ margin: '4px 0 0', fontSize: 12, color: SD.gray500 }}>유효기간 {valid}</p>}
                </div>
                {token && (
                    <a href={quoteDocPath(token)} target="_blank" rel="noopener noreferrer"
                        style={{ flex: 'none', height: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${SD.gray200}`, color: SD.gray700, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                        <SIcon name="quoteDoc" size={14} stroke={1.8} />견적서·PDF
                    </a>
                )}
            </div>
            {total > 0 && (
                <div style={{ marginTop: 22, padding: compact ? '16px 18px' : '20px 22px', borderRadius: 14, background: SD.gray50, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>{money?.contract ? '총 여행 금액' : '총 여행 금액(실속형)'}</span>
                    <strong style={{ fontSize: compact ? 22 : 28, color: SD.mint600, fontVariantNumeric: 'tabular-nums' }}>{won(total)}</strong>
                </div>
            )}
            {priceRows.length > 0 && <div style={{ marginTop: 8 }}>{priceRows}</div>}
            {days.length > 0 && (
                <>
                    <h4 style={{ margin: '24px 0 10px', fontSize: 15, fontWeight: 700, color: SD.gray900 }}>일정</h4>
                    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                        {days.map((d) => (
                            <li key={d.day} style={{ display: 'flex', gap: 14, padding: '12px 0', borderTop: `1px solid ${SD.gray100}` }}>
                                <span style={{ flex: 'none', width: 52, fontSize: 13, fontWeight: 700, color: SD.gray900 }}>{d.day}</span>
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                    {d.title && <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>{d.title}</span>}
                                    {d.text && <span style={{ fontSize: 13, color: SD.gray700, lineHeight: 1.6 }}>{d.text}</span>}
                                </span>
                            </li>
                        ))}
                    </ol>
                </>
            )}
            <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
                <a href={mine} style={{ flex: '1 1 0', height: 52, borderRadius: 12, border: `1px solid ${SD.gray300}`, color: SD.gray900, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>수정 요청하기</a>
                <a href={mine} style={{ flex: '2 1 0', height: 52, borderRadius: 12, background: SD.mint500, color: SD.white, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                    {stage.tab === 'booked' ? '예약 진행 보기' : '이 견적으로 예약하기'}
                </a>
            </div>
        </section>
    ) : (
        <section aria-label="견적서" style={compact ? { padding: '40px 20px', textAlign: 'center', borderBottom: `8px solid ${SD.gray50}` } : { ...card, padding: '56px 28px', textAlign: 'center' }}>
            <span aria-hidden="true" style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 9999, background: SD.gray50, border: `1px solid ${SD.gray200}`, color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name={stage.tab === 'done' ? 'quoteDoc' : 'historyBack'} size={24} stroke={1.7} />
            </span>
            <h3 style={{ margin: '18px 0 6px', fontSize: 18, fontWeight: 700, color: SD.gray900 }}>{stage.tab === 'done' ? '종료된 견적이에요' : isPending && token ? '불러오는 중…' : '견적서를 준비하고 있어요'}</h3>
            {stage.tab !== 'done' && (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: SD.gray600 }}>담당자가 요청 내용을 확인하고 있어요.<br />영업시간 기준 24시간 이내에 카카오 알림톡으로 알려 드려요.</p>
            )}
            {isError && <p style={{ margin: '10px 0 0', fontSize: 12, color: SD.gray500 }}>자세한 내용은 내 견적 화면에서 확인할 수 있어요.</p>}
            <a href={mine} style={{ marginTop: 22, height: 44, padding: '0 18px', borderRadius: 10, border: `1px solid ${SD.gray300}`, color: SD.gray900, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                {q.source === 'request' ? '내 견적 화면에서 보기' : '견적 보기'}
            </a>
        </section>
    );

    const reqCard = (
        <section style={compact ? { padding: '20px 20px 12px', borderBottom: `8px solid ${SD.gray50}` } : { ...card, padding: '22px 24px 10px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: SD.gray900 }}>요청 내용</h3>
            <dl style={{ margin: 0 }}>
                {(reqRows.length ? reqRows : ([['지역', q.destination || '-'], ['여행 기간', q.period || '-'], ['인원', people || '-']] as Array<[string, string]>)).map(([k, v], i, all) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: i === all.length - 1 ? 'none' : `1px solid ${SD.gray100}`, fontSize: 13 }}>
                        <dt style={{ flex: 'none', color: SD.gray600 }}>{k}</dt>
                        <dd style={{ margin: 0, fontWeight: 700, color: SD.gray900, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
    const kakao = <QKakaoLink label="카카오톡 상담하기" style={{ height: 48, borderRadius: 12, border: `1px solid ${SD.gray200}`, background: SD.white, fontSize: 14 }} />;

    if (compact) {
        return (
            <div style={{ background: SD.white, color: SD.gray900 }}>
                {header}
                {docCard}
                {reqCard}
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>{kakao}</div>
            </div>
        );
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button type="button" onClick={onBack}
                style={{ alignSelf: 'flex-start', height: 36, padding: '0 12px 0 6px', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: SD.gray700, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <SIcon name="chevronLeft" size={18} stroke={2} />견적 내역
            </button>
            {header}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>{docCard}</div>
                <aside aria-label="요청 내용" style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {reqCard}
                    {kakao}
                </aside>
            </div>
        </div>
    );
}
