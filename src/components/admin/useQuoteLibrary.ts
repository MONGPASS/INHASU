import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { adminConfirm, adminNotify } from './ui/adminFeedback';
import { connectQuoteDesk } from './quoteDesk';
import { readQuoteLibrary, writeQuoteLibrary, type QuoteLibraryKey } from './quoteLibraryStore';

export type QuoteLibraryPhase = 'connecting' | 'loading' | 'ready' | 'unset' | 'error';

interface Options<M> {
    /** 이름 → 항목 자료 키(snippets·spots 등) */
    mapKey: QuoteLibraryKey;
    /** 지역(카테고리) 목록 키(snippet_cats·spot_cats 등). 지역 목록이 없는 자료(코스)는 비운다 */
    catsKey?: QuoteLibraryKey;
    readMap: (data: unknown) => M;
    /** 저장된 지역 목록 + 항목에만 있는 지역 */
    mergeCats?: (map: M, cats: string[]) => string[];
    /** 서버에 저장된 자료가 없을 때(옛 도구와 같이 이 브라우저 저장분 → presets.js 기본값) */
    fallback: () => Promise<unknown>;
    /** 서버에 지역 목록이 없을 때(옛 도구의 기본 지역 등). 없으면 빈 목록 */
    catsFallback?: () => string[];
}

const readCatList = (data: unknown): string[] => {
    if (data == null) return [];
    if (!Array.isArray(data) || data.some((item) => typeof item !== 'string')) throw new Error('지역 목록 형식을 확인할 수 없습니다.');
    return data as string[];
};

/**
 * 견적 자료실(`/api/data/:key`)의 ‘항목 + 지역 목록’ 한 쌍(또는 항목만)을 읽고 저장한다(일정 관리·여행지 관리·코스 관리 공통).
 * - 관리자 세션으로 견적 관리자 값을 받아(connectQuoteDesk) x-admin-token으로 보낸다.
 * - 저장은 마지막으로 읽은 updatedAt으로 충돌을 확인하고, 다른 기기가 먼저 저장했으면 덮어쓸지 묻는다.
 *   취소하면 저장하지 않고 최신 자료를 다시 불러온다(열려 있는 편집 창은 화면이 그대로 둔다).
 * - 바뀐 쪽만 저장하고, 저장에 성공한 쪽만 화면에 반영한다.
 */
export function useQuoteLibrary<M extends Record<string, unknown>>(options: Options<M>) {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const optionsRef = useRef(options); optionsRef.current = options;
    const [phase, setPhase] = useState<QuoteLibraryPhase>('connecting');
    const [loadError, setLoadError] = useState('');
    const [map, setMap] = useState<M>({} as M);
    const [cats, setCats] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const token = useRef('');
    const meta = useRef<Record<string, string | null>>({});
    const savingRef = useRef(false);
    const loadRequest = useRef(0);

    const load = useCallback(async () => {
        const request = ++loadRequest.current;
        if (!accountId) return;
        const { mapKey, catsKey, readMap, mergeCats, fallback } = optionsRef.current;
        setLoadError('');
        try {
            if (!token.current) {
                setPhase('connecting');
                const value = await connectQuoteDesk({ accountId });
                if (request !== loadRequest.current) return;
                if (!value) { setPhase('unset'); return; }
                token.current = value;
            }
            setPhase((current) => (current === 'ready' ? current : 'loading'));
            const [items, catList] = await Promise.all([
                readQuoteLibrary(mapKey, token.current),
                catsKey ? readQuoteLibrary(catsKey, token.current) : Promise.resolve(null),
            ]);
            if (request !== loadRequest.current) return;
            const nextMap = readMap(items.data == null ? await fallback().catch(() => ({})) : items.data);
            if (request !== loadRequest.current) return;
            meta.current = { [mapKey]: items.updatedAt, ...(catsKey && catList ? { [catsKey]: catList.updatedAt } : {}) };
            setMap(nextMap);
            const savedCats = catList ? (catList.data == null && optionsRef.current.catsFallback ? optionsRef.current.catsFallback() : readCatList(catList.data)) : [];
            setCats(mergeCats ? mergeCats(nextMap, savedCats) : savedCats);
            setPhase('ready');
        } catch (error) {
            if (request !== loadRequest.current) return;
            setLoadError(error instanceof Error ? error.message : String(error));
            setPhase('error');
        }
    }, [accountId]);

    useEffect(() => {
        token.current = '';
        void load();
        return () => { loadRequest.current++; };
    }, [load]);

    const writeKey = async (key: QuoteLibraryKey, data: unknown): Promise<boolean> => {
        let result = await writeQuoteLibrary(key, data, token.current, { base: meta.current[key] ?? null });
        if (!result.ok) {
            const overwrite = await adminConfirm({
                title: '먼저 저장된 내용이 있어요',
                message: '다른 기기(또는 다른 탭)에서 이 목록을 먼저 저장했어요. 지금 화면의 내용으로 덮어쓸까요? 취소하면 저장하지 않고 최신 목록을 다시 불러옵니다.',
                confirmLabel: '덮어쓰기', danger: true,
            });
            if (!overwrite) return false;
            result = await writeQuoteLibrary(key, data, token.current, { base: null, force: true });
            if (!result.ok) return false;
        }
        meta.current[key] = result.updatedAt;
        return true;
    };

    /** 저장. 모두 저장됐으면 true. */
    const persist = async (next: { map?: M; cats?: string[] }): Promise<boolean> => {
        if (savingRef.current) return false;
        const { mapKey, catsKey } = optionsRef.current;
        savingRef.current = true; setSaving(true);
        try {
            if (next.map) {
                if (!await writeKey(mapKey, next.map)) { await load(); return false; }
                setMap(next.map);
            }
            if (next.cats) {
                if (!catsKey) throw new Error('지역 목록이 없는 자료입니다.');
                if (!await writeKey(catsKey, next.cats)) { await load(); return false; }
                setCats(next.cats);
            }
            return true;
        } catch (error) {
            adminNotify(error instanceof Error ? error.message : '저장하지 못했습니다.');
            return false;
        } finally {
            savingRef.current = false; setSaving(false);
        }
    };

    // 화면의 effect 의존 값으로 써도 다시 실행되지 않도록 렌더마다 같은 함수를 돌려준다
    const isSaving = useCallback(() => savingRef.current, []);
    const currentToken = useCallback(() => token.current, []);

    return {
        phase, loadError, map, cats, saving, load, persist,
        /** 저장 중이면 true(창 닫기·중복 저장 막기용, 렌더와 무관하게 바로 읽는다) */
        isSaving,
        /** 견적 관리자 값(사진 올리기 등) */
        token: currentToken,
    };
}
