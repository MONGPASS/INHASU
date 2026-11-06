import React, { useEffect, useRef, useState } from 'react';
import type { DesignTemplateField } from '../../product/designTemplates/types';
import { Ico } from '../v7/v7Ui';
import { PopoverShell } from './PopoverShell';
import { PresetChips, PresetLineChips } from './PresetChips';
import { isCommitKey } from './inlineEdit';

const btn = (primary = false): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', font: 'inherit',
    border: primary ? '1.5px solid #1A1B1E' : '1.5px solid #e5e8eb', background: primary ? '#1A1B1E' : '#fff', color: primary ? '#fff' : '#1A1B1E',
});

/**
 * 문구 한 칸을 그 자리에서 고치는 편집창. 입력하는 대로 미리보기에 반영되고,
 * Enter(여러 줄은 Ctrl+Enter)·‘적용’·바깥 클릭이면 그대로 두고 닫힌다. Esc는 열기 전 값으로 되돌린다.
 */
export function FieldPopover({ field, value, anchor, disabled = false, readOnlyNote, onChange, onClear, onClose, isInside }: {
    field: DesignTemplateField; value: string; anchor: DOMRect | null; disabled?: boolean;
    /** 자동 반영 값(가격표)처럼 여기서 고칠 수 없는 칸의 안내 */
    readOnlyNote?: string;
    onChange: (next: string) => void; onClear: () => void; onClose: () => void; isInside?: (target: Element) => boolean;
}) {
    const multiline = field.type === 'textarea';
    const original = useRef(value);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    useEffect(() => { original.current = value; setDraft(value); }, [field.key]); // eslint-disable-line react-hooks/exhaustive-deps -- 다른 칸으로 옮길 때만 초기화
    // 껍데기는 앵커를 잰 뒤에야 내용을 그리므로, 입력칸이 생긴 첫 렌더에 한 번만 포커스한다(스크롤로 앵커가 바뀔 때는 건드리지 않는다)
    const focusedFor = useRef<string | null>(null);
    useEffect(() => {
        const el = inputRef.current;
        if (!el || readOnlyNote || focusedFor.current === field.key) return;
        focusedFor.current = field.key;
        // 껍데기가 위치를 잡기 전(visibility:hidden)에는 focus()가 무시되므로 한 프레임 뒤에 준다
        requestAnimationFrame(() => { el.focus({ preventScroll: true }); el.select?.(); });
    }, [field.key, readOnlyNote, anchor]);

    const update = (next: string) => { setDraft(next); onChange(next); };
    const cancel = () => { onChange(original.current); onClose(); };
    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (isCommitKey(event, multiline)) { event.preventDefault(); onClose(); }
    };
    const rows = Math.min(8, Math.max(3, (field.default?.split('\n').length ?? 3) + 1));
    const changed = draft !== '' && draft !== (field.default ?? '');

    return <PopoverShell anchor={anchor} label={`${field.label} 편집`} width={multiline ? 440 : 360} onClose={onClose} onEscape={cancel} isInside={isInside}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <b style={{ fontSize: 13, fontWeight: 800, color: '#1A1B1E' }}>{field.label}</b>
            <span style={{ fontSize: 11, color: '#868e96' }}>{changed ? '수정됨' : '원본 문구'}</span>
            <button type="button" aria-label="닫기" onClick={onClose} style={{ marginLeft: 'auto', width: 28, height: 28, border: 0, borderRadius: 999, background: 'transparent', color: '#868e96', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name="lc-x" size={15} /></button>
        </div>
        {readOnlyNote ? <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8f9fa', fontSize: 12.5, color: '#495057', lineHeight: 1.6 }}>{readOnlyNote}</div> : <>
            {field.presets && <PresetChips presets={field.presets} value={draft} onPick={update} />}
            {field.presetLines && <PresetLineChips presetLines={field.presetLines} separator={field.presetSeparator} value={draft} onChange={update} />}
            {multiline
                ? <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} className="inp" rows={rows} value={draft} placeholder={field.default || ''} disabled={disabled} onChange={e => update(e.target.value)} onKeyDown={onKeyDown}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, lineHeight: 1.6, resize: 'vertical' }} />
                : <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text" className="inp" value={draft} placeholder={field.default || ''} disabled={disabled} onChange={e => update(e.target.value)} onKeyDown={onKeyDown}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 14 }} />}
            {field.help && <div style={{ marginTop: 6, fontSize: 11.5, color: '#868e96', lineHeight: 1.5 }}>{field.help}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <span style={{ fontSize: 11, color: '#adb5bd' }}>{multiline ? 'Ctrl+Enter 적용 · Esc 취소' : 'Enter 적용 · Esc 취소'}</span>
                <button type="button" disabled={disabled || !changed} title="비우고 디자인 원본 문구로 되돌립니다" onClick={() => { onClear(); onClose(); }} style={{ ...btn(), marginLeft: 'auto', opacity: changed ? 1 : .5 }}><Ico name="lc-rotate-ccw" size={13} />원본으로</button>
                <button type="button" onClick={cancel} style={btn()}>취소</button>
                <button type="button" disabled={disabled} onClick={onClose} style={btn(true)}><Ico name="lc-check" size={13} />적용</button>
            </div>
        </>}
    </PopoverShell>;
}
