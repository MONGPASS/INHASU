import React, { useCallback, useEffect, useState } from 'react';
import type { AdminTrafficData } from '../../../types/adminTraffic';
import { trafficKpis, trafficRows } from '../../../utils/adminTraffic';
import { AdminButton, IconCircleExclamationFill, IconInfo } from '../ui';
import styles from './TrafficSources.module.css';

type Ready = Extract<AdminTrafficData, { configured: true }>;
export type AdminTrafficLoad = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: AdminTrafficData };

/**
 * GA4 aggregates for the last 30 days from /api/admin/traffic. The dashboard reads it once and shares it between
 * the 문의 전환율 card and the 유입 경로 card. A missing setup or failed read is reported as such, never as zero.
 */
export function useAdminTraffic(): { load: AdminTrafficLoad; retry: () => void } {
    const [load, setLoad] = useState<AdminTrafficLoad>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => { setLoad({ status: 'loading' }); setAttempt(n => n + 1); }, []);
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/admin/traffic?period=30d', { credentials: 'same-origin', signal: controller.signal })
            .then(async res => {
                const body = await res.json().catch(() => null);
                if (!res.ok || !body || typeof body.configured !== 'boolean') throw new Error(body?.error || '유입 통계를 불러오지 못했습니다. 다시 시도해 주세요.');
                setLoad({ status: 'ready', data: body as AdminTrafficData });
            })
            .catch(error => { if (!controller.signal.aborted) setLoad({ status: 'error', message: error instanceof Error ? error.message : String(error) }); });
        return () => controller.abort();
    }, [attempt]);
    return { load, retry };
}

export const trafficReady = (load: AdminTrafficLoad): Ready | null => load.status === 'ready' && load.data.configured ? load.data : null;

const numbers = new Intl.NumberFormat('ko-KR');
/** 채널 순서 색(1위 진한 민트 → 옅은 민트 → 파랑 → 초록, 나머지 회색). 색은 CSS 클래스(--adm-* 토큰)로. */
const TONES = [styles.tone0, styles.tone1, styles.tone2, styles.tone3];
const tone = (index: number) => TONES[index] || styles.toneRest;

/** 유입 경로 카드(디자인 시안 A): 최근 30일 방문자 · 채널 비중 막대 · 상위 채널 4개. */
export function TrafficSources({ load, retry }: { load: AdminTrafficLoad; retry: () => void }) {
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
            <span className={styles.period}>최근 30일</span>
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
            {!rows.length && <p className={styles.state}>최근 30일에 수집된 방문이 없습니다.</p>}
        </>}
    </section>;
}
