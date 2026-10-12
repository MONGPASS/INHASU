import { MatIcon } from './MatIcon';

interface SectionHeaderProps {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    onAll?: () => void;
    allLabel?: string;
}

export function SectionHeader({ eyebrow, title, subtitle, onAll, allLabel = '전체 보기' }: SectionHeaderProps) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, gap: 24 }}>
            <div>
                {eyebrow && (
                    <div
                        style={{
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            color: '#0f766e',
                            textTransform: 'uppercase',
                            marginBottom: 8,
                        }}
                    >
                        {eyebrow}
                    </div>
                )}
                <h2
                    style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: 'var(--fg-1)',
                        margin: 0,
                        lineHeight: 1.25,
                        letterSpacing: '-0.01em',
                    }}
                >
                    {title}
                </h2>
                {subtitle && (
                    <div style={{ fontSize: 14, color: 'var(--fg-4)', marginTop: 8, lineHeight: 1.6 }}>{subtitle}</div>
                )}
            </div>
            {onAll && (
                <button
                    type="button"
                    onClick={onAll}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--fg-2)',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 999,
                        transition: 'background 150ms',
                        fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    {allLabel} <MatIcon name="arrow_forward" size={16} />
                </button>
            )}
        </div>
    );
}
