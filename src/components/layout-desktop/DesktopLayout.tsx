import type { ReactNode } from 'react';
import { DesktopHeader } from './DesktopHeader';
import { DesktopFooter } from './DesktopFooter';
import { MW_FONT } from '../desktop-primitives/mwTokens';
import { SD } from '../site-seed/seed';

interface DesktopLayoutProps {
    children: ReactNode;
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
    return (
        <div style={{ minHeight: '100vh', background: SD.white, color: SD.gray900, fontFamily: MW_FONT, WebkitFontSmoothing: 'antialiased' }}>
            <DesktopHeader />
            <main>{children}</main>
            <DesktopFooter />
        </div>
    );
}
