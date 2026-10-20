import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useProductCategories } from '../../hooks/useProductCategories';
import { MW, MW_GRADIENT } from '../desktop-primitives/mwTokens';
import { copyText, myQuotePath, myQuoteUrl, quoteLinkDate, type QuoteDoneState } from './quoteLinks';
import { KakaoConsultButton } from './quoteParts';

const STATUS = ['요청 접수', '견적 작성 중', '견적 도착', '예약 진행'];

/** 복사 결과를 잠깐(1.8초) 보여 주는 상태: true = 복사됨, false = 실패. */
function useCopyFlag() {
    const [flag, setFlag] = useState<boolean | null>(null);
    const timer = useRef(0);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const copy = async (text: string) => {
        setFlag(await copyText(text));
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setFlag(null), 1800);
    };
    return [flag, copy] as const;
}

/**
 * 견적 요청 완료 화면의 본문 — PC(/estimate-complete 카드)와 모바일(QuoteDone)이 함께 쓴다.
 * 내 견적 전용 링크(`/내견적.html?t=…`)가 이후 모든 단계(견적 확인 → 입금 신고 → 계약서 서명 →
 * 확정일정표)의 입구이므로 가장 먼저 눈에 띄게 둔다.
 */
export function QuoteDoneBody({ done, go, compact = false }: { done: QuoteDoneState; go: (path: string) => void; compact?: boolean }) {
    const categories = useProductCategories().slice(0, 3);
    const [linkCopied, copyLink] = useCopyFlag();
    const [memoCopied, copyMemo] = useCopyFlag();
    const url = myQuoteUrl(done.token);
    const when = quoteLinkDate(done.createdAt);
    const small = compact ? 12 : 13;
    const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: compact ? '10px 0' : '12px 0', borderTop: `1px solid ${MW.line3}`, fontSize: compact ? 13 : 14 };

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 12 : 14, textAlign: 'center' }}>
                <span aria-hidden="true" style={{ width: compact ? 68 : 80, height: compact ? 68 : 80, borderRadius: '50%', background: MW.mintTint, color: MW.mintDeep, fontSize: compact ? 26 : 30, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
                <h1 style={{ margin: compact ? '6px 0 0' : '8px 0 0', fontSize: compact ? 21 : 26, fontWeight: 900, lineHeight: 1.45 }}>견적 요청이<br />접수되었습니다</h1>
                <p style={{ margin: 0, fontSize: compact ? 13 : 14, lineHeight: 1.8, color: MW.mute }}>
                    담당자가 확인한 뒤 영업시간 기준 24시간 이내에 연락드립니다.<br />
                    <strong style={{ color: MW.navy }}>견적서가 준비되면 카카오 알림톡으로 알려 드립니다.</strong>
                </p>
            </div>

            <ol aria-label="견적 진행 단계" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
                {STATUS.map((label, i) => {
                    const on = i === 0;
                    return (
                        <li key={label} aria-current={on || undefined} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: compact ? 11 : 12, fontWeight: on ? 700 : 500, color: on ? MW.mintDeep : MW.mute2, textAlign: 'center' }}>
                            {i > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: 7, right: '50%', width: '100%', height: 2, background: MW.line3 }} />}
                            <span aria-hidden="true" style={{ position: 'relative', width: 16, height: 16, borderRadius: '50%', background: on ? MW.mint : MW.line2, boxShadow: on ? `0 0 0 4px ${MW.mintTint}` : 'none' }} />
                            {label}
                        </li>
                    );
                })}
            </ol>

            <section aria-label="내 견적 전용 링크" style={{ border: `1px solid ${MW.mintTint}`, borderRadius: 16, background: MW.mintBg, padding: compact ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: compact ? 14 : 15, fontWeight: 900 }}>내 Google 계정으로 안전하게 확인</span>
                <span style={{ fontSize: small, lineHeight: 1.7, color: MW.mute }}>진행 상황과 완성된 견적서를 이 링크와 마이페이지에서 확인할 수 있습니다.</span>
                <span title={url} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${MW.line}`, background: '#FFFFFF', fontSize: 12, color: MW.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 8 }}>
                    <a href={myQuotePath(done.token)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: compact ? 50 : 54, borderRadius: 14, background: MW_GRADIENT, color: MW.navy, fontSize: compact ? 15 : 16, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        내 견적 확인하기
                    </a>
                    <button type="button" onClick={() => copyLink(url)} style={{ height: compact ? 50 : 54, border: `1.5px solid ${MW.navy}`, borderRadius: 14, background: '#FFFFFF', color: MW.navy, fontFamily: 'inherit', fontSize: compact ? 14 : 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <span aria-live="polite">{linkCopied === true ? '✓ 복사됨' : linkCopied === false ? '복사 실패' : '링크 복사'}</span>
                    </button>
                </div>
                <span style={{ fontSize: 11, lineHeight: 1.6, color: MW.mute }}>견적을 요청한 Google 계정으로 로그인해야 내용을 확인할 수 있습니다.</span>
            </section>

            {done.brief ? (
                <div style={{ border: `1px solid ${MW.line}`, borderRadius: 16, padding: compact ? 16 : 20, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: compact ? 13 : 14, fontWeight: 700, paddingBottom: compact ? 10 : 12 }}>요청 내용 요약</span>
                    <div style={rowStyle}><span style={{ color: MW.mute, flexShrink: 0 }}>여행</span><span style={{ fontWeight: 700, textAlign: 'right' }}>{done.brief.trip}</span></div>
                    <div style={rowStyle}><span style={{ color: MW.mute, flexShrink: 0 }}>희망 투어</span><span style={{ fontWeight: 700, textAlign: 'right' }}>{done.brief.tour}</span></div>
                    <div style={rowStyle}><span style={{ color: MW.mute, flexShrink: 0 }}>연락처</span><span style={{ fontWeight: 700, textAlign: 'right' }}>{done.brief.phone}</span></div>
                    {done.rows && done.rows.length > 0 && (
                        <details style={{ borderTop: `1px solid ${MW.line3}`, paddingTop: 4 }}>
                            <summary style={{ padding: '10px 0 4px', fontSize: small, fontWeight: 700, color: MW.mute, cursor: 'pointer' }}>요청 내용 자세히 보기</summary>
                            {done.rows.map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: small }}>
                                    <span style={{ color: MW.mute, flexShrink: 0 }}>{k}</span>
                                    <span style={{ fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
                                </div>
                            ))}
                        </details>
                    )}
                </div>
            ) : (
                (done.name || when) && (
                    <p style={{ margin: 0, fontSize: small, color: MW.mute, textAlign: 'center' }}>
                        {[done.name && `${done.name} 님`, when && `${when} 요청`].filter(Boolean).join(' · ')}
                    </p>
                )
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <KakaoConsultButton height={compact ? 50 : 54} />
                {done.memo && (
                    <button type="button" onClick={() => copyMemo(done.memo || '')} style={{ alignSelf: 'center', border: 0, background: 'transparent', padding: '6px 4px', color: MW.mute, fontFamily: 'inherit', fontSize: small, textDecoration: 'underline', cursor: 'pointer' }}>
                        <span aria-live="polite">{memoCopied === true ? '✓ 요청 내용을 복사했어요' : memoCopied === false ? '복사하지 못했어요' : '카카오톡 상담용 요청 내용 복사'}</span>
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 12 : 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: compact ? 15 : 17, fontWeight: 700 }}>투어 상품 둘러보기</span>
                    <a href="/products" onClick={(e) => { e.preventDefault(); go('/products'); }} style={{ fontSize: small, color: MW.mute, textDecoration: 'none' }}>더 보기</a>
                </div>
                <div style={{ display: 'flex', gap: compact ? 6 : 8, flexWrap: 'wrap' }}>
                    {[{ id: '', name: '전체' }, ...categories].map((c) => (
                        <button
                            key={c.id || 'all'}
                            type="button"
                            onClick={() => go(c.id ? `/category/${c.id}` : '/products')}
                            style={{ border: `1px solid ${MW.line2}`, background: '#fff', borderRadius: 999, height: compact ? 38 : 40, padding: compact ? '0 14px' : '0 16px', fontFamily: 'inherit', fontSize: small, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
            </div>

            <button type="button" onClick={() => go('/')} style={{ height: 44, border: 0, background: 'transparent', color: MW.mute, fontFamily: 'inherit', fontSize: compact ? 13 : 14, cursor: 'pointer' }}>
                홈으로 돌아가기
            </button>
        </>
    );
}
