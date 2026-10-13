import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { MobileShell } from '../mobile/MobileShell';
import { M_HAIR, M_PAPER } from '../mobile/mobileTheme';
import { INFO_PAGES, activeInfoKey, infoEntry, type InfoKey } from './infoNav';

interface InfoLayoutMobileProps {
    page: InfoKey;
    /** Replaces the nav title as the page's h1 (the chip label stays as it is). */
    heading?: string;
    children: ReactNode;
}

/** Mobile Info template (Claude Design: "Info Header" + "M Info Nav"): header, chip row, body. */
export function InfoLayoutMobile(props: InfoLayoutMobileProps) {
    return (
        <MobileShell title="이용 안내">
            <InfoScreen {...props} />
        </MobileShell>
    );
}

function InfoScreen({ page, heading, children }: InfoLayoutMobileProps) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const info = infoEntry(page);
    const active = activeInfoKey(pathname, page);
    const row = useRef<HTMLElement>(null);

    // Bring the current chip into view without moving the page vertically.
    useEffect(() => {
        const nav = row.current;
        const chip = nav?.querySelector<HTMLElement>('[aria-current="page"]');
        if (nav && chip) nav.scrollLeft = chip.offsetLeft - 16;
    }, [active]);

    const go = (path: string) => (e: MouseEvent) => {
        e.preventDefault();
        navigate(path);
        window.scrollTo(0, 0);
    };

    return (
        <>
            <section style={{ background: `linear-gradient(180deg,${M_PAPER} 0%,#FFFFFF 100%)`, borderBottom: `1px solid ${M_HAIR}` }}>
                <div style={{ padding: '20px 16px 36px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintDeep }}>{info.en}</span>
                    <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1.25 }}>{heading ?? info.title}</h1>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: MW.mute }}>{info.lead}</p>
                </div>
            </section>

            <section style={{ padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                <nav ref={row} aria-label="이용 안내·회사 정보" data-noscroll="" style={{ position: 'relative', minWidth: 0, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -16px', padding: '0 16px' }}>
                    {INFO_PAGES.map((p) => {
                        const on = p.key === active;
                        return (
                            <a
                                key={p.key}
                                href={p.path}
                                onClick={go(p.path)}
                                aria-current={on ? 'page' : undefined}
                                style={{
                                    flexShrink: 0, display: 'flex', alignItems: 'center', height: 38, padding: '0 14px', borderRadius: 999, boxSizing: 'border-box',
                                    border: `1.5px solid ${on ? MW.navy : MW.line}`, background: on ? MW.navy : '#FFFFFF',
                                    fontSize: 13, fontWeight: 700, color: on ? '#FFFFFF' : MW.ink3, whiteSpace: 'nowrap', textDecoration: 'none',
                                }}
                            >
                                {p.title}
                            </a>
                        );
                    })}
                </nav>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
            </section>
        </>
    );
}
