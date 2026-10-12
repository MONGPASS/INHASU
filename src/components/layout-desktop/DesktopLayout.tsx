import type { ReactNode } from 'react';
import { DesktopHeader } from './DesktopHeader';
import { DesktopFooter } from './DesktopFooter';
import { MW, MW_FONT } from '../desktop-primitives/mwTokens';

interface DesktopLayoutProps {
    children: ReactNode;
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
    return (
        <div style={{ minHeight: '100vh', background: '#fff', color: MW.navy, fontFamily: MW_FONT, WebkitFontSmoothing: 'antialiased' }}>
            <DesktopHeader />
            <main>{children}</main>
            <DesktopFooter />
        </div>
    );
}
