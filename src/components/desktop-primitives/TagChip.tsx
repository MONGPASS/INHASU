import type { ReactNode } from 'react';

export type TagTone = 'premium' | 'hot' | 'new' | 'light';

interface TagChipProps {
    children: ReactNode;
    tone?: TagTone;
    size?: 'sm' | 'md';
}

const toneBg: Record<TagTone, string> = {
    premium: '#115e59',
    hot: '#dc2626',
    new: '#0ea5e9',
    light: 'rgba(255,255,255,0.18)',
};

export function TagChip({ children, tone = 'premium', size = 'md' }: TagChipProps) {
    const pad = size === 'sm' ? '3px 7px' : '4px 9px';
    const fs = size === 'sm' ? 10 : 11;
    return (
        <span
            style={{
                background: toneBg[tone],
                color: '#fff',
                fontSize: fs,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: pad,
                borderRadius: 4,
                display: 'inline-block',
                backdropFilter: tone === 'light' ? 'blur(8px)' : 'none',
            }}
        >
            {children}
        </span>
    );
}
