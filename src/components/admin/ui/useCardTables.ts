import { useEffect, type RefObject } from 'react';

/**
 * 휴대폰에서 표를 카드 목록으로 보여 주기 위해, 본문 안의 표 칸마다 머리글을 `data-label`로 붙인다.
 * 모양은 admin-mobile.css의 ‘표 → 카드’ 규칙이 정한다. 화면별로 따로 손댈 필요가 없고 새 표에도 자동으로 적용된다.
 * - 제목 칸(`data-primary`): 순서·아이콘·번호 같은 짧은 칸을 뺀 첫 칸
 * - 관리 칸(`data-actions`): 머리글이 ‘관리’이거나 마지막 칸에 버튼만 있는 칸
 * 표에 `data-card-off`를 주면 건드리지 않는다(예: 인쇄·문서용 표).
 */
const SKIP_PRIMARY = new Set(['', '순서', '아이콘', '번호', 'No', 'NO', '선택', '사진', '이미지']);

const labelTable = (table: HTMLTableElement) => {
    const heads = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th')).map(th => (th.textContent || '').trim());
    if (!heads.length) return;
    const primaryIndex = heads.findIndex(text => !SKIP_PRIMARY.has(text));
    table.dataset.cardTable = 'on';
    table.querySelectorAll<HTMLTableRowElement>('tbody > tr').forEach(row => {
        const cells = Array.from(row.children) as HTMLElement[];
        // 한 칸이 줄 전체를 쓰는 안내 줄(빈 목록 등)은 그대로 둔다.
        if (cells.length !== heads.length) { row.dataset.cardRow = 'plain'; return; }
        cells.forEach((cell, index) => {
            const label = heads[index];
            if (cell.dataset.label !== label) cell.dataset.label = label;
            const primary = index === primaryIndex, actions = label === '관리' || label === '작업';
            if (primary !== (cell.dataset.primary === '')) { if (primary) cell.dataset.primary = ''; else delete cell.dataset.primary; }
            if (actions !== (cell.dataset.actions === '')) { if (actions) cell.dataset.actions = ''; else delete cell.dataset.actions; }
        });
    });
};

export function useCardTables(container: RefObject<HTMLElement | null>): void {
    useEffect(() => {
        const node = container.current;
        if (!node || typeof MutationObserver === 'undefined') return;
        let frame = 0;
        const run = () => { frame = 0; node.querySelectorAll<HTMLTableElement>('table:not([data-card-off])').forEach(labelTable); };
        const schedule = () => { if (!frame) frame = window.requestAnimationFrame(run); };
        run();
        const observer = new MutationObserver(schedule);
        observer.observe(node, { childList: true, subtree: true });
        return () => { observer.disconnect(); if (frame) window.cancelAnimationFrame(frame); };
    }, [container]);
}
