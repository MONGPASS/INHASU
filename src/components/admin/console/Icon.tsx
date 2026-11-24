import React from 'react';
import { SEED_FOR_MATERIAL } from '../ui/legacyIconNames';

/**
 * 예전 Material Symbols 이름으로 부르는 관리자 아이콘.
 *
 * 2026-11-24부터 표(ui/legacyIconNames.ts)에 있는 이름은 당근 Seed 아이콘을 그린다. 바깥 `span`은
 * `material-symbols-outlined` 클래스를 그대로 달아, 화면 CSS가 그 클래스로 정한 크기·색이 Seed 아이콘에도 똑같이 적용된다
 * (아이콘은 1em, `adm-glyph` 규칙은 ui/admin-components.css). 표에 없는 이름은 예전처럼 Material 글꼴로 그린다.
 *
 * 관리자가 고른 카테고리·배너 아이콘이나 고객 문서 미리보기처럼 **고객 화면과 같은 Material 모양**이어야 하는 곳은
 * `MaterialIcon`을 쓴다. 새 관리자 코드는 이 부품 대신 `Icon*`(components/admin/ui)를 바로 쓴다.
 */
export interface IconProps {
    name: string;
    /** Material의 채운 모양(FILL 1). Seed로 그릴 때는 쓰지 않는다. */
    fill?: boolean;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
    onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
}

/** Material Symbols 글꼴 그대로(고객 화면과 같은 모양이어야 하는 아이콘) */
export const MaterialIcon: React.FC<IconProps> = ({ name, fill, className = '', style, title, onClick }) => (
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

export const Icon: React.FC<IconProps> = (props) => {
    const Glyph = SEED_FOR_MATERIAL[props.name];
    if (!Glyph) return <MaterialIcon {...props} />;
    const { className = '', style, title, onClick } = props;
    return (
        <span className={`material-symbols-outlined adm-glyph ${className}`} style={style} title={title} onClick={onClick} aria-hidden="true">
            <Glyph focusable="false" />
        </span>
    );
};

export default Icon;
