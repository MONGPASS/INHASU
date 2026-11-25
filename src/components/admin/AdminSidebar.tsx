import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { disconnectQuoteDesk, quoteDeskPageId } from './quoteDesk';
import { dashboardItem, navGroups, type NavGroup, type NavItem } from './adminNav';
import { useAdminWorkspaceOptional } from './AdminWorkspaceContext';
import {
    badgeText, findMenus, groupOfPage, groupSummary, moveIndex, navBadges, OPEN_KEY, pushRecent, readJson, RECENT_KEY, recentMenus,
    resolveOpenGroups, writeJson, type NavBadge,
} from './adminSidebarModel';
import {
    AdminButton, AdminIconButton, AdminSearch, AdminTextButton, cx, IconApps, IconBook, IconCalendar, IconChevronDown, IconChevronLeft,
    IconChevronRight, IconCircleQuestion, IconClock, IconClose, IconDocument, IconDocumentText, IconFlag, IconFolder, IconHome, IconImage,
    IconLocation, IconLogout, IconMail, IconMegaphone, IconPerson, IconPersons, IconSearch, IconStar, IconTag, IconTicket,
} from './ui';
import { preloadAdminPage } from '../../lib/adminPagePreload';
import './AdminSidebar.css';
// 사용자 사이트 상단과 같은 로고(동그란 민트 마크)
import logoMark from '../../assets/logo_horizontal.webp';

interface AdminSidebarProps {
    activePage: string;
    /** 아이콘만 보이는 좁은 메뉴(접기). */
    rail?: boolean;
    onToggleRail?: () => void;
    /** 휴대폰 서랍으로 열렸을 때 닫기(주면 서랍 모양: 닫기 버튼·큰 줄·사이트 보기/로그아웃). */
    onClose?: () => void;
    /** kept for backward-compat with existing call sites; the redesign is light-only */
    isDarkMode?: boolean;
    toggleTheme?: () => void;
}

type IconComponent = typeof IconApps;
/** 메뉴별 아이콘(당근 Seed 아이콘, ui/AdminIcons) — Claude Design ‘관리자 사이드바 개선’과 같다. */
const MENU_ICONS: Record<string, IconComponent> = {
    dashboard: IconApps, reservations: IconTicket, calendar: IconCalendar,
    [quoteDeskPageId('inbox')]: IconDocumentText, [quoteDeskPageId('courses')]: IconFlag, [quoteDeskPageId('itinerary')]: IconClock, [quoteDeskPageId('spots')]: IconLocation,
    products: IconFolder, categories: IconTag, templates: IconDocument,
    'accommodation-ops': IconHome, [quoteDeskPageId('resources')]: IconPersons,
    inquiries: IconMail, reviews: IconStar, faq: IconCircleQuestion, magazines: IconBook,
    banners: IconImage, promotions: IconMegaphone,
};
/** 접힌 메뉴에서 닫힌 묶음을 대신하는 아이콘. */
const GROUP_ICONS: Record<string, IconComponent> = { 'customer-content': IconMail, 'site-management': IconImage };
const iconOf = (item: NavItem) => MENU_ICONS[item.id] || IconDocument;

const Badge: React.FC<{ badge: NavBadge }> = ({ badge }) => (
    <span className={cx('adm-side-badge', `is-${badge.kind}`)} aria-label={badge.label}>{badgeText(badge.count)}</span>
);

/** 메뉴 이름에서 찾은 글자를 표시한다. */
const Highlight: React.FC<{ text: string; start: number; length: number }> = ({ text, start, length }) => (
    start < 0 || !length ? <>{text}</> : <>{text.slice(0, start)}<mark>{text.slice(start, start + length)}</mark>{text.slice(start + length)}</>
);

/**
 * 관리자 사이드바(Claude Design ‘관리자 사이드바 개선’):
 * 로고 → 메뉴 찾기(Ctrl K) → 대시보드 + 업무 묶음 6개(접고 펼침, 처리할 일 숫자) → 계정·접기·로그아웃.
 * 접힌 메뉴(rail)는 아이콘과 점, 휴대폰 서랍(onClose)은 큰 줄과 사이트 보기·로그아웃.
 */
export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activePage, rail = false, onToggleRail, onClose }) => {
    const navigate = useNavigate();
    let logout: undefined | (() => void | Promise<void>);
    try { logout = useUser().logout; } catch { logout = undefined; }
    const workspace = useAdminWorkspaceOptional();
    const badges = useMemo(() => navBadges(workspace?.data?.tasks), [workspace?.data?.tasks]);
    const drawer = !!onClose;
    const id = useId().replace(/:/g, '');
    const asideRef = useRef<HTMLElement>(null);
    const navRef = useRef<HTMLElement>(null);
    const findButtonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [stored, setStored] = useState<Record<string, boolean>>(() => readJson(OPEN_KEY, {}));
    const open = useMemo(() => resolveOpenGroups(stored, activePage), [stored, activePage]);
    const [recent, setRecent] = useState<string[]>(() => { const list = readJson<unknown>(RECENT_KEY, []); return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : []; });
    const [searching, setSearching] = useState(false);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const results = useMemo(() => findMenus(query), [query]);
    const recentItems = useMemo(() => recentMenus(recent, activePage), [recent, activePage]);

    // 지금 화면을 최근 기록에 넣고, 화면을 옮기면 메뉴 찾기를 닫는다.
    useEffect(() => {
        setRecent((list) => { const next = pushRecent(list, activePage); if (next.join() !== list.join()) writeJson(RECENT_KEY, next); return next; });
        setSearching(false); setQuery('');
    }, [activePage]);

    // 다른 화면으로 이동하면 현재 메뉴가 보이게 스크롤한다.
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activePage, rail]);

    useEffect(() => { setCursor(0); }, [query]);
    useEffect(() => { if (searching && !rail) inputRef.current?.focus(); }, [searching, rail]);

    const openSearch = () => {
        if (rail) onToggleRail?.();
        setSearching(true);
    };
    const closeSearch = (restoreFocus = true) => {
        setSearching(false); setQuery('');
        if (restoreFocus) window.setTimeout(() => findButtonRef.current?.focus(), 0);
    };

    // Ctrl K(맥은 ⌘ K): 보이는 사이드바에서 메뉴 찾기를 연다.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
            if (!asideRef.current || asideRef.current.getClientRects().length === 0) return;
            event.preventDefault();
            if (rail) onToggleRail?.();
            setSearching(true);
            window.setTimeout(() => inputRef.current?.focus(), 0);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [rail, onToggleRail]);

    const toggleGroup = (group: NavGroup) => {
        setStored((current) => { const next = { ...current, [group.id]: !open[group.id] }; writeJson(OPEN_KEY, next); return next; });
    };

    const handleLogout = async () => {
        // 견적 도구가 쓰는 관리자 값(sessionStorage)도 함께 지운다.
        disconnectQuoteDesk();
        try { await logout?.(); } catch { /* ignore */ }
        navigate('/admin/login');
    };

    const preload = (href: string) => ({
        onPointerEnter: () => preloadAdminPage(href), onFocus: () => preloadAdminPage(href), onPointerDown: () => preloadAdminPage(href),
    });

    const brand = (
        <Link to="/admin" className="adm-side-brand" aria-label="몽골리아 은하수 관리자 대시보드" title={rail ? '몽골리아 은하수 관리자' : undefined}>
            <span className="adm-side-mark has-logo" aria-hidden="true"><img src={logoMark} alt="" width={32} height={32} /></span>
            {!rail && <span className="adm-side-brand-text"><b>몽골리아 은하수</b><small>{drawer ? '관리자 · 운영 계정' : '관리자'}</small></span>}
        </Link>
    );

    /* ── 접힌 메뉴: 아이콘 + 처리할 일 점 ── */
    if (rail) {
        const railLink = (key: string, href: string, label: string, Icon: IconComponent, current: boolean, badge: NavBadge | null | undefined) => (
            <Link key={key} to={href} className={cx('adm-side-rail-item', current && 'is-active')} aria-current={current ? 'page' : undefined}
                aria-label={badge ? `${label} · ${badge.label}` : label} title={label} {...preload(href)}>
                <Icon aria-hidden="true" />
                {badge && <span className={cx('adm-side-dot', `is-${badge.kind}`)} aria-hidden="true" />}
            </Link>
        );
        return (
            <aside ref={asideRef} className="side adm-side is-rail" aria-label="관리자 메뉴">
                {brand}
                <button type="button" className="adm-side-rail-find" aria-label="메뉴 찾기 (Ctrl K)" title="메뉴 찾기 (Ctrl K)" onClick={openSearch}><IconSearch aria-hidden="true" /></button>
                <nav className="adm-side-rail-nav" ref={navRef} aria-label="관리자 업무 메뉴">
                    {railLink(dashboardItem.id, dashboardItem.href, dashboardItem.label, IconApps, activePage === dashboardItem.id, null)}
                    {navGroups.map((group) => (
                        <React.Fragment key={group.id}>
                            <span className="adm-side-divider" aria-hidden="true" />
                            {open[group.id] || !GROUP_ICONS[group.id]
                                ? group.items.map((item) => railLink(item.id, item.href, item.label, iconOf(item), activePage === item.id, badges[item.id]))
                                : railLink(group.id, group.items[0].href, group.label, GROUP_ICONS[group.id], groupOfPage(activePage)?.id === group.id, groupSummary(group, badges))}
                        </React.Fragment>
                    ))}
                </nav>
                {onToggleRail && <AdminIconButton label="메뉴 펼치기" className="adm-side-rail-toggle" onClick={onToggleRail}><IconChevronRight /></AdminIconButton>}
                <span className="adm-side-avatar is-rail" aria-hidden="true"><IconPerson /></span>
            </aside>
        );
    }

    const renderItem = (item: NavItem) => {
        const current = activePage === item.id;
        const Icon = iconOf(item);
        const badge = badges[item.id];
        return (
            <Link key={item.id} to={item.href} className={cx('adm-side-item', current && 'is-active')} aria-current={current ? 'page' : undefined} {...preload(item.href)}>
                <span className="adm-side-icon" aria-hidden="true"><Icon /></span>
                <span className="adm-side-label">{item.label}</span>
                {badge && <Badge badge={badge} />}
            </Link>
        );
    };

    /* ── 메뉴 찾기 ── */
    const listId = `adm-side-results-${id}`;
    const optionId = (index: number) => `${listId}-${index}`;
    const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSearch(); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setCursor((current) => moveIndex(current, event.key === 'ArrowDown' ? 1 : -1, results.length));
            return;
        }
        if (event.key === 'Enter' && results[cursor]) {
            event.preventDefault();
            const target = results[cursor].item;
            closeSearch(false);
            navigate(target.href);
        }
    };
    const searchPanel = (
        <div className="adm-side-search">
            <div className="adm-side-search-bar">
                <AdminSearch ref={inputRef} wide value={query} onChange={setQuery} placeholder="메뉴 이름·묶음 이름" aria-label="메뉴 찾기"
                    role="combobox" aria-expanded={results.length > 0} aria-controls={listId} aria-autocomplete="list"
                    aria-activedescendant={results[cursor] ? optionId(cursor) : undefined} onKeyDown={onSearchKey} />
                <AdminTextButton onClick={() => closeSearch()}>닫기</AdminTextButton>
            </div>
            <div className="adm-side-search-body">
                {query.trim() && <>
                    <p className="adm-side-caption" role="status">{results.length ? `메뉴 ${results.length}개` : '맞는 메뉴가 없어요'}</p>
                    <div className="adm-side-results" id={listId} role="listbox" aria-label="찾은 메뉴">
                        {results.map((match, index) => {
                            const Icon = iconOf(match.item);
                            const badge = badges[match.item.id];
                            const sub = match.group ? [match.group.label, badge?.label].filter(Boolean).join(' · ') : '첫 화면';
                            return (
                                <Link key={match.item.id} id={optionId(index)} role="option" aria-selected={index === cursor} to={match.item.href}
                                    className={cx('adm-side-result', index === cursor && 'is-cursor')} onMouseEnter={() => setCursor(index)} onClick={() => closeSearch(false)}>
                                    <span className="adm-side-icon" aria-hidden="true"><Icon /></span>
                                    <span className="adm-side-result-text">
                                        <span className="adm-side-result-label"><Highlight text={match.item.label} start={match.start} length={match.length} /></span>
                                        <span className="adm-side-result-sub">{sub}</span>
                                    </span>
                                    {index === cursor && <span className="adm-side-enter" aria-hidden="true">Enter</span>}
                                </Link>
                            );
                        })}
                    </div>
                </>}
                {recentItems.length > 0 && <>
                    <p className="adm-side-caption">최근 연 화면</p>
                    <div className="adm-side-recent">
                        {recentItems.map((item) => {
                            const Icon = iconOf(item);
                            return (
                                <Link key={item.id} to={item.href} className="adm-side-item" onClick={() => closeSearch(false)} {...preload(item.href)}>
                                    <span className="adm-side-icon" aria-hidden="true"><Icon /></span>
                                    <span className="adm-side-label">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </>}
            </div>
            <p className="adm-side-help">↑ ↓로 고르고 Enter로 이동합니다. 메뉴 이름과 묶음 이름으로 찾습니다.</p>
        </div>
    );

    return (
        <aside ref={asideRef} className={cx('side adm-side', drawer && 'is-drawer')} aria-label="관리자 메뉴">
            <div className="adm-side-head">
                {brand}
                {drawer && <AdminIconButton label="메뉴 닫기" size="lg" className="adm-side-close" onClick={onClose}><IconClose /></AdminIconButton>}
            </div>

            {searching ? searchPanel : <>
                <div className="adm-side-find">
                    <button ref={findButtonRef} type="button" className="adm-side-find-btn" aria-label={drawer ? '메뉴 찾기' : '메뉴 찾기 (Ctrl K)'} onClick={openSearch}>
                        <IconSearch aria-hidden="true" />
                        <span className="adm-side-find-text">메뉴 찾기</span>
                        {!drawer && <kbd className="adm-side-kbd">Ctrl K</kbd>}
                    </button>
                </div>

                <nav className="adm-side-nav" ref={navRef} aria-label="관리자 업무 메뉴">
                    {renderItem(dashboardItem)}
                    {navGroups.map((group) => {
                        const isOpen = open[group.id];
                        const current = groupOfPage(activePage)?.id === group.id;
                        const summary = isOpen ? null : groupSummary(group, badges);
                        const titleId = `adm-side-${id}-${group.id}`;
                        const listIdForGroup = `${titleId}-items`;
                        return (
                            <div className="adm-side-group" key={group.id} role="group" aria-labelledby={titleId}>
                                <button type="button" className={cx('adm-side-group-btn', current && 'is-current')} aria-expanded={isOpen} aria-controls={listIdForGroup} onClick={() => toggleGroup(group)}>
                                    <span className="adm-side-group-label" id={titleId}>{group.label}</span>
                                    {summary && <Badge badge={summary} />}
                                    <IconChevronDown className={cx('adm-side-chevron', !isOpen && 'is-closed')} aria-hidden="true" />
                                </button>
                                {isOpen && <div className="adm-side-items" id={listIdForGroup}>{group.items.map(renderItem)}</div>}
                            </div>
                        );
                    })}
                </nav>
            </>}

            {!searching && (drawer ? (
                <div className="adm-side-foot is-drawer">
                    <a className="adm-side-site" href="/" target="_blank" rel="noopener noreferrer">사이트 보기</a>
                    <AdminButton variant="weak" size="lg" className="adm-side-logout-wide" leading={<IconLogout />} onClick={handleLogout}>로그아웃</AdminButton>
                </div>
            ) : (
                <div className="adm-side-foot">
                    <span className="adm-side-avatar" aria-hidden="true"><IconPerson /></span>
                    <span className="adm-side-who"><b>관리자</b><span>운영 계정 · 마스터</span></span>
                    {onToggleRail && <AdminIconButton size="sm" label="메뉴 접기" onClick={onToggleRail}><IconChevronLeft /></AdminIconButton>}
                    <AdminIconButton size="sm" label="로그아웃" className="adm-side-logout" onClick={handleLogout}><IconLogout /></AdminIconButton>
                </div>
            ))}
        </aside>
    );
};
