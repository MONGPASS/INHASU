import React from 'react';

/**
 * Admin-console icon. Renders a Material Symbols Outlined glyph (already loaded
 * globally in index.html) so it works with the ported MyRealTrip admin CSS,
 * which sizes `.material-symbols-outlined` per component.
 *
 * The design prototype used inline Lucide SVGs via a custom registry; here we
 * use the project-standard Material Symbols font instead (same glyph names).
 */
export interface IconProps {
    name: string;
    /** Render the filled variant (FILL axis = 1). */
    fill?: boolean;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
    onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
}

export const Icon: React.FC<IconProps> = ({ name, fill, className = '', style, title, onClick }) => (
    <span
        className={`material-symbols-outlined ${className}`}
        style={fill ? { fontVariationSettings: "'FILL' 1", ...style } : style}
        title={title}
        onClick={onClick}
        aria-hidden="true"
    >
        {name}
    </span>
);

export default Icon;
