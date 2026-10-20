import { useState } from 'react';
import styles from './AdminTrafficPanel.module.css';

export type AdminTrafficPeriod = 'today' | '7days' | '30days';
/** Provider-neutral contract for the analytics connection. Booking counts are never substituted for visits. */
export interface AdminTrafficReport {
    period: AdminTrafficPeriod;
    visitors: number | null;
    pageViews: number | null;
    inquiries: number | null;
    conversionRate: number | null;
    channels: { key: string; visitors: number | null; inquiries: number | null; conversionRate: number | null }[];
}
const channels = [
    { key: 'naver_search', name: '네이버 검색', mark: 'N', color: '#03c75a' },
    { key: 'naver_blog', name: '네이버 블로그', mark: 'N', color: '#03c75a' },
    { key: 'instagram', name: '인스타그램', mark: '◎', color: 'linear-gradient(135deg,#feda75,#d62976,#4f5bd5)' },
    { key: 'google', name: '구글 검색', mark: 'G', color: '#4285f4' },
    { key: 'youtube', name: '유튜브', mark: '▶', color: '#ff0000' },
    { key: 'kakao', name: '카카오톡 채널', mark: 'K', color: '#fee500' },
    { key: 'direct', name: '직접 방문', mark: '↗', color: '#8a8f99' },
    { key: 'referral', name: '기타·추천', mark: '+', color: '#b4b8c0' },
];
const number = (value: number | null | undefined, suffix = '') => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${value.toLocaleString('ko-KR')}${suffix}` : '—';

export function AdminTrafficPanel({ reports }: { reports?: AdminTrafficReport[] }) {
    const [period, setPeriod] = useState<AdminTrafficPeriod>('30days');
    const report = reports?.find(entry => entry.period === period);
    const rows = channels.map(channel => ({ ...channel, value: report?.channels.find(entry => entry.key === channel.key) }));
    const maximum = Math.max(1, ...rows.map(row => row.value?.visitors || 0));
    return <section className={styles.panel} aria-label="유입 경로 통계">
        <div className={styles.heading}><h2>유입 경로</h2><span className={styles.info} title="방문자와 페이지뷰는 통계 서비스에서 제공하는 자료를 사용합니다.">ⓘ</span>
            {!report && <span className={styles.connection}>통계 연동 준비</span>}
            <div className={styles.periods} aria-label="유입 통계 기간">{([
                ['today', '오늘'], ['7days', '7일'], ['30days', '30일'],
            ] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>)}</div>
        </div>
        <div className={styles.metrics}>{[
            ['홈페이지 방문자', report?.visitors, '명'], ['페이지뷰', report?.pageViews, '회'],
            ['견적 문의', report?.inquiries, '건'], ['문의 전환율', report?.conversionRate, '%'],
        ].map(([label, value, unit]) => <div key={String(label)}><span>{label}</span><strong>{number(value as number | undefined)}<small>{unit}</small></strong></div>)}</div>
        <div className={styles.segments} aria-hidden="true">{report && rows.map((row, index) => <span key={row.key} style={{ flex: row.value?.visitors || 0, background: `var(--traffic-${index})` }} />)}</div>
        <div className={styles.table}>
            <div className={styles.tableHead}><span>채널</span><span>비중</span><span>방문자</span><span>문의</span><span>전환율</span></div>
            {rows.map((row, index) => <div key={row.key} className={styles.row}>
                <span className={styles.name}><span className={styles.logo} style={{ background: row.color, color: row.key === 'kakao' ? '#191919' : '#fff' }} aria-hidden="true">{row.mark}</span><span>{row.name}</span></span>
                <span className={styles.share}><span className={styles.track}><span style={{ width: `${(row.value?.visitors || 0) / maximum * 100}%`, background: `var(--traffic-${index})` }} /></span><small>{report?.visitors && row.value?.visitors != null ? `${Math.round(row.value.visitors / report.visitors * 100)}%` : report?.visitors === 0 && row.value?.visitors === 0 ? '0%' : '—'}</small></span>
                <span>{number(row.value?.visitors)}</span><span>{number(row.value?.inquiries)}</span><strong>{number(row.value?.conversionRate, '%')}</strong>
            </div>)}
        </div>
        {!report && <p className={styles.notice}>통계 서비스를 연결하면 선택한 기간의 방문자·페이지뷰·채널별 문의가 표시됩니다.</p>}
    </section>;
}
