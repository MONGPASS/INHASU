import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Icon } from './console/Icon';
import './Admin3DIcon.css';

const fallbackIcons = {
    reservation: 'assignment', achievement: 'verified', dashboard: 'dashboard',
    target: 'flag', customer: 'person', message: 'mail', idea: 'lightbulb',
    calendar: 'calendar_today', travelers: 'groups', flight: 'flight',
    travel: 'luggage', route: 'route', hotel: 'hotel', vehicle: 'directions_car', payment: 'payments',
} as const;

export type Admin3DIconName = keyof typeof fallbackIcons;

const matteIcons = new Set<Admin3DIconName>([
    'reservation', 'achievement', 'dashboard', 'target', 'customer', 'message', 'idea', 'calendar',
]);

/** Licensed local artwork for admin navigation and headings. Small action glyphs use Icon. */
export function Admin3DIcon({ name, fallback, size = 36, className = '' }: {
    name: Admin3DIconName;
    fallback?: string;
    size?: number;
    className?: string;
}) {
    const src = `/assets/admin-3d/${name}.webp`;
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    return <span
        className={`admin-3d-icon${matteIcons.has(name) ? ' is-matte' : ''} ${className}`}
        style={{ '--admin-3d-size': `${size}px` } as CSSProperties}
        aria-hidden="true"
    >
        {failedSrc === src ? <Icon name={fallback || fallbackIcons[name]} /> : <img
            key={src} src={src} alt="" width={192} height={192} decoding="async"
            onError={() => setFailedSrc(src)}
        />}
    </span>;
}
