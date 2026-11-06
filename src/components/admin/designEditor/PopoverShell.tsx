import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { placePopover, type PopoverPlacement } from './inlineEdit';

/**
 * 미리보기 요소 옆에 뜨는 작은 편집창의 껍데기.
 * body 포털 + position:fixed라 상품 편집창의 overflow에 잘리지 않는다.
 * 바깥을 누르면 닫히지만(pointerdown capture) 백드롭은 두지 않아 다른 문구를 바로 이어서 누를 수 있다.
 */
export function PopoverShell({ anchor, label, width = 360, onClose, onEscape, children, isInside }: {
    anchor: DOMRect | null; label: string; width?: number; onClose: () => void; children: React.ReactNode;
    /** Esc 처리 — 없으면 onClose. 문구 편집창은 여기서 열기 전 값으로 되돌린다 */
    onEscape?: () => void;
    /** 바깥 클릭 판정에서 제외할 요소(앵커 자신) */
    isInside?: (target: Element) => boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [placement, setPlacement] = useState<PopoverPlacement | null>(null);
    const closeRef = useRef(onClose); closeRef.current = onClose;
    const escapeRef = useRef(onEscape); escapeRef.current = onEscape;
    const insideRef = useRef(isInside); insideRef.current = isInside;

    useLayoutEffect(() => {
        if (!anchor || !ref.current) { setPlacement(null); return; }
        const size = { width: ref.current.offsetWidth || width, height: ref.current.offsetHeight || 160 };
        setPlacement(placePopover(anchor, size, { width: window.innerWidth, height: window.innerHeight }));
    }, [anchor, width, children]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); (escapeRef.current ?? closeRef.current)(); } };
        const onPointer = (event: PointerEvent) => {
            const target = event.target as Element | null;
            if (!target || ref.current?.contains(target) || insideRef.current?.(target)) return;
            closeRef.current();
        };
        window.addEventListener('keydown', onKey, true);
        document.addEventListener('pointerdown', onPointer, true);
        return () => { window.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onPointer, true); };
    }, []);

    // 최소 포커스 순환: body 끝에 붙어 있어 Tab이 페이지 밖으로 튀지 않게 한다.
    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key !== 'Tab' || !ref.current) return;
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>('input,textarea,button:not(:disabled),[tabindex="0"]')).filter(el => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    if (!anchor || typeof document === 'undefined') return null;
    return createPortal(
        <div ref={ref} role="dialog" aria-label={label} onKeyDown={onKeyDown} className="design-popover"
            style={{ position: 'fixed', zIndex: 64, width, maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box', padding: 12, borderRadius: 14, background: '#fff',
                boxShadow: '0 0 0 1px rgba(16,24,40,.08), 0 16px 40px rgba(16,24,40,.18)', fontFamily: 'Pretendard, system-ui, sans-serif',
                left: placement?.left ?? anchor.left, ...(placement ? (placement.above ? { bottom: placement.bottom } : { top: placement.top }) : { top: anchor.bottom + 8 }),
                visibility: placement ? 'visible' : 'hidden' }}>
            {children}
        </div>,
        document.body,
    );
}
