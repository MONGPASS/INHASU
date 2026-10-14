import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RepresentativeSpotSnapshot } from '../../types/product';
import { normalizeRepresentativeSpots } from '../../../functions/lib/productItinerary';

interface Library { spots: Record<string, any>; categories: string[]; }
interface SelectorProps extends Library {
    selected: string[];
    disabled?: boolean;
    onToggle: (name: string, value: any) => void;
}
interface Widget { update: (options: SelectorProps) => void; destroy: () => void; }
interface SharedSelector { mount: (host: HTMLElement, options: SelectorProps) => Widget; }
const selectorWindow = () => window as Window & { QuoteSpotSelector?: SharedSelector };
let loading: Promise<SharedSelector> | null = null;

function loadSelector(): Promise<SharedSelector> {
    const existing = selectorWindow().QuoteSpotSelector;
    if (existing) return Promise.resolve(existing);
    if (loading) return loading;
    loading = new Promise<SharedSelector>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/quote-spot-selector.js';
        script.async = true;
        script.onload = () => {
            const selector = selectorWindow().QuoteSpotSelector;
            if (selector) resolve(selector);
            else { loading = null; script.remove(); reject(new Error('대표 명소 선택 화면을 초기화하지 못했습니다.')); }
        };
        script.onerror = () => { loading = null; script.remove(); reject(new Error('대표 명소 선택 화면을 불러오지 못했습니다.')); };
        document.head.appendChild(script);
    });
    return loading;
}

/** The original quote STEP 4 widget, shared by quotes, products and bookings. */
export function QuoteSpotSelector(p: SelectorProps) {
    const host = useRef<HTMLDivElement>(null);
    const widget = useRef<Widget | null>(null);
    const latest = useRef(p);
    latest.current = p;
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const options = (): SelectorProps => ({ ...latest.current, onToggle: (...args) => latest.current.onToggle(...args) });
    useEffect(() => {
        let disposed = false;
        setReady(false); setError('');
        loadSelector().then(selector => {
            if (disposed || !host.current) return;
            widget.current = selector.mount(host.current, options());
            setReady(true);
        }).catch(reason => { if (!disposed) setError(reason?.message || '대표 명소 선택 화면을 불러오지 못했습니다.'); });
        return () => { disposed = true; widget.current?.destroy(); widget.current = null; };
        // The shared widget keeps its buttons while React supplies the current selection.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt]);
    useLayoutEffect(() => { widget.current?.update(options()); });
    return <>
        <link rel="stylesheet" href="/quote-spot-selector.css" precedence="quote-spot-selector" />
        {!ready && !error && <p role="status">대표 명소 선택 화면을 불러오고 있습니다.</p>}
        {error && <p role="alert">{error} <button type="button" disabled={p.disabled} onClick={() => setAttempt(value => value + 1)}>다시 시도</button></p>}
        <div ref={host} className="quote-spot-selector" aria-label="대표 명소 선택" />
    </>;
}

/** Selecting a new spot captures its photos and text; existing selections remain snapshots. */
export function toggleRepresentativeSpot(selected: RepresentativeSpotSnapshot[], name: string, value: any): RepresentativeSpotSnapshot[] {
    if (selected.some(spot => spot.name === name)) return selected.filter(spot => spot.name !== name);
    if (!value || typeof value !== 'object') return selected;
    const snapshot = normalizeRepresentativeSpots([{ name, nameMn: value.nameMn, short: value.short, region: value.region,
        desc: value.desc, img: value.img, subImgs: value.subImgs }]);
    return [...selected, ...snapshot];
}

/** Products use the same quote master library, rather than a second copy of spot data. */
export function ProductRepresentativeSpots({ value, onChange, disabled = false }: {
    value: RepresentativeSpotSnapshot[];
    onChange: (value: RepresentativeSpotSnapshot[]) => void;
    disabled?: boolean;
}) {
    const [library, setLibrary] = useState<Library | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setError('');
        const read = async (key: 'spots' | 'spot_cats') => {
            const response = await fetch(`/api/data/${key}`, { cache: 'no-store', signal: controller.signal });
            const payload = await response.json();
            if (!response.ok || payload?.ok !== true) throw new Error('명소 자료를 불러오지 못했습니다. 다시 시도해 주세요.');
            const data = payload.data ?? (key === 'spots' ? {} : []);
            if (key === 'spots' ? typeof data !== 'object' || Array.isArray(data) : !Array.isArray(data) || data.some((item: unknown) => typeof item !== 'string')) {
                throw new Error('명소 자료 형식을 확인할 수 없습니다.');
            }
            return data;
        };
        Promise.all([read('spots'), read('spot_cats')]).then(([spots, categories]) => {
            if (!controller.signal.aborted) setLibrary({ spots, categories });
        }).catch(reason => { if (!controller.signal.aborted) setError(reason?.message || '명소 자료를 불러오지 못했습니다.'); });
        return () => controller.abort();
    }, [attempt]);
    return <section style={{ maxWidth: 1000 }} aria-label="상품 대표 명소">
        <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>대표 명소</h3>
        <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 13 }}>견적서와 같은 목록입니다. 선택한 순서·사진·설명이 이 상품의 예약 일정표에 이어집니다.</p>
        {error ? <p role="alert">{error} <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => setAttempt(current => current + 1)}>다시 시도</button></p>
            : !library ? <p role="status">등록된 명소를 불러오고 있습니다.</p>
            : <QuoteSpotSelector {...library} selected={value.map(spot => spot.name)} disabled={disabled}
                onToggle={(name, spot) => onChange(toggleRepresentativeSpot(value, name, spot))} />}
    </section>;
}
