import './admin-ui.css';

/**
 * 필수 입력 공통 처리.
 * - 라벨에 `className="adm-req"`를 주면 빨간 `*`가 붙는다(라벨 글자에 `*`를 직접 적지 않는다).
 * - 저장할 때 `adminValidateRequired()`를 부르면, 열려 있는 팝업(없으면 화면 본문) 안의 필수 칸 중
 *   비어 있는 칸 아래에 빨간 안내를 띄우고 첫 칸으로 이동한다. 모두 채워져 있으면 true.
 * 안내는 그 칸을 고치면 사라진다. `alert()`나 알림으로 필수 입력을 알리지 않는다.
 */
const POPUPS = '.picker, .cm-modal, .drawer, .cg-drawer, .adm-form';
const CONTROLS = 'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), select, textarea';

const controlFor = (label: HTMLElement): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null => {
    const forId = label.getAttribute('for');
    if (forId) { const linked = label.ownerDocument.getElementById(forId); if (linked?.matches(CONTROLS)) return linked as HTMLInputElement; }
    return label.querySelector(CONTROLS) || label.parentElement?.querySelector(CONTROLS) || null;
};

const particle = (word: string) => {
    const code = word.charCodeAt(word.length - 1);
    if (code < 0xac00 || code > 0xd7a3) return '을(를)';
    return (code - 0xac00) % 28 ? '을' : '를';
};

export function adminValidateRequired(root?: ParentNode | null): boolean {
    if (typeof document === 'undefined') return true;
    const popups = Array.from(document.querySelectorAll<HTMLElement>(POPUPS)).filter(node => node.offsetParent !== null || node.getClientRects().length);
    const scope: ParentNode = root || popups[popups.length - 1] || document.querySelector('.admin-app-wrapper .content') || document;
    let first: HTMLElement | null = null;
    scope.querySelectorAll<HTMLElement>('label.adm-req').forEach(label => {
        const control = controlFor(label), holder = label.parentElement;
        if (!control || !holder || control.disabled) return;
        const empty = !String(control.value ?? '').trim();
        if (!empty) { holder.removeAttribute('data-adm-error'); control.removeAttribute('aria-invalid'); return; }
        const name = (label.textContent || '').trim();
        holder.setAttribute('data-adm-error', `${name}${particle(name)} 입력해 주세요.`);
        control.setAttribute('aria-invalid', 'true');
        const clear = () => { holder.removeAttribute('data-adm-error'); control.removeAttribute('aria-invalid'); control.removeEventListener('input', clear); control.removeEventListener('change', clear); };
        control.addEventListener('input', clear); control.addEventListener('change', clear);
        if (!first) first = control;
    });
    if (first) { (first as HTMLElement).focus(); (first as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return !first;
}
