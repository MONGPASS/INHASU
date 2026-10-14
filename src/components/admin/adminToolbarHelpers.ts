import type { AdminSearchItem, AdminWorkspaceData } from '../../types/adminWorkspace';

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s()+.\-]/g, '');
export const searchCategoryLabel = { reservation: '예약', quote: '견적 문의', product: '상품' };
export const isAdminHref = (href: string) => /^\/admin(?:\/|\?|#|$)/.test(href);

/** Names and formatted phone numbers share the same matching rules; no empty-query samples. */
export function adminSearchGroups(items: AdminSearchItem[], query: string, perGroup = 4) {
    const terms = query.trim().split(/\s+/).map(normalize).filter(Boolean);
    if (!terms.length) return [];
    const scored = items.filter(item => isAdminHref(item.href)).map(item => {
        const fields = [item.title, item.subtitle, ...item.keywords].map(normalize);
        const matches = terms.every(term => fields.some(field => field.includes(term)));
        const score = terms.reduce((total, term) => total + (fields.some(field => field === term) ? 10 : normalize(item.title).includes(term) ? 3 : 1), 0);
        return { item, matches, score };
    }).filter(result => result.matches).sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'ko'));
    return (['reservation', 'quote', 'product'] as const).map(category => ({
        category, label: searchCategoryLabel[category],
        items: scored.filter(result => result.item.category === category).slice(0, perGroup).map(result => result.item),
    })).filter(group => group.items.length);
}

export function adminTaskBadge(data: AdminWorkspaceData | null, loading: boolean, failed: boolean) {
    if (!data) return { text: loading ? '…' : '?', label: loading ? '업무 알림 불러오는 중' : failed ? '업무 알림 조회 실패' : '업무 알림 확인 필요' };
    const partial = data.warnings.length > 0 || Object.values(data.availability).some(available => !available);
    const count = data.tasks.length;
    if (failed) return { text: count ? `${count}?` : '?', label: `업무 알림 새로고침 실패, 마지막 확인한 미완료 업무 ${count}건` };
    return {
        text: partial ? count ? `${count}+` : '?' : String(count),
        label: partial ? `업무 알림: 확인된 미완료 업무 ${count}건, 일부 자료 확인 필요` : `업무 알림: 미완료 업무 ${count}건`,
    };
}

export function nextSearchIndex(current: number, direction: 1 | -1, length: number) {
    if (!length) return -1;
    if (current < 0 || current >= length) return direction === 1 ? 0 : length - 1;
    return (current + direction + length) % length;
}
