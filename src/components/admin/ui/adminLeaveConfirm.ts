// 테스트가 '/ui/adminFeedback' 경로로 확인 창을 바꿔 끼우므로 같은 꼴의 경로로 읽는다.
import { adminConfirm } from '../ui/adminFeedback';

interface LeaveBlocker { proceed?: () => void; reset?: () => void; }

let asking = false;

/**
 * 화면 이동이 막힌 상태(useBlocker의 blocked)에서 공통 확인 창으로 묻는다.
 * 확인하면 이동을 이어 가고, 취소하면 그 자리에 머문다. 창이 떠 있는 동안 다시 불려도 한 번만 묻는다.
 */
export function adminConfirmLeave(blocker: LeaveBlocker, message: string): void {
    if (asking) return;
    asking = true;
    void Promise.resolve(adminConfirm({ message, confirmLabel: '이동', cancelLabel: '머무르기' }))
        .then((ok) => { if (ok) blocker.proceed?.(); else blocker.reset?.(); })
        .catch(() => blocker.reset?.())
        .finally(() => { asking = false; });
}
