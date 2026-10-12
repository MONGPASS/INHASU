import type { MouseEvent, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DesktopLayout } from '../layout-desktop/DesktopLayout';
import { MW, MW_FONT_EN, MW_STICKY_TOP } from '../desktop-primitives/mwTokens';
import { M_HAIR, M_PAPER } from '../mobile/mobileTheme';
import { INFO_GROUPS, INFO_PAGES, activeInfoKey, infoEntry, type InfoKey } from './infoNav';

interface InfoLayoutDesktopProps {
    page: InfoKey;
    /** Replaces the nav title as the page's h1 (the nav label stays as it is). */
    heading?: string;
    children: ReactNode;
}

/** PC Info template (Claude Design: "Info Header" + "Info Nav"): header, sticky side navigation, body. */
export function InfoLayoutDesktop({ page, heading, children }: InfoLayoutDesktopProps) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const info = infoEntry(page);
    const active = activeInfoKey(pathname, page);

    const go = (path: string) => (e: MouseEvent) => {
        e.preventDefault();
        navigate(path);
        window.scrollTo(0, 0);
    };

    return (
        <DesktopLayout>
            <section style={{ background: `linear-gradient(180deg,${M_PAPER} 0%,#FFFFFF 100%)`, borderBottom: `1px solid ${M_HAIR}` }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 12, color: MW.mute2, whiteSpace: 'nowrap' }}>
                        <a href="/" onClick={go('/')} style={{ color: MW.mute2, textDecoration: 'none' }}>홈</a>
                        <span aria-hidden="true">›</span>
                        <span>{info.group}</span>
                        <span aria-hidden="true">›</span>
                        <span aria-current="page" style={{ color: MW.navy, fontWeight: 700 }}>{info.title}</span>
                    </nav>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintDeep }}>{info.en}</span>
                        <h1 style={{ margin: 0, fontSize: 'clamp(30px,3.6vw,42px)', fontWeight: 900, lineHeight: 1.25 }}>{heading ?? info.title}</h1>
                        <p style={{ margin: 0, fontSize: 15, color: MW.mute }}>{info.lead}</p>
                    </div>
                </div>
            </section>

            <section style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 104px', display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <nav aria-label="이용 안내·회사 정보" style={{ flex: '0 1 240px', minWidth: 200, position: 'sticky', top: MW_STICKY_TOP + 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {INFO_GROUPS.map((group) => (
                        <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ padding: '0 14px 6px', fontSize: 11, fontWeight: 700, color: MW.mute2 }}>{group}</span>
                            {INFO_PAGES.filter((p) => p.group === group).map((p) => {
                                const on = p.key === active;
                                return (
                                    <a
                                        key={p.key}
                                        href={p.path}
                                        onClick={go(p.path)}
                                        aria-current={on ? 'page' : undefined}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 44, padding: '0 14px', borderRadius: 12,
                                            background: on ? MW.mintBg : 'transparent', fontSize: 14, fontWeight: on ? 900 : 700, color: on ? MW.mintDeep : MW.ink3,
                                            textDecoration: 'none', boxSizing: 'border-box',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = MW.mintBg)}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = on ? MW.mintBg : 'transparent')}
                                    >
                                        {p.title}
                                        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: on ? MW.mint : 'transparent' }} />
                                    </a>
                                );
                            })}
                        </div>
                    ))}
                </nav>
                <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
            </section>
        </DesktopLayout>
    );
}
