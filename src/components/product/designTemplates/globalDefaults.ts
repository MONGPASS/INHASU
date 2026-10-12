import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

/**
 * 디자인 템플릿의 "공통 기본값" — 상품마다 다시 올릴 필요 없는 사진·문구.
 *
 * 값이 정해지는 순서:
 *   1) 상품에 직접 입력한 값 (detail_blocks 안의 design 블록)
 *   2) 여기(사이트 설정)에 저장한 공통값
 *   3) 템플릿 매니페스트의 원본 디자인 기본값
 *
 * 저장 위치는 settings 테이블의 design_defaults 한 칸이고,
 * 형태는 { [템플릿id]: { [필드key]: 값 } } 이다.
 */
export type DesignGlobalDefaults = Record<string, Record<string, string>>;

const SETTING_KEY = 'design_defaults';

let cache: Promise<DesignGlobalDefaults> | null = null;
let current: DesignGlobalDefaults = {};
const listeners = new Set<() => void>();

function notify() {
    for (const fn of listeners) fn();
}

/** 사이트 설정에서 공통값을 한 번만 읽어 캐시한다 */
export function loadDesignDefaults(force = false): Promise<DesignGlobalDefaults> {
    if (!cache || force) {
        cache = api.settings.get()
            .then((all: Record<string, string>) => {
                const raw = all?.[SETTING_KEY];
                if (!raw) return {};
                try {
                    const parsed = JSON.parse(raw);
                    return (parsed && typeof parsed === 'object') ? parsed as DesignGlobalDefaults : {};
                } catch {
                    return {};
                }
            })
            .catch(() => ({}))
            .then(v => { current = v; notify(); return v; });
    }
    return cache;
}

/** 공통값 저장 — 저장 즉시 화면(미리보기·상세페이지)에 반영된다 */
export async function saveDesignDefaults(next: DesignGlobalDefaults): Promise<void> {
    await api.settings.saveMany({ [SETTING_KEY]: JSON.stringify(next) });
    current = next;
    cache = Promise.resolve(next);
    notify();
}

/** 한 템플릿의 공통값을 구독한다 (저장하면 자동으로 다시 그려진다) */
export function useDesignGlobalDefaults(templateId?: string): Record<string, string> {
    const [defs, setDefs] = useState<Record<string, string>>(() => (templateId && current[templateId]) || {});

    useEffect(() => {
        let cancelled = false;
        const sync = () => { if (!cancelled) setDefs((templateId && current[templateId]) || {}); };
        listeners.add(sync);
        loadDesignDefaults().then(sync);
        return () => { cancelled = true; listeners.delete(sync); };
    }, [templateId]);

    return defs;
}

/** 편집기에서 쓰는 전체 맵 (템플릿별 묶음 그대로) */
export function useAllDesignDefaults(): DesignGlobalDefaults {
    const [all, setAll] = useState<DesignGlobalDefaults>(current);
    useEffect(() => {
        let cancelled = false;
        const sync = () => { if (!cancelled) setAll({ ...current }); };
        listeners.add(sync);
        loadDesignDefaults().then(sync);
        return () => { cancelled = true; listeners.delete(sync); };
    }, []);
    return all;
}
