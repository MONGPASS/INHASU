/**
 * 클립보드에 복사한다. 권한이 없거나 보안 컨텍스트가 아니어서 실패하면 임시 입력창으로 한 번 더 시도한다.
 * 예외를 던지지 않고 성공 여부만 돌려준다 — 실패는 조용히 넘기고, 화면에는 값이 그대로 보이므로 직접 복사할 수 있다.
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // 아래 폴백으로 넘어간다
    }
    try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '0';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
    } catch {
        return false;
    }
}
