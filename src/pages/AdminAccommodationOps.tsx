import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';

/**
 * Байр захиалгын удирдлага (дотоод) — байрны хариуцсан ажилтанд зориулсан, монгол хэлээр.
 * Баталгаажсан захиалгыг нэг дороос харж, өдөр тутмын байр/өрөө/хүн/захиалгын төлвийг удирдана.
 * Аяллын мэдээлэл (нислэг·аялагч) нь reservations.contractData-аас, байр нь dailyAccommodations(JSON)-д хадгална.
 * Схемийн миграци шаардлагагүй.
 */

type BookingStatus = 'Илгээгээгүй' | 'Имэйл илгээсэн' | 'Хариу ирсэн' | 'Баталгаажсан';
const STATUS_OPTIONS: BookingStatus[] = ['Илгээгээгүй', 'Имэйл илгээсэн', 'Хариу ирсэн', 'Баталгаажсан'];
const OCCUPANCY_OPTIONS = ['', '1 хүн/өрөө', '2 хүн/өрөө', '3 хүн/өрөө', '4 хүн/өрөө', '5 хүн/өрөө', '6 хүн/өрөө'];
// 숙소 등급 — 선택명은 한국어로 유지(요청)
const GRADE_OPTIONS = ['', '고급 게르', '일반 게르', '5성급 호텔', '4성급호텔', '목조하우스'];
const WD = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];

interface DailyAcc {
    day: number;
    date?: string; // 직접 편집 가능한 날짜(yyyy-mm-dd). 없으면 startDate 기준 자동
    accommodation: {
        id?: string;
        name?: string;
        type?: string;
        location?: string;
        images?: string[];
        description?: string;
        facilities?: string[];
        roomCount?: number;
        occupancy?: string;
        bookingStatus?: BookingStatus;
    };
}
interface Traveler { name?: string; passportName?: string; birthdate?: string; gender?: string; phone?: string }
interface Flight { date?: string; time?: string; flight?: string }
interface Reservation {
    id: string;
    type?: string;
    productName?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    depositStatus?: string;
    travelers?: number;
    reservationNumber?: string | null;
    createdAt?: string;
    dailyAccommodations?: DailyAcc[];
    assignedGuide?: { id?: string; name?: string; phone?: string; image?: string; kakaoId?: string; languages?: string[]; specialties?: string[] };
    contractData?: {
        region?: string; category?: string;
        travelers?: Traveler[];
        arrival?: Flight; departure?: Flight;
        agreement?: { agreed?: boolean; name?: string; agreedAt?: string };
        vehicle?: { type?: string; phone?: string };
    };
}

const statusStyle = (s?: BookingStatus | 'Хуваарилаагүй' | 'Явагдаж байна'): { bg: string; fg: string } => ({
    'Хуваарилаагүй': { bg: '#F1F2F4', fg: '#8A8F99' },
    'Илгээгээгүй': { bg: '#EEF1F5', fg: '#5F636B' },
    'Имэйл илгээсэн': { bg: '#E8F2FF', fg: '#0B6FE0' },
    'Хариу ирсэн': { bg: '#FEF6E7', fg: '#B45309' },
    'Явагдаж байна': { bg: '#FEF6E7', fg: '#B45309' },
    'Баталгаажсан': { bg: '#E4F7EC', fg: '#0F7A43' },
}[s || 'Хуваарилаагүй'] || { bg: '#F1F2F4', fg: '#8A8F99' });

const nightsOf = (r: Reservation): number => {
    if (!r.startDate || !r.endDate) return 0;
    const s = new Date(r.startDate), e = new Date(r.endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const n = Math.round((e.getTime() - s.getTime()) / 86400000);
    return n > 0 ? n : 0;
};
const fmtDate = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
const monthKey = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
// 오늘 (yyyy-mm-dd, 로컬 기준)
const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// 투어가 이미 끝났는가 — 종료일(없으면 출발일)이 오늘보다 앞이면 지난 투어
const isPastTour = (r: { startDate?: string; endDate?: string }, today: string) => {
    const last = r.endDate || r.startDate;
    if (!last) return false;
    const d = new Date(last);
    if (Number.isNaN(d.getTime())) return false;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key < today;
};
// startDate + offset일 → yyyy-mm-dd (date input용 기본값)
const isoOffset = (start?: string, offset = 0) => {
    if (!start) return '';
    const d = new Date(start);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const weekdayMn = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : WD[d.getDay()];
};
const regionOf = (r: Reservation) => (r.contractData?.region || r.contractData?.category || r.productName || '-');
const genderMn = (g?: string) => g === '男性' || g === '남성' || g === 'male' ? 'Эрэгтэй' : g === '女性' || g === '여성' || g === 'female' ? 'Эмэгтэй' : (g || '-');
const flightLine = (f?: Flight) => [f?.date, f?.time, f?.flight].filter(Boolean).join(' · ') || '-';

// 저장된 dailyAccommodations이 있으면 그대로(추가/삭제 보존), 없으면 박일수만큼 빈 행 생성
const daysOf = (r: Reservation): DailyAcc[] => {
    const existing = Array.isArray(r.dailyAccommodations) ? r.dailyAccommodations : [];
    if (existing.length > 0) return existing;
    const nights = nightsOf(r);
    if (nights <= 0) return [];
    return Array.from({ length: nights }, (_, i) => ({ day: i + 1, date: isoOffset(r.startDate, i), accommodation: {} }));
};
const summaryOf = (r: Reservation) => {
    const rows = daysOf(r);
    const total = rows.length;
    const assigned = rows.filter(d => (d.accommodation?.name || '').trim()).length;
    const confirmed = rows.filter(d => d.accommodation?.bookingStatus === 'Баталгаажсан').length;
    const allConfirmed = total > 0 && confirmed === total;
    const label: BookingStatus | 'Хуваарилаагүй' | 'Явагдаж байна' = allConfirmed ? 'Баталгаажсан' : (assigned > 0 || confirmed > 0) ? 'Явагдаж байна' : 'Хуваарилаагүй';
    return { total, assigned, confirmed, allConfirmed, label };
};

const CONFIRMED_STATUSES = ['confirmed', 'paid', 'completed'];

export const AdminAccommodationOps: React.FC = () => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState<Set<string>>(new Set());
    const [savingId, setSavingId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [materialized, setMaterialized] = useState<Set<string>>(new Set());

    const [q, setQ] = useState('');
    const [month, setMonth] = useState('all');
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [region, setRegion] = useState('all');
    const [confirmFilter, setConfirmFilter] = useState<'all' | 'pending' | 'done'>('all');
    const [scope, setScope] = useState<'confirmed' | 'all'>('confirmed');
    const [hotels, setHotels] = useState<Array<{ id: string; name_kr?: string; name_local?: string; region?: string; address?: string; description?: string; images?: string[]; amenities?: string[] }>>([]);
    // 호텔 마스터에 없는 숙소를 직접 입력 중인 칸 (key = `${reservationId}:${dayIndex}`)
    const [manualHotels, setManualHotels] = useState<Set<string>>(new Set());

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.reservations.list();
            // 사이트 예약 + 맞춤 견적(전환되어 type='quote'로 생성된 예약)을 모두 포함
            const arr: Reservation[] = (Array.isArray(data) ? data : []).filter((r: any) => !!r && !!r.id);
            setReservations(arr);
            setMaterialized(new Set());
        } catch (e) {
            console.error('Байр захиалга — ачаалал амжилтгүй:', e);
            setReservations([]);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);
    // 호텔 마스터 목록 — байрны нэр 셀렉트에 사용
    useEffect(() => {
        (api as any).hotels.list({ active: true })
            .then((d: any) => setHotels(Array.isArray(d) ? d : []))
            .catch(() => setHotels([]));
    }, []);
    const hotelNames = useMemo(() => Array.from(new Set(hotels.map(h => h.name_kr || h.name_local || '').filter(Boolean))), [hotels]);
    // 표시명 → 호텔 마스터 레코드 (선택 시 이미지·지역·설명 등 전체 정보를 숙소에 채우기 위함)
    const hotelByName = useMemo(() => {
        const map = new Map<string, typeof hotels[number]>();
        hotels.forEach(h => { const n = h.name_kr || h.name_local || ''; if (n) map.set(n, h); });
        return map;
    }, [hotels]);

    const base = useMemo(() => reservations.filter(r => scope === 'all' ? true
        : (CONFIRMED_STATUSES.includes(r.status || '') || r.depositStatus === 'paid' || r.type === 'quote')), [reservations, scope]);
    /** 연도 막대에 표시할 월별 건수 + 이동 가능한 연도 범위 */
    const monthStats = useMemo(() => {
        const perMonth = new Map<string, number>();
        const years = new Set<number>();
        base.forEach(r => {
            const k = monthKey(r.startDate);
            if (!k) return;
            perMonth.set(k, (perMonth.get(k) || 0) + 1);
            years.add(Number(k.slice(0, 4)));
        });
        years.add(new Date().getFullYear());
        const list = Array.from(years).sort();
        return { perMonth, minYear: list[0], maxYear: list[list.length - 1], total: base.length };
    }, [base]);
    const regionOptions = useMemo(() => {
        const set = new Set<string>();
        base.forEach(r => { const k = regionOf(r); if (k && k !== '-') set.add(k); });
        return Array.from(set).sort();
    }, [base]);
    const filtered = useMemo(() => {
        const today = todayKey();
        const needle = q.trim().toLowerCase();
        return base.filter(r => {
            if (month !== 'all' && monthKey(r.startDate) !== month) return false;
            if (region !== 'all' && regionOf(r) !== region) return false;
            if (confirmFilter !== 'all') {
                const done = summaryOf(r).allConfirmed;
                if (confirmFilter === 'done' && !done) return false;
                if (confirmFilter === 'pending' && done) return false;
            }
            if (needle) {
                const hay = `${r.customerName || ''} ${r.productName || ''} ${r.reservationNumber || ''} ${regionOf(r)}`.toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            return true;
        }).sort((a, b) => {
            // 끝난 투어는 항상 아래로, 그 안에서는 최근에 끝난 것부터
            const pa = isPastTour(a, today) ? 1 : 0;
            const pb = isPastTour(b, today) ? 1 : 0;
            if (pa !== pb) return pa - pb;
            if (pa === 1) return (b.startDate || '').localeCompare(a.startDate || '');
            // 다가오는 투어는 미확정 먼저 → 출발일 가까운 순
            const da = summaryOf(a).allConfirmed ? 1 : 0;
            const db = summaryOf(b).allConfirmed ? 1 : 0;
            if (da !== db) return da - db;
            return (a.startDate || '').localeCompare(b.startDate || '');
        });
    }, [base, q, month, region, confirmFilter]);
    const counts = useMemo(() => {
        let done = 0, pending = 0;
        filtered.forEach(r => { summaryOf(r).allConfirmed ? done++ : pending++; });
        return { total: filtered.length, done, pending };
    }, [filtered]);

    // ── 펼침/구체화 ──
    const openRow = (r: Reservation) => {
        if (!materialized.has(r.id)) {
            setReservations(prev => prev.map(x => x.id === r.id ? { ...x, dailyAccommodations: daysOf(x).map((d, i) => ({ ...d, date: d.date || isoOffset(x.startDate, i) })) } : x));
            setMaterialized(prev => new Set(prev).add(r.id));
        }
        setExpanded(prev => new Set(prev).add(r.id));
    };
    const toggleExpand = (r: Reservation) => expanded.has(r.id) ? setExpanded(prev => { const n = new Set(prev); n.delete(r.id); return n; }) : openRow(r);

    // ?open=<reservationId> — 예약 상세의 「숙소 보드에서 수배 관리」 링크로 진입 시 해당 예약을 자동 펼침
    const openedFromUrl = useRef(false);
    useEffect(() => {
        if (openedFromUrl.current || reservations.length === 0) return;
        const id = new URLSearchParams(window.location.search).get('open');
        if (!id) return;
        const target = reservations.find(x => x.id === id);
        if (!target) return;
        openedFromUrl.current = true;
        // 확정 전 예약이면 기본 필터(Зөвхөн баталгаажсан)에 걸려 안 보이므로 전체 보기로 전환
        if (!(CONFIRMED_STATUSES.includes(target.status || '') || target.depositStatus === 'paid' || target.type === 'quote')) setScope('all');
        openRow(target);
        setTimeout(() => { try { document.getElementById(`acc-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* noop */ } }, 200);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reservations]);

    // ── 편집 ──
    const markDirty = (rId: string) => setDirty(prev => new Set(prev).add(rId));
    // Хадгалах(저장) 전 새로고침·이탈 시 편집 내용이 사라지는 것을 경고 —
    // "다 바꿨는데 어느 순간 되돌아간다"의 흔한 원인이 저장 전 이탈이다.
    useEffect(() => {
        const h = (e: BeforeUnloadEvent) => { if (dirty.size > 0) { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, [dirty]);
    // 일차 번호를 날짜순으로 1..N 재부여 — 2~5처럼 어긋난 옛 데이터를 예약 상세·확정 일정표와 맞춘다
    const renumberDays = (rId: string) => {
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = [...(r.dailyAccommodations || [])];
            rows.sort((a, b) => String(a.date || '9999-99-99').localeCompare(String(b.date || '9999-99-99')) || ((a.day || 0) - (b.day || 0)));
            return { ...r, dailyAccommodations: rows.map((d, i) => ({ ...d, day: i + 1, date: d.date || isoOffset(r.startDate, i) })) };
        }));
        markDirty(rId);
    };
    // 인덱스 기준 편집(일차 번호·날짜를 직접 수정해도 안전)
    const patchDay = (rId: string, idx: number, patch: Partial<DailyAcc['accommodation']>) => {
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = (r.dailyAccommodations || []).map((d, i) => i === idx ? { ...d, accommodation: { ...d.accommodation, ...patch } } : d);
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    // 일차(번호)·날짜 직접 편집
    const patchDayMeta = (rId: string, idx: number, patch: { day?: number; date?: string }) => {
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = (r.dailyAccommodations || []).map((d, i) => i === idx ? { ...d, ...patch } : d);
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    const addDay = (rId: string) => {
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = [...(r.dailyAccommodations || [])];
            const maxDay = rows.reduce((m, d) => Math.max(m, d.day || 0), 0);
            const last = rows[rows.length - 1]?.date;
            const nextDate = last ? isoOffset(last, 1) : isoOffset(r.startDate, rows.length);
            rows.push({ day: maxDay + 1, date: nextDate, accommodation: {} });
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    const removeDay = (rId: string, idx: number) => {
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = (r.dailyAccommodations || []).filter((_, i) => i !== idx);
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    // 담당 가이드(assignedGuide)·차량(contractData.vehicle) 편집 — 기존 컬럼에 저장(마이그레이션 불필요)
    const patchGuide = (rId: string, patch: { name?: string; phone?: string }) => {
        setReservations(prev => prev.map(r => r.id === rId ? { ...r, assignedGuide: { ...(r.assignedGuide || {}), ...patch } } : r));
        markDirty(rId);
    };
    const patchVehicle = (rId: string, patch: { type?: string; phone?: string }) => {
        setReservations(prev => prev.map(r => r.id === rId
            ? { ...r, contractData: { ...(r.contractData || {}), vehicle: { ...(r.contractData?.vehicle || {}), ...patch } } }
            : r));
        markDirty(rId);
    };
    const save = async (r: Reservation) => {
        setSavingId(r.id);
        try {
            // 전체 객체를 보내면 이 화면이 로드된 뒤 다른 곳(예약 상세·고객 계약서)에서 바뀐
            // 필드를 오래된 복사본으로 덮어쓴다. 최신본을 다시 읽어, 이 보드가 편집하는
            // 필드(숙소 배정·가이드·차량)만 얹어 부분 저장한다.
            let fresh: any = null;
            try { fresh = await api.reservations.get(r.id); } catch { fresh = null; }
            const payload: any = {
                dailyAccommodations: r.dailyAccommodations || [],
                assignedGuide: { ...((fresh?.assignedGuide) || {}), ...(r.assignedGuide || {}) },
                contractData: { ...((fresh?.contractData) || (r.contractData || {})), vehicle: r.contractData?.vehicle },
            };
            await api.reservations.update(r.id, payload);
            setDirty(prev => { const n = new Set(prev); n.delete(r.id); return n; });
        } catch (e: any) {
            alert('Хадгалах амжилтгүй: ' + (e?.message || e));
        } finally {
            setSavingId(null);
        }
    };

    return (
        <AdminLayout
            activePage="accommodation-ops"
            title="Байр захиалгын удирдлага"
            actions={<button type="button" onClick={load} className="btn"><Icon name="refresh" />Шинэчлэх</button>}
        >
            <div className="route-anim">
                <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <label className="tb-search">
                        <Icon name="search" />
                        <input placeholder="Үйлчлүүлэгч, аялал, захиалгын дугаараар хайх" value={q} onChange={e => setQ(e.target.value)} />
                    </label>
                    <select className="select" value={scope} onChange={e => setScope(e.target.value as any)}>
                        <option value="confirmed">Зөвхөн баталгаажсан</option>
                        <option value="all">Бүх захиалга</option>
                    </select>
                    <select className="select" value={region} onChange={e => setRegion(e.target.value)}>
                        <option value="all">Бүх бүс нутаг</option>
                        {regionOptions.map(rg => <option key={rg} value={rg}>{rg}</option>)}
                    </select>
                    <select className="select" value={confirmFilter} onChange={e => setConfirmFilter(e.target.value as any)}>
                        <option value="all">Бүх төлөв</option>
                        <option value="pending">Батлаагүй</option>
                        <option value="done">Баталгаажсан</option>
                    </select>
                    <div className="spacer" />
                    <span className="cell-muted" style={{ fontSize: 13 }}>
                        Харагдаж буй <b style={{ color: 'var(--text-strong)' }}>{counts.total}</b> ·{' '}
                        <span style={{ color: '#B45309', fontWeight: 700 }}>Батлаагүй {counts.pending}</span> ·{' '}
                        <span style={{ color: '#0F7A43', fontWeight: 700 }}>Баталгаажсан {counts.done}</span>
                    </span>
                </div>

                {/* 출발월 막대 — 연도 이동 + 월별 건수, 누르면 그 달만 표시 */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginTop: 10, overflowX: 'auto' }}>
                    <div className="row" style={{ gap: 6, alignItems: 'center', flex: 'none' }}>
                        <Icon name="calendar_month" style={{ fontSize: 18, color: 'var(--text-muted)' }} />
                        <span className="cell-muted" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>Явах сар</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setMonth('all')}
                        style={{
                            flex: 'none', border: 0, cursor: 'pointer', borderRadius: 999, padding: '6px 14px',
                            fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap',
                            background: month === 'all' ? '#06C4A0' : 'var(--bg-muted, #f1f3f5)',
                            color: month === 'all' ? '#fff' : 'var(--text-muted)',
                        }}
                    >
                        Бүгд {monthStats.total}
                    </button>
                    <div className="row" style={{ gap: 4, alignItems: 'center', flex: 'none' }}>
                        <button type="button" className="act-btn" title="Өмнөх жил" disabled={year <= monthStats.minYear} onClick={() => setYear(y => y - 1)}>
                            <Icon name="chevron_left" style={{ fontSize: 16 }} />
                        </button>
                        <b style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{year} он</b>
                        <button type="button" className="act-btn" title="Дараа жил" disabled={year >= monthStats.maxYear} onClick={() => setYear(y => y + 1)}>
                            <Icon name="chevron_right" style={{ fontSize: 16 }} />
                        </button>
                    </div>
                    <div className="row" style={{ gap: 6, flex: 1, minWidth: 0 }}>
                        {Array.from({ length: 12 }, (_, i) => {
                            const key = `${year}-${String(i + 1).padStart(2, '0')}`;
                            const n = monthStats.perMonth.get(key) || 0;
                            const active = month === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    disabled={n === 0}
                                    onClick={() => setMonth(key)}
                                    title={n === 0 ? 'Захиалга байхгүй' : `${i + 1}-р сар — ${n} захиалга`}
                                    style={{
                                        flex: '1 1 0', minWidth: 62, cursor: n === 0 ? 'default' : 'pointer',
                                        borderRadius: 10, padding: '7px 4px', textAlign: 'center', lineHeight: 1.25,
                                        border: active ? '2px solid #06C4A0' : '1px solid var(--border-default)',
                                        background: active ? 'rgba(6,196,160,0.08)' : '#fff',
                                        opacity: n === 0 ? 0.45 : 1,
                                    }}
                                >
                                    <div style={{ fontSize: 12.5, fontWeight: 800, color: n === 0 ? 'var(--text-muted)' : 'var(--text-strong)' }}>{i + 1}-р сар</div>
                                    <div style={{ fontSize: 11.5, fontWeight: 700, color: n === 0 ? 'var(--text-muted)' : '#06C4A0' }}>{n === 0 ? '-' : `${n}`}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="card">
                    <div className="tbl-wrap">
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 34 }}></th>
                                    <th style={{ width: 116 }}>Төлөв</th>
                                    <th>Үйлчлүүлэгч</th>
                                    <th style={{ width: 200 }}>Ирэх ~ Явах</th>
                                    <th style={{ width: 120 }}>Хоног</th>
                                    <th>Бүс нутаг</th>
                                    <th style={{ width: 100 }}>Захиалсан</th>
                                    <th style={{ width: 64 }}>Хүн</th>
                                    <th style={{ width: 130 }}>Явц</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 28 }} className="cell-muted">Ачааллаж байна…</td></tr>}
                                {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 28 }} className="cell-muted">Тохирох захиалга алга.</td></tr>}
                                {!loading && filtered.map(r => {
                                    const sum = summaryOf(r);
                                    const sty = statusStyle(sum.label);
                                    const open = expanded.has(r.id);
                                    const isDirty = dirty.has(r.id);
                                    const rows = open ? (r.dailyAccommodations || []) : [];
                                    const cd = r.contractData || {};
                                    const travelers = cd.travelers || [];
                                    return (
                                        <React.Fragment key={r.id}>
                                            <tr id={`acc-row-${r.id}`} style={{ cursor: 'pointer', background: open ? 'var(--surface-canvas, #F7F8FA)' : undefined }} onClick={() => toggleExpand(r)}>
                                                <td style={{ textAlign: 'center' }}><Icon name={open ? 'expand_more' : 'chevron_right'} /></td>
                                                <td><span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: sty.bg, color: sty.fg }}>{sum.label}</span></td>
                                                <td style={{ fontWeight: 700 }}>
                                                    {r.customerName || '-'}
                                                    {r.type === 'quote' && <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: '#EEEDFE', color: '#534AB7' }}>Үнийн санал</span>}
                                                    {r.reservationNumber && <span className="cell-muted" style={{ marginLeft: 6, fontSize: 11 }}>#{r.reservationNumber}</span>}
                                                </td>
                                                <td>{fmtDate(r.startDate)} ~ {fmtDate(r.endDate)}</td>
                                                <td>{nightsOf(r) > 0 ? `${nightsOf(r)} шөнө ${nightsOf(r) + 1} өдөр` : '-'}</td>
                                                <td>{regionOf(r)}</td>
                                                <td>{fmtDate(r.createdAt)}</td>
                                                <td>{r.travelers || '-'} хүн</td>
                                                <td style={{ fontWeight: 700, color: sum.allConfirmed ? '#0F7A43' : '#B45309' }}>
                                                    {sum.confirmed}/{sum.total} баталгаажсан
                                                    {/* 옛 데이터: 박수보다 행이 많으면(예: 4박인데 5행) 빈 행이 확정을 영원히 막는다 — 삭제 유도 */}
                                                    {nightsOf(r) > 0 && sum.total > nightsOf(r) && (
                                                        <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#D0342C' }}>шөнөөс {sum.total - nightsOf(r)} мөр илүү — 🗑 устгана уу</span>
                                                    )}
                                                </td>
                                            </tr>
                                            {open && (
                                                <tr>
                                                    <td colSpan={9} style={{ padding: 0, background: 'var(--surface-canvas, #F7F8FA)' }}>
                                                        <div style={{ padding: '14px 18px 18px' }}>

                                                            {/* ── Аяллын мэдээлэл (수배서 정보) ── */}
                                                            <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary, #E6E8EC)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                                                                <b style={{ fontSize: 13 }}>Аяллын мэдээлэл</b>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                                                                    <div style={{ background: 'var(--surface-canvas, #F7F8FA)', borderRadius: 8, padding: '10px 12px' }}>
                                                                        <div className="cell-muted" style={{ fontSize: 11 }}>✈ Ирэх нислэг (Монгол ирэх)</div>
                                                                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>{flightLine(cd.arrival)}</div>
                                                                    </div>
                                                                    <div style={{ background: 'var(--surface-canvas, #F7F8FA)', borderRadius: 8, padding: '10px 12px' }}>
                                                                        <div className="cell-muted" style={{ fontSize: 11 }}>✈ Буцах нислэг (Монголоос явах)</div>
                                                                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>{flightLine(cd.departure)}</div>
                                                                    </div>
                                                                </div>
                                                                {travelers.length > 0 ? (
                                                                    <div style={{ overflowX: 'auto', marginTop: 10 }}>
                                                                        <table className="tbl" style={{ minWidth: 640 }}>
                                                                            <thead><tr>
                                                                                <th style={{ width: 56 }}>Аялагч</th>
                                                                                <th>Паспортын нэр</th>
                                                                                <th>Нэр</th>
                                                                                <th style={{ width: 110 }}>Төрсөн огноо</th>
                                                                                <th style={{ width: 80 }}>Хүйс</th>
                                                                                <th style={{ width: 130 }}>Утас</th>
                                                                            </tr></thead>
                                                                            <tbody>
                                                                                {travelers.map((t, i) => (
                                                                                    <tr key={i}>
                                                                                        <td style={{ fontWeight: 700 }}>{i + 1}</td>
                                                                                        <td style={{ fontWeight: 700 }}>{t.passportName || '-'}</td>
                                                                                        <td>{t.name || '-'}</td>
                                                                                        <td>{t.birthdate || '-'}</td>
                                                                                        <td>{genderMn(t.gender)}</td>
                                                                                        <td>{t.phone || '-'}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                ) : <div className="cell-muted" style={{ fontSize: 12, marginTop: 10 }}>Аялагчийн мэдээлэл алга (гэрээ ирээгүй).</div>}
                                                                {cd.agreement?.name && <div style={{ marginTop: 10, fontSize: 12 }}><span className="cell-muted">Цахим гарын үсэг:</span> <b>{cd.agreement.name}</b></div>}
                                                            </div>

                                                            {/* ── Өдөр тутмын байр ── */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                                                                <b style={{ fontSize: 13 }}>Өдөр тутмын байрны захиалга</b>
                                                                <a className="btn btn-sm" href={`/admin/reservations?open=${r.id}`} title="통합 예약 관리에서 이 예약 상세를 엽니다.">
                                                                    <Icon name="assignment" />Захиалгын дэлгэрэнгүй
                                                                </a>
                                                                <div style={{ flex: 1 }} />
                                                                <button type="button" className="btn btn-sm" title="일차 번호를 날짜순으로 1..N 재정렬합니다." onClick={() => renumberDays(r.id)}>
                                                                    <Icon name="format_list_numbered" />Огноогоор цэгцлэх
                                                                </button>
                                                                {isDirty && <span style={{ fontSize: 12, fontWeight: 700, color: '#B45309' }}>Өөрчлөгдсөн ·</span>}
                                                                <button type="button" className="btn btn-ink btn-sm" disabled={!isDirty || savingId === r.id} onClick={() => save(r)}>
                                                                    <Icon name="save" />{savingId === r.id ? 'Хадгалж байна…' : 'Хадгалах'}
                                                                </button>
                                                            </div>
                                                            <div style={{ overflowX: 'auto' }}>
                                                                <table className="tbl" style={{ minWidth: 1070 }}>
                                                                    <thead>
                                                                        <tr>
                                                                            <th style={{ width: 240 }}>Өдөр · Огноо</th>
                                                                            <th style={{ width: 120 }}>Бүс / Байршил</th>
                                                                            <th>Байрны нэр</th>
                                                                            <th style={{ width: 130 }}>Зэрэглэл</th>
                                                                            <th style={{ width: 80 }}>Өрөө</th>
                                                                            <th style={{ width: 130 }}>Хүн/өрөө</th>
                                                                            <th style={{ width: 150 }}>Захиалгын төлөв</th>
                                                                            <th style={{ width: 44 }}></th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {rows.map((d, idx) => {
                                                                            const acc = d.accommodation || {};
                                                                            const hasName = (acc.name || '').trim().length > 0;
                                                                            const st: BookingStatus | 'Хуваарилаагүй' = hasName ? (acc.bookingStatus || 'Илгээгээгүй') : 'Хуваарилаагүй';
                                                                            const sts = statusStyle(st);
                                                                            return (
                                                                                <tr key={idx}>
                                                                                    <td>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                                                                                                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: '#B4B8C0' }}>ӨДӨР</span>
                                                                                                <input type="number" min={1} value={d.day} onChange={e => patchDayMeta(r.id, idx, { day: parseInt(e.target.value) || idx + 1 })}
                                                                                                    style={{ width: 38, height: 28, textAlign: 'center', padding: 0, border: '1px solid #E6E8EC', borderRadius: 8, fontWeight: 800, fontSize: 14, color: '#1A8CFF', background: '#fff', outline: 'none', marginTop: 1 }} />
                                                                                            </div>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                                                                                <input type="date" className="inp" style={{ width: 148 }} value={d.date || ''} onChange={e => patchDayMeta(r.id, idx, { date: e.target.value })} />
                                                                                                {d.date && <span style={{ fontSize: 11, fontWeight: 700, color: '#8A8F99', flex: 'none' }}>{weekdayMn(d.date)}</span>}
                                                                                            </div>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td><input className="inp" style={{ width: 116 }} value={acc.location || ''} placeholder="지역 입력" onChange={e => patchDay(r.id, idx, { location: e.target.value })} /></td>
                                                                                    <td>{(() => {
                                                                                        // 호텔 마스터에서 셀렉트로 선택. 목록에 없는 숙소만 "Гараар бичих"로 직접 입력.
                                                                                        const mKey = `${r.id}:${idx}`;
                                                                                        const nm = acc.name || '';
                                                                                        const inMaster = !!nm && hotelNames.includes(nm);
                                                                                        const manual = manualHotels.has(mKey) || (!!nm && !inMaster);
                                                                                        if (manual) {
                                                                                            return (
                                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 200 }}>
                                                                                                    <input className="inp" style={{ flex: 1, minWidth: 0 }} value={nm} placeholder="Буудлын нэр бичих"
                                                                                                        onChange={e => { if (!manualHotels.has(mKey)) setManualHotels(prev => new Set(prev).add(mKey)); patchDay(r.id, idx, { name: e.target.value }); }} />
                                                                                                    <button type="button" title="Жагсаалтаас сонгох"
                                                                                                        onClick={() => { setManualHotels(prev => { const n = new Set(prev); n.delete(mKey); return n; }); patchDay(r.id, idx, { name: '' }); }}
                                                                                                        style={{ flex: 'none', width: 30, height: 30, display: 'grid', placeItems: 'center', border: '1px solid #E6E8EC', borderRadius: 8, background: '#fff', color: '#8A8F99', cursor: 'pointer' }}>
                                                                                                        <Icon name="checklist" />
                                                                                                    </button>
                                                                                                </div>
                                                                                            );
                                                                                        }
                                                                                        return (
                                                                                            <select className="select" style={{ width: '100%', minWidth: 200 }} value={inMaster ? nm : ''}
                                                                                                onChange={e => {
                                                                                                    const v = e.target.value;
                                                                                                    if (v === '__manual__') { setManualHotels(prev => new Set(prev).add(mKey)); patchDay(r.id, idx, { name: '', id: undefined, images: [] }); return; }
                                                                                                    // 호텔 마스터에서 선택 → 이미지·지역·설명·시설까지 전체를 숙소에 채운다.
                                                                                                    // (이름만 넣으면 예약 상세·확정 일정표에 이미지가 안 나옴)
                                                                                                    const h = hotelByName.get(v);
                                                                                                    const patch: Partial<DailyAcc['accommodation']> = { name: v };
                                                                                                    if (h) {
                                                                                                        patch.id = h.id;
                                                                                                        patch.images = Array.isArray(h.images) ? h.images : [];
                                                                                                        patch.description = h.description || '';
                                                                                                        if (!acc.location && h.region) patch.location = h.region;
                                                                                                        if (Array.isArray(h.amenities) && h.amenities.length) patch.facilities = h.amenities;
                                                                                                    }
                                                                                                    patchDay(r.id, idx, patch);
                                                                                                }}>
                                                                                                <option value="">Буудал сонгох…</option>
                                                                                                {hotelNames.map(n => <option key={n} value={n}>{n}</option>)}
                                                                                                <option value="__manual__">✏️ Гараар бичих (жагсаалтад байхгүй)</option>
                                                                                            </select>
                                                                                        );
                                                                                    })()}</td>
                                                                                    <td>
                                                                                        <select className="select" style={{ width: 124 }} value={acc.type || ''} onChange={e => patchDay(r.id, idx, { type: e.target.value || undefined })}>
                                                                                            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g || 'Тодорхойгүй'}</option>)}
                                                                                        </select>
                                                                                    </td>
                                                                                    <td><input className="inp" type="number" min={0} style={{ width: 66 }} value={acc.roomCount ?? ''} placeholder="0" onChange={e => patchDay(r.id, idx, { roomCount: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0) })} /></td>
                                                                                    <td>
                                                                                        <select className="select" style={{ width: 120 }} value={acc.occupancy || ''} onChange={e => patchDay(r.id, idx, { occupancy: e.target.value || undefined })}>
                                                                                            {OCCUPANCY_OPTIONS.map(o => <option key={o} value={o}>{o || 'Тодорхойгүй'}</option>)}
                                                                                        </select>
                                                                                    </td>
                                                                                    <td>
                                                                                        <select className="select" style={{ width: 140, fontWeight: 700, background: sts.bg, color: sts.fg, borderColor: 'transparent' }}
                                                                                            value={hasName ? (acc.bookingStatus || 'Илгээгээгүй') : 'Илгээгээгүй'} disabled={!hasName}
                                                                                            onChange={e => patchDay(r.id, idx, { bookingStatus: e.target.value as BookingStatus })}>
                                                                                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                                                        </select>
                                                                                    </td>
                                                                                    <td style={{ textAlign: 'center' }}>
                                                                                        <button type="button" className="btn btn-sm" title="Энэ өдрийг устгах" onClick={() => { if (window.confirm(`Өдөр ${d.day}-г устгах уу?`)) removeDay(r.id, idx); }} style={{ color: '#E24B4A' }}>
                                                                                            <Icon name="delete" />
                                                                                        </button>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                        {rows.length === 0 && <tr><td colSpan={8} className="cell-muted" style={{ textAlign: 'center', padding: 14 }}>Өдөр алга. ‘Өдөр нэмэх’ дарж нэмнэ үү.</td></tr>}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                            <button type="button" className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => addDay(r.id)}><Icon name="add" />Өдөр нэмэх</button>

                                                            {/* ── Хариуцсан гайд ба тээвэр (가이드·차량) ── */}
                                                            <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary, #E6E8EC)', borderRadius: 12, padding: 14, marginTop: 14 }}>
                                                                <b style={{ fontSize: 13 }}>Хариуцсан гайд ба тээвэр</b>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginTop: 10 }}>
                                                                    <div>
                                                                        <label className="cell-muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Гайдын нэр</label>
                                                                        <input className="inp" style={{ width: '100%' }} value={r.assignedGuide?.name || ''} placeholder="Гайдын нэр" onChange={e => patchGuide(r.id, { name: e.target.value })} />
                                                                    </div>
                                                                    <div>
                                                                        <label className="cell-muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Гайдын утас</label>
                                                                        <input className="inp" style={{ width: '100%' }} value={r.assignedGuide?.phone || ''} placeholder="Гайдын утас" onChange={e => patchGuide(r.id, { phone: e.target.value })} />
                                                                    </div>
                                                                    <div>
                                                                        <label className="cell-muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Машины төрөл</label>
                                                                        <input className="inp" style={{ width: '100%' }} value={r.contractData?.vehicle?.type || ''} placeholder="Жишээ: Land Cruiser 76" onChange={e => patchVehicle(r.id, { type: e.target.value })} />
                                                                    </div>
                                                                    <div>
                                                                        <label className="cell-muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Жолоочийн утас</label>
                                                                        <input className="inp" style={{ width: '100%' }} value={r.contractData?.vehicle?.phone || ''} placeholder="Жолоочийн утас" onChange={e => patchVehicle(r.id, { phone: e.target.value })} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};
