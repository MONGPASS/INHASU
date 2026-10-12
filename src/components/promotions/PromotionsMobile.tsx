import { useNavigate } from 'react-router-dom';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { useMobileShell } from '../mobile/mobileShellContext';
import { MEmpty, MLoading } from '../mobile/mobileUi';
import { PromoCard } from './PromoCard';
import { usePromoFilter, usePromotions } from './promotionsData';

/** Mobile 여행 기획전: heading, sticky group tabs + count, and the campaign card grid. */
export function PromotionsMobile() {
    const navigate = useNavigate();
    const { stickyTop } = useMobileShell();
    const { items, groups, isLoading } = usePromotions();
    const { tabs, current, setCurrent, list } = usePromoFilter(items, groups);

    const count = (
        <span style={{ flexShrink: 0, fontSize: 12, color: MW.mute, whiteSpace: 'nowrap' }}>
            총 <strong style={{ color: MW.navy, fontWeight: 900 }}>{list.length}</strong>건
        </span>
    );

    return (
        <>
            <section style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintDeep }}>SPECIAL EXHIBITION</span>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1.25, whiteSpace: 'nowrap' }}>여행 기획전</h1>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    몽골 여행 특집·캠페인을 한데 모아 소개합니다.
                </p>
            </section>

            {isLoading ? (
                <MLoading />
            ) : items.length === 0 ? (
                <div style={{ padding: '24px 16px 36px' }}>
                    <MEmpty text="현재 진행 중인 특집이 없습니다." action={{ label: '투어 상품 보기', onClick: () => navigate('/products') }} />
                </div>
            ) : (
                <>
                    {tabs.length > 0 ? (
                        <div style={{ position: 'sticky', top: stickyTop, zIndex: 9, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${MW.line}`, marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, paddingRight: 16 }}>
                            <div role="tablist" data-noscroll="" style={{ flex: 1, minWidth: 0, display: 'flex', gap: 20, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px' }}>
                                {tabs.map((c) => {
                                    const on = c === current;
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            role="tab"
                                            aria-selected={on}
                                            onClick={() => setCurrent(c)}
                                            style={{ flexShrink: 0, height: 46, padding: '0 2px', border: 0, borderBottom: `3px solid ${on ? MW.mint : 'transparent'}`, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 500, color: on ? MW.navy : MW.mute, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                            {c}
                                        </button>
                                    );
                                })}
                            </div>
                            {count}
                        </div>
                    ) : (
                        // One group only: no tabs to switch, just the count on the divider line.
                        <div style={{ marginTop: 12, padding: '0 16px 12px', borderBottom: `1px solid ${MW.line}`, display: 'flex', justifyContent: 'flex-end' }}>{count}</div>
                    )}

                    <section style={{ padding: '16px 16px 36px', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                        {list.map((item, i) => (
                            <PromoCard key={item.key} item={item} variant={i === 0 ? 'wide' : 'small'} />
                        ))}
                    </section>
                </>
            )}
        </>
    );
}
