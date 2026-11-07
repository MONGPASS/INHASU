/**
 * 디자인 블록 인라인 편집의 순수 계산 — 팝오버 위치, 값 확정, 클릭 대상 찾기.
 * React·DOM 타입에 묶이지 않아 테스트가 직접 불러 쓴다.
 */
export interface AnchorBox { top: number; left: number; right: number; bottom: number; width: number; height: number }
export interface PopoverPlacement { left: number; top?: number; bottom?: number; above: boolean }

/**
 * 앵커 아래에 두되 공간이 모자라면 위로 뒤집고, 좌우는 화면 안쪽으로 밀어 넣는다.
 * 위아래 어디에도 다 들어가지 않으면(문구가 화면 가운데에서 커졌을 때 등) 고치는 문구를 가리지 않도록 옆에 둔다.
 */
export function placePopover(anchor: AnchorBox, size: { width: number; height: number }, viewport: { width: number; height: number }, gap = 8, margin = 8): PopoverPlacement {
    const below = viewport.height - anchor.bottom - gap;
    const aboveSpace = anchor.top - gap;
    if (below - margin < size.height && aboveSpace - margin < size.height) {
        const right = viewport.width - anchor.right - gap - margin, leftSpace = anchor.left - gap - margin;
        if (right >= size.width || leftSpace >= size.width) {
            const top = Math.max(margin, Math.min(anchor.top, viewport.height - size.height - margin));
            return { left: right >= size.width ? anchor.right + gap : anchor.left - gap - size.width, top, above: false };
        }
    }
    const above = below < size.height && aboveSpace > below;
    const left = Math.max(margin, Math.min(anchor.left, viewport.width - size.width - margin));
    if (above) return { left, bottom: Math.max(margin, viewport.height - anchor.top + gap), above: true };
    return { left, top: Math.max(margin, Math.min(anchor.bottom + gap, viewport.height - size.height - margin)), above: false };
}

/** 빈 값이나 원본과 같은 값은 저장하지 않는다(키 삭제 → 미리보기는 기본 문구로 돌아간다). */
export function commitValue(values: Record<string, string>, key: string, next: string, fieldDefault = ''): Record<string, string> {
    const out = { ...values };
    if (next === '' || next === fieldDefault) delete out[key];
    else out[key] = next;
    return out;
}

/** `key@2` → 접미사 `@2`. 복제 섹션의 필드 키 규칙(sections.ts의 scopedKey)과 같다. */
export const scopeSuffix = (key: string) => { const at = key.lastIndexOf('@'); return at > 0 && /^\d+$/.test(key.slice(at + 1)) ? key.slice(at) : ''; };
export const unscopedKey = (key: string) => key.slice(0, key.length - scopeSuffix(key).length);
/** 미리보기 안에서 그 필드 요소를 다시 찾는 선택자(요소가 교체돼도 유효하다). */
export const fieldSelector = (key: string) => `[data-df-scope="${scopeSuffix(key)}"] [data-df="${unscopedKey(key)}"]`;
export const sectionSelector = (instId: string) => `[data-df-section="${instId.replace(/"/g, '\\"')}"]`;

export interface DesignTarget { key: string; scope: string; sectionId: string | null; element: Element }
/** 클릭·드롭 지점에서 편집 대상 필드와 그 섹션을 읽는다. */
export function findDesignTarget(start: Element | null | undefined): DesignTarget | null {
    const element = start?.closest?.('[data-df]');
    const base = element?.getAttribute('data-df');
    if (!element || !base) return null;
    const scope = element.closest('[data-df-scope]')?.getAttribute('data-df-scope') || '';
    const sectionId = element.closest('[data-df-section]')?.getAttribute('data-df-section') ?? null;
    return { key: base + scope, scope, sectionId, element };
}

/** Enter로 확정할 때: 한국어 입력 조합 중이면 무시하고, 여러 줄 칸은 Ctrl/⌘+Enter만 확정이다. */
export function isCommitKey(event: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; isComposing?: boolean; nativeEvent?: { isComposing?: boolean } }, multiline: boolean): boolean {
    if (event.key !== 'Enter') return false;
    if (event.isComposing || event.nativeEvent?.isComposing) return false;
    return multiline ? !!(event.ctrlKey || event.metaKey) : !event.shiftKey;
}

/** 섹션 도구줄 위치: 섹션 오른쪽 위를 미리보기 영역 안으로 가둔다. */
export function clampSectionAnchor(section: AnchorBox, container: AnchorBox, inset = 8): { top: number; right: number } {
    return {
        top: Math.max(section.top, container.top) + inset,
        right: Math.min(section.right, container.right) - inset,
    };
}
