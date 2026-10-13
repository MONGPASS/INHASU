import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MatIcon } from './MatIcon';

interface Crumb {
    label: string;
    path?: string;
}

interface PageHeroProps {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    breadcrumbs?: Crumb[];
    /** Optional right-side content (action button, stats card etc.) */
    aside?: ReactNode;
    /** Optional content rendered below the title row (search bar, etc.) */
    children?: ReactNode;
    contentWidth?: number;
    /** Slight gradient background; default true. */
    gradient?: boolean;
}

export function PageHero({
    eyebrow,
    title,
    subtitle,
    breadcrumbs,
    aside,
    children,
    contentWidth = 1280,
    gradient = true,
}: PageHeroProps) {
    const navigate = useNavigate();
    return (
        <section
            style={{
                background: gradient ? 'linear-gradient(180deg, var(--bg-muted) 0%, #fff 100%)' : '#fff',
                borderBottom: '1px solid var(--border-subtle)',
            }}
        >
            <div style={{ maxWidth: contentWidth, margin: '0 auto', padding: '32px 32px 36px' }}>
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <div
                        style={{
                            fontSize: 12,
                            color: 'var(--fg-5)',
                            marginBottom: 18,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                        }}
                    >
                        {breadcrumbs.map((c, i) => {
                            const isLast = i === breadcrumbs.length - 1;
                            return (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {isLast || !c.path ? (
                                        <span style={{ color: 'var(--fg-2)', fontWeight: 600 }}>{c.label}</span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => c.path && navigate(c.path)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                padding: 0,
                                                cursor: 'pointer',
                                                color: 'var(--fg-5)',
                                                fontSize: 12,
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            {c.label}
                                        </button>
                                    )}
                                    {!isLast && <MatIcon name="chevron_right" size={14} color="var(--fg-6)" />}
                                </span>
                            );
                        })}
                    </div>
                )}

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: aside ? '1fr auto' : '1fr',
                        gap: 32,
                        alignItems: 'flex-end',
                    }}
                >
                    <div>
                        {eyebrow && (
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    letterSpacing: '0.12em',
                                    color: '#0f766e',
                                    textTransform: 'uppercase',
                                    marginBottom: 10,
                                }}
                            >
                                {eyebrow}
                            </div>
                        )}
                        <h1
                            style={{
                                fontSize: 42,
                                fontWeight: 700,
                                color: 'var(--fg-1)',
                                margin: 0,
                                lineHeight: 1.2,
                                letterSpacing: '-0.02em',
                            }}
                        >
                            {title}
                        </h1>
                        {subtitle && (
                            <p
                                style={{
                                    fontSize: 15,
                                    color: 'var(--fg-3)',
                                    marginTop: 14,
                                    lineHeight: 1.75,
                                    maxWidth: 640,
                                }}
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {aside}
                </div>

                {children}
            </div>
        </section>
    );
}
