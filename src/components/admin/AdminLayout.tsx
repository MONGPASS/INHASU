import React from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminToolbar } from './AdminToolbar';
import '../../styles/admin-console.css';

interface AdminLayoutProps {
    activePage: string;
    title: string;
    description?: string;
    /** small uppercase label above the title; defaults from the page section */
    eyebrow?: string;
    /** 검색은 선택적으로 표시하며 업무 알림은 항상 제공한다. */
    showSearch?: boolean;
    /** kept for backward-compat with existing call sites; redesign is light-only */
    isDarkMode?: boolean;
    toggleTheme?: () => void;
    actions?: React.ReactNode;
    /**
     * 본문 여백·최대 폭 없이 children 이 상단 바 아래 영역(뷰포트 − 상단 바)을 꽉 채운다.
     * 끼워 넣은 화면(맞춤 견적 데스크의 iframe)용 — children 의 최상위 요소에 `flex: 1` 을 주면 된다.
     */
    flush?: boolean;
    children: React.ReactNode;
}

const EYEBROW: Record<string, string> = {
    dashboard: '관리자 콘솔',
    reservations: '운영', calendar: '운영', guides: '운영',
    products: '카탈로그',
    magazines: '콘텐츠', templates: '콘텐츠', reviews: '콘텐츠', faq: '콘텐츠',
    banners: '사이트 설정', categories: '사이트 설정', hotels: '사이트 설정',
    'tourist-spots': '사이트 설정', 'design-spots': '사이트 설정', accommodations: '사이트 설정', 'guide-intro': '사이트 설정',
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
    activePage, title, description, eyebrow, showSearch = true, actions, flush = false, children,
}) => {
    const eb = eyebrow || EYEBROW[activePage] || '관리자 콘솔';
    return (
        <div className="app">
            <AdminSidebar activePage={activePage} />
            <div className="main" style={flush ? { height: '100vh' } : undefined}>
                <header className="header">
                    <div className="header-in">
                        <div style={{ minWidth: 0 }}>
                            <div className="eyebrow"><span className="dot" />{eb}</div>
                            <div className="page-title">{title}</div>
                            {description && (
                                <div className="cell-muted" style={{ fontSize: 12.5, marginTop: 2 }}>{description}</div>
                            )}
                        </div>
                        <div className="header-spacer" />
                        <div className="header-tools">
                            <AdminToolbar showSearch={showSearch} />
                            {actions}
                        </div>
                    </div>
                </header>

                {flush ? (
                    <div className="content" style={{ padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        {children}
                    </div>
                ) : (
                    <div className="content"><div className="content-in">{children}</div></div>
                )}
            </div>
        </div>
    );
};
