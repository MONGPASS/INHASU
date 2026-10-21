import React, { useCallback, useEffect, useState } from 'react';
import type { AdminTrafficChannel, AdminTrafficData, AdminTrafficPeriod } from '../../../types/adminTraffic';
import { trafficKpis, trafficRows } from '../../../utils/adminTraffic';
import { dashboardTimestamp } from '../../../utils/adminDashboard';
import { DashboardIcon, type DashboardIconName } from './DashboardIcon';
import { useEntrance, type DashboardTipFor } from './dashboardMotion';
import styles from './TrafficSources.module.css';

const PERIODS: { key: AdminTrafficPeriod; label: string }[] = [{ key: 'today', label: '오늘' }, { key: '7d', label: '7일' }, { key: '30d', label: '30일' }];
const logo = (slug: string, color: string) => `https://cdn.simpleicons.org/${slug}/${color}`;
const BRAND: Record<AdminTrafficChannel, { bg: string; border?: boolean; logo?: string; icon?: DashboardIconName }> = {
    '네이버 검색': { bg: '#03C75A', logo: logo('naver', 'ffffff') },
    '네이버 블로그': { bg: '#fff', border: true, logo: logo('naver', '03C75A') },
    '인스타그램': { bg: 'linear-gradient(135deg,#FEDA75,#FA7E1E 30%,#D62976 60%,#962FBF 85%,#4F5BD5)', logo: logo('instagram', 'ffffff') },
    '구글 검색': { bg: '#fff', border: true, logo: logo('google', '4285F4') },
    '유튜브': { bg: '#FF0000', logo: logo('youtube', 'ffffff') },
    '카카오톡 채널': { bg: '#FEE500', logo: logo('kakaotalk', '191919') },
    '직접 방문': { bg: 'var(--mrt-gray-100)', icon: 'lc-mouse-pointer-click' },
    '기타·추천': { bg: 'var(--mrt-gray-100)', icon: 'lc-link' },
};
const TONES = ['var(--mrt-ink)', 'var(--mrt-blue-strong)', 'var(--mrt-blue)', 'color-mix(in oklch, var(--mrt-blue) 70%, white)',
    'color-mix(in oklch, var(--mrt-blue) 45%, white)', 'color-mix(in oklch, var(--mrt-blue) 28%, white)', 'var(--mrt-gray-400)', 'var(--border-default)'];
const numbers = new Intl.NumberFormat('ko-KR');

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: AdminTrafficData };

/** 유입 경로: GA4 aggregates from /api/admin/traffic. Missing setup or a failed read is shown as such, never as zero. */
export function TrafficSources({ tipFor }: { tipFor: DashboardTipFor }) {
    const [period, setPeriod] = useState<AdminTrafficPeriod>('30d');
    const [load, setLoad] = useState<Load>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const t = useEntrance(`${load.status}:${period}`);
    const retry = useCallback(() => { setLoad({ status: 'loading' }); setAttempt(n => n + 1); }, []);

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

    const choose = (next: AdminTrafficPeriod) => { if (next !== period) { setLoad({ status: 'loading' }); setPeriod(next); } };
    const data = load.status === 'ready' && load.data.configured ? load.data : null;
    const rows = data ? trafficRows(data) : [];
    const max = Math.max(1, ...rows.map(row => row.sessions));

    return <section className={styles.card} aria-busy={load.status === 'loading'}>
        <div className={styles.head}>
            <span className={styles.title}>유입 경로</span>
            <span className={styles.info} role="img" aria-label="GA4 기준. 최대 15분 단위로 갱신되며 오늘 자료는 GA 반영까지 몇 시간 걸릴 수 있습니다."
                title="GA4 기준 · 15분 단위 갱신 · 오늘 자료는 GA 반영까지 몇 시간 걸릴 수 있습니다">
                <DashboardIcon name="lc-info" size={14} color="var(--mrt-gray-400)" />
            </span>
            <div className={styles.seg} role="group" aria-label="유입 경로 기간">
                {PERIODS.map(option => <button key={option.key} type="button" aria-pressed={period === option.key}
                    className={styles.segButton} onClick={() => choose(option.key)}>{option.label}</button>)}
            </div>
        </div>

        {load.status === 'loading' && <div className={styles.state} role="status"><p>유입 통계를 불러오고 있습니다.</p></div>}
        {load.status === 'error' && <div className={styles.state} role="alert">
            <span className={styles.stateIcon}><DashboardIcon name="lc-circle-alert" size={20} /></span>
            <p>{load.message}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>다시 시도</button>
        </div>}
        {load.status === 'ready' && !load.data.configured && <div className={styles.state}>
            <span className={styles.stateIcon}><DashboardIcon name="lc-trending-up" size={20} /></span>
            <strong>GA4 연결 설정이 필요합니다.</strong>
            <p>Cloudflare에 GA4_PROPERTY_ID와 GA4_SERVICE_ACCOUNT_JSON(비밀)을 등록하면 채널별 방문·견적 문의·전환율을 이 영역에 표시합니다.</p>
        </div>}

        {data && <>
            <div className={styles.kpis}>
                {trafficKpis(data).map(kpi => <div key={kpi.label} className={styles.kpi}>
                    <span className={styles.kpiLabel}>{kpi.label}</span>
                    <div className={styles.kpiRow}>
                        <span className={styles.kpiValue}>{kpi.value === null ? '—' : kpi.format(kpi.value * t)}</span>
                        {kpi.value !== null && <span className={styles.kpiUnit}>{kpi.unit}</span>}
                        {kpi.delta && <span className={`${styles.kpiDelta} ${kpi.down ? styles.kpiDown : ''}`}>{kpi.delta}</span>}
                    </div>
                </div>)}
            </div>
            <div className={styles.track}>
                <div className={styles.segments} style={{ width: `${t * 100}%` }}>
                    {rows.map((row, index) => <span key={row.name} style={{ flex: row.sessions, background: TONES[index] }}
                        {...tipFor(row.name, [{ k: '방문', v: `${numbers.format(row.sessions)}회` }, { k: '비중', v: `${row.share.toFixed(1)}%` },
                            { k: '견적 문의', v: `${numbers.format(row.leads)}건` }, { k: '전환율', v: row.cvr === null ? '—' : `${row.cvr.toFixed(2)}%` }])} />)}
                </div>
            </div>
            <div className={styles.table}>
                <div className={styles.tableHead} aria-hidden="true">
                    <span>채널</span><span>비중</span><span className={styles.right}>방문</span><span className={styles.right}>문의</span><span className={styles.right}>전환율</span>
                </div>
                {rows.map((row, index) => {
                    const brand = BRAND[row.name];
                    return <div key={row.name} className={styles.row}>
                        <span className={styles.channel}>
                            <span className={styles.dot} style={{ background: brand.bg, border: brand.border ? '1px solid var(--border-default)' : 0 }}>
                                {brand.logo ? <img src={brand.logo} alt="" width={16} height={16} loading="lazy" /> : brand.icon && <DashboardIcon name={brand.icon} size={15} />}
                            </span>
                            <span className={styles.channelName}>{row.name}</span>
                        </span>
                        <span className={styles.shareCell}>
                            <span className={styles.bar} {...tipFor(row.name, [{ k: '방문', v: `${numbers.format(row.sessions)}회` }, { k: '비중', v: `${row.share.toFixed(1)}%` }])}>
                                <span style={{ width: `${row.sessions / max * 100 * t}%`, background: TONES[index] }} />
                            </span>
                            <span className={styles.share}>{Math.round(row.share)}%</span>
                        </span>
                        <span className={styles.visits}>{numbers.format(row.sessions)}</span>
                        <span className={styles.leads}>{numbers.format(row.leads)}</span>
                        <span className={styles.cvr}>{row.cvr === null ? '—' : `${row.cvr.toFixed(1)}%`}</span>
                    </div>;
                })}
                {!rows.length && <div className={styles.state}><p>선택한 기간에 수집된 방문이 없습니다.</p></div>}
            </div>
            <p className={styles.note}>GA4 기준 · {dashboardTimestamp(data.generatedAt)} 조회 · 방문은 세션 수, 문의는 접수가 확인된 견적 요청입니다.</p>
        </>}
    </section>;
}
