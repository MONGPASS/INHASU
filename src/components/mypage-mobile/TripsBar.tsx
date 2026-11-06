import type { ReactNode } from 'react';
import { MW } from '../desktop-primitives/mwTokens';
import { useMobileShell } from '../mobile/mobileShellContext';
import { D } from '../mobile/mobileTheme';
import { Ico } from '../mobile/mobileUi';

/**
 * Title bar of 내 여행 (Claude Design: "M My Trips"): back button, centred title and the tab row
 * passed as children, sticky under the shell header. Unlike the other my page sub screens
 * (SubPageBar, left-aligned 16px title) this screen centres a 17px title over its tabs.
 */
export function TripsBar({ title, onBack, children }: { title: string; onBack: () => void; children?: ReactNode }) {
    const { stickyTop } = useMobileShell();
    return (
        <div style={{ position: 'sticky', top: stickyTop, zIndex: 10, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${MW.line}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 44px', alignItems: 'center', padding: '4px 6px 0' }}>
                <button type="button" onClick={onBack} aria-label="뒤로" style={{ width: 44, height: 44, border: 0, borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                    <Ico d={D.back} size={22} width={2} />
                </button>
                <h1 style={{ margin: 0, textAlign: 'center', fontSize: 17, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
                <span />
            </div>
            {children}
        </div>
    );
}
