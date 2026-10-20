import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

export interface AdminContentState { busy: boolean; dirty: boolean; }

/** One guard per page also covers its open editor, browser Back and toolbar links. */
export function useAdminContentGuard(read: () => AdminContentState, notice: (message: string) => void) {
    const current = useRef({ read, notice }); current.current = { read, notice };
    const attempted = useRef('');
    const blocker = useBlocker(({ currentLocation, nextLocation }) => {
        if (currentLocation.pathname === nextLocation.pathname && currentLocation.search === nextLocation.search) return false;
        const state = current.current.read();
        return state.busy || state.dirty;
    });
    useEffect(() => {
        if (blocker.state === 'unblocked') { attempted.current = ''; return; }
        if (blocker.state !== 'blocked' || attempted.current === blocker.location.key) return;
        attempted.current = blocker.location.key;
        const state = current.current.read();
        if (state.busy) {
            current.current.notice('저장·이미지 업로드가 끝난 뒤 이동해 주세요.');
            blocker.reset();
        } else if (!state.dirty || window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?')) blocker.proceed();
        else blocker.reset();
    }, [blocker]);
    useEffect(() => {
        const unload = (event: BeforeUnloadEvent) => {
            const state = current.current.read();
            if (state.busy || state.dirty) { event.preventDefault(); event.returnValue = ''; }
        };
        window.addEventListener('beforeunload', unload);
        return () => window.removeEventListener('beforeunload', unload);
    }, []);
}
