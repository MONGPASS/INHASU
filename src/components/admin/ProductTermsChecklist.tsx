import { useState } from 'react';
import { quoteExclusions, quoteIncludedLabels } from '../../../public/quote-inclusions.js';
import { AdminButton, AdminCheckbox, AdminTextInput } from './ui';
import './CourseImportModal.css';

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
            <span className={`material-symbols-outlined cim-term-icon ${included ? 'is-included' : 'is-excluded'}`} aria-hidden="true">{included ? 'check_circle' : 'cancel'}</span>
            <h4>{title}</h4>
        </div>
        <div className="pa-term-choices">
            {choices.map(item => <AdminCheckbox key={item} className="cim-term-choice" label={item}
                checked={selected.includes(item)} onChange={checked => {
                    onChange(checked ? [...selected, item] : selected.filter(value => value !== item));
                }} />)}
        </div>
        <div className="pa-term-add">
            <AdminTextInput className="cim-term-input" aria-label={title + ' 직접 입력'} placeholder="직접 입력"
                value={input} onChange={event => setInput(event.target.value)}
                onKeyDown={event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) add();
                    }
                }} />
            <AdminButton variant="secondary" onClick={add} disabled={!input.trim()}>추가</AdminButton>
        </div>
    </section>;
}
