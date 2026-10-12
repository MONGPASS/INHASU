import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { BRAND } from '../constants/company';
import { Icon } from '../components/admin/console/Icon';
import '../styles/admin-console.css';

const ADMIN_BRAND = `${BRAND.name} 관리자`;
const MIN_PASSWORD_LENGTH = 10;

const noticeStyle = (tone: 'red' | 'green'): React.CSSProperties => ({
    marginBottom: 18, padding: '12px 14px', borderRadius: 'var(--r-md)',
    background: `var(--mrt-${tone}-soft)`, color: `var(--mrt-${tone})`,
    fontSize: 13, fontWeight: 600, lineHeight: 1.5,
});

const textButtonStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 600,
};

export const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // 처음 설정: 관리자 계정이 아직 하나도 없을 때만 보여 준다.
    const [needsSetup, setNeedsSetup] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [notice, setNotice] = useState('');
    const [legacyPassword, setLegacyPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

    useEffect(() => {
        let cancelled = false;
        api.auth.adminSetupStatus().then((status) => {
            if (cancelled || !status.needsSetup) return;
            setNeedsSetup(true);
            setShowSetup(true);
        });
        return () => { cancelled = true; };
    }, []);

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setNotice('');
        setLoading(true);
        try {
            const response = await api.auth.login(email, password);
            if (response.success) {
                window.location.href = '/admin';
            } else {
                setError(response.error || '로그인에 실패했습니다.');
            }
        } catch (err) {
            setError('로그인 요청을 처리하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    const handleSetup = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setNotice('');

        const trimmedEmail = newEmail.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setError('새 관리자 이메일을 정확히 입력해 주세요.');
            return;
        }
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setError(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상으로 정해 주세요.`);
            return;
        }
        if (newPassword !== newPasswordConfirm) {
            setError('새 비밀번호와 확인 입력이 서로 다릅니다.');
            return;
        }
        // 기존 비밀번호는 요청 헤더로 보낸다(견적 화면과 같은 방식). 헤더에 실을 수 없는 글자가 있으면 맞는 비밀번호일 수 없다.
        if (!legacyPassword || /[^\x20-\x7e\x80-\xff]/.test(legacyPassword)) {
            setError('기존 견적 관리자 비밀번호가 올바르지 않습니다.');
            return;
        }

        setLoading(true);
        try {
            const result = await api.auth.adminSetup(legacyPassword, trimmedEmail, newPassword);
            // 완료 — 방금 만든 계정으로 바로 로그인할 수 있게 일반 로그인 폼으로 돌아간다.
            setEmail(result.email || trimmedEmail.toLowerCase());
            setPassword('');
            setLegacyPassword('');
            setNewPassword('');
            setNewPasswordConfirm('');
            setNeedsSetup(false);
            setShowSetup(false);
            setNotice('관리자 계정을 만들었습니다. 방금 정한 이메일과 비밀번호로 로그인해 주세요.');
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            // 서버가 보낸 안내(한국어)는 그대로 보여 주고, 그 밖의 오류는 일반 문구로 바꾼다.
            setError(/[가-힣]/.test(message) ? message : '처음 설정을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
            if (message.includes('이미 관리자 계정이 있습니다')) {
                setNeedsSetup(false);
                setShowSetup(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const switchForm = (toSetup: boolean) => {
        setError('');
        setNotice('');
        setShowSetup(toSetup);
    };

    return (
        <div className="login-wrap">
            <div className="login-brand">
                <div className="login-brand-in">
                    <div className="row" style={{ gap: 12 }}>
                        <span className="brand-mark" style={{ width: 46, height: 46 }}><Icon name="flight_takeoff" /></span>
                        <div>
                            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>{ADMIN_BRAND}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>예약 · 맞춤 견적 · 상품 · 콘텐츠</div>
                        </div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <h1 className="login-h">예약부터 가이드 배정까지,<br />몽골 여행 운영을 한 곳에서.</h1>
                    <p className="login-p">여행 상품 예약과 맞춤 견적 문의·견적서·예약 배정을 하나의 관리자에서 한 번의 로그인으로 관리합니다.</p>
                    <div className="login-stats">
                        <div><b>예약</b><span>견적부터 확정까지</span></div>
                        <div><b>상품</b><span>카탈로그 운영</span></div>
                        <div><b>콘텐츠</b><span>매거진·후기·FAQ</span></div>
                    </div>
                </div>
            </div>

            <div className="login-form-side">
                {showSetup ? (
                    <form className="login-card" onSubmit={handleSetup}>
                        <div className="eyebrow"><span className="dot" />처음 설정</div>
                        <h2 style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-strong)', margin: '6px 0 6px' }}>관리자 계정을 만듭니다</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 22px', lineHeight: 1.6 }}>
                            {ADMIN_BRAND}에 아직 계정이 없습니다. 기존 견적 관리자 비밀번호로 확인한 뒤,
                            앞으로 로그인에 쓸 이메일과 비밀번호를 정해 주세요.
                        </p>

                        {error && <div style={noticeStyle('red')} role="alert">{error}</div>}

                        <div className="field">
                            <label htmlFor="setup-legacy">기존 견적 관리자 비밀번호</label>
                            <input id="setup-legacy" className="inp" type="password" value={legacyPassword}
                                onChange={(e) => setLegacyPassword(e.target.value)} placeholder="견적 관리 화면에 쓰던 비밀번호"
                                autoComplete="off" required />
                        </div>
                        <div className="field">
                            <label htmlFor="setup-email">새 관리자 이메일</label>
                            <input id="setup-email" className="inp" type="text" inputMode="email" value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)} placeholder={`admin@${BRAND.domain}`}
                                autoComplete="username" autoCapitalize="none" spellCheck={false} required />
                        </div>
                        <div className="field">
                            <label htmlFor="setup-password">새 비밀번호</label>
                            <input id="setup-password" className="inp" type="password" value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)} placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
                                autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
                        </div>
                        <div className="field">
                            <label htmlFor="setup-password-confirm">새 비밀번호 확인</label>
                            <input id="setup-password-confirm" className="inp" type="password" value={newPasswordConfirm}
                                onChange={(e) => setNewPasswordConfirm(e.target.value)} placeholder="한 번 더 입력"
                                autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
                        </div>

                        <button className="btn btn-ink btn-lg" style={{ width: '100%' }} type="submit" disabled={loading}>
                            {loading
                                ? <><Icon name="progress_activity" className="spin" />계정 만드는 중</>
                                : <><Icon name="person_add" />관리자 계정 만들기</>}
                        </button>

                        <p style={{ textAlign: 'center', marginTop: 18 }}>
                            <button type="button" onClick={() => switchForm(false)} style={textButtonStyle}>
                                이미 관리자 계정이 있으면 로그인
                            </button>
                        </p>
                    </form>
                ) : (
                    <form className="login-card" onSubmit={handleLogin}>
                        <div className="eyebrow"><span className="dot" />관리자 로그인</div>
                        <h2 style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-strong)', margin: '6px 0 6px' }}>운영을 시작합니다</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 26px' }}>{ADMIN_BRAND} 계정으로 로그인해 주세요.</p>

                        {notice && <div style={noticeStyle('green')} role="status">{notice}</div>}
                        {error && <div style={noticeStyle('red')} role="alert">{error}</div>}

                        <div className="field">
                            <label htmlFor="login-email">이메일</label>
                            <input id="login-email" className="inp" type="text" inputMode="email" value={email}
                                onChange={(e) => setEmail(e.target.value)} placeholder={`admin@${BRAND.domain}`}
                                autoComplete="email" required />
                        </div>
                        <div className="field">
                            <label htmlFor="login-password">비밀번호</label>
                            <input id="login-password" className="inp" type="password" value={password}
                                onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 입력"
                                autoComplete="current-password" required />
                        </div>

                        <button className="btn btn-ink btn-lg" style={{ width: '100%' }} type="submit" disabled={loading}>
                            {loading
                                ? <><Icon name="progress_activity" className="spin" />로그인 중</>
                                : <><Icon name="login" />로그인</>}
                        </button>

                        <p style={{ textAlign: 'center', marginTop: 18 }}>
                            {needsSetup && (
                                <button type="button" onClick={() => switchForm(true)} style={{ ...textButtonStyle, display: 'block', margin: '0 auto 8px' }}>
                                    처음 설정으로 돌아가기
                                </button>
                            )}
                            <button type="button" onClick={() => { window.location.href = '/'; }} style={textButtonStyle}>
                                사용자 사이트로 돌아가기
                            </button>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
};
