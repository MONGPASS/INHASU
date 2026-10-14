import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { quoteDayFields } from '../../utils/reservationInline';

type QuoteDay = ReturnType<typeof quoteDayFields> & { d: number };
type QuoteField = 'date' | 'dest' | 'move' | 'items' | 'stay' | 'meals';
interface Props {
    days: QuoteDay[];
    startDate: string;
    endDate: string;
    snippets: Record<string, any>;
    snippetCats: string[];
    disabled: boolean;
    syncKey: string;
    onField: (index: number, field: QuoteField, value: any) => void;
    onSnippet: (index: number, name: string) => void;
    onDelete: (index: number) => void;
    onReorder: (from: number, to: number) => void;
    onAdd: () => void;
    onNotice: (message: string) => void;
    renderDetails: (index: number) => ReactNode;
}
interface WidgetOptions extends Omit<Props, 'renderDetails'> {
    extras: boolean;
    forceValues: boolean;
    afterRender: (cards: HTMLElement[]) => void;
}
interface Widget { update: (options: WidgetOptions) => void; destroy: () => void; }
interface SharedEditor { mount: (host: HTMLElement, options: WidgetOptions) => Widget; }
const editorWindow = () => window as Window & { QuoteDayEditor?: SharedEditor };
let loading: Promise<SharedEditor> | null = null;

function loadEditor(): Promise<SharedEditor> {
    const existing = editorWindow().QuoteDayEditor;
    if (existing) return Promise.resolve(existing);
    if (loading) return loading;
    loading = new Promise<SharedEditor>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/quote-day-editor.js';
        script.async = true;
        script.onload = () => {
            const editor = editorWindow().QuoteDayEditor;
            if (editor) resolve(editor);
            else { loading = null; script.remove(); reject(new Error('견적 일정 편집기를 초기화하지 못했습니다.')); }
        };
        script.onerror = () => { loading = null; script.remove(); reject(new Error('견적 일정 편집기를 불러오지 못했습니다. 다시 시도해 주세요.')); };
        document.head.appendChild(script);
    });
    return loading;
}

/** Mount the very same day-card widget used by 견적만들기.html. */
export function QuoteDayEditor(p: Props) {
    const host = useRef<HTMLDivElement>(null);
    const widget = useRef<Widget | null>(null);
    const scrollToAdded = useRef(false);
    const latest = useRef(p);
    const syncedKey = useRef(p.syncKey);
    latest.current = p;
    const [slots, setSlots] = useState<HTMLElement[]>([]);
    const [error, setError] = useState('');
    const [ready, setReady] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const options = (): WidgetOptions => ({
        ...latest.current,
        extras: true,
        forceValues: latest.current.syncKey !== syncedKey.current,
        onField: (...args) => latest.current.onField(...args),
        onSnippet: (...args) => latest.current.onSnippet(...args),
        onDelete: (...args) => latest.current.onDelete(...args),
        onReorder: (...args) => latest.current.onReorder(...args),
        onAdd: () => { scrollToAdded.current = true; latest.current.onAdd(); },
        onNotice: message => latest.current.onNotice(message),
        afterRender: cards => {
            syncedKey.current = latest.current.syncKey;
            const next = cards.map(card => card.querySelector<HTMLElement>('.quote-day-extra')).filter((node): node is HTMLElement => !!node);
            setSlots(previous => previous.length === next.length && previous.every((node, index) => node === next[index]) ? previous : next);
            if (scrollToAdded.current) { cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); scrollToAdded.current = false; }
        },
    });
    useEffect(() => {
        let disposed = false;
        setError(''); setReady(false);
        loadEditor().then(editor => {
            if (disposed || !host.current) return;
            widget.current = editor.mount(host.current, options());
            setReady(true);
        }).catch(reason => { if (!disposed) setError(reason?.message || '일정 편집기를 불러오지 못했습니다.'); });
        return () => { disposed = true; widget.current?.destroy(); widget.current = null; };
        // The widget keeps its DOM while React supplies the latest reservation draft.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt]);
    useLayoutEffect(() => { widget.current?.update(options()); });

    return <>
        <link rel="stylesheet" href="/quote-day-editor.css" precedence="quote-day-editor" />
        {!ready && !error && <p className="ri-library-note" role="status">견적서의 일자별 일정 편집기를 불러오고 있습니다.</p>}
        {error && <div className="ri-library-error" role="alert">{error}<button type="button" onClick={() => setAttempt(value => value + 1)}>다시 시도</button></div>}
        <div ref={host} className="quote-day-editor" aria-label="견적서 일자별 일정 편집" />
        {slots.map((slot, index) => createPortal(p.renderDetails(index), slot, String(index)))}
    </>;
}
