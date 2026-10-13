import type { CSSProperties } from 'react';

interface MatIconProps {
    name: string;
    filled?: boolean;
    size?: number;
    color?: string;
    style?: CSSProperties;
}

export function MatIcon({ name, filled, size = 24, color, style = {} }: MatIconProps) {
    return (
        <span
            className="material-symbols-outlined"
            style={{
                fontSize: size,
                width: size,
                height: size,
                color,
                fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
                lineHeight: 1,
                userSelect: 'none',
                ...style,
            }}
        >
            {name}
        </span>
    );
}
