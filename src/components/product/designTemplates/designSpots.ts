import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

/**
 * 디자인 템플릿용 "여행지 등록" — 이미지 + 여행지 이름만 담는 가벼운 목록.
 * 관리자 「여행지 사진」 페이지에서 등록하고, 템플릿 편집기의 방문 여행지
 * 카드에서 바로 골라 쓴다. (관광지 마스터와 별개 — 여긴 카드 표시용만)
 *
 * 저장 위치는 settings 테이블의 design_spots 한 칸, 형태는 DesignSpot[] JSON.
 */
export interface DesignSpot {
    id: string;
    /** 카드에 표시될 이름 — 운영 페이지에 그대로 나오므로 한국어로 */
    name: string;
    /** 목록에서 고른 경우의 영어 표기 (관리자 표시용) */
    en?: string;
    image: string;
}

const SETTING_KEY = 'design_spots';

let cache: Promise<DesignSpot[]> | null = null;
let current: DesignSpot[] = [];
const listeners = new Set<() => void>();

function notify() {
    for (const fn of listeners) fn();
}

/** 사이트 설정에서 여행지 목록을 한 번만 읽어 캐시한다 */
export function loadDesignSpots(force = false): Promise<DesignSpot[]> {
    if (!cache || force) {
        cache = api.settings.get()
            .then((all: Record<string, string>) => {
                const raw = all?.[SETTING_KEY];
                if (!raw) return [];
                try {
                    const parsed = JSON.parse(raw);
                    return Array.isArray(parsed) ? parsed as DesignSpot[] : [];
                } catch {
                    return [];
                }
            })
            .catch(() => [])
            .then(v => { current = v; notify(); return v; });
    }
    return cache;
}

/** 여행지 목록 저장 — 저장 즉시 편집기 목록에도 반영된다 */
export async function saveDesignSpots(next: DesignSpot[]): Promise<void> {
    await api.settings.saveMany({ [SETTING_KEY]: JSON.stringify(next) });
    current = next;
    cache = Promise.resolve(next);
    notify();
}

/** 등록된 여행지 목록을 구독한다 (저장하면 자동으로 다시 그려진다) */
export function useDesignSpots(): DesignSpot[] {
    const [spots, setSpots] = useState<DesignSpot[]>(() => current);

    useEffect(() => {
        let cancelled = false;
        loadDesignSpots().then(v => { if (!cancelled) setSpots(v); });
        const fn = () => setSpots(current);
        listeners.add(fn);
        return () => { cancelled = true; listeners.delete(fn); };
    }, []);

    return spots;
}
