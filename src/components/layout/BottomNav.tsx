import { MobileTabBar } from '../mobile/MobileTabBar';

/**
 * Bottom navigation for mobile screens that are not built on MobileShell yet.
 * Renders the redesigned tab bar pinned to the viewport, plus a spacer so page
 * content is never hidden behind it.
 */
export const BottomNav: React.FC = () => (
    <>
        <div aria-hidden="true" style={{ height: 'calc(66px + env(safe-area-inset-bottom))' }} />
        <MobileTabBar fixed />
    </>
);
