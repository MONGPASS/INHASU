import type { CSSProperties, ReactNode } from 'react';
import { KAKAO_CHANNEL_URL } from '../../constants/company';
import { MW } from '../desktop-primitives/mwTokens';
import { QUOTE_FILE_ACCEPT, type QuoteFileState } from './quoteForm';
import { myQuotePath, quoteLinkDate, type QuoteLink } from './quoteLinks';

/**
 * 견적 요청 폼의 작은 조각들 — PC·모바일 폼이 함께 쓴다(`compact` = 모바일 크기).
 * 사진이 들어가는 조각(여행지 카드·관심 지역)은 각 레이아웃 파일에 있다.
 */

const KAKAO_YELLOW = '#FEE500';
const KAKAO_INK = '#191919';
const WARN = { bg: '#FFF8ED', line: '#F0D7A8', ink: '#8B641C' };
const ERR = { bg: '#FDF0EE', line: '#F3D6D1', ink: MW.redDeep };

const ICON = {
    clip: 'M8 12.5l6.2-6.2a3 3 0 014.3 4.2l-7.8 7.8a5 5 0 01-7-7l7.2-7.3',
    chain: 'M10 14a4 4 0 005.7 0l3-3A4 4 0 0013 5.3l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1',
    arrow: 'M5 12h14M13 6l6 6-6 6',
};

export function QuoteIcon({ d, size = 18, color = 'currentColor', style }: { d: string; size?: number; color?: string; style?: CSSProperties }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
            <path d={d} />
        </svg>
    );
}

/** 카카오톡 말풍선 글리프. */
export function KakaoGlyph({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={KAKAO_INK} aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 5.9L6.4 20.2l3.9-2.5c.6.1 1.1.2 1.7.2 5 0 9-3.1 9-6.9S17 4 12 4z" />
        </svg>
    );
}

/** 카카오톡 채널 상담 버튼(새 창). */
export function KakaoConsultButton({ label = '카카오톡 채널로 상담하기', height = 52, style }: { label?: string; height?: number; style?: CSSProperties }) {
    return (
        <a
            href={KAKAO_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height, padding: '0 18px', borderRadius: 14, background: KAKAO_YELLOW, color: KAKAO_INK, fontSize: 15, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', boxSizing: 'border-box', ...style }}
        >
            <KakaoGlyph />
            {label}
        </a>
    );
}

/** 스텝 안의 묶음 제목("시내(울란바토르) 숙소")과 옆의 보조 설명. */
export function QuoteGroupLabel({ children, note, compact = false }: { children: ReactNode; note?: string; compact?: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', fontSize: compact ? 13 : 14, fontWeight: 700, color: MW.navy }}>
            <span>{children}</span>
            {note && <span style={{ fontSize: compact ? 11 : 12, fontWeight: 500, color: MW.mute }}>{note}</span>}
        </div>
    );
}

/** 선택지 아래의 회색 도움말. */
export function QuoteHelp({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
    return <p style={{ margin: 0, fontSize: compact ? 11.5 : 12.5, lineHeight: 1.65, color: MW.mute }}>{children}</p>;
}

/** 추천·경고 안내 상자(차량 정원, 박 수 대비 권장 일정). */
export function QuoteAdvice({ text, warn = false, compact = false }: { text: string; warn?: boolean; compact?: boolean }) {
    return (
        <p
            aria-live="polite"
            style={{ margin: 0, padding: compact ? '11px 13px' : '12px 16px', borderRadius: 12, border: `1px solid ${warn ? WARN.line : MW.mintTint}`, background: warn ? WARN.bg : MW.mintBg, color: warn ? WARN.ink : MW.mintDeep, fontSize: compact ? 12 : 13, lineHeight: 1.65 }}
        >
            {text}
        </p>
    );
}

/** 입력칸 아래의 빨간 안내(형식 오류 등). */
export function QuoteFieldNote({ children }: { children: ReactNode }) {
    return <span role="alert" style={{ fontSize: 12, lineHeight: 1.6, color: MW.redDeep }}>{children}</span>;
}

/** 첨부파일 1개. 고르는 즉시 올리고, 상태(올리는 중·완료·실패)를 그 자리에 보여 준다. */
export function QuoteFileField({ fileName, state, note, onPick, onRemove, compact = false }: {
    fileName: string;
    state: QuoteFileState;
    note: string;
    onPick: (file: File | undefined) => void;
    onRemove: () => void;
    compact?: boolean;
}) {
    const uploading = state === 'uploading';
    const done = state === 'done';
    const failed = state === 'error';
    const text = uploading ? `"${fileName}" 업로드 중…`
        : done ? `"${fileName}" 첨부 완료 (바꾸려면 누르세요)`
        : failed ? '업로드에 실패했어요. 다시 선택하거나, 파일 없이 요청한 뒤 카카오톡으로 보내 주세요.'
        : '항공권 또는 준비된 일정표가 있으면 첨부해 주세요 (선택 · 10MB 이하)';
    const line = done ? MW.mint : failed ? MW.red : '#B8C4C1';
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, minHeight: compact ? 52 : 56, boxSizing: 'border-box', padding: compact ? '12px 14px' : '14px 18px', borderRadius: 14, border: `1.5px ${done ? 'solid' : 'dashed'} ${line}`, background: done ? MW.mintBg : failed ? ERR.bg : '#FFFFFF', color: failed ? ERR.ink : done ? MW.navy : MW.mute, fontSize: compact ? 13 : 14, lineHeight: 1.6, cursor: uploading ? 'progress' : 'pointer' }}
            >
                <QuoteIcon d={ICON.clip} color={done ? MW.mintDeep : failed ? ERR.ink : MW.mute} />
                <span aria-live="polite" style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{text}</span>
                <input
                    type="file"
                    accept={QUOTE_FILE_ACCEPT}
                    aria-label="첨부파일 선택"
                    onChange={(e) => {
                        onPick(e.target.files?.[0]);
                        e.target.value = '';
                    }}
                    style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                />
            </label>
            {note && <QuoteFieldNote>{note}</QuoteFieldNote>}
            {!!fileName && !uploading && (
                <button type="button" onClick={onRemove} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', padding: '4px 0', color: MW.mute, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                    첨부 지우기
                </button>
            )}
        </div>
    );
}

/** 개인정보 수집·이용 동의(필수). */
export function QuoteAgreeRow({ on, onToggle, compact = false }: { on: boolean; onToggle: () => void; compact?: boolean }) {
    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={onToggle}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', boxSizing: 'border-box', padding: compact ? 14 : 16, border: `1.5px solid ${on ? MW.mint : MW.line2}`, borderRadius: 14, background: on ? MW.mintBg : '#F7F8F7', color: MW.navy, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
        >
            <span aria-hidden="true" style={{ flexShrink: 0, width: 22, height: 22, marginTop: 1, borderRadius: 6, boxSizing: 'border-box', border: `1.5px solid ${on ? MW.mint : '#B8C4C1'}`, background: on ? MW.mint : '#FFFFFF', color: MW.navy, fontSize: 13, lineHeight: '19px', textAlign: 'center' }}>
                {on ? '✓' : ''}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: compact ? 13 : 14, fontWeight: 700, lineHeight: 1.5 }}>
                    개인정보 수집 및 이용에 동의합니다. <span style={{ color: MW.red }}>*</span>
                </span>
                <span style={{ fontSize: 12, lineHeight: 1.6, color: MW.mute }}>이름·연락처·이메일은 견적 상담 목적으로만 사용됩니다.</span>
            </span>
        </button>
    );
}

/** 스팸 방어용 숨은 칸: 사람에게는 보이지 않고, 봇이 채워 보내면 서버가 저장하지 않는다. */
export function QuoteHoneypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <input
            type="text"
            name="website"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
    );
}

/** 제출 실패 안내 + 카카오톡 채널 문의 링크. */
export function QuoteErrorBox({ message, compact = false }: { message: string; compact?: boolean }) {
    return (
        <div role="alert" style={{ padding: compact ? '10px 12px' : '12px 14px', borderRadius: 12, border: `1.5px solid ${ERR.line}`, background: ERR.bg, color: ERR.ink, fontSize: compact ? 12 : 13, lineHeight: 1.65, textAlign: 'left' }}>
            <strong style={{ display: 'block' }}>견적 요청이 접수되지 않았어요.</strong>
            {message} 계속 안 되면{' '}
            <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: ERR.ink, fontWeight: 700 }}>카카오톡 채널</a>
            로 문의해 주세요.
        </div>
    );
}

/** 이 브라우저에서 이전에 요청한 견적(최근 1건)의 내 견적 화면으로 가는 링크. */
export function RecentQuoteBar({ link, compact = false }: { link: QuoteLink; compact?: boolean }) {
    const when = quoteLinkDate(link.createdAt);
    const sub = [link.name && `${link.name} 님`, when && `${when} 요청`].filter(Boolean).join(' · ') || '진행 상황과 견적서를 확인할 수 있어요';
    return (
        <a
            href={myQuotePath(link.token)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: compact ? '12px 14px' : '14px 18px', borderRadius: 14, border: `1px solid ${MW.mintTint}`, background: MW.mintBg, color: MW.navy, textDecoration: 'none' }}
        >
            <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QuoteIcon d={ICON.chain} color={MW.mintDeep} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: compact ? 13 : 14, fontWeight: 700 }}>이전에 요청한 견적 보기</span>
                <span style={{ fontSize: 12, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
            </span>
            <QuoteIcon d={ICON.arrow} size={16} color={MW.mintDeep} />
        </a>
    );
}
