const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const texts: Record<string, number> = {
    name: 200, description: 10000, icon: 10000, image: 10000,
    landing_hero_image: 10000, landing_hero_tagline: 1000, landing_hero_title: 1000,
    landing_hero_subtitle: 10000, landing_accent_color: 100,
    landing_product_grid_title: 1000,
};
export function categoryChanges(input: unknown): Record<string, any> {
    if (!object(input)) throw new Error('카테고리 변경 내용을 확인해 주세요.');
    const changes: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
        if (key === 'order' || key === 'sort_order') {
            if (!Number.isSafeInteger(value) || value < 0) throw new Error('노출 순서는 0 이상의 정수여야 합니다.');
            if (changes.sort_order !== undefined && changes.sort_order !== value) throw new Error('노출 순서 값이 서로 다릅니다.');
            changes.sort_order = value;
        } else if (key === 'is_active') {
            if (![true, false, 0, 1].includes(value)) throw new Error('노출 여부를 확인해 주세요.');
            changes.is_active = value ? 1 : 0;
        } else if (Object.hasOwn(texts, key)) {
            if (value === null && key.startsWith('landing_')) { changes[key] = null; continue; }
            if (typeof value !== 'string' || value.length > texts[key] || (key === 'name' && !value.trim())) throw new Error(`${key} 내용을 확인해 주세요.`);
            changes[key] = key === 'name' ? value.trim() : value;
        } else if (key === 'landing_hero_images' || key === 'landing_highlights') {
            let decoded = value;
            if (typeof decoded === 'string') { try { decoded = JSON.parse(decoded); } catch { throw new Error('이미지·하이라이트 형식을 확인해 주세요.'); } }
            if (!Array.isArray(decoded) || decoded.length > 100) throw new Error('이미지·하이라이트 목록을 확인해 주세요.');
            if (key === 'landing_hero_images') {
                if (decoded.some(item => typeof item !== 'string' || item.length > 10000)) throw new Error('이미지 주소를 확인해 주세요.');
            } else if (decoded.some(section => !object(section)
                || ['label', 'title', 'subtitle'].some(field => section[field] !== undefined && (typeof section[field] !== 'string' || section[field].length > 20000))
                || !Array.isArray(section.cards) || section.cards.length > 100
                || section.cards.some((card: any) => !object(card)
                    || ['image', 'title', 'description', 'link'].some(field => card[field] !== undefined && (typeof card[field] !== 'string' || card[field].length > 20000))
                    || (card.tags !== undefined && (!Array.isArray(card.tags) || card.tags.some((tag: any) => typeof tag !== 'string')))))) throw new Error('하이라이트 내용을 확인해 주세요.');
            const json = JSON.stringify(decoded);
            if (json.length > 500000) throw new Error('카테고리 내용이 너무 큽니다.');
            changes[key] = json;
        } else throw new Error('허용되지 않은 카테고리 항목입니다.');
    }
    if (!Object.keys(changes).length) throw new Error('변경할 항목이 없습니다.');
    return changes;
}

export function categoryOrder(input: unknown): { type: string; items: Array<{ id: string; sort_order: number }> } {
    if (!object(input) || !['product', 'magazine'].includes(input.type) || !Array.isArray(input.items)
        || input.items.length > 1000 || Object.keys(input).some(key => !['type', 'items'].includes(key))) throw new Error('카테고리 순서 목록을 확인해 주세요.');
    const ids = new Set(), positions = new Set();
    for (const item of input.items) {
        if (!object(item) || Object.keys(item).some(key => !['id', 'sort_order'].includes(key)) || typeof item.id !== 'string'
            || !item.id || item.id.length > 150 || ids.has(item.id) || !Number.isSafeInteger(item.sort_order) || item.sort_order < 0 || positions.has(item.sort_order)) throw new Error('카테고리 순서가 중복되었거나 올바르지 않습니다.');
        ids.add(item.id); positions.add(item.sort_order);
    }
    return { type: input.type, items: input.items };
}
