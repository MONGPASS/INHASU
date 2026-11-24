import React, { useCallback, useEffect, useState } from 'react';
import type { AdminTrafficData, AdminTrafficPeriod } from '../../../types/adminTraffic';
import { trafficKpis, trafficRows } from '../../../utils/adminTraffic';
import { AdminButton, AdminMenu, IconCheck, IconChevronDown, IconCircleExclamationFill, IconInfo } from '../ui';
import styles from './TrafficSources.module.css';

type Ready = Extract<AdminTrafficData, { configured: true }>;
export type AdminTrafficLoad = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: AdminTrafficData };

/** 유입 경로 기간(서버 /api/admin/traffic의 period). 비교(+%)는 바로 앞의 같은 길이 기간과 한다. */
export const TRAFFIC_PERIODS: { key: AdminTrafficPeriod; label: string; note: string }[] = [
    { key: 'today', label: '오늘', note: '오늘 하루 · 어제와 비교' },
    { key: 'yesterday', label: '어제', note: '지난 하루 · 그 전날과 비교' },
    { key: '7d', label: '최근 7일', note: '오늘 포함 7일 · 그 전 7일과 비교' },
    { key: '30d', label: '최근 30일', note: '오늘 포함 30일 · 그 전 30일과 비교' },
    { key: '90d', label: '최근 90일', note: '오늘 포함 90일 · 그 전 90일과 비교' },
];
export const trafficPeriodLabel = (period: AdminTrafficPeriod) => TRAFFIC_PERIODS.find(item => item.key === period)?.label || '';

export interface AdminTraffic { load: AdminTrafficLoad; retry: () => void; period: AdminTrafficPeriod; setPeriod: (period: AdminTrafficPeriod) => void }
/**
 * GA4 aggregates from /api/admin/traffic for the chosen period (처음은 최근 30일). The dashboard reads it once and
 * shares it between the 문의 전환율 card and the 유입 경로 card. A missing setup or failed read is reported as such, never as zero.
 */
export function useAdminTraffic(): AdminTraffic {
    const [period, choose] = useState<AdminTrafficPeriod>('30d');
    const [load, setLoad] = useState<AdminTrafficLoad>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => { setLoad({ status: 'loading' }); setAttempt(n => n + 1); }, []);
    const setPeriod = useCallback((next: AdminTrafficPeriod) => { choose(current => { if (current !== next) setLoad({ status: 'loading' }); return next; }); }, []);
    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/admin/traffic?period=${period}`, { credentials: 'same-origin', signal: controller.signal })
            .then(async res => {
                const body = await res.json().catch(() => null);
                if (!res.ok || !body || typeof body.configured !== 'boolean') throw new Error(body?.error || '유입 통계를 불러오지 못했습니다. 다시 시도해 주세요.');
                setLoad({ status: 'ready', data: body as AdminTrafficData });
            })
            .catch(error => { if (!controller.signal.aborted) setLoad({ status: 'error', message: error instanceof Error ? error.message : String(error) }); });
        return () => controller.abort();
    }, [period, attempt]);
    return { load, retry, period, setPeriod };
}

export const trafficReady = (load: AdminTrafficLoad): Ready | null => load.status === 'ready' && load.data.configured ? load.data : null;

const numbers = new Intl.NumberFormat('ko-KR');
/** 채널 순서 색(1위 진한 민트 → 옅은 민트 → 파랑 → 초록, 나머지 회색). 색은 CSS 클래스(--adm-* 토큰)로. */
const TONES = [styles.tone0, styles.tone1, styles.tone2, styles.tone3];
const tone = (index: number) => TONES[index] || styles.toneRest;

/** 유입 경로 카드(디자인 시안 A): 고른 기간의 방문자 · 채널 비중 막대 · 상위 채널 4개. 기간은 오른쪽 위 고르기 메뉴. */
export function TrafficSources({ load, retry, period, setPeriod }: AdminTraffic) {
    const data = trafficReady(load);
    const rows = data ? trafficRows(data) : [];
    const kpis = data ? trafficKpis(data) : [];
    const visitors = kpis.find(kpi => kpi.label === '홈페이지 방문자');
    const leads = kpis.find(kpi => kpi.label === '견적 문의');

    return <section className={styles.card} id="dashboard-traffic" aria-labelledby="dashboard-traffic-title" aria-busy={load.status === 'loading'}>
        <div className={styles.head}>
            <h2 id="dashboard-traffic-title" className={styles.title}>유입 경로</h2>
            <span className={styles.info} role="img" aria-label="GA4 기준. 방문은 세션 수, 문의는 접수가 확인된 견적 요청입니다. 오늘 자료는 GA 반영까지 몇 시간 걸릴 수 있습니다."
                title="GA4 기준 · 방문은 세션 수 · 오늘 자료는 GA 반영까지 몇 시간 걸릴 수 있습니다"><IconInfo /></span>
            {/* 기간 고르기: 우리 고르기 메뉴(바깥 누르기·Esc로 닫힘). 고른 기간은 이름 앞 체크로 보인다 */}
            <div className={styles.period}>
                <AdminMenu label="유입 경로 기간"
                    trigger={<AdminButton variant="weak" size="sm" trailing={<IconChevronDown aria-hidden="true" />}>{trafficPeriodLabel(period)}</AdminButton>}
                    items={TRAFFIC_PERIODS.map(option => ({
                        key: option.key,
                        label: <span className={`${styles.option} ${period === option.key ? styles.optionOn : ''}`}>
                            <IconCheck aria-hidden="true" className={styles.optionCheck} />{option.label}{period === option.key && <span className={styles.srOnly}> (선택됨)</span>}
                        </span>,
                        description: option.note,
                        onSelect: () => setPeriod(option.key),
                    }))} />
            </div>
        </div>

        {load.status === 'loading' && <p className={styles.state} role="status">유입 통계를 불러오고 있습니다.</p>}
        {load.status === 'error' && <div className={styles.state} role="alert">
            <IconCircleExclamationFill className={styles.stateIcon} aria-hidden="true" />
            <p>{load.message}</p>
            <AdminButton variant="weak" size="sm" onClick={retry}>다시 시도</AdminButton>
        </div>}
        {load.status === 'ready' && !load.data.configured && <div className={styles.state}>
            <strong>GA4 연결 설정이 필요합니다.</strong>
            <p>Cloudflare에 GA4_PROPERTY_ID와 GA4_SERVICE_ACCOUNT_JSON(비밀)을 등록하면 채널별 방문·견적 문의를 이 영역에 표시합니다.</p>
        </div>}

        {data && <>
            <div className={styles.total}>
                <span className={styles.totalValue}>{visitors?.value == null ? '—' : `${numbers.format(visitors.value)}명`}</span>
                {visitors?.delta && <span className={`${styles.delta} ${visitors.down ? styles.deltaDown : ''}`}>{visitors.delta}</span>}
                <span className={styles.totalNote}>방문자 · 문의 {leads?.value == null ? '—' : numbers.format(leads.value)}건</span>
            </div>
            {/* 막대 길이만 실행 중 계산값이라 인라인 */}
            {!!rows.length && <div className={styles.stack} role="img" aria-label={rows.map(row => `${row.name} ${Math.round(row.share)}%`).join(', ')}>
                {rows.map((row, index) => <span key={row.name} className={tone(index)} style={{ flexGrow: row.sessions }} />)}
            </div>}
            <ul className={styles.list}>
                {rows.slice(0, 4).map((row, index) => <li key={row.name} className={styles.row}>
                    <span className={`${styles.dot} ${tone(index)}`} aria-hidden="true" />
                    <span className={styles.name}>{row.name}</span>
                    <span className={styles.share}>{Math.round(row.share)}%</span>
                    <span className={styles.visits}>{numbers.format(row.sessions)}회</span>
                </li>)}
            </ul>
            {!rows.length && <p className={styles.state}>{trafficPeriodLabel(period)}에 수집된 방문이 없습니다.</p>}
        </>}
    </section>;
}
