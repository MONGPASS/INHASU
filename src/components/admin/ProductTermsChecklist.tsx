import { useState } from 'react';
import { quoteExclusions, quoteIncludedLabels } from '../../../public/quote-inclusions.js';

interface Props {
    kind: 'included' | 'excluded';
    selected: string[];
    onChange: (items: string[]) => void;
}

export function ProductTermsChecklist({ kind, selected, onChange }: Props) {
    const included = kind === 'included';
    const title = included ? '포함 사항' : '불포함 사항';
    const defaults = included ? quoteIncludedLabels : quoteExclusions;
    const [custom, setCustom] = useState<string[]>(() => selected.filter(item => !defaults.includes(item)));
    const [input, setInput] = useState('');
    const choices = [...new Set([...defaults, ...custom, ...selected])];

    const add = () => {
        const label = input.trim();
        if (!label) return;
        if (!defaults.includes(label) && !custom.includes(label)) setCustom(items => [...items, label]);
        if (!selected.includes(label)) onChange([...selected, label]);
        setInput('');
    };

    return <section className="edit-sec pa-terms" aria-label={title}>
        <div className="edit-sec-head">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ color: included ? 'var(--mrt-green)' : 'var(--mrt-red)' }}>{included ? 'check_circle' : 'cancel'}</span>
            <h4>{title}</h4>
        </div>
        <div className="pa-term-choices">
            {choices.map(item => <label className="pa-term-choice" key={item}>
                <input type="checkbox" checked={selected.includes(item)} onChange={event => {
                    onChange(event.target.checked ? [...selected, item] : selected.filter(value => value !== item));
                }} />
                {item}
            </label>)}
        </div>
        <div className="pa-term-add">
            <input type="text" className="inp" aria-label={title + ' 직접 입력'} placeholder="직접 입력"
                value={input} onChange={event => setInput(event.target.value)}
                onKeyDown={event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) add();
                    }
                }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={add} disabled={!input.trim()}>추가</button>
        </div>
    </section>;
}
