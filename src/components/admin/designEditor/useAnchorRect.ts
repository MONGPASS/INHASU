import { useLayoutEffect, useState } from 'react';

/**
 * 요소의 화면 위치를 따라가는 훅. 요소는 참조가 아니라 getter로 받는다 —
 * 사진 업로드 뒤 placeholder가 <img>로 교체되고, 미리보기가 다시 그려져도 선택자로 다시 찾는다.
 * scroll은 capture로 받아 미리보기 컨테이너·템플릿 안 가로 스크롤까지 포착한다.
 */
export function useAnchorRect(getElement: () => Element | null | undefined, watch: readonly unknown[], getContainer?: () => Element | null | undefined): DOMRect | null {
    const [rect, setRect] = useState<DOMRect | null>(null);
    useLayoutEffect(() => {
        let frame = 0;
        const update = () => { const el = getElement(); setRect(el ? el.getBoundingClientRect() : null); };
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
        update();
        window.addEventListener('scroll', schedule, true);
        window.addEventListener('resize', schedule);
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
        const el = getElement(); if (observer && el) observer.observe(el);
        const container = getContainer?.(); if (observer && container) observer.observe(container);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule, true);
            window.removeEventListener('resize', schedule);
            observer?.disconnect();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 호출부가 다시 찾아야 할 때를 watch로 준다
    }, watch);
    return rect;
}
