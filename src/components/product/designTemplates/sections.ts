import type { DesignSectionInstance } from '../../../types/product';
import type { DesignTemplateDef } from './types';

/**
 * 디자인 템플릿의 섹션 인스턴스 유틸.
 *
 * 한 템플릿은 고정된 섹션 목록(sectionDefs)을 갖고, 상품마다 그 중 일부를 빼거나
 * 같은 섹션을 여러 번 복제할 수 있다 (예: 「1일차 상세」를 2·3·4일차로 복제).
 * 복제본은 인스턴스 id에 '#2' 접미사가 붙고, 입력값 key에도 같은 접미사(@2)를 붙여
 * 원본과 값이 섞이지 않게 한다.
 */

/** 인스턴스 id에서 복제 접미사를 뽑는다. 원본이면 '' */
export function suffixOf(instanceId: string): string {
    const i = instanceId.indexOf('#');
    return i === -1 ? '' : `@${instanceId.slice(i + 1)}`;
}

/** 이 인스턴스에서 사용할 실제 입력값 key */
export function scopedKey(key: string, instanceId: string): string {
    return key + suffixOf(instanceId);
}

/** 템플릿 기본 섹션 목록 (한 번씩, 정의 순서대로) */
export function defaultInstances(def: DesignTemplateDef): DesignSectionInstance[] {
    return def.sectionDefs.map(s => ({ id: s.id, def: s.id }));
}

/**
 * content.sections가 없으면 기본 목록으로 채워 돌려준다.
 * 저장된 목록이 있어도 그 뒤 템플릿에 새로 생긴 섹션은 템플릿 순서대로 채워 넣고,
 * 템플릿에서 사라진 섹션은 걸러낸다 (템플릿이 바뀐 뒤에도 안전하게).
 * hidden(뺀 섹션) 인스턴스도 포함해 돌려주므로, 상세페이지 렌더 쪽에서는
 * visibleInstances()를 쓰거나 hidden을 걸러야 한다.
 */
export function resolveInstances(
    def: DesignTemplateDef,
    sections: DesignSectionInstance[] | undefined,
): DesignSectionInstance[] {
    if (!sections || sections.length === 0) return defaultInstances(def);
    const known = new Set(def.sectionDefs.map(s => s.id));
    const byDef = new Map<string, DesignSectionInstance[]>();
    for (const s of sections) {
        if (!known.has(s.def)) continue;
        const list = byDef.get(s.def);
        if (list) list.push(s); else byDef.set(s.def, [s]);
    }
    return def.sectionDefs.flatMap(sd => byDef.get(sd.id) ?? [{ id: sd.id, def: sd.id }]);
}

/** 상세페이지에 실제로 표시할 섹션 목록 (뺀 섹션 제외) */
export function visibleInstances(
    def: DesignTemplateDef,
    sections: DesignSectionInstance[] | undefined,
): DesignSectionInstance[] {
    return resolveInstances(def, sections).filter(s => !s.hidden);
}

/** 해당 섹션 def에 속한 매니페스트 필드 key 목록 */
export function fieldKeysOfSection(def: DesignTemplateDef, sectionDefId: string): string[] {
    const sec = def.sectionDefs.find(s => s.id === sectionDefId);
    if (!sec) return [];
    const names = new Set(sec.fieldSections);
    return def.fields.filter(f => names.has(f.section)).map(f => f.key);
}

/** 이미 쓰인 번호를 피해 새 복제 인스턴스 id를 만든다 */
export function nextCopyId(sectionDefId: string, existing: DesignSectionInstance[]): string {
    const used = new Set(existing.filter(s => s.def === sectionDefId).map(s => s.id));
    for (let n = 2; n < 100; n++) {
        const id = `${sectionDefId}#${n}`;
        if (!used.has(id)) return id;
    }
    return `${sectionDefId}#${Date.now()}`;
}

/** 복제 접미사(@2)를 뗀 원본 필드 key — 기본값 조회·미리보기 선택자에 쓴다 */
export function baseKey(key: string): string {
    const at = key.lastIndexOf('@');
    return at > 0 && /^\d+$/.test(key.slice(at + 1)) ? key.slice(0, at) : key;
}

/** key가 속한 복제 접미사 ('' 또는 '@2') */
export function scopeOf(key: string): string {
    const at = key.lastIndexOf('@');
    return at > 0 && /^\d+$/.test(key.slice(at + 1)) ? key.slice(at) : '';
}
