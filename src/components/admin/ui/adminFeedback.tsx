import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './admin-ui.css';

/**
 * 관리자 공통 알림(토스트)과 확인 창.
 * - adminNotify('저장했습니다.')         : 화면 아래 알림. 브라우저 기본 알림창 대신 쓴다.
 * - await adminConfirm({ message, … })  : 삭제처럼 되돌릴 수 없는 일의 확인 창. true면 진행.
 * 어느 화면에서 불러도 같은 모양·같은 위치로 뜬다(문서 body에 한 번만 붙는다).
 */
export type AdminNoticeKind = 'success' | 'error' | 'info';
interface Notice { id: number; kind: AdminNoticeKind; message: string }
interface ConfirmOptions { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
interface ConfirmRequest extends ConfirmOptions { id: number; resolve: (ok: boolean) => void }

const ERROR_WORDS = /실패|오류|에러|없습니다|못했|못 했|않았|할 수 없|입력해|선택해|확인해|필수|초과|잘못|중복|만료|권한/;
/** 문구로 종류를 가린다. 기존 화면의 안내 문구를 그대로 넘겨도 오류는 빨간 점으로 보인다. */
export const noticeKindFor = (message: string): AdminNoticeKind => (ERROR_WORDS.test(message) ? 'error' : 'success');

type Listener = () => void;
const state = { notices: [] as Notice[], confirm: null as ConfirmRequest | null };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(listener => listener());
let seq = 0;
let mounted = false;

const dismiss = (id: number) => { state.notices = state.notices.filter(entry => entry.id !== id); emit(); };

const Host: React.FC = () => {
    const [, tick] = useState(0);
    const confirmButton = useRef<HTMLButtonElement>(null);
    useEffect(() => { const listener = () => tick(value => value + 1); listeners.add(listener); return () => { listeners.delete(listener); }; }, []);
    const request = state.confirm;
    const settle = (ok: boolean) => { if (!state.confirm) return; const current = state.confirm; state.confirm = null; emit(); current.resolve(ok); };
    useEffect(() => {
        if (!request) return;
        confirmButton.current?.focus();
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); settle(false); } };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [request?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    return <>
        <div className="adm-toast-stack" aria-live="polite">
            {state.notices.map(entry => (
                <button key={entry.id} type="button" className={`adm-toast is-${entry.kind}`} role={entry.kind === 'error' ? 'alert' : 'status'} onClick={() => dismiss(entry.id)} title="눌러서 닫기">
                    <span className="adm-toast-dot" aria-hidden="true" />
                    <span className="adm-toast-text">{entry.message}</span>
                </button>
            ))}
        </div>
        {request && <div className="adm-dialog-scrim" onMouseDown={event => { if (event.target === event.currentTarget) settle(false); }}>
            <div className="adm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="adm-dialog-title" aria-describedby="adm-dialog-message">
                <div className="adm-dialog-title" id="adm-dialog-title">{request.title || (request.danger ? '삭제할까요?' : '확인')}</div>
                <div className="adm-dialog-message" id="adm-dialog-message">{request.message}</div>
                <div className="adm-dialog-foot">
                    <button type="button" className="adm-btn" onClick={() => settle(false)}>{request.cancelLabel || '취소'}</button>
                    <button ref={confirmButton} type="button" className={`adm-btn ${request.danger ? 'is-danger' : 'is-primary'}`} onClick={() => settle(true)}>{request.confirmLabel || (request.danger ? '삭제' : '확인')}</button>
                </div>
            </div>
        </div>}
    </>;
};

const ensureHost = () => {
    if (mounted || typeof document === 'undefined') return;
    mounted = true;
    const node = document.createElement('div');
    node.className = 'adm-feedback-host';
    document.body.appendChild(node);
    createRoot(node).render(<Host />);
};

/** 화면 아래 알림. 성공·안내는 3초, 오류는 6초 뒤(또는 눌러서) 사라진다. */
export function adminNotify(message: unknown, kind?: AdminNoticeKind): void {
    const text = String(message ?? '').trim();
    if (!text) return;
    ensureHost();
    const entry: Notice = { id: ++seq, kind: kind || noticeKindFor(text), message: text };
    state.notices = [...state.notices.slice(-2), entry];
    emit();
    window.setTimeout(() => dismiss(entry.id), entry.kind === 'error' ? 6000 : 3000);
}

/** 공통 확인 창. 이미 열려 있으면 앞의 요청은 취소로 끝낸다. */
export function adminConfirm(options: ConfirmOptions | string): Promise<boolean> {
    ensureHost();
    const normalized = typeof options === 'string' ? { message: options } : options;
    return new Promise(resolve => {
        state.confirm?.resolve(false);
        state.confirm = { ...normalized, id: ++seq, resolve };
        emit();
    });
}
