import React from 'react';
import { Ico } from '../v7/v7Ui';
import { PopoverShell } from './PopoverShell';

const btn = (primary = false): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', font: 'inherit',
    border: primary ? '1.5px solid #1A1B1E' : '1.5px solid #e5e8eb', background: primary ? '#1A1B1E' : '#fff', color: primary ? '#fff' : '#1A1B1E',
});

/**
 * 사진 한 자리를 그 자리에서 바꾸는 편집창: 올리기 · 공통 사진 쓰기 · 지우기.
 * 업로드 중에는 모두 잠긴다(상품 폼의 fieldset 잠금 밖에 떠 있으므로 직접 잠근다).
 */
export function ImagePopover({ label, value, sharedUrl, uploading, disabled = false, anchor, onUpload, onUseShared, onClear, onClose, isInside }: {
    label: string; value: string; sharedUrl?: string; uploading: boolean; disabled?: boolean; anchor: DOMRect | null;
    onUpload: (file: File) => void; onUseShared: () => void; onClear: () => void; onClose: () => void; isInside?: (target: Element) => boolean;
}) {
    const shown = value || sharedUrl || '';
    const locked = disabled || uploading;
    const status = uploading ? '업로드 중…' : value ? '이 상품에 올린 사진' : sharedUrl ? '공통 사진 사용 중' : '사진 없음 — 올리면 이 자리에 들어갑니다';
    return <PopoverShell anchor={anchor} label={`${label} 사진`} width={380} onClose={onClose} isInside={isInside}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <b style={{ fontSize: 13, fontWeight: 800, color: '#1A1B1E' }}>{label}</b>
            <span style={{ fontSize: 11, color: uploading ? '#e8590c' : '#868e96' }}>{status}</span>
            <button type="button" aria-label="닫기" onClick={onClose} style={{ marginLeft: 'auto', width: 28, height: 28, border: 0, borderRadius: 999, background: 'transparent', color: '#868e96', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name="lc-x" size={15} /></button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 96, height: 96, flex: 'none', borderRadius: 12, overflow: 'hidden', background: '#f1f3f5', border: `1px ${shown ? 'solid' : 'dashed'} ${value ? '#e9ecef' : '#06C4A0'}`, display: 'grid', placeItems: 'center', color: '#adb5bd' }}>
                {shown ? <img src={shown} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: uploading ? .5 : 1 }} /> : <Ico name="lc-image-plus" size={26} color="#adb5bd" />}
                {!value && sharedUrl && <span style={{ position: 'absolute', left: 6, bottom: 6, padding: '1px 7px', borderRadius: 999, background: '#06C4A0', color: '#fff', fontSize: 10, fontWeight: 800 }}>공통</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <label style={{ ...btn(true), opacity: locked ? .5 : 1, cursor: locked ? 'not-allowed' : 'pointer' }}>
                    <Ico name="lc-image-plus" size={14} />{value ? '사진 바꾸기' : '사진 올리기'}
                    <input type="file" accept="image/*" disabled={locked} style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) onUpload(file); }} />
                </label>
                {value && sharedUrl && <button type="button" disabled={locked} title="이 상품만의 사진을 지우고 공통 사진을 따라갑니다" onClick={() => { onUseShared(); onClose(); }} style={btn()}><Ico name="lc-rotate-ccw" size={13} />공통 사진 쓰기</button>}
                {value && <button type="button" disabled={locked} onClick={() => { onClear(); onClose(); }} style={{ ...btn(), color: '#e5484d' }}><Ico name="lc-trash" size={13} />지우기</button>}
                <span style={{ fontSize: 11, color: '#adb5bd' }}>파일을 이 자리에 끌어다 놓아도 올라갑니다</span>
            </div>
        </div>
    </PopoverShell>;
}
