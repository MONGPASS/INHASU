import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { isUsableImage } from '../desktop-primitives/mwTokens';
import { SD, SIcon } from '../site-seed/seed';

/**
 * 예약 상세(PC·휴대폰)의 숙소·가이드 소개 창 — 디자인 ‘마이페이지 — 예약 상세 (예약 확정 후)’.
 * PC는 가운데 창(520px), 휴대폰은 아래에서 올라오는 시트.
 */

const parseArr = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') {
        try {
            const p = JSON.parse(v);
            return Array.isArray(p) ? p.map(String) : v.split(',').map((x) => x.trim()).filter(Boolean);
        } catch {
            return v.split(',').map((x) => x.trim()).filter(Boolean);
        }
    }
    return [];
};

const parseImages = (v: unknown): string[] => {
    const arr = parseArr(v).filter(isUsableImage);
    if (arr.length > 0) return arr;
    return typeof v === 'string' && isUsableImage(v) ? [v] : [];
};

function ModalShell({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
    const pc = useIsDesktop();
    useEffect(() => {
        if (!open) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = original;
            window.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div role="dialog" aria-modal="true" aria-label={label} data-mw-overlay=""
            style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: pc ? 'center' : 'flex-end', justifyContent: 'center', padding: pc ? 24 : 0 }}>
            <div aria-hidden="true" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
            <div style={{ position: 'relative', width: pc ? 520 : '100%', maxHeight: pc ? 'calc(100vh - 48px)' : '92vh', overflowY: 'auto', background: SD.white,
                borderRadius: pc ? 20 : '20px 20px 0 0', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', color: SD.gray900 }}>
                <button type="button" aria-label="닫기" onClick={onClose}
                    style={{ position: 'absolute', top: 14, right: 14, zIndex: 1, width: 36, height: 36, borderRadius: 9999, border: 'none', background: 'rgba(255,255,255,0.92)', color: SD.gray900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                    <SIcon name="close" size={18} stroke={1.8} />
                </button>
                {children}
            </div>
        </div>
    );
}

const tag: CSSProperties = { height: 22, padding: '0 8px', borderRadius: 6, boxSizing: 'border-box', border: `1px solid ${SD.gray200}`, color: SD.gray700, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' };
const label: CSSProperties = { margin: '22px 0 10px', fontSize: 13, fontWeight: 700, color: SD.gray900 };

// ─── 가이드 ────────────────────────────────────────────────
interface Guide {
    name?: string;
    image?: string;
    introduction?: string;
    bio?: string;
    desc?: string;
    phone?: string;
    qr?: string;
}

export function GuideDetailModal({ guide, open, onClose }: { guide: Guide | null; open: boolean; onClose: () => void }) {
    if (!guide) return null;
    const intro = guide.introduction || guide.bio || guide.desc || '';
    const qr = isUsableImage(guide.qr) ? guide.qr : '';
    return (
        <ModalShell open={open} onClose={onClose} label="가이드 소개">
            <div style={{ padding: '32px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <span style={{ width: 88, height: 88, borderRadius: 9999, overflow: 'hidden', background: SD.gray100, color: SD.gray500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isUsableImage(guide.image) ? <img src={guide.image} alt={guide.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <SIcon name="user" size={40} stroke={1.5} />}
                </span>
                <span style={{ marginTop: 12, fontSize: 12, color: SD.gray600 }}>담당 가이드</span>
                <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700 }}>{guide.name}</h2>
            </div>
            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {intro && <p style={{ margin: 0, padding: '16px 18px', borderRadius: 12, background: SD.gray50, fontSize: 14, lineHeight: 1.7, color: SD.gray700, whiteSpace: 'pre-wrap' }}>{intro}</p>}
                {(guide.phone || qr) && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                        {guide.phone && (
                            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: 16, border: `1px solid ${SD.gray200}`, borderRadius: 14 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SD.gray600 }}><SIcon name="phoneCall" size={14} stroke={1.7} />전화번호</span>
                                <a href={`tel:${guide.phone}`} style={{ fontSize: 18, fontWeight: 700, color: SD.gray900, textDecoration: 'none' }}>{guide.phone}</a>
                            </div>
                        )}
                        {qr && (
                            <div style={{ flex: 'none', width: 140, padding: 12, boxSizing: 'border-box', border: `1px solid ${SD.gray200}`, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                <img src={qr} alt="가이드 카카오톡 QR" style={{ width: 96, height: 96, borderRadius: 8, objectFit: 'contain', display: 'block', background: SD.white }} />
                                <span style={{ fontSize: 12, fontWeight: 700 }}>카카오톡 QR</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </ModalShell>
    );
}

// ─── 숙소 ────────────────────────────────────────
interface Accommodation {
    id?: string;
    name?: string;
    type?: string;
    location?: string;
    images?: unknown;
    description?: string;
    facilities?: unknown;
}

/** "전기 O, 샤워 O, 인터넷 X" 같은 시설 값 → 이름 + 있음/없음. */
const facilityItems = (v: unknown) => parseArr(v).map((x) => {
    const no = /\s[xX]$/.test(x);
    return { label: x.replace(/\s[oOxX]$/, '').trim(), ok: !no };
}).filter((x) => x.label);

export function AccommodationDetailModal({ accommodation, day, date, open, onClose }: { accommodation: Accommodation | null; day?: number; date?: string; open: boolean; onClose: () => void }) {
    const [idx, setIdx] = useState(0);
    const [shownFor, setShownFor] = useState<string | undefined>(undefined);
    const key = `${accommodation?.id || accommodation?.name || ''}:${day ?? ''}`;
    // 다른 숙소를 열면 첫 사진부터.
    if (open && shownFor !== key) {
        setShownFor(key);
        setIdx(0);
    }
    if (!accommodation) return null;
    const images = parseImages(accommodation.images);
    const facilities = facilityItems(accommodation.facilities);
    const mapsUrl = accommodation.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(accommodation.location)}` : '';
    const n = images.length;
    const nav: CSSProperties = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: 9999, border: 'none', background: 'rgba(255,255,255,0.9)', color: SD.gray900,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 };

    return (
        <ModalShell open={open} onClose={onClose} label="숙소 소개">
            <div style={{ position: 'relative', height: 240, background: SD.gray100, color: SD.gray500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {n > 0 ? <img src={images[idx % n]} alt={accommodation.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <SIcon name="bedStay" size={40} stroke={1.4} />}
                {n > 1 && (
                    <>
                        <button type="button" aria-label="이전 사진" onClick={() => setIdx((i) => (i - 1 + n) % n)} style={{ ...nav, left: 12 }}><SIcon name="chevronLeft" size={18} stroke={2} /></button>
                        <button type="button" aria-label="다음 사진" onClick={() => setIdx((i) => (i + 1) % n)} style={{ ...nav, right: 12 }}><SIcon name="chevronRight" size={18} stroke={2} /></button>
                        <span style={{ position: 'absolute', right: 12, bottom: 12, height: 24, padding: '0 10px', borderRadius: 9999, background: 'rgba(0,0,0,0.55)', color: SD.white, fontSize: 12, display: 'inline-flex', alignItems: 'center' }}>
                            {(idx % n) + 1} / {n}
                        </span>
                    </>
                )}
            </div>
            <div style={{ padding: '22px 24px 24px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {day ? <span style={{ ...tag, border: 'none', background: SD.gray900, color: SD.white }}>{day}일차</span> : null}
                    {accommodation.type && <span style={tag}>{accommodation.type}</span>}
                </span>
                <h2 style={{ margin: '10px 0 4px', fontSize: 22, fontWeight: 700 }}>{accommodation.name}</h2>
                {date && <p style={{ margin: 0, fontSize: 13, color: SD.gray600 }}>{date} 숙박</p>}

                {facilities.length > 0 && (
                    <>
                        <p style={label}>시설</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            {facilities.map((f) => (
                                <div key={f.label} style={{ minHeight: 64, padding: '8px 4px', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${SD.gray200}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: f.ok ? 1 : 0.5, textAlign: 'center' }}>
                                    <span style={{ color: f.ok ? SD.gray900 : SD.gray500, display: 'flex' }}><SIcon name={f.ok ? 'checkMark' : 'crossMark'} size={18} stroke={2} /></span>
                                    <span style={{ fontSize: 13, fontWeight: 700 }}>{f.label}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {accommodation.description && (
                    <>
                        <p style={label}>안내</p>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: SD.gray700, whiteSpace: 'pre-wrap' }}>{accommodation.description}</p>
                    </>
                )}

                {accommodation.location && (
                    <>
                        <p style={label}>주소</p>
                        <div style={{ padding: '14px 16px', borderRadius: 12, background: SD.gray50, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ flex: 'none', color: SD.gray700, display: 'flex', paddingTop: 1 }}><SIcon name="pinPlace" size={18} stroke={1.7} /></span>
                            <span style={{ flex: '1 1 auto', fontSize: 14, lineHeight: 1.6 }}>{accommodation.location}</span>
                        </div>
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                            style={{ marginTop: 10, height: 44, border: `1px solid ${SD.gray200}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: SD.gray900, textDecoration: 'none' }}>
                            <SIcon name="mapFold" size={16} stroke={1.7} />지도에서 보기
                        </a>
                    </>
                )}
            </div>
        </ModalShell>
    );
}
