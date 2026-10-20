import React, { useRef, useEffect, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { useAdminContentGuard } from '../hooks/useAdminContentGuard';
import { createAdminContentTask, withUploadedImage, moveAdminRow } from '../utils/adminContentWorkflow';

interface Banner {
    id: string;
    image: string;
    pcImage?: string;   // PC-only wide-aspect image. Falls back to `image` when empty.
    tag: string;
    title: string;
    subtitle: string;
    link?: string;
    // PC-only text overrides. When blank, PC reuses the mobile equivalents
    // above. Lets the admin write a shorter headline for PC's 60px font.
    pcTitle?: string;
    pcSubtitle?: string;
    pcTag?: string;
}

interface QuickLink {
    id: string;
    icon: string; // Material Symbol name
    image?: string; // Custom uploaded image (Base64)
    label: string;
    path: string;
}

interface EventBanner {
    id: string;
    image?: string; // Optional custom background image
    backgroundColor: string; // Default background color if no image
    tag: string;
    title: string;
    icon: string; // Material symbol
    link: string;
    location?: 'home' | 'products' | 'all'; // New field
}

interface CategoryTab {
    id: string; // 'central', 'gobi', 'khuvsgul', etc.
    name: string; // The category key (e.g. '중앙몽골') used for filtering
    title: string;
    subtitle: string;
    bannerImage: string;
}

// Predefined Links for easy selection
const PREDEFINED_LINKS = [
    { label: '직접 입력', value: '' },
    { label: '홈 화면', value: '/' },
    { label: '여행상품 목록', value: '/products' },
    { label: '맞춤견적', value: '/custom-estimate' },
    { label: '동행찾기', value: '/travel-mates' },
    { label: '마이페이지', value: '/profile' },

    { label: '여행가이드', value: '/travel-guide' },
];

const DEFAULT_BANNERS: Banner[] = [
    {
        id: 'banner-1',
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCa-lOI8hWg7jkEPE6aLpgULy46wN1zu_SdVj-gwNCoVza2ioMGm0cfT7njLma7CYQJ7YOCcomwafa5fKhJc9eO0hKtIafFHLoS9Vw_f3fyxGnxJkpkfUIBcpBSK8kb0onNzfKU-ImdlsG7T9ipvcqEVeiv0IkkaRjkNX43p7iWB42lYEVlHp-virwWcrmYH0R2SNXPmyNr-nNF55R-vs8rATJH09lIQgi22C3kyFBnx7gHhz_pjfvaFOI5i-SonHUBrrbuY_hnNQ",
        tag: "Premium Trip",
        title: "지평선 끝에서 만나는\n태초의 대자연, 몽골",
        subtitle: "지금 가장 인기 있는 테를지 힐링 코스",
        link: "/products/1"
    },
    {
        id: 'banner-2',
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB4K20GMVq8yGSfTci46S9biO_u2LDuxENlWBxUuJ0nn-vXp0HxEwZMChpGwntz2L5VISAaVTO0C3Jwe-ONgJLNcItHgdmG8Zb9pp-1uACHde5HETQBqmxnKmhs57ApVVkSCA6Kd-ta5q_h0ExQ84FYSY6vbGnDKD5yCJn-muLZnWDQCVEXnPd4YHvkNxzeRZmK1PN9XDNxQ1qdNDHGzJNqUkknzlI6FflIQG7Tnf1tHDg5TqEB8Gp1IlcZiBunTStiUDAFZDa0zQ",
        tag: "Gobi Adventure",
        title: "밤하늘을 수놓은\n쏟아지는 별빛 탐험",
        subtitle: "고비 사막 은하수 투어 얼리버드",
        link: "/products/2"
    }
];

const DEFAULT_LINKS: QuickLink[] = [
    { id: 'link-1', icon: 'grid_view', label: '여행상품', path: '/products' },
    { id: 'link-2', icon: 'receipt_long', label: '맞춤견적', path: '/custom-estimate' },
    { id: 'link-3', icon: 'groups', label: '동행찾기', path: '/travel-mates' },

    { id: 'link-5', icon: 'auto_stories', label: '여행가이드', path: '/travel-guide' },
];

const DEFAULT_EVENT_BANNERS: EventBanner[] = [
    {
        id: 'event-1',
        backgroundColor: '#0F766E', // teal-700
        tag: 'EVENT',
        title: '친구와 함께하면\n10만원 할인!',
        icon: 'redeem',
        link: '#',
        location: 'all'
    }
];

const DEFAULT_CATEGORY_TABS: CategoryTab[] = [
    {
        id: 'central',
        name: '중앙몽골',
        title: '중앙몽골의 대초원',
        subtitle: '테를지 국립공원부터 \n카라코룸 옛 수도까지',
        bannerImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCViCzrsaryy2z22sZJjJC2yPok7E9fmP1eXTz5wxd0B9jW3b8ccHatM2GhE_PpfKvS4v62VtA9hKyqw0dGAuFEsBQax20AoO8MdCUXLg00zA8ODyeJZh-S9i4BUVoD3jx3bueEDMJeAJknjXRv9dg0xSf2FnfAZjPTTIHQoJm77_1r5C4ZlTxJWlzEkoI1s2BhdWPaYC11Q17j9_gAO2hS0gUFXxzfVl469Mp7kJGlkuZc39udLK16lJgqurk2l1VXHODjPbZ5gA'
    },
    {
        id: 'gobi',
        name: '고비사막',
        title: '쏟아지는 은하수',
        subtitle: '끝없이 펼쳐진 모래사막과 \n밤하늘의 별을 만나다',
        bannerImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4K20GMVq8yGSfTci46S9biO_u2LDuxENlWBxUuJ0nn-vXp0HxEwZMChpGwntz2L5VISAaVTO0C3Jwe-ONgJLNcItHgdmG8Zb9pp-1uACHde5HETQBqmxnKmhs57ApVVkSCA6Kd-ta5q_h0ExQ84FYSY6vbGnDKD5yCJn-muLZnWDQCVEXnPd4YHvkNxzeRZmK1PN9XDNxQ1qdNDHGzJNqUkknzlI6FflIQG7Tnf1tHDg5TqEB8Gp1IlcZiBunTStiUDAFZDa0zQ'
    },
    {
        id: 'khuvsgul',
        name: '홉스굴',
        title: '몽골의 푸른 진주',
        subtitle: '지상 낙원 홉스굴 호수에서 \n즐기는 진정한 힐링',
        bannerImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2c-W88eNfAuepIIez8D142m0RaAu5IIVeT9H7JHKMdO_hBpKiaj9qahcrzlVZlKjJqxXoq0VzO-Aw0A7EN_sDU5pp1smnpRkWy6O3lt4E4KuNi4L3q95jN8U_VmB_8uMcgoSNcE8b0HtZVflsg_87AOF659W686DmWlQPYRdZW0HyVcje7MtAmXT-KDvgPboK9HujomSiuwF7EPAIP4cC_s0405X2ZaWONxKLKPMLHrNtX-m2362SM10q9c7aC5w_afAeRLJU2w'
    },
];

export const AdminBannerManage: React.FC = () => {
    // Buffering state (changes applied here first)
    const [banners, setBanners] = useState<Banner[]>([]);
    const [links, setLinks] = useState<QuickLink[]>([]);
    const [eventBanners, setEventBanners] = useState<EventBanner[]>([]);
    const [categoryTabs, setCategoryTabs] = useState<CategoryTab[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // UI state
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const bannerFileInputRef = useRef<HTMLInputElement>(null);
    const pcBannerFileInputRef = useRef<HTMLInputElement>(null);
    const iconFileInputRef = useRef<HTMLInputElement>(null);
    const eventFileInputRef = useRef<HTMLInputElement>(null);
    const categoryFileInputRef = useRef<HTMLInputElement>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [collapsedBanners, setCollapsedBanners] = useState<Record<string, boolean>>({});
    const [collapsedEvents, setCollapsedEvents] = useState<Record<string, boolean>>({});
    const [pcOpen, setPcOpen] = useState<Record<string, boolean>>({});
    const task = useRef(createAdminContentTask());
    const mounted = useRef(true), dirty = useRef(false);
    const [busy, setBusy] = useState<'upload' | 'save' | null>(null);
    const [notice, setNotice] = useState(''), [loadError, setLoadError] = useState(''), [loadAttempt, setLoadAttempt] = useState(0);
    const dataRef = useRef({ banners, quickLinks: links, eventBanners, categoryTabs });
    const savedData = useRef<typeof dataRef.current | null>(null);
    dataRef.current = { banners, quickLinks: links, eventBanners, categoryTabs };
    useAdminContentGuard(() => ({ busy: task.current.busy(), dirty: dirty.current }), setNotice);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => {
        if (!isLoading && !loadError && !hasUnsavedChanges && !busy) savedData.current = dataRef.current;
    }, [isLoading, loadError, hasUnsavedChanges, busy]);

    // Initial Load from API
    useEffect(() => {
        let current = true;
        setIsLoading(true); setLoadError('');
        const fetchData = async () => {
            try {
                const data = await api.banners.get();
                if (!current) return;
                if (!data || ['banners', 'quickLinks', 'eventBanners', 'categoryTabs'].some(key => !Array.isArray((data as any)[key]))) throw new Error('홈 화면 자료의 형식을 확인해 주세요.');
                if (data.banners) {
                    setBanners(data.banners.map((b: any) => ({
                        id: b.id, image: b.image, pcImage: b.pc_image || b.pcImage || '',
                        tag: b.tag || 'Premium Trip',
                        title: b.title, subtitle: b.subtitle, link: b.link,
                        pcTitle: b.pc_title || b.pcTitle || '',
                        pcSubtitle: b.pc_subtitle || b.pcSubtitle || '',
                        pcTag: b.pc_tag || b.pcTag || '',
                    })));
                }
                if (data.quickLinks) {
                    setLinks(data.quickLinks.map((l: any) => ({
                        id: l.id, icon: l.icon, image: l.image, label: l.label, path: l.path
                    })));
                }
                if (data.eventBanners) {
                    setEventBanners(data.eventBanners.map((e: any) => ({
                        id: e.id, image: e.image, backgroundColor: e.background_color,
                        tag: e.tag, title: e.title, icon: e.icon, link: e.link, location: e.location
                    })));
                }
                if (data.categoryTabs) {
                    setCategoryTabs(data.categoryTabs.map((c: any) => ({
                        id: c.id, name: c.name, title: c.title, subtitle: c.subtitle, bannerImage: c.banner_image
                    })));
                }
            } catch (error) {
                if (current) setLoadError('홈 화면 자료를 불러오지 못했습니다. 다시 불러온 뒤 편집해 주세요.');
            } finally {
                if (current) setIsLoading(false);
            }
        };
        fetchData();
        return () => { current = false; };
    }, [loadAttempt]);

    // Change Detection
    const markUnsaved = () => { dirty.current = true; setHasUnsavedChanges(true); setNotice(''); };

    // CRUD - Banners
    const addBanner = () => {
        const newId = `banner-${Date.now()}`;
        setBanners(previous => [...previous, {
            id: newId, image: "", pcImage: "",
            tag: "", title: "", subtitle: "", link: "",
            pcTitle: "", pcSubtitle: "", pcTag: "",
        }]);
        markUnsaved();
    };

    const deleteBanner = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setBanners(previous => previous.filter(b => b.id !== id));
            markUnsaved();
        }
    };

    const handleBannerChange = (id: string, field: keyof Banner, value: string) => {
        setBanners(previous => previous.map(b => b.id === id ? { ...b, [field]: value } : b));
        markUnsaved();
    };

    // CRUD - Links
    const addLink = () => {
        const newId = `link-${Date.now()}`;
        setLinks(previous => [...previous, { id: newId, icon: 'star', label: '새 메뉴', path: '#' }]);
        markUnsaved();
    };

    const deleteLink = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setLinks(previous => previous.filter(l => l.id !== id));
            markUnsaved();
        }
    };

    const moveLink = (index: number, direction: 'left' | 'right') => {
        const newLinks = [...links];
        if (direction === 'left') {
            if (index === 0) return;
            [newLinks[index - 1], newLinks[index]] = [newLinks[index], newLinks[index - 1]];
        } else {
            if (index === newLinks.length - 1) return;
            [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
        }
        setLinks(newLinks);
        markUnsaved();
    };

    const handleLinkChange = (id: string, field: keyof QuickLink, value: string) => {
        setLinks(previous => previous.map(l => l.id === id ? { ...l, [field]: value } : l));
        markUnsaved();
    };

    // CRUD - Event Banners
    const addEventBanner = () => {
        const newId = `event-${Date.now()}`;
        setEventBanners(previous => [...previous, {
            id: newId, backgroundColor: '#0F766E', tag: 'NEW', title: '새로운 이벤트', icon: 'campaign', link: '#', location: 'all'
        }]);
        markUnsaved();
    };
    const deleteEventBanner = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setEventBanners(previous => previous.filter(e => e.id !== id));
            markUnsaved();
        }
    };
    const moveEventBanner = (index: number, direction: 'left' | 'right') => {
        const newEvents = [...eventBanners];
        if (direction === 'left') { if (index === 0) return;[newEvents[index - 1], newEvents[index]] = [newEvents[index], newEvents[index - 1]]; }
        else { if (index === newEvents.length - 1) return;[newEvents[index], newEvents[index + 1]] = [newEvents[index + 1], newEvents[index]]; }
        setEventBanners(newEvents); markUnsaved();
    };
    const handleEventChange = (id: string, field: keyof EventBanner, value: string) => {
        setEventBanners(previous => previous.map(e => e.id === id ? { ...e, [field]: value } : e));
        markUnsaved();
    };

    // CRUD - Category Tabs
    const handleCategoryChange = (id: string, field: keyof CategoryTab, value: string) => {
        setCategoryTabs(previous => previous.map(c => c.id === id ? { ...c, [field]: value } : c));
        markUnsaved();
    };



    const moveBanner = (index: number, step: number) => {
        if (task.current.busy()) return;
        setBanners(previous => moveAdminRow(previous, index, step)); markUnsaved();
    };
    // Capture the target once and apply only its image to the latest form state.
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'pcBanner' | 'icon' | 'event' | 'category') => {
        const input = e.target, file = input.files?.[0], id = selectedId;
        if (!file || !id || isLoading || loadError) return;
        const release = task.current.begin('upload'); if (!release) return;
        setBusy('upload'); setNotice('');
        try {
            const folder = type === 'icon' ? 'icons' : type === 'event' ? 'events' : type === 'category' ? 'categories' : 'banners';
            const url = await uploadImage(file, folder);
            if (!mounted.current) return;
            if (type === 'banner' || type === 'pcBanner') setBanners(previous => withUploadedImage(previous, id, type === 'banner' ? 'image' : 'pcImage', url));
            if (type === 'icon') setLinks(previous => withUploadedImage(previous, id, 'image', url));
            if (type === 'event') setEventBanners(previous => withUploadedImage(previous, id, 'image', url));
            if (type === 'category') setCategoryTabs(previous => withUploadedImage(previous, id, 'bannerImage', url));
            markUnsaved();
        } catch (error: any) { if (mounted.current) setNotice(error?.message || '이미지를 업로드하지 못했습니다. 입력한 내용은 유지됩니다. 다시 선택해 주세요.'); }
        finally { input.value = ''; release(); if (mounted.current) setBusy(null); }
    };

    const clearPcImage = (id: string) => {
        setBanners(previous => previous.map(b => b.id === id ? { ...b, pcImage: '' } : b));
        markUnsaved();
    };

    const revertChanges = () => {
        if (task.current.busy() || !savedData.current || !dirty.current || !window.confirm('저장하지 않은 변경사항을 버리고 마지막으로 저장된 내용으로 되돌릴까요?')) return;
        const saved = savedData.current;
        setBanners(saved.banners); setLinks(saved.quickLinks); setEventBanners(saved.eventBanners); setCategoryTabs(saved.categoryTabs);
        dirty.current = false; setHasUnsavedChanges(false); setNotice('');
    };

    // Save Action via API
    const saveAll = async () => {
        if (isLoading || loadError || !dirty.current) return;
        const release = task.current.begin('save'); if (!release) return;
        setBusy('save'); setNotice('');
        try {
            await api.banners.save(dataRef.current);
            if (!mounted.current) return;
            dirty.current = false; setHasUnsavedChanges(false); setShowToast(true);
            setTimeout(() => { if (mounted.current) setShowToast(false); }, 3000);
        } catch (error: any) { if (mounted.current) setNotice('저장하지 못했습니다. 입력한 내용은 유지됩니다. ' + (error?.message || '다시 시도해 주세요.')); }
        finally { release(); if (mounted.current) setBusy(null); }
    };

    const bannerTone = (index: number) => ['bp-blue', 'bp-purple', 'bp-red'][index % 3];
    const toggle = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, id: string) => setter(previous => ({ ...previous, [id]: !previous[id] }));
    const bannerField = (banner: Banner, field: keyof Banner, label: string, placeholder = '', multiline = false) => (
        <label className="field hm-field">
            <span>{label}</span>
            {multiline ? <textarea className="inp" value={banner[field] || ''} placeholder={placeholder} onChange={event => handleBannerChange(banner.id, field, event.target.value)} />
                : <input className="inp" type="text" value={banner[field] || ''} placeholder={placeholder} onChange={event => handleBannerChange(banner.id, field, event.target.value)} />}
        </label>
    );
    const areas = [
        { id: 'home-banners', label: '메인 배너', count: banners.length },
        { id: 'home-icons', label: '바로가기 아이콘', count: links.length },
        { id: 'home-events', label: '이벤트 배너', count: eventBanners.length },
        { id: 'home-themes', label: '테마 배너', count: categoryTabs.length },
    ];
    const status = isLoading ? '불러오는 중' : loadError ? '자료 확인 필요' : busy === 'upload' ? '이미지 업로드 중' : busy === 'save' ? '저장 중' : hasUnsavedChanges ? '변경사항 있음' : '저장된 내용';

    return (
        <AdminLayout activePage="banners" title="홈 화면 관리" hidePageHeading actions={
            <button className="btn btn-ink" onClick={saveAll} disabled={!hasUnsavedChanges || !!busy || isLoading || !!loadError}>
                <Icon name="save" />{busy === 'save' ? '저장 중…' : '변경사항 저장'}
                {hasUnsavedChanges && <span className="badge b-amber" style={{ padding: '0 6px', marginLeft: 2 }}>•</span>}
            </button>
        }>
            <div className="admin-home-manager">
                <header className="hm-header">
                    <div className="hm-title"><span>사이트 관리</span><h1>홈 화면 관리</h1></div>
                    <nav aria-label="홈 화면 편집 영역" className="hm-areas">
                        {areas.map(area => <a key={area.id} href={`#${area.id}`}>{area.label}<span>{area.count}</span></a>)}
                    </nav>
                    <div className="hm-status-actions">
                        <span className={`hm-status ${hasUnsavedChanges ? 'hm-status-dirty' : ''}`}><i />{status}</span>
                        {hasUnsavedChanges && <button type="button" className="btn btn-ghost" onClick={revertChanges} disabled={!!busy || isLoading || !!loadError}>되돌리기</button>}
                    </div>
                </header>
                {notice && <p role="alert" className="card card-pad">{notice}</p>}
                {loadError && <div role="alert" className="card card-pad">{loadError}<button type="button" className="btn btn-ghost" onClick={() => setLoadAttempt(value => value + 1)}>다시 불러오기</button></div>}
                {(isLoading || busy) && <p role="status" aria-live="polite">{isLoading ? '홈 화면 자료를 불러오는 중…' : busy === 'upload' ? '이미지 업로드 중… 완료 후 변경사항을 저장해 주세요.' : '홈 화면 저장 중…'}</p>}
                <fieldset disabled={!!busy || isLoading || !!loadError} inert={!!busy || isLoading || !!loadError} className="hm-content">
                    <input type="file" ref={bannerFileInputRef} className="hidden" style={{ display: 'none' }} accept="image/*" onChange={event => handleUpload(event, 'banner')} />
                    <input type="file" ref={pcBannerFileInputRef} className="hidden" style={{ display: 'none' }} accept="image/*" onChange={event => handleUpload(event, 'pcBanner')} />
                    <input type="file" ref={iconFileInputRef} className="hidden" style={{ display: 'none' }} accept="image/*" onChange={event => handleUpload(event, 'icon')} />
                    <input type="file" ref={eventFileInputRef} className="hidden" style={{ display: 'none' }} accept="image/*" onChange={event => handleUpload(event, 'event')} />
                    <input type="file" ref={categoryFileInputRef} className="hidden" style={{ display: 'none' }} accept="image/*" onChange={event => handleUpload(event, 'category')} />

                    <section id="home-banners" className="hm-area">
                        <div className="hm-area-heading"><div><h2>메인 배너 <span>{banners.length}</span></h2><p>홈 상단 슬라이드 배너입니다. 이미지와 문구를 고친 뒤 ‘변경사항 저장’을 누르면 공개됩니다.</p></div><button className="btn btn-ink" onClick={addBanner}><Icon name="add" />배너 추가</button></div>
                        {banners.length > 1 && <div className="hm-collapse-all"><button type="button" onClick={() => { const close = banners.some(banner => !collapsedBanners[banner.id]); setCollapsedBanners(Object.fromEntries(banners.map(banner => [banner.id, close]))); }}>{banners.some(banner => !collapsedBanners[banner.id]) ? '모두 접기' : '모두 펼치기'}</button></div>}
                        {banners.map((banner, index) => (
                            <article className="hm-editor-card" key={banner.id}>
                                <div className="hm-card-heading">
                                    <button type="button" className="hm-card-toggle" aria-expanded={!collapsedBanners[banner.id]} aria-controls={`home-banner-body-${banner.id}`} onClick={() => toggle(setCollapsedBanners, banner.id)}>
                                        <Icon name={collapsedBanners[banner.id] ? 'chevron_right' : 'expand_more'} />
                                        <span className={`hm-thumb ${bannerTone(index)}`} style={banner.image ? { backgroundImage: `url('${banner.image}')` } : undefined} />
                                        <span className="hm-order">#{index + 1}</span><span className="hm-card-name"><strong>{banner.title?.split('\n')[0] || '제목 없음'}</strong><small>{banner.tag || '태그 없음'} · {banner.link || '연결 주소 없음'}</small></span>
                                    </button>
                                    <span className="hm-card-tools"><button type="button" className="act-btn" aria-label="메인 배너 위로" onClick={() => moveBanner(index, -1)} disabled={index === 0}><Icon name="arrow_upward" /></button><button type="button" className="act-btn" aria-label="메인 배너 아래로" onClick={() => moveBanner(index, 1)} disabled={index === banners.length - 1}><Icon name="arrow_downward" /></button><button type="button" className="act-btn danger" title="삭제" aria-label={`${index + 1}번 메인 배너 삭제`} onClick={() => deleteBanner(banner.id)}><Icon name="delete" /></button></span>
                                </div>
                                <div className="hm-card-body" id={`home-banner-body-${banner.id}`} hidden={!!collapsedBanners[banner.id]}>
                                    <div className="hm-previews">
                                        <div className="hm-preview-label"><Icon name="smartphone" />모바일 · 16:10<span>기본 이미지</span></div>
                                        <button type="button" className={`hm-banner-preview ${bannerTone(index)}`} style={banner.image ? { backgroundImage: `url('${banner.image}')` } : undefined} title="모바일 이미지 변경" onClick={() => { setSelectedId(banner.id); bannerFileInputRef.current?.click(); }}>
                                            <span className="hm-preview-overlay"><small>{banner.tag}</small><strong>{banner.title || `배너 #${index + 1}`}</strong><span>{banner.subtitle}</span></span><span className="hm-upload-label"><Icon name="upload" />이미지 변경</span>
                                        </button>
                                        <div className="hm-preview-label"><Icon name="desktop_windows" />PC · 21:9<span>선택</span></div>
                                        <button type="button" className={`hm-pc-preview ${banner.pcImage ? 'hm-has-image' : ''}`} style={banner.pcImage ? { backgroundImage: `url('${banner.pcImage}')` } : undefined} title="PC 와이드 이미지 변경" onClick={() => { setSelectedId(banner.id); pcBannerFileInputRef.current?.click(); }}>
                                            {banner.pcImage ? <span>{banner.pcTitle || banner.title}</span> : <><Icon name="add_photo_alternate" /><span>없으면 모바일 이미지 사용</span></>}
                                        </button>
                                        {banner.pcImage && <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearPcImage(banner.id)}>PC 이미지 제거</button>}
                                    </div>
                                    <div className="hm-editor-fields">
                                        <section className="hm-basic-copy"><h3><Icon name="smartphone" />기본 문구 <span>모바일과 PC에 함께 사용합니다</span></h3><div className="hm-field-grid">{bannerField(banner, 'tag', '태그')}{bannerField(banner, 'link', '링크', '/products/...')}</div>{bannerField(banner, 'title', '제목 · 줄바꿈은 Enter', '', true)}{bannerField(banner, 'subtitle', '부제목')}</section>
                                        <section className="hm-pc-copy"><button type="button" className="hm-pc-toggle" aria-expanded={!!pcOpen[banner.id]} aria-controls={`home-pc-copy-${banner.id}`} onClick={() => toggle(setPcOpen, banner.id)}><Icon name="desktop_windows" /><strong>PC 전용 문구</strong><span className="hm-order">{banner.pcTitle || banner.pcSubtitle || banner.pcTag ? '설정됨' : '선택'}</span><small>비우면 기본 문구를 사용합니다</small><Icon name={pcOpen[banner.id] ? 'expand_less' : 'expand_more'} /></button><div className="hm-pc-fields" id={`home-pc-copy-${banner.id}`} hidden={!pcOpen[banner.id]}>{bannerField(banner, 'pcTag', 'PC 태그', banner.tag || '모바일 값 사용')}{bannerField(banner, 'pcTitle', 'PC 제목', banner.title || '모바일 값 사용', true)}{bannerField(banner, 'pcSubtitle', 'PC 부제목', banner.subtitle || '모바일 값 사용')}</div></section>
                                    </div>
                                </div>
                            </article>
                        ))}
                        {banners.length === 0 && <button type="button" className="hm-empty-add" onClick={addBanner}><Icon name="add_photo_alternate" />등록된 배너가 없습니다. 첫 배너를 추가하세요.</button>}
                    </section>

                    <section id="home-icons" className="hm-area">
                        <div className="hm-area-heading"><div><h2>바로가기 아이콘 <span>{links.length}</span></h2><p>홈 화면 바로가기입니다. 이미지 또는 아이콘과 이름, 연결 주소로 구성합니다.</p></div><button className="btn btn-ink" onClick={addLink}><Icon name="add" />아이콘 추가</button></div>
                        <div className="hm-icon-grid">{links.map((link, index) => <article className="hm-icon-card" key={link.id}>
                            <button type="button" className="hm-icon-preview" title="이미지 변경" aria-label={`${link.label} 아이콘 이미지 변경`} onClick={() => { setSelectedId(link.id); iconFileInputRef.current?.click(); }}>{link.image ? <img src={link.image} alt={link.label} /> : <Icon name={link.icon} />}</button>
                            <label className="field hm-field"><span>라벨</span><input type="text" className="inp" value={link.label} placeholder="라벨" onChange={event => handleLinkChange(link.id, 'label', event.target.value)} /></label><label className="field hm-field"><span>링크</span><input type="text" className="inp" value={link.path} placeholder="링크" onChange={event => handleLinkChange(link.id, 'path', event.target.value)} /></label>
                            <div className="hm-icon-tools"><button type="button" className="act-btn" title="앞으로" onClick={() => moveLink(index, 'left')} disabled={index === 0}><Icon name="chevron_left" /></button><button type="button" className="act-btn" title="뒤로" onClick={() => moveLink(index, 'right')} disabled={index === links.length - 1}><Icon name="chevron_right" /></button><button type="button" className="act-btn danger" title="삭제" onClick={() => deleteLink(link.id)}><Icon name="delete" /></button></div>
                        </article>)}</div>
                        {links.length === 0 && <button type="button" className="hm-empty-add" onClick={addLink}><Icon name="grid_view" />등록된 아이콘이 없습니다. 바로가기를 추가하세요.</button>}
                    </section>

                    <section id="home-events" className="hm-area">
                        <div className="hm-area-heading"><div><h2>이벤트 배너 <span>{eventBanners.length}</span></h2><p>가로로 넘겨 보는 이벤트 배너입니다. 노출 위치를 선택할 수 있습니다.</p></div><button className="btn btn-ink" onClick={addEventBanner}><Icon name="add" />이벤트 추가</button></div>
                        {eventBanners.length > 1 && <div className="hm-collapse-all"><button type="button" onClick={() => { const close = eventBanners.some(banner => !collapsedEvents[banner.id]); setCollapsedEvents(Object.fromEntries(eventBanners.map(banner => [banner.id, close]))); }}>{eventBanners.some(banner => !collapsedEvents[banner.id]) ? '모두 접기' : '모두 펼치기'}</button></div>}
                        {eventBanners.map((banner, index) => <article className="hm-editor-card" key={banner.id}>
                            <div className="hm-card-heading"><button type="button" className="hm-card-toggle" aria-expanded={!collapsedEvents[banner.id]} aria-controls={`home-event-body-${banner.id}`} onClick={() => toggle(setCollapsedEvents, banner.id)}><Icon name={collapsedEvents[banner.id] ? 'chevron_right' : 'expand_more'} /><span className="hm-thumb hm-event-thumb" style={{ backgroundColor: banner.backgroundColor, ...(banner.image ? { backgroundImage: `url('${banner.image}')` } : {}) }}><Icon name={banner.icon} /></span><span className="hm-order">#{index + 1}</span><span className="hm-card-name"><strong>{banner.title?.split('\n')[0] || '제목 없음'}</strong><small>{banner.location === 'home' ? '홈 화면' : banner.location === 'products' ? '여행상품' : '전체 화면'} · {banner.link || '연결 주소 없음'}</small></span></button><span className="hm-card-tools"><button type="button" className="act-btn" title="위로" onClick={() => moveEventBanner(index, 'left')} disabled={index === 0}><Icon name="arrow_upward" /></button><button type="button" className="act-btn" title="아래로" onClick={() => moveEventBanner(index, 'right')} disabled={index === eventBanners.length - 1}><Icon name="arrow_downward" /></button><button type="button" className="act-btn danger" title="삭제" onClick={() => deleteEventBanner(banner.id)}><Icon name="delete" /></button></span></div>
                            <div className="hm-card-body" id={`home-event-body-${banner.id}`} hidden={!!collapsedEvents[banner.id]}>
                                <div className="hm-previews"><button type="button" className="hm-event-preview" title="이미지 변경" style={{ backgroundColor: banner.backgroundColor, ...(banner.image ? { backgroundImage: `url('${banner.image}')` } : {}) }} onClick={() => { setSelectedId(banner.id); eventFileInputRef.current?.click(); }}><span><small>{banner.tag}</small><strong>{banner.title}</strong></span><Icon name={banner.icon} /></button><small className="hm-hint">눌러서 배경 이미지를 변경합니다.</small></div>
                                <div className="hm-editor-fields"><div className="hm-field-grid"><label className="field hm-field"><span>배경색 · 이미지가 없을 때</span><span className="hm-color-input"><input type="color" aria-label="이벤트 배경색 선택" value={banner.backgroundColor} onChange={event => handleEventChange(banner.id, 'backgroundColor', event.target.value)} /><input type="text" className="inp" aria-label="이벤트 배경색 코드" value={banner.backgroundColor} onChange={event => handleEventChange(banner.id, 'backgroundColor', event.target.value)} /></span></label><div className="field hm-field"><span>노출 위치</span><div className="hm-location-options">{[['all', '전체'], ['home', '홈 화면'], ['products', '여행상품']].map(([value, label]) => <button type="button" key={value} aria-pressed={(banner.location || 'all') === value} onClick={() => handleEventChange(banner.id, 'location', value)}>{label}</button>)}</div></div><label className="field hm-field"><span>태그</span><input type="text" className="inp" value={banner.tag} onChange={event => handleEventChange(banner.id, 'tag', event.target.value)} /></label><div className="field hm-field"><span>링크</span><div className="hm-link-input"><select className="inp" aria-label="이벤트 연결 화면" value={PREDEFINED_LINKS.some(link => link.value === banner.link) ? banner.link : ''} onChange={event => { if (event.target.value) handleEventChange(banner.id, 'link', event.target.value); }}>{PREDEFINED_LINKS.map(link => <option key={link.label} value={link.value}>{link.label}</option>)}</select><input type="text" className="inp" aria-label="이벤트 연결 주소" value={banner.link} placeholder="https://..." onChange={event => handleEventChange(banner.id, 'link', event.target.value)} /></div></div></div><label className="field hm-field"><span>제목 · 줄바꿈 가능</span><textarea className="inp" value={banner.title} onChange={event => handleEventChange(banner.id, 'title', event.target.value)} /></label></div>
                            </div>
                        </article>)}
                        {eventBanners.length === 0 && <button type="button" className="hm-empty-add" onClick={addEventBanner}><Icon name="campaign" />이벤트 배너가 없습니다. 이벤트를 추가하세요.</button>}
                    </section>

                    <section id="home-themes" className="hm-area">
                        <div className="hm-area-heading"><div><h2>테마 배너 <span>{categoryTabs.length}</span></h2><p>여행 지역별 테마 배너의 이미지와 문구를 관리합니다.</p></div></div>
                        <div className="hm-theme-grid">{categoryTabs.map(tab => <article className="hm-editor-card hm-theme-card" key={tab.id}>
                            <button type="button" className="hm-theme-preview" title="이미지 변경" style={tab.bannerImage ? { backgroundImage: `url('${tab.bannerImage}')` } : undefined} onClick={() => { setSelectedId(tab.id); categoryFileInputRef.current?.click(); }}><strong>{tab.name}</strong><span><Icon name="upload" />이미지 변경</span></button><div className="hm-theme-fields"><label className="field hm-field"><span>제목</span><input className="inp" type="text" value={tab.title} onChange={event => handleCategoryChange(tab.id, 'title', event.target.value)} /></label><label className="field hm-field"><span>부제목</span><textarea className="inp" value={tab.subtitle} onChange={event => handleCategoryChange(tab.id, 'subtitle', event.target.value)} /></label></div>
                        </article>)}</div>
                        {categoryTabs.length === 0 && <p className="hm-empty">등록된 테마 배너가 없습니다.</p>}
                    </section>
                </fieldset>
            </div>
            {showToast && <div className="page-toast"><Icon name="check_circle" /><span>저장되었습니다!</span></div>}
        </AdminLayout>
    );
};
