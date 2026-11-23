import React, { useEffect, useRef, useState } from 'react';
import type { DesignTemplateField } from '../../product/designTemplates/types';
import { Ico } from '../v7/v7Ui';
import { AdminButton, AdminIconButton } from '../ui/AdminButton';
import { AdminTextArea, AdminTextInput } from '../ui/AdminFields';
import { cx } from '../ui/adminUiUtils';
import { PopoverShell } from './PopoverShell';
import { PresetChips, PresetLineChips } from './PresetChips';
import { isCommitKey } from './inlineEdit';
import { TEXT_SIZE, clampTextSize } from '../../product/designTemplates/textStyles';
import './design-editor.css';

/**
 * 문구 한 칸을 그 자리에서 고치는 편집창. 입력하는 대로 미리보기에 반영되고,
 * Enter(여러 줄은 Ctrl+Enter)·‘적용’·바깥 클릭이면 그대로 두고 닫힌다. Esc는 열기 전 값(글자 크기 포함)으로 되돌린다.
 * 한 줄 칸도 프리셋·공통값이 아니면 Shift+Enter로 줄을 나눌 수 있다. 글자 크기는 원래 크기 대비 %다.
 */
export function FieldPopover({ field, value, anchor, disabled = false, readOnlyNote, size = TEXT_SIZE.base, onSizeChange, onChange, onClear, onClose, isInside }: {
    field: DesignTemplateField; value: string; anchor: DOMRect | null; disabled?: boolean;
    /** 자동 반영 값(가격표)처럼 여기서 고칠 수 없는 칸의 안내 */
    readOnlyNote?: string;
    /** 글자 크기(원래 크기 대비 %). onSizeChange가 있을 때만 조절칸을 보여 준다. */
    size?: number; onSizeChange?: (next: number) => void;
    onChange: (next: string) => void; onClear: () => void; onClose: () => void; isInside?: (target: Element) => boolean;
}) {
    const multiline = field.type === 'textarea';
    // 프리셋·공통값(일수 등)은 값 자체를 다른 곳에서 읽으므로 줄을 나누지 않는다
    const breakable = !multiline && !field.presets && !field.presetLines && !field.shared;
    const original = useRef(value);
    const originalSize = useRef(size);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    useEffect(() => { original.current = value; originalSize.current = size; setDraft(value); }, [field.key]); // eslint-disable-line react-hooks/exhaustive-deps -- 다른 칸으로 옮길 때만 초기화
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
    const cancel = () => { onChange(original.current); if (onSizeChange && size !== originalSize.current) onSizeChange(originalSize.current); onClose(); };
    const setSize = (next: number) => onSizeChange?.(clampTextSize(next));
    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (isCommitKey(event, multiline)) { event.preventDefault(); onClose(); }
    };
    const rows = Math.min(8, Math.max(3, (field.default?.split('\n').length ?? 3) + 1));
    const changed = draft !== '' && draft !== (field.default ?? '');
    const sized = clampTextSize(size) !== TEXT_SIZE.base;
    const lineRows = Math.min(4, Math.max(1, draft.split(/\n/).length));

    return <PopoverShell anchor={anchor} label={`${field.label} 편집`} width={multiline ? 440 : onSizeChange ? 400 : 360} onClose={onClose} onEscape={cancel} isInside={isInside}>
        <div className="de-pop-head">
            <b className="de-pop-title">{field.label}</b>
            <span className="de-pop-status">{changed || sized ? '수정됨' : '원본 문구'}</span>
            <AdminIconButton label="닫기" size="sm" className="de-push" onClick={onClose}><Ico name="lc-x" size={15} /></AdminIconButton>
        </div>
        {readOnlyNote ? <div className="de-pop-note">{readOnlyNote}</div> : <>
            {field.presets && <PresetChips presets={field.presets} value={draft} onPick={update} />}
            {field.presetLines && <PresetLineChips presetLines={field.presetLines} separator={field.presetSeparator} value={draft} onChange={update} />}
            {multiline
                ? <AdminTextArea ref={inputRef as React.RefObject<HTMLTextAreaElement>} className="de-pop-field is-multiline" minRows={rows} maxRows={Math.max(rows, 12)} value={draft} placeholder={field.default || ''} disabled={disabled} onChange={e => update(e.target.value)} onKeyDown={onKeyDown} />
                : breakable
                ? <AdminTextArea ref={inputRef as React.RefObject<HTMLTextAreaElement>} className="de-pop-field" minRows={lineRows} maxRows={lineRows} value={draft} placeholder={field.default || ''} disabled={disabled} onChange={e => update(e.target.value)} onKeyDown={onKeyDown} />
                : <AdminTextInput ref={inputRef as React.RefObject<HTMLInputElement>} type="text" className="de-pop-field" value={draft} placeholder={field.default || ''} disabled={disabled} onChange={e => update(e.target.value)} onKeyDown={onKeyDown} />}
            {field.help && <div className="de-pop-help">{field.help}</div>}
            <div className="de-pop-keys">{multiline ? 'Ctrl+Enter 적용 · Esc 취소' : breakable ? 'Enter 적용 · Shift+Enter 줄바꿈 · Esc 취소' : 'Enter 적용 · Esc 취소'}</div>
            <div className="de-pop-foot">
                {onSizeChange && <div role="group" aria-label="글자 크기" className="de-size">
                    <span className="de-size-label">크기</span>
                    <AdminIconButton label="글자 작게" size="sm" className="de-size-step" disabled={disabled || size <= TEXT_SIZE.min} onClick={() => setSize(size - TEXT_SIZE.step)}><Ico name="lc-minus" size={13} /></AdminIconButton>
                    <button type="button" className={cx('adm-de-size-value', sized && 'is-changed')} aria-live="polite" title="눌러서 기본 크기(100%)로 되돌립니다" disabled={disabled || !sized} onClick={() => setSize(TEXT_SIZE.base)}>{clampTextSize(size)}%</button>
                    <AdminIconButton label="글자 크게" size="sm" className="de-size-step" disabled={disabled || size >= TEXT_SIZE.max} onClick={() => setSize(size + TEXT_SIZE.step)}><Ico name="lc-plus" size={13} /></AdminIconButton>
                </div>}
                <AdminButton size="sm" className="de-push" disabled={disabled || !changed} title="비우고 디자인 원본 문구로 되돌립니다" leading={<Ico name="lc-rotate-ccw" size={13} />} onClick={() => { onClear(); onClose(); }}>원본으로</AdminButton>
                <AdminButton size="sm" onClick={cancel}>취소</AdminButton>
                <AdminButton size="sm" variant="primary" disabled={disabled} leading={<Ico name="lc-check" size={13} />} onClick={onClose}>적용</AdminButton>
            </div>
        </>}
    </PopoverShell>;
}
