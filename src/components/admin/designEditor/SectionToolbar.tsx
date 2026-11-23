import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Ico, V7Menu, menuAt, type V7MenuState } from '../v7/v7Ui';
import './design-editor.css';

/**
 * 마우스를 올린 섹션의 오른쪽 위에 뜨는 작은 도구줄: 이름 · 사진 ▾ · 복제 · 빼기 · 목록.
 * ‘사진 ▾’은 배경처럼 다른 요소에 가려 직접 못 누르는 사진을 고르는 길이다.
 */
export function SectionToolbar({ name, position, repeatable, imageFields, disabled = false, onDuplicate, onRemove, onPickImage, onOpenPanel, onPointerEnter, onPointerLeave }: {
    name: string; position: { top: number; right: number } | null; repeatable: boolean; imageFields: Array<{ key: string; label: string; filled: boolean }>; disabled?: boolean;
    onDuplicate: () => void; onRemove: () => void; onPickImage: (key: string) => void; onOpenPanel: () => void;
    onPointerEnter?: () => void; onPointerLeave?: () => void;
}) {
    const [menu, setMenu] = useState<V7MenuState | null>(null);
    if (!position || typeof document === 'undefined') return null;
    return createPortal(<>
        <div role="toolbar" aria-label={`${name} 섹션`} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}
            className="de-toolbar" style={{ top: position.top, left: position.right }}>
            <span className="de-toolbar-name">{name}</span>
            {imageFields.length > 0 && <button type="button" className="adm-de-tool" disabled={disabled} aria-haspopup="menu" onClick={e => setMenu(menuAt(e.currentTarget, `${name} 사진`, imageFields.map(f => ({ key: f.key, label: f.label, sub: f.filled ? '올린 사진 있음' : '사진 없음', subTone: f.filled ? 'ok' : 'muted', onPick: () => onPickImage(f.key) })), true))}><Ico name="lc-image-plus" size={13} />사진<Ico name="lc-chevron-down" size={11} /></button>}
            {repeatable && <button type="button" className="adm-de-tool" disabled={disabled} title="이 섹션을 내용까지 복제해 아래에 추가" onClick={onDuplicate}><Ico name="lc-copy" size={13} />복제</button>}
            <button type="button" className="adm-de-tool" disabled={disabled} title="이 섹션의 입력칸을 목록으로 보기" onClick={onOpenPanel}><Ico name="lc-list" size={13} />목록</button>
            <button type="button" className="adm-de-tool is-danger" disabled={disabled} title="이 섹션을 상세페이지에서 빼기 (나중에 다시 넣을 수 있음)" onClick={onRemove}><Ico name="lc-trash" size={13} />빼기</button>
        </div>
        <V7Menu menu={menu} onClose={() => setMenu(null)} />
    </>, document.body);
}
