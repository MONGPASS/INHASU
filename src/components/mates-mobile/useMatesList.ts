import { useMemo, useState } from 'react';
import { AGE_LABEL, GENDER_LABEL, STATUS_LABEL, STYLE_LABEL, useMatePosts, type MatePost } from '../mates-desktop/matesData';

export type MateSort = 'new' | 'date' | 'pop';
export type MateFilterKey = 'status' | 'gender' | 'age' | 'style' | 'size';
export type MateFilters = Partial<Record<MateFilterKey, string[]>>;
export interface MateFilterGroup {
    key: MateFilterKey;
    title: string;
    opts: [string, string][];
}

export const ALL_DESTS = 'all';

export const MATE_SORTS: [MateSort, string][] = [
    ['new', '최신순'],
    ['date', '출발 임박순'],
    ['pop', '인기순'],
];

function matchesQuery(p: MatePost, q: string) {
    if (!q) return true;
    const hay = `${p.title} ${p.description} ${p.region} ${p.styles.join(' ')}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/**
 * Search / destination / filter / sort state of the mobile list.
 * Same rules as the PC list (TravelMatesDesktop) over the same `useMatePosts` data.
 */
export function useMatesList() {
    const { data: posts = [], isLoading } = useMatePosts();
    const [query, setQuery] = useState('');
    const [dest, setDest] = useState(ALL_DESTS);
    const [sort, setSort] = useState<MateSort>('new');
    const [filters, setFilters] = useState<MateFilters>({});

    const q = query.trim();
    const has = (k: MateFilterKey, v: string) => (filters[k] || []).includes(v);
    const toggle = (k: MateFilterKey, v: string) =>
        setFilters((f) => {
            const cur = f[k] || [];
            return { ...f, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
        });
    const resetFilters = () => setFilters({});
    const resetAll = () => {
        setFilters({});
        setQuery('');
        setDest(ALL_DESTS);
    };

    // Everything except the destination tab — the tab counts are computed from this.
    const base = useMemo(() => {
        const on = (k: MateFilterKey) => filters[k] || [];
        return posts.filter(
            (p) =>
                matchesQuery(p, q) &&
                (!on('status').length || on('status').includes(p.status)) &&
                (!on('gender').length || on('gender').includes(p.gender)) &&
                (!on('age').length || p.ages.some((a) => on('age').includes(a))) &&
                (!on('style').length || p.styles.some((s) => on('style').includes(s))) &&
                (!on('size').length || on('size').includes(p.size)),
        );
    }, [posts, q, filters]);

    const items = useMemo(() => {
        const list = base.filter((p) => dest === ALL_DESTS || p.region === dest);
        const upcoming = (p: MatePost) => (p.daysLeft == null || p.daysLeft < 0 ? Number.MAX_SAFE_INTEGER : p.daysLeft);
        const sorters: Record<MateSort, (a: MatePost, b: MatePost) => number> = {
            new: (a, b) => b.createdAt - a.createdAt,
            date: (a, b) => upcoming(a) - upcoming(b) || b.createdAt - a.createdAt,
            pop: (a, b) => b.views - a.views,
        };
        return [...list].sort(sorters[sort]);
    }, [base, dest, sort]);

    // Destinations present in the data, most-posted first.
    const regions = useMemo(() => {
        const counts = new Map<string, number>();
        posts.forEach((p) => counts.set(p.region, (counts.get(p.region) || 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
    }, [posts]);

    // Popular keywords = the most frequent styles / destinations in the posts.
    const keywords = useMemo(() => {
        const counts = new Map<string, number>();
        posts.forEach((p) => [...p.styles, p.region].forEach((w) => counts.set(w, (counts.get(w) || 0) + 1)));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
    }, [posts]);

    const styleOptions = useMemo(() => {
        const extra = posts.flatMap((p) => p.styles).filter((s) => !Object.values(STYLE_LABEL).includes(s));
        return [...Object.values(STYLE_LABEL), ...new Set(extra)];
    }, [posts]);

    const groups: MateFilterGroup[] = [
        { key: 'status', title: '모집 상태', opts: Object.entries(STATUS_LABEL) },
        { key: 'gender', title: '성별', opts: [['any', '무관'], ['female', GENDER_LABEL.female], ['male', GENDER_LABEL.male]] },
        { key: 'age', title: '연령대', opts: Object.entries(AGE_LABEL) },
        { key: 'style', title: '여행 스타일', opts: styleOptions.map((s) => [s, s]) },
        { key: 'size', title: '모집 인원', opts: [['s', '1~2명'], ['m', '3~4명'], ['l', '5명 이상']] },
    ];

    const activeCount = Object.values(filters).reduce((n, a) => n + (a?.length || 0), 0);
    const open = posts.filter((p) => p.status !== 'done');
    const stats = [
        { n: open.length, l: '모집 중인 여행' },
        { n: open.reduce((n, p) => n + p.left, 0), l: '남은 자리' },
        { n: regions.length, l: '여행지' },
    ];
    const tabs = [ALL_DESTS, ...regions].map((key) => ({
        key,
        label: key === ALL_DESTS ? '전체' : key,
        n: key === ALL_DESTS ? base.length : base.filter((p) => p.region === key).length,
    }));

    return {
        posts, isLoading, items,
        query, q, setQuery,
        dest, setDest, tabs,
        sort, setSort,
        has, toggle, groups, activeCount, resetFilters, resetAll,
        keywords, stats,
    };
}
