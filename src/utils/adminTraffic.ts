import type { AdminTrafficChannel, AdminTrafficData, AdminTrafficTotals } from '../types/adminTraffic';

const numbers = new Intl.NumberFormat('ko-KR');
const rate = (totals: AdminTrafficTotals) => totals.sessions ? totals.leads / totals.sessions * 100 : null;

/** Change against the previous period of the same length; hidden when there is nothing to compare. */
function delta(current: number, previous: number): string {
    if (!previous) return '';
    const change = Math.round((current - previous) / previous * 100);
    return `${change > 0 ? '+' : ''}${change}%`;
}

export interface TrafficKpi { label: string; value: number | null; format: (value: number) => string; unit: string; delta: string; down: boolean }
export function trafficKpis(data: Extract<AdminTrafficData, { configured: true }>): TrafficKpi[] {
    const { current: c, previous: p } = data;
    const cvr = rate(c), cvrPrev = rate(p);
    const cvrDelta = cvr !== null && cvrPrev !== null ? Math.round((cvr - cvrPrev) * 10) / 10 : null;
    const kpi = (label: string, value: number, previous: number, unit: string): TrafficKpi =>
        ({ label, value, format: v => numbers.format(Math.round(v)), unit, delta: delta(value, previous), down: value < previous });
    return [
        kpi('홈페이지 방문자', c.visitors, p.visitors, '명'),
        kpi('페이지뷰', c.pageViews, p.pageViews, '회'),
        kpi('견적 문의', c.leads, p.leads, '건'),
        { label: '문의 전환율', value: cvr, format: v => v.toFixed(1), unit: '%',
            delta: cvrDelta === null ? '' : `${cvrDelta > 0 ? '+' : ''}${cvrDelta.toFixed(1)}%p`, down: (cvrDelta ?? 0) < 0 },
    ];
}

export interface TrafficRow { name: AdminTrafficChannel; sessions: number; leads: number; share: number; cvr: number | null }
/** Channels with traffic, largest first; channels without a visit or lead are left out. */
export function trafficRows(data: Extract<AdminTrafficData, { configured: true }>): TrafficRow[] {
    const total = data.channels.reduce((sum, channel) => sum + channel.sessions, 0);
    return data.channels.filter(channel => channel.sessions || channel.leads)
        .map(channel => ({ ...channel, share: total ? channel.sessions / total * 100 : 0, cvr: channel.sessions ? channel.leads / channel.sessions * 100 : null }))
        .sort((a, b) => b.sessions - a.sessions || b.leads - a.leads);
}
