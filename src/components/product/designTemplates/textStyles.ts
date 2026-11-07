import type { DesignTextStyle } from '../../../types/product';
import { baseKey, scopeOf } from './sections';

/**
 * 디자인 블록 문구의 글자 크기·줄바꿈.
 * 관리자가 정한 크기는 `content.textStyles[scopedKey].size`(원래 크기 대비 %)로 저장하고,
 * 화면에서는 그 문구 요소에 CSS `zoom`을 준다. 템플릿마다(데스크톱·모바일) 원래 글자 크기가 달라도
 * 같은 비율로 커지거나 작아진다.
 */
export const TEXT_SIZE = { min: 60, max: 200, step: 10, base: 100 } as const;

const KEY = /^[A-Za-z0-9_-]+(@\d+)?$/;

/** 저장값을 허용 범위의 정수 %로 맞춘다. 숫자가 아니면 기본(100). */
export function clampTextSize(size: unknown): number {
    const n = Math.round(Number(size));
    if (!Number.isFinite(n)) return TEXT_SIZE.base;
    return Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, n));
}

/** 크기를 바꾼 결과. 기본 크기면 키를 지워 저장한다(문구 값과 같은 규칙). */
export function commitTextSize(styles: Record<string, DesignTextStyle> | undefined, key: string, size: number): Record<string, DesignTextStyle> | undefined {
    const out = { ...(styles || {}) };
    const next = clampTextSize(size);
    if (next === TEXT_SIZE.base) delete out[key];
    else out[key] = { ...out[key], size: next };
    return Object.keys(out).length ? out : undefined;
}

const selector = (root: string, key: string) => `${root} [data-df-scope="${scopeOf(key)}"] [data-df="${baseKey(key)}"]`;

/**
 * 한 디자인 블록 안에서만 적용되는 CSS 규칙.
 * - 크기: 저장된 % → `zoom`
 * - 줄바꿈: 관리자가 줄을 나눠 입력한 문구는 템플릿이 한 줄로 그리던 칸이어도 줄을 나눠 보여 준다.
 */
export function textStyleCss(root: string, styles: Record<string, DesignTextStyle> | undefined, values: Record<string, string> | undefined): string {
    const rules: string[] = [];
    for (const [key, style] of Object.entries(styles || {})) {
        if (!KEY.test(key)) continue;
        const size = clampTextSize(style?.size);
        if (size !== TEXT_SIZE.base) rules.push(`${selector(root, key)}{zoom:${size / 100}}`);
    }
    for (const [key, value] of Object.entries(values || {})) {
        if (KEY.test(key) && typeof value === 'string' && value.includes('\n') && !/^(https?:|\/|data:)/.test(value)) rules.push(`${selector(root, key)}{white-space:pre-line}`);
    }
    return rules.join('\n');
}
