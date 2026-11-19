import { useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SEO } from '../components/seo/SEO';
import { useUser } from '../contexts/UserContext';
import { MW } from '../components/desktop-primitives/mwTokens';
import { parseCustomerReference, safeCustomerReturnPath, type CustomerSource } from '../../public/customer-access.js';

type Channel = { kind: 'email' | 'sms'; masked: string };
type Status = { state: 'linked' | 'verification_required' | 'unavailable'; channels: Channel[]; codeLength?: number; staffReviewAvailable?: boolean };
type Challenge = { challengeId: string; masked: string; expiresAt: string; retryAfter: number; codeLength: number };
const button: CSSProperties = { width: '100%', minHeight: 50, padding: '12px 16px', border: 0, borderRadius: 14, background: MW.mintDeep, color: '#fff', font: 'inherit', fontWeight: 800, cursor: 'pointer' };
const input: CSSProperties = { width: '100%', minHeight: 50, boxSizing: 'border-box', padding: '12px 14px', border: `1px solid ${MW.line2}`, borderRadius: 12, background: '#fff', color: MW.navy, font: 'inherit', fontSize: 16 };

/** The original link identifies the record for contact verification or a staff-reviewed claim. */
export function CustomerLink() {
    const [params, setParams] = useSearchParams();
    const { user } = useUser();
    const fromReservations = params.get('from') === 'reservations' || params.get('source') === 'reservation';
    const sourceValue = params.get('source');
    const source = ['request', 'quote', 'reservation'].includes(sourceValue || '') ? sourceValue as CustomerSource : null;
    const key = params.get('key') || '';
    const hasReference = !!source && !!key && key.length <= 256;
    const fallback = source === 'quote' ? `/estimate/${encodeURIComponent(key)}` : source === 'reservation' ? `/mypage/reservations/${encodeURIComponent(key)}` : `/내견적.html?t=${encodeURIComponent(key)}`;
    const returnTo = safeCustomerReturnPath(params.get('returnTo'), hasReference ? fallback : '/mypage/estimates');
    const [link, setLink] = useState('');
    const [status, setStatus] = useState<Status | null>(null);
    const [channel, setChannel] = useState<'email' | 'sms'>('email');
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [retryAt, setRetryAt] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [review, setReview] = useState<{ reference: string; expiresAt: string } | null>(null);
    const [refresh, setRefresh] = useState(0);
    const queryClient = useQueryClient();
    const call = async (path: string, body?: unknown) => {
        const response = await fetch('/api/customer-access' + path, { credentials: 'same-origin', cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
        const result = await response.json().catch(() => ({}));
        if (response.status === 401) {
            window.location.replace('/login?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search));
            return new Promise<never>(() => {});
        }
        if (!response.ok) {
            if (response.status === 403 && result.code === 'access_denied') throw new Error('이 계정으로 확인할 수 없는 이력입니다. 처음 연결한 Google 계정으로 로그인해 주세요.');
            if (response.status === 404) throw new Error('견적·예약을 찾을 수 없습니다. 담당자에게 받은 최신 링크를 확인해 주세요.');
            if (response.status === 429) throw new Error('인증 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
            if (response.status === 503) throw new Error('지금은 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.');
            if (path === '/verify') throw new Error('인증번호가 올바르지 않거나 시간이 지났습니다. 번호를 확인하거나 다시 받아 주세요.');
            throw new Error('이력을 연결할 수 없습니다. 처음 연결한 Google 계정을 확인하거나 담당자에게 문의해 주세요.');
        }
        return result;
    };
    useEffect(() => {
        if (!hasReference || !source) return;
        let active = true;
        setStatus(null); setChallenge(null); setCode(''); setError('');
        call('/status?' + new URLSearchParams({ source, key })).then((result: Status) => {
            if (!active) return;
            if (result.state === 'linked') { window.location.replace(returnTo); return; }
            setStatus(result); setChannel(result.channels?.[0]?.kind || 'email');
        }).catch((failure) => { if (active) setError(failure instanceof TypeError ? '이력을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.' : failure.message); });
        return () => { active = false; };
    }, [source, key, hasReference, returnTo, refresh]);
    useEffect(() => { setReview(null); setRetryAt(0); }, [source, key]);
    useEffect(() => {
        if (!review) return;
        const recheck = () => setRefresh(value => value + 1);
        window.addEventListener('focus', recheck);
        return () => window.removeEventListener('focus', recheck);
    }, [review]);
    useEffect(() => {
        if (!retryAt) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [retryAt]);
    const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
    const send = async () => {
        if (busy || remaining || !source) return;
        setBusy(true); setError('');
        try {
            const result: Challenge = await call('/challenge', { source, key, channel });
            setChallenge(result); setCode(''); setNow(Date.now()); setRetryAt(Date.now() + (result.retryAfter || 60) * 1000);
        } catch (failure) { setError((failure as Error).message); }
        finally { setBusy(false); }
    };
    const verify = async () => {
        if (busy || !challenge || code.length !== (challenge.codeLength || 8)) return;
        setBusy(true); setError('');
        try {
            await call('/verify', { challengeId: challenge.challengeId, code });
            await queryClient.invalidateQueries({ queryKey: ['myPage'] });
            window.location.replace(returnTo);
        } catch (failure) { setError((failure as Error).message); setBusy(false); }
    };
    const readLink = () => {
        const reference = parseCustomerReference(link, window.location.origin);
        if (!reference) { setError('카카오톡이나 이메일로 받은 이 사이트의 견적·예약 링크를 붙여 넣어 주세요.'); return; }
        setParams({ source: reference.source, key: reference.key, returnTo: reference.returnTo, ...(fromReservations ? { from: 'reservations' } : {}) }, { replace: true });
    };
    const requestReview = async () => {
        if (busy || !source) return;
        setBusy(true); setError('');
        try {
            const result = await call('/staff-request', { source, key });
            if (result.state === 'linked') { window.location.replace(returnTo); return; }
            setReview({ reference: result.reference, expiresAt: result.expiresAt });
        } catch (failure) { setError((failure as Error).message); }
        finally { setBusy(false); }
    };
    return <>
        <SEO title="기존 견적·예약 연결" description="본인 확인 후 기존 여행 이력을 Google 계정에 연결합니다." robots="noindex, nofollow" />
        <main style={{ minHeight: '100vh', boxSizing: 'border-box', background: '#F7FAF9', padding: '32px 20px', color: MW.navy, fontFamily: 'Pretendard, sans-serif', display: 'grid', placeItems: 'center' }}>
            <section style={{ width: '100%', maxWidth: 460, boxSizing: 'border-box', background: '#fff', border: `1px solid ${MW.line}`, borderRadius: 24, padding: '30px 24px', display: 'grid', gap: 20 }}>
                <a href={fromReservations ? '/mypage/reservations' : '/mypage/estimates'} style={{ color: MW.mintDeep, fontSize: 13, textDecoration: 'none', fontWeight: 700 }}>← {fromReservations ? '내 예약 내역' : '내 견적 내역'}</a>
                <header><p style={{ margin: '0 0 8px', color: MW.mintDeep, fontSize: 12, fontWeight: 800 }}>기존 고객 이력 연결</p><h1 style={{ margin: 0, fontSize: 25, lineHeight: 1.4 }}>받은 견적·예약을<br />내 계정에 연결하세요</h1><p style={{ fontSize: 14, lineHeight: 1.8, color: MW.mute, marginBottom: 0 }}>처음 한 번 본인 확인을 마치면, 다음부터는 같은 Google 계정의 마이페이지에서 확인할 수 있습니다.</p></header>
                {user?.email && <p style={{ margin: 0, fontSize: 13, overflowWrap: 'anywhere' }}>로그인한 Google 계정 <strong>{user.email}</strong></p>}
                {!hasReference ? <form onSubmit={event => { event.preventDefault(); readLink(); }} style={{ display: 'grid', gap: 12 }}><label htmlFor="old-customer-link" style={{ fontSize: 13, fontWeight: 700 }}>기존에 받은 견적·예약 링크</label><input id="old-customer-link" type="url" value={link} onChange={event => setLink(event.target.value)} placeholder="https://…/내견적.html?t=…" style={input} required /><button style={button}>이력 확인하기</button><p style={{ color: MW.mute, fontSize: 12, lineHeight: 1.7, margin: 0 }}>카카오톡이나 이메일로 받은 링크를 붙여 넣어 주세요. 링크를 찾기 어려우면 담당자에게 문의해 주세요.</p></form>
                    : !status && !error ? <p role="status">연결할 이력을 확인하고 있습니다.</p>
                    : status?.state === 'verification_required' && status.channels?.length ? <div style={{ display: 'grid', gap: 14 }}>
                        <fieldset disabled={busy || !!challenge} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: 8 }}><legend style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>기존에 등록한 연락처로 본인 확인</legend>{status.channels.map(item => <label key={item.kind} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: MW.mintBg, borderRadius: 12, fontSize: 14 }}><input type="radio" name="verification-channel" checked={channel === item.kind} onChange={() => setChannel(item.kind)} />{item.kind === 'email' ? '이메일' : '휴대폰'} {item.masked}</label>)}</fieldset>
                        <button type="button" onClick={send} disabled={busy || remaining > 0} style={{ ...button, opacity: busy || remaining ? .55 : 1 }}>{remaining ? `${remaining}초 후 다시 받기` : challenge ? '인증번호 다시 받기' : '인증번호 받기'}</button>
                        {challenge && <form onSubmit={event => { event.preventDefault(); void verify(); }} style={{ display: 'grid', gap: 10 }}><p role="status" style={{ fontSize: 13, color: MW.mute, lineHeight: 1.7, margin: 0 }}>{challenge.masked}로 인증번호를 보냈습니다. 10분 안에 {challenge.codeLength || 8}자리를 입력해 주세요.</p><label htmlFor="customer-verification-code" style={{ fontSize: 13, fontWeight: 700 }}>인증번호</label><input id="customer-verification-code" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, challenge.codeLength || 8))} maxLength={challenge.codeLength || 8} style={input} required /><button disabled={busy || code.length !== (challenge.codeLength || 8)} style={{ ...button, background: MW.navy, opacity: busy || code.length !== (challenge.codeLength || 8) ? .55 : 1 }}>본인 확인하고 이력 연결</button>{status.channels.length > 1 && <button type="button" disabled={busy} onClick={() => { setChallenge(null); setCode(''); setError(''); }} style={{ border: 0, background: 'transparent', padding: 10, color: MW.mintDeep, font: 'inherit', fontSize: 13, cursor: 'pointer' }}>다른 인증 방법 선택</button>}</form>}
                    </div> : status ? <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8 }}>현재 이 기록에 등록된 연락처로 인증번호를 보낼 수 없습니다.</p> : null}
                {status?.staffReviewAvailable && <div style={{ display: 'grid', gap: 10, padding: 16, borderRadius: 14, background: MW.mintBg }}>
                    {review ? <>
                        <strong>연결 요청번호 <span style={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{review.reference}</span></strong>
                        <p role="status" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>예약을 진행한 담당자에게 이 번호를 알려 주세요. 담당자가 예약자 본인을 확인하고 승인하면 이 계정의 마이페이지에 표시됩니다.</p>
                        <small>요청번호 유효 기한 {new Date(review.expiresAt).toLocaleString('ko-KR')}</small>
                        <button type="button" style={button} onClick={() => setRefresh(value => value + 1)}>연결 상태 확인</button>
                        {Date.parse(review.expiresAt) <= Date.now() && <button type="button" style={button} disabled={busy} onClick={requestReview}>새 요청번호 받기</button>}
                    </> : <>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>연락처 인증이 어려우면 예약 담당자에게 본인 확인을 요청할 수 있습니다.</p>
                        <button type="button" style={button} disabled={busy} onClick={requestReview}>담당자 확인 요청</button>
                    </>}
                </div>}
                {error && <p role="alert" style={{ margin: 0, padding: 14, background: '#FFF2F0', color: '#A83228', borderRadius: 12, fontSize: 13, lineHeight: 1.7 }}>{error}</p>}
                {hasReference && !status && error && <button type="button" style={button} onClick={() => setRefresh(value => value + 1)}>다시 확인</button>}
                <a href="https://pf.kakao.com/_BSLaxl" target="_blank" rel="noopener noreferrer" style={{ color: MW.mintDeep, fontSize: 13, fontWeight: 700 }}>연락처가 바뀌었거나 연결이 어려운가요? 카카오톡 문의 →</a>
            </section>
        </main>
    </>;
}
