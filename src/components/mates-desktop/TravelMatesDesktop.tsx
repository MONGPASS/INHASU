import { useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotImages } from '../../hooks/useSpotImages';
import { MW, MW_FONT_EN, MW_GRADIENT, MW_STICKY_TOP, cleanTitle, isUsableImage } from '../desktop-primitives/mwTokens';
import {
    AGE_LABEL,
    GENDER_LABEL,
    STATUS_LABEL,
    STYLE_LABEL,
    hideBroken,
    matePhoto,
    regionPhoto,
    seatText,
    useMatePosts,
    type MatePost,
    type MateStatus,
} from './matesData';

type Sort = 'new' | 'date' | 'pop';
type GroupKey = 'status' | 'gender' | 'age' | 'style' | 'size';
type Filters = Partial<Record<GroupKey, string[]>>;

const ALL = 'all';
const WRITE_PATH = '/travel-mates/write';
const PANEL_BG = 'linear-gradient(160deg,#0F2A3B 0%,#1C8571 100%)';
const STATUS_PILL: Record<MateStatus, [string, string]> = {
    open: ['#3FC2A4', MW.navy],
    few: ['#F2B544', MW.navy],
    done: ['rgba(10,31,46,0.72)', '#FFFFFF'],
};
const SEAT_FG: Record<MateStatus, string> = { open: MW.mintDeep, few: '#9A5B00', done: MW.mute2 };

const SORTS: [Sort, string][] = [
    ['new', '최신순'],
    ['date', '출발 임박순'],
    ['pop', '인기순'],
];

const STEPS = [
    ['01', '모집글 찾기·올리기', '여행지와 일정, 여행 스타일로 마음 맞는 동행을 찾아보세요. 마땅한 글이 없으면 무료로 모집글을 올릴 수 있습니다.'],
    ['02', '댓글로 상의하기', '마음에 드는 모집글에는 댓글로 질문이나 참가 의사를 남겨 보세요. 일정과 플랜을 편하게 상의할 수 있습니다.'],
    ['03', '여행 준비는 몽골리아 은하수에', '멤버가 정해지면 한국어 가이드·차량·숙박 준비를 몽골리아 은하수에 한 번에 상담할 수 있습니다.'],
];

/** Border-color hover used by the design's pill buttons (`style-hover="border-color:#27AB8F"`). */
const hoverBorder = (base: string) => ({
    onMouseEnter: (e: MouseEvent<HTMLElement>) => (e.currentTarget.style.borderColor = MW.mint),
    onMouseLeave: (e: MouseEvent<HTMLElement>) => (e.currentTarget.style.borderColor = base),
});

function matchesQuery(p: MatePost, q: string) {
    if (!q) return true;
    const hay = `${p.title} ${p.description} ${p.region} ${p.styles.join(' ')}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function TravelMatesDesktop() {
    const navigate = useNavigate();
    const { pick } = useSpotImages();
    const { data: posts = [], isLoading } = useMatePosts();
    const [query, setQuery] = useState('');
    const [dest, setDest] = useState(ALL);
    const [sort, setSort] = useState<Sort>('new');
    const [filters, setFilters] = useState<Filters>({});

    const q = query.trim();
    const has = (k: GroupKey, v: string) => (filters[k] || []).includes(v);
    const toggle = (k: GroupKey, v: string) =>
        setFilters((f) => {
            const cur = f[k] || [];
            return { ...f, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
        });
    const reset = () => {
        setFilters({});
        setQuery('');
        setDest(ALL);
    };

    // Everything except the destination tab — the tab counts are computed from this.
    const base = useMemo(() => {
        const on = (k: GroupKey) => filters[k] || [];
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
        const list = base.filter((p) => dest === ALL || p.region === dest);
        const upcoming = (p: MatePost) => (p.daysLeft == null || p.daysLeft < 0 ? Number.MAX_SAFE_INTEGER : p.daysLeft);
        const sorters: Record<Sort, (a: MatePost, b: MatePost) => number> = {
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

    const groups: { key: GroupKey; title: string; opts: [string, string][] }[] = [
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
    const tabs = [ALL, ...regions].map((key) => ({
        key,
        label: key === ALL ? '전체' : key,
        n: key === ALL ? base.length : base.filter((p) => p.region === key).length,
        photo: key === ALL ? pick(['モンゴルの大草原', '몽골 대초원', '몽골의 대초원']) : regionPhoto(key, pick),
    }));

    const write = () => navigate(WRITE_PATH);

    return (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 104px', display: 'flex', flexDirection: 'column', gap: 40 }}>
            <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 13, color: MW.mute }}>
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ color: MW.mute, textDecoration: 'none' }}>홈</a>
                <span>›</span>
                <span style={{ color: MW.navy, fontWeight: 700 }}>동행 찾기</span>
            </nav>

            {/* Header */}
            <div style={{ marginTop: -16, borderRadius: 32, overflow: 'hidden', background: `linear-gradient(135deg,${MW.mintBg} 0%,#FFFFFF 60%)`, border: `1px solid ${MW.mintTint}`, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
                <div style={{ flex: '1 1 520px', minWidth: 0, padding: 'clamp(28px,5vw,56px)', display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center' }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>TRAVEL MATES</span>
                    <h1 style={{ margin: 0, fontSize: 'clamp(34px,4.4vw,52px)', fontWeight: 900, lineHeight: 1.2, color: MW.navy }}>동행을 찾아보세요</h1>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: MW.mute, maxWidth: 520 }}>
                        몽골을 함께 여행할 동행을 모집하거나 모집글에 참가할 수 있습니다. 취향·예산·일정이 맞는 사람과 경비를 나누고, 현지를 더 깊이 즐겨 보세요.
                    </p>
                    <label style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, height: 56, padding: '0 8px 0 22px', borderRadius: 999, background: '#fff', boxShadow: '0 8px 24px rgba(10,31,46,0.08)', border: `1px solid ${MW.line}`, maxWidth: 520 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={MW.mintDeep} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                            <circle cx="11" cy="11" r="6.5" />
                            <path d="M16 16l4.5 4.5" />
                        </svg>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="여행지·키워드로 검색"
                            aria-label="동행 찾기 검색"
                            style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', fontSize: 15, fontFamily: 'inherit', color: MW.navy, background: 'transparent' }}
                        />
                        {query && (
                            <button type="button" onClick={() => setQuery('')} aria-label="지우기" style={{ width: 40, height: 40, border: 0, borderRadius: '50%', background: MW.chip, color: MW.mute, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>
                                ×
                            </button>
                        )}
                    </label>
                    {keywords.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: MW.mute, marginRight: 4 }}>인기 키워드</span>
                            {keywords.map((k) => {
                                const on = q === k;
                                const bd = on ? MW.mint : MW.mintTint;
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => setQuery(on ? '' : k)}
                                        {...hoverBorder(bd)}
                                        style={{ height: 34, padding: '0 14px', borderRadius: 999, border: `1px solid ${bd}`, background: on ? MW.mintTint : '#FFFFFF', color: MW.mintDeep, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        #{k}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div style={{ flex: '1 1 380px', minWidth: 280, position: 'relative', overflow: 'hidden', background: PANEL_BG, color: '#FFFFFF', padding: 'clamp(28px,4vw,44px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
                    <span aria-hidden="true" style={{ position: 'absolute', right: -90, top: -90, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(109,219,190,0.35),rgba(109,219,190,0) 70%)', pointerEvents: 'none' }} />
                    <span aria-hidden="true" style={{ position: 'absolute', left: -60, bottom: -60, width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.14)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
                            몽골리아<span style={{ color: MW.mintLight }}> 은하수</span> mates
                        </span>
                        <span style={{ fontSize: 13, color: MW.mintTint }}>혼자 떠나는 여행도, 동행과 나누면 더 가볍게.</span>
                    </div>
                    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
                        {stats.map((s) => (
                            <div key={s.l} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 26, fontWeight: 600 }}>{isLoading ? '–' : s.n}</span>
                                <span style={{ fontSize: 12, color: MW.mintTint }}>{s.l}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button
                            type="button"
                            onClick={write}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                        >
                            <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>동행 모집하기
                        </button>
                        <span style={{ fontSize: 12, color: MW.mintTint, textAlign: 'center' }}>무료로 올릴 수 있습니다</span>
                    </div>
                </div>
            </div>

            {/* Destination tabs */}
            {regions.length > 0 && (
                <div role="tablist" aria-label="여행지" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 2px', margin: '-8px -2px 0' }}>
                    {tabs.map((t) => {
                        const on = dest === t.key;
                        const bd = on ? MW.mint : MW.line;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                onClick={() => setDest(t.key)}
                                {...hoverBorder(bd)}
                                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 18px 0 6px', borderRadius: 999, border: `1.5px solid ${bd}`, background: on ? MW.mintBg : '#FFFFFF', color: on ? MW.mintDeep : MW.navy, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .15s' }}
                            >
                                <span aria-hidden="true" style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: MW.mintTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: MW.mintDeep }}>
                                    {t.label.charAt(0)}
                                    {isUsableImage(t.photo) && (
                                        <img src={t.photo} onError={hideBroken} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )}
                                    {on && (
                                        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(10,31,46,0.45)', color: '#fff', fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
                                    )}
                                </span>
                                {t.label}
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, color: on ? MW.mintDeep : MW.mute2 }}>{t.n}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Filters */}
                <aside aria-label="필터" style={{ flex: '0 1 220px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 24, position: 'sticky', top: MW_STICKY_TOP + 24, maxHeight: `calc(100vh - ${MW_STICKY_TOP + 48}px)`, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 900, color: MW.navy }}>
                            필터
                            {activeCount > 0 && (
                                <span style={{ minWidth: 22, height: 22, padding: '0 7px', boxSizing: 'border-box', borderRadius: 999, background: MW.mint, color: MW.navy, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeCount}</span>
                            )}
                        </span>
                        <button
                            type="button"
                            onClick={reset}
                            onMouseEnter={(e) => (e.currentTarget.style.color = MW.mintDeep)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = MW.mute)}
                            style={{ border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.mute, cursor: 'pointer' }}
                        >
                            초기화
                        </button>
                    </div>
                    {groups.map((g) => (
                        <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 20, borderTop: `1px solid ${MW.line}` }}>
                            <span style={{ fontSize: 13, fontWeight: 900, color: MW.navy }}>{g.title}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {g.opts.map(([v, label]) => {
                                    const on = has(g.key, v);
                                    const bd = on ? MW.mint : MW.line;
                                    return (
                                        <button
                                            key={v}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => toggle(g.key, v)}
                                            {...hoverBorder(bd)}
                                            style={{ height: 34, padding: '0 14px', borderRadius: 999, border: `1px solid ${bd}`, background: on ? MW.mintTint : '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500, color: on ? MW.mintDeep : MW.ink3, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </aside>

                {/* Results */}
                <div style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>OPEN TRIPS</span>
                            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.3, color: MW.navy }}>
                                모집 중인 여행 <span style={{ fontFamily: MW_FONT_EN, fontSize: 18, fontWeight: 600, color: MW.mintDeep }}>{items.length}</span>
                            </h2>
                        </div>
                        <div role="tablist" aria-label="정렬" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: MW.chip }}>
                            {SORTS.map(([k, label]) => {
                                const on = sort === k;
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        role="tab"
                                        aria-selected={on}
                                        onClick={() => setSort(k)}
                                        style={{ height: 36, padding: '0 16px', border: 0, borderRadius: 999, background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 2px 6px rgba(10,31,46,0.08)' : 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: on ? MW.navy : MW.mute, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {isLoading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,250px),1fr))', gap: '36px 22px' }}>
                            {[0, 1, 2].map((i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ aspectRatio: '4/3', borderRadius: 20, background: MW.chip }} />
                                    <div style={{ height: 18, width: '80%', borderRadius: 6, background: MW.chip }} />
                                    <div style={{ height: 14, width: '50%', borderRadius: 6, background: MW.chip }} />
                                </div>
                            ))}
                        </div>
                    ) : items.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,250px),1fr))', gap: '36px 22px' }}>
                            {items.map((p) => (
                                <MateCard key={p.id} p={p} photo={matePhoto(p, pick)} onOpen={() => navigate(`/travel-mates/${p.id}`)} />
                            ))}
                        </div>
                    ) : (
                        <div style={{ border: `1px dashed ${MW.line2}`, borderRadius: 20, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: MW.navy }}>
                                {posts.length ? '조건에 맞는 모집글이 없습니다' : '아직 모집글이 없습니다'}
                            </p>
                            <p style={{ margin: 0, fontSize: 13, color: MW.mute }}>
                                {posts.length ? '조건을 바꾸거나 직접 동행을 모집해 보세요.' : '첫 번째 동행 모집글을 올려 보세요.'}
                            </p>
                            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                                {posts.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={reset}
                                        {...hoverBorder(MW.line)}
                                        style={{ height: 44, padding: '0 20px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                                    >
                                        조건 초기화
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={write}
                                    style={{ height: 44, padding: '0 20px', border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                                >
                                    + 동행 모집하기
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* How it works */}
            <div style={{ borderRadius: 32, background: 'radial-gradient(600px 320px at 88% 0%,rgba(39,171,143,0.14),rgba(39,171,143,0) 70%),#F7FAF9', border: `1px solid ${MW.line}`, padding: 'clamp(28px,4vw,48px)', display: 'flex', flexDirection: 'column', gap: 28 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>HOW IT WORKS</span>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: MW.navy }}>안심하고 동행과 여행하려면</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 16 }}>
                    {STEPS.map(([n, title, body]) => (
                        <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 22, borderRadius: 20, background: '#FFFFFF', border: `1px solid ${MW.line}` }}>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600, color: MW.mintDeep }}>{n}</span>
                            <span style={{ fontSize: 16, fontWeight: 900, color: MW.navy }}>{title}</span>
                            <span style={{ fontSize: 13, lineHeight: 1.7, color: MW.mute }}>{body}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function MateCard({ p, photo, onOpen }: { p: MatePost; photo: string; onOpen: () => void }) {
    const [sbg, sfg] = STATUS_PILL[p.status];
    const dots = Math.min(p.cap, 6);
    const title = cleanTitle(p.title) || p.title;
    return (
        <a
            href={`/travel-mates/${p.id}`}
            onClick={(e) => { e.preventDefault(); onOpen(); }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, color: MW.navy, opacity: p.status === 'done' ? 0.72 : 1, textDecoration: 'none', transition: 'transform .2s', minWidth: 0 }}
        >
            <div style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 20, overflow: 'hidden', background: PANEL_BG }}>
                {isUsableImage(photo) && (
                    <img src={photo} onError={hideBroken} alt={p.image ? title : `${p.region} 이미지`} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <span style={{ position: 'absolute', inset: 'auto 0 0 0', height: '55%', background: 'linear-gradient(180deg,rgba(10,31,46,0),rgba(10,31,46,0.6))', pointerEvents: 'none' }} />
                <span style={{ position: 'absolute', left: 10, top: 10, display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 999, background: sbg, color: sfg, fontSize: 11, fontWeight: 700 }}>{STATUS_LABEL[p.status]}</span>
                <span style={{ position: 'absolute', right: 10, top: 10, display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', color: MW.navy, fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600 }}>{p.period}</span>
                <span style={{ position: 'absolute', left: 14, right: 14, bottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, color: '#FFFFFF', pointerEvents: 'none' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintTint }}>{p.region}</span>
                        {p.nightsLabel && <span style={{ fontSize: 13, fontWeight: 700 }}>{p.nightsLabel}</span>}
                    </span>
                    {dots > 0 && (
                        <span style={{ display: 'flex', paddingLeft: 5 }} aria-label={`${p.joined}/${p.cap}명`}>
                            {Array.from({ length: dots }, (_, k) => (
                                <span key={k} style={{ width: 22, height: 22, marginLeft: -5, borderRadius: '50%', border: '2px solid #FFFFFF', boxSizing: 'border-box', background: k < p.joined ? '#3FC2A4' : 'rgba(255,255,255,0.35)' }} />
                            ))}
                        </span>
                    )}
                </span>
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 900, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{title}</h3>
            {p.styles.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {p.styles.slice(0, 4).map((s) => (
                        <span key={s} style={{ fontSize: 11, fontWeight: 700, color: MW.mintDeep, background: MW.mintBg, border: `1px solid ${MW.mintTint}`, padding: '3px 10px', borderRadius: 999 }}>#{s}</span>
                    ))}
                </div>
            )}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid #EEF1EF' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <HostAvatar p={p} size={30} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.host}</span>
                        <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[p.hostInfo, p.posted].filter(Boolean).join(' · ')}</span>
                    </span>
                </span>
                {p.cap > 0 && (
                    <span style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 4, fontSize: 12, color: MW.mute }}>
                        <strong style={{ fontFamily: MW_FONT_EN, fontSize: 14, fontWeight: 600, color: SEAT_FG[p.status] }}>{p.joined}/{p.cap}</strong>
                        {seatText(p)}
                    </span>
                )}
            </div>
        </a>
    );
}

export function HostAvatar({ p, size }: { p: Pick<MatePost, 'hostImage' | 'initial'>; size: number }) {
    return (
        <span style={{ position: 'relative', width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: MW_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: Math.round(size * 0.38), fontWeight: 600, color: MW.navy, flexShrink: 0 }}>
            {p.initial}
            {p.hostImage && <img src={p.hostImage} onError={hideBroken} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        </span>
    );
}
