import { useRef, type CSSProperties, type ReactNode } from 'react';
import { KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { isUsableImage } from '../desktop-primitives/mwTokens';
import { SD, SIcon } from '../site-seed/seed';
import {
    DEST_CATEGORIES, DEST_UNSURE, QUOTE_FILE_ACCEPT, QUOTE_STEP_LABELS, plusDays, quoteStepId, routeAdvice, toKey, vehicleCapacity,
    type DestCategory, type QuoteFileState, type QuoteFormValues,
} from './quoteForm';
import { Q_INPUT, qChip, quoteHeadline, quoteReceiptRows, quoteSubline, quoteTiles, todayDot } from './quoteSeed';

/**
 * 맞춤 견적 새 디자인(Claude Design ‘맞춤 견적 (PC)’·‘맞춤 견적 — 모바일’)의 부품.
 * PC는 흰 카드 구역, 휴대폰(`compact`)은 8px 회색 띠로 나눈 구역으로 같은 내용을 그린다.
 */

// ───────────────────────── 구역 머리 ─────────────────────────

export function QSection({ n, title, sub, done, compact = false, children }: { n: number; title: string; sub: string; done: boolean; compact?: boolean; children: ReactNode }) {
    const box = compact ? 30 : 36;
    return (
        <section id={quoteStepId(n)} aria-labelledby={`${quoteStepId(n)}-t`}
            style={compact
                ? { background: SD.white, padding: '24px 20px', borderBottom: `8px solid ${SD.gray50}`, scrollMarginTop: 60 }
                : { background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 16, padding: '28px 32px', scrollMarginTop: 80 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 12 : 14, margin: compact ? '0 0 18px' : '-4px 0 22px', paddingBottom: compact ? 14 : 18, borderBottom: `1px solid ${SD.gray100}` }}>
                <span aria-hidden="true" style={{ flex: 'none', width: box, height: box, borderRadius: compact ? 9 : 10, background: done ? SD.gray900 : SD.gray100, color: done ? SD.white : SD.gray700,
                    fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {done ? <SIcon name="checkMark" size={compact ? 16 : 18} stroke={2.4} /> : String(n).padStart(2, '0')}
                </span>
                <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <h2 id={`${quoteStepId(n)}-t`} style={{ margin: 0, fontSize: compact ? 17 : 19, fontWeight: 700, color: SD.gray900 }}>{title}</h2>
                    <span style={{ fontSize: compact ? 12 : 13, color: SD.gray600 }}>{sub}</span>
                </span>
                <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: done ? SD.gray900 : SD.gray400 }}>{done ? '입력 완료' : '필수'}</span>
            </div>
            {children}
        </section>
    );
}

export function QLabel({ children, required, note, top }: { children: ReactNode; required?: boolean; note?: string; top?: boolean }) {
    return (
        <p style={{ margin: `${top ? 24 : 0}px 0 10px`, fontSize: 14, fontWeight: 700, color: SD.gray900 }}>
            {children}{required && <span style={{ color: SD.mint500 }}> *</span>}
            {note && <span style={{ fontWeight: 400, fontSize: 12, color: SD.gray600 }}> {note}</span>}
        </p>
    );
}

export function QHint({ children, warn }: { children: ReactNode; warn?: boolean }) {
    return (
        <p style={{ margin: '10px 0 0', display: 'flex', gap: 6, fontSize: 12, lineHeight: '18px', color: warn ? SD.red : SD.gray600 }}>
            <span style={{ flex: 'none', height: 18, display: 'flex', alignItems: 'center' }}><SIcon name="info" size={14} stroke={1.8} /></span>
            <span>{children}</span>
        </p>
    );
}

/** 칩 줄. 휴대폰의 긴 줄(`scroll`)은 옆으로 넘긴다. */
export function QChips({ options, isOn, onPick, scroll = false, label }: { options: string[]; isOn: (v: string) => boolean; onPick: (v: string) => void; scroll?: boolean; label?: string }) {
    return (
        <div role="group" aria-label={label} className={scroll ? 'q-hscroll' : undefined}
            style={scroll
                ? { display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px', scrollbarWidth: 'none' }
                : { display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {scroll && <style>{'.q-hscroll::-webkit-scrollbar{display:none}'}</style>}
            {options.map((o) => {
                const on = isOn(o);
                return <button key={o} type="button" aria-pressed={on} onClick={() => onPick(o)} style={qChip(on)}>{o}</button>;
            })}
        </div>
    );
}

/** 체크 상자가 있는 줄 단추(지역 맡기기·개인정보 동의). */
export function QCheckRow({ on, onToggle, title, sub, dashed, gray }: { on: boolean; onToggle: () => void; title: ReactNode; sub: string; dashed?: boolean; gray?: boolean }) {
    return (
        <button type="button" role="checkbox" aria-checked={on} onClick={onToggle}
            style={{ width: '100%', padding: '16px 18px', boxSizing: 'border-box', borderRadius: 14, border: on ? `1.5px solid ${SD.gray900}` : `1px ${dashed ? 'dashed' : 'solid'} ${SD.gray200}`,
                background: gray ? SD.gray50 : SD.white, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', cursor: 'pointer', color: SD.gray900 }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 22, height: 22, boxSizing: 'border-box', borderRadius: 7, border: on ? 'none' : `1.5px solid ${SD.gray300}`, background: on ? SD.gray900 : SD.white,
                color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {on && <SIcon name="checkMark" size={14} stroke={2.6} />}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
                <span style={{ fontSize: 12, color: SD.gray600 }}>{sub}</span>
            </span>
        </button>
    );
}

// ───────────────────────── 01 가고 싶은 곳 ─────────────────────────


export function QDestinations({ form, pick, onPick, onToggleSpot, compact = false }: {
    form: QuoteFormValues; pick: (keywords: string[]) => string | undefined; onPick: (name: string) => void; onToggleSpot: (name: string) => void; compact?: boolean;
}) {
    const unsure = form.destination === DEST_UNSURE;
    const route = routeAdvice(form);
    return (
        <>
            <div role="radiogroup" aria-label="투어 지역" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DEST_CATEGORIES.map((d) => {
                    const on = form.destination === d.name;
                    const img = pick(d.spot);
                    return (
                        <div key={d.name} style={{ border: on ? `1.5px solid ${SD.gray900}` : `1px solid ${SD.gray200}`, borderRadius: 14, background: SD.white, overflow: 'hidden' }}>
                            <button type="button" role="radio" aria-checked={on} onClick={() => onPick(on ? '' : d.name)}
                                style={{ width: '100%', padding: 12, border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: compact ? 12 : 16, fontFamily: 'inherit', cursor: 'pointer', color: SD.gray900 }}>
                                <img src={isUsableImage(img) ? img : d.img} alt="" loading="lazy" decoding="async"
                                    style={{ flex: 'none', width: compact ? 72 : 96, height: compact ? 56 : 72, borderRadius: 10, objectFit: 'cover', display: 'block', background: SD.gray100 }} />
                                <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 16, fontWeight: 700 }}>{d.name}</span>
                                        {d.badge && <span style={{ height: 20, padding: '0 7px', borderRadius: 5, background: SD.gray100, color: SD.gray700, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{d.badge}</span>}
                                    </span>
                                    <span style={{ fontSize: compact ? 12 : 13, color: SD.gray600 }}>{d.tagline}</span>
                                </span>
                                <span aria-hidden="true" style={{ flex: 'none', width: 22, height: 22, boxSizing: 'border-box', borderRadius: 9999, border: on ? 'none' : `1.5px solid ${SD.gray300}`,
                                    background: on ? SD.gray900 : SD.white, color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
                                    {on && <SIcon name="checkMark" size={13} stroke={2.6} />}
                                </span>
                            </button>
                            {on && d.regions.length > 0 && <SpotPanel category={d} selected={form.destSpots} onToggle={onToggleSpot} note={route?.text} warn={route?.warn} compact={compact} />}
                        </div>
                    );
                })}
            </div>
            <div style={{ marginTop: 12 }}>
                <QCheckRow on={unsure} onToggle={() => onPick(unsure ? '' : DEST_UNSURE)} dashed title="지역 선택을 여행사에 맡기기" sub="상담 후 일정과 취향에 맞는 지역을 제안해 드려요." />
            </div>
        </>
    );
}

function SpotPanel({ category, selected, onToggle, note, warn, compact }: { category: DestCategory; selected: string[]; onToggle: (name: string) => void; note?: string; warn?: boolean; compact: boolean }) {
    return (
        <div style={{ margin: '0 12px 12px', padding: '14px 16px', borderRadius: 10, background: SD.gray50 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: SD.gray900 }}>가 보고 싶은 곳 <span style={{ fontWeight: 400, fontSize: 12, color: SD.gray600 }}>선택 · 여러 곳 가능</span></p>
            <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(4, 1fr)' : 'repeat(auto-fill, minmax(84px, 1fr))', gap: compact ? '14px 4px' : '14px 8px' }}>
                {category.regions.map((r) => {
                    const on = selected.includes(r.name);
                    return (
                        <button key={r.name} type="button" aria-pressed={on} title={r.desc} onClick={() => onToggle(r.name)}
                            style={{ padding: 0, border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontFamily: 'inherit', cursor: 'pointer' }}>
                            <span style={{ position: 'relative', width: 64, height: 64, boxSizing: 'border-box', borderRadius: 9999, border: `2px solid ${on ? SD.gray900 : 'transparent'}`, padding: 2, background: SD.white }}>
                                <span style={{ width: '100%', height: '100%', borderRadius: 9999, overflow: 'hidden', background: SD.gray100, display: 'block' }}>
                                    <img src={r.img} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </span>
                                {on && (
                                    <span aria-hidden="true" style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, boxSizing: 'border-box', borderRadius: 9999, background: SD.gray900, border: `2px solid ${SD.white}`, color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <SIcon name="checkMark" size={10} stroke={3} />
                                    </span>
                                )}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: SD.gray900, textAlign: 'center', lineHeight: 1.3, wordBreak: 'keep-all' }}>{r.name}</span>
                        </button>
                    );
                })}
            </div>
            {selected.length > 0 && (
                <p aria-live="polite" style={{ margin: '12px 0 0', paddingTop: 10, borderTop: `1px solid ${SD.gray200}`, fontSize: 12, color: SD.gray700 }}>
                    <strong style={{ color: SD.gray900 }}>선택 {selected.length}곳</strong> · {selected.join(', ')}
                </p>
            )}
            {note && <QHint warn={warn}>{note}</QHint>}
        </div>
    );
}

// ───────────────────────── 02 여행 기간 · 03 인원 ─────────────────────────

export function QDates({ form, onDepart, onReturn, compact = false }: { form: QuoteFormValues; onDepart: (v: string) => void; onReturn: (v: string) => void; compact?: boolean }) {
    const tomorrow = plusDays(toKey(new Date()), 1);
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? 10 : 14 }}>
            <QField label="몽골 입국일" required>
                <input type="date" aria-label="몽골 입국일" value={form.depart} min={tomorrow} onChange={(e) => onDepart(e.target.value)} style={{ ...Q_INPUT, padding: compact ? '0 10px' : Q_INPUT.padding }} />
            </QField>
            <QField label="귀국일" required>
                <input type="date" aria-label="귀국일" value={form.return_} min={form.depart ? plusDays(form.depart, 1) : tomorrow} onChange={(e) => onReturn(e.target.value)} style={{ ...Q_INPUT, padding: compact ? '0 10px' : Q_INPUT.padding }} />
            </QField>
        </div>
    );
}

export function QPeople({ form, set, max }: { form: QuoteFormValues; set: (p: Partial<QuoteFormValues>) => void; max: number }) {
    const rows: Array<{ key: 'adult' | 'child' | 'infant'; label: string; sub: string; min: number }> = [
        { key: 'adult', label: '성인', sub: '만 12세 이상', min: 1 },
        { key: 'child', label: '아동', sub: '만 2~11세', min: 0 },
        { key: 'infant', label: '유아', sub: '만 2세 미만', min: 0 },
    ];
    const step: CSSProperties = { width: 32, height: 32, boxSizing: 'border-box', borderRadius: 9999, border: `1px solid ${SD.gray200}`, background: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' };
    return (
        <div style={{ border: `1px solid ${SD.gray200}`, borderRadius: 14 }}>
            {rows.map((r, i) => {
                const n = form[r.key];
                return (
                    <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < rows.length - 1 ? `1px solid ${SD.gray100}` : 'none' }}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900 }}>{r.label}</span>
                            <span style={{ fontSize: 12, color: SD.gray600 }}>{r.sub}</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 4px', borderRadius: 9999, background: SD.gray50 }}>
                            <button type="button" aria-label={`${r.label} 줄이기`} disabled={n <= r.min} onClick={() => set({ [r.key]: Math.max(r.min, n - 1) })}
                                style={{ ...step, color: n <= r.min ? SD.gray300 : SD.gray900, cursor: n <= r.min ? 'default' : 'pointer' }}><SIcon name="minusLine" size={16} stroke={2} /></button>
                            <span aria-live="polite" style={{ minWidth: 44, textAlign: 'center', fontSize: 15, fontWeight: 700, color: SD.gray900 }}>{n}명</span>
                            <button type="button" aria-label={`${r.label} 늘리기`} disabled={n >= max} onClick={() => set({ [r.key]: Math.min(max, n + 1) })}
                                style={{ ...step, color: n >= max ? SD.gray300 : SD.gray900 }}><SIcon name="plusLine" size={16} stroke={2} /></button>
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ───────────────────────── 05 차량 ─────────────────────────

export function QVehicles({ options, value, pax, onPick, compact = false }: { options: string[]; value: string; pax: number; onPick: (v: string) => void; compact?: boolean }) {
    return (
        <div role="radiogroup" aria-label="차량" className={compact ? 'q-hscroll' : undefined}
            style={compact
                ? { display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px', scrollbarWidth: 'none' }
                : { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {options.map((v) => {
                const on = value === v;
                const cap = vehicleCapacity(v);
                const over = cap < pax;
                return (
                    <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onPick(v)}
                        style={{ flex: compact ? '0 0 auto' : undefined, minWidth: compact ? 132 : 0, height: 64, padding: '0 14px', boxSizing: 'border-box', borderRadius: 12,
                            border: on ? `1.5px solid ${over ? SD.red : SD.gray900}` : `1px solid ${SD.gray200}`, background: SD.white, textAlign: 'left',
                            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, fontFamily: 'inherit', cursor: 'pointer' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900, whiteSpace: 'nowrap' }}>{v}</span>
                        <span style={{ fontSize: 12, color: over ? SD.red : SD.gray600, whiteSpace: 'nowrap' }}>{cap === Infinity ? '인원에 맞춰 배정' : over ? `정원 ${cap}명 · 현재 ${pax}명` : `정원 ${cap}명`}</span>
                    </button>
                );
            })}
        </div>
    );
}

// ───────────────────────── 입력 칸 ─────────────────────────

export function QField({ label, required, note, wide, error, children }: { label: string; required?: boolean; note?: string; wide?: boolean; error?: string; children: ReactNode }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: SD.gray900 }}>
                {label}{required && <span style={{ color: SD.mint500 }}> *</span>}{note && <span style={{ fontWeight: 400, color: SD.gray600 }}> ({note})</span>}
            </span>
            {children}
            {error && <span role="alert" style={{ fontSize: 12, color: SD.red }}>{error}</span>}
        </label>
    );
}

export function QFile({ fileName, state, note, onPick, onRemove, compact = false }: {
    fileName: string; state: QuoteFileState; note: string; onPick: (file: File | undefined) => void; onRemove: () => void; compact?: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const uploading = state === 'uploading', done = state === 'done', failed = state === 'error';
    const text = uploading ? `"${fileName}" 올리는 중…`
        : done ? `"${fileName}" 첨부 완료`
        : failed ? '올리지 못했어요. 다시 고르거나, 파일 없이 요청한 뒤 카카오톡으로 보내 주세요.'
        : compact ? '항공권·일정표 첨부' : '항공권이나 준비된 일정표가 있으면 첨부해 주세요';
    return (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type="button" onClick={() => input.current?.click()} disabled={uploading}
                style={{ width: '100%', minHeight: 52, padding: '10px 14px', boxSizing: 'border-box', border: `1px ${done ? 'solid' : 'dashed'} ${failed ? SD.red : done ? SD.gray900 : SD.gray200}`, borderRadius: 12,
                    background: SD.white, fontFamily: 'inherit', fontSize: 13, color: failed ? SD.red : SD.gray700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    cursor: uploading ? 'progress' : 'pointer', textAlign: 'center', overflowWrap: 'anywhere' }}>
                <SIcon name={done ? 'checkMark' : 'paperClip'} size={16} stroke={1.8} />
                <span aria-live="polite">{text}{!fileName && !failed && <span style={{ color: SD.gray500 }}> (선택 · 10MB 이하)</span>}</span>
            </button>
            <input ref={input} type="file" accept={QUOTE_FILE_ACCEPT} aria-label="첨부파일 선택" hidden
                onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
            {note && <span role="alert" style={{ fontSize: 12, color: SD.red }}>{note}</span>}
            {!!fileName && !uploading && (
                <button type="button" onClick={onRemove} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', padding: '2px 0', fontFamily: 'inherit', fontSize: 12, color: SD.gray600, textDecoration: 'underline', cursor: 'pointer' }}>
                    첨부 지우기
                </button>
            )}
        </div>
    );
}

export function QError({ message }: { message: string }) {
    return (
        <div role="alert" style={{ padding: '12px 14px', borderRadius: 12, background: '#FDEEEC', color: SD.red, fontSize: 13, lineHeight: 1.6, textAlign: 'left' }}>
            <strong style={{ display: 'block' }}>견적 요청이 접수되지 않았어요.</strong>
            {message} 계속 안 되면 <a href={KAKAO_CHANNEL_CHAT_URL} target="_blank" rel="noopener noreferrer" style={{ color: SD.red, fontWeight: 700 }}>카카오톡으로 문의</a>해 주세요.
        </div>
    );
}

// ───────────────────────── 요약 ─────────────────────────

/** 모두 입력했을 때의 요청서(영수증 모양). */
export function QReceipt({ form, compact = false }: { form: QuoteFormValues; compact?: boolean }) {
    const dash = <div aria-hidden="true" style={{ height: 0, borderTop: `1.5px dashed ${SD.gray200}`, margin: '16px 0' }} />;
    return (
        <div style={{ position: 'relative', background: SD.white, borderRadius: '16px 16px 0 0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: compact ? '24px 20px 28px' : '26px 24px 30px' }}>
            <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: SD.gray500 }}>QUOTE REQUEST</span>
                <h2 style={{ margin: '6px 0 2px', fontSize: 20, fontWeight: 700, color: SD.gray900 }}>맞춤 견적 요청서</h2>
                <span style={{ fontSize: 12, color: SD.gray600 }}>{todayDot()} · 작성 완료</span>
            </div>
            {dash}
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.4, color: SD.gray900 }}>{quoteHeadline(form)}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: SD.gray600 }}>{quoteSubline(form)}</p>
            {dash}
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {quoteReceiptRows(form).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                        <dt style={{ flex: 'none', color: SD.gray600 }}>{k}</dt>
                        <span aria-hidden="true" style={{ flex: '1 1 auto', borderBottom: `1px dotted ${SD.gray200}`, transform: 'translateY(-3px)' }} />
                        <dd style={{ margin: 0, flex: 'none', maxWidth: '60%', textAlign: 'right', fontWeight: 700, color: SD.gray900, overflowWrap: 'anywhere' }}>{v}</dd>
                    </div>
                ))}
            </dl>
            {dash}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>견적 금액</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: SD.mint600 }}>24시간 안에 안내</span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: SD.gray600 }}>무료 · 부담 없음 · 한국어 스태프가 카카오 알림톡으로 보내 드려요</p>
            <div aria-hidden="true" style={{ margin: '20px auto 0', width: 200, height: 38, opacity: 0.85,
                background: `repeating-linear-gradient(90deg, ${SD.gray900} 0 2px, transparent 2px 4px, ${SD.gray900} 4px 5px, transparent 5px 8px, ${SD.gray900} 8px 11px, transparent 11px 13px)` }} />
            <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: -10, height: 10, background: `radial-gradient(circle at 8px 0, ${SD.white} 7px, transparent 7.5px) 0 0 / 16px 10px repeat-x` }} />
        </div>
    );
}

/** 입력 중 요약: 요청할 여행 · 스타일/숙소/차량/항공 칸(누르면 그 구역으로). PC는 아래에 진행 막대와 버튼을 더한다. */
export function QStatusCard({ form, onJump, footer, compact = false }: { form: QuoteFormValues; onJump: (step: number) => void; footer?: ReactNode; compact?: boolean }) {
    const head = quoteHeadline(form);
    return (
        <div style={{ background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: compact ? 16 : 20, overflow: 'hidden', boxShadow: compact ? 'none' : '0 8px 24px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: compact ? '18px 18px 14px' : '22px 22px 18px', background: compact ? SD.white : SD.gray50, borderBottom: `1px solid ${compact ? SD.gray100 : SD.gray200}` }}>
                <span style={{ fontSize: 12, color: SD.gray600 }}>요청할 여행</span>
                <p style={{ margin: '6px 0 0', fontSize: compact ? 17 : 19, fontWeight: 700, lineHeight: 1.4, color: head ? SD.gray900 : SD.gray500 }}>{head || '어디로 떠나볼까요?'}</p>
                <p style={{ margin: '4px 0 0', fontSize: compact ? 12 : 13, color: SD.gray600 }}>{quoteSubline(form)}</p>
            </div>
            <div style={{ padding: compact ? '14px 18px 16px' : '18px 22px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? 12 : '14px 12px' }}>
                    {quoteTiles(form).map((t) => (
                        <button key={t.label} type="button" onClick={() => onJump(t.step)}
                            style={{ padding: 0, border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, fontFamily: 'inherit', cursor: 'pointer' }}>
                            <span style={{ fontSize: 11, color: SD.gray500 }}>{t.label}</span>
                            <span style={{ fontSize: 13, fontWeight: t.value ? 700 : 400, color: t.value ? SD.gray900 : SD.gray400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.value || '미선택'}</span>
                        </button>
                    ))}
                </div>
                {footer}
            </div>
        </div>
    );
}

/** 8칸 진행 막대(입력한 칸은 민트). 누르면 그 구역으로. */
export function QProgress({ steps, onJump, height = 6, gap = 4 }: { steps: boolean[]; onJump?: (step: number) => void; height?: number; gap?: number }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap }}>
            {steps.map((done, i) => (
                <button key={i} type="button" tabIndex={onJump ? 0 : -1} aria-label={`${QUOTE_STEP_LABELS[i]} ${done ? '입력 완료' : '입력 전'}`} title={QUOTE_STEP_LABELS[i]}
                    onClick={() => onJump?.(i + 1)}
                    style={{ height, padding: 0, border: 'none', borderRadius: 9999, background: done ? SD.mint500 : SD.gray100, cursor: onJump ? 'pointer' : 'default' }} />
            ))}
        </div>
    );
}

/** 카카오톡 상담 작은 단추(노란 사각 + 글자). */
export function QKakaoLink({ label, style }: { label?: string; style?: CSSProperties }) {
    return (
        <a href={KAKAO_CHANNEL_CHAT_URL} target="_blank" rel="noopener noreferrer" aria-label={label ? undefined : '카카오톡 상담'}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', color: SD.gray900, fontWeight: 700, ...style }}>
            <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 6, background: '#FEE500', color: '#3C1E1E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name="kakao" size={14} stroke={0} style={{ fill: 'currentColor' }} />
            </span>
            {label}
        </a>
    );
}

/** 스팸 방어용 숨은 칸: 사람에게는 보이지 않고, 봇이 채워 보내면 서버가 저장하지 않는다. */
export function QuoteHoneypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <input type="text" name="website" value={value} onChange={(e) => onChange(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true"
            style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
    );
}
