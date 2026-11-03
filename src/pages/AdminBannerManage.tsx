import React, { useRef, useEffect, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { DashboardIcon } from '../components/admin/dashboard/DashboardIcon';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { useAdminContentGuard } from '../hooks/useAdminContentGuard';
import { createAdminContentTask, withUploadedImage, moveAdminRow } from '../utils/adminContentWorkflow';
import './AdminBannerManage.css';

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

interface HomeContent { banners: Banner[]; quickLinks: QuickLink[]; eventBanners: EventBanner[]; categoryTabs: CategoryTab[]; }

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

/* Lucide outlines (ISC) that DashboardIcon does not carry. `lc-` keys keep them out of the Material Symbols subset check. */
const HM_PATHS = {
    'lc-smartphone': <><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></>,
    'lc-monitor': <><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></>,
    'lc-arrow-down': <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
    'lc-arrow-left': <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
    'lc-upload': <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></>,
    'lc-megaphone': <><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
    'lc-layout-grid': <><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></>,
} as const;
const HmIcon = ({ name, size = 16 }: { name: keyof typeof HM_PATHS; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: 'none', display: 'block' }}>{HM_PATHS[name]}</svg>
);

const EVENT_COLORS = ['#0F766E', '#12b28c', '#6D28D9', '#E11D48', '#1A1B1E'];
const EVENT_PLACES: { value: NonNullable<EventBanner['location']>; label: string; summary: string }[] = [
    { value: 'all', label: '전체 (홈 + 상품)', summary: '홈 + 여행상품' }, { value: 'home', label: '홈만', summary: '홈 화면만' }, { value: 'products', label: '여행상품만', summary: '여행상품 페이지만' },
];
const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value || '');
const coverStyle = (url?: string): React.CSSProperties => url ? { backgroundImage: `url('${url}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
const nowLabel = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

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
    const task = useRef(createAdminContentTask());
    const mounted = useRef(true), dirty = useRef(false);
    const [busy, setBusy] = useState<'upload' | 'save' | null>(null);
    const [notice, setNotice] = useState(''), [loadError, setLoadError] = useState(''), [loadAttempt, setLoadAttempt] = useState(0);
    const dataRef = useRef<HomeContent>({ banners, quickLinks: links, eventBanners, categoryTabs });
    dataRef.current = { banners, quickLinks: links, eventBanners, categoryTabs };
    // Last loaded/saved content for 되돌리기. Rows are replaced immutably, so references stay intact.
    const savedRef = useRef<HomeContent | null>(null);
    const [savedAt, setSavedAt] = useState('');
    // Screen-only open/closed state; never sent with the save payload.
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [pcOpen, setPcOpen] = useState<Record<string, boolean>>({});
    const barRef = useRef<HTMLDivElement>(null);
    useAdminContentGuard(() => ({ busy: task.current.busy(), dirty: dirty.current }), setNotice);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

    // Initial Load from API
    useEffect(() => {
        let current = true;
        setIsLoading(true); setLoadError('');
        const fetchData = async () => {
            try {
                const data = await api.banners.get();
                if (!current) return;
                if (!data || ['banners', 'quickLinks', 'eventBanners', 'categoryTabs'].some(key => !Array.isArray((data as any)[key]))) throw new Error('홈 화면 자료의 형식을 확인해 주세요.');
                const loaded: HomeContent = {
                    banners: data.banners.map((b: any) => ({
                        id: b.id, image: b.image, pcImage: b.pc_image || b.pcImage || '',
                        tag: b.tag || 'Premium Trip',
                        title: b.title, subtitle: b.subtitle, link: b.link,
                        pcTitle: b.pc_title || b.pcTitle || '',
                        pcSubtitle: b.pc_subtitle || b.pcSubtitle || '',
                        pcTag: b.pc_tag || b.pcTag || '',
                    })),
                    quickLinks: data.quickLinks.map((l: any) => ({
                        id: l.id, icon: l.icon, image: l.image, label: l.label, path: l.path
                    })),
                    eventBanners: data.eventBanners.map((e: any) => ({
                        id: e.id, image: e.image, backgroundColor: e.background_color,
                        tag: e.tag, title: e.title, icon: e.icon, link: e.link, location: e.location
                    })),
                    categoryTabs: data.categoryTabs.map((c: any) => ({
                        id: c.id, name: c.name, title: c.title, subtitle: c.subtitle, bannerImage: c.banner_image
                    })),
                };
                setBanners(loaded.banners); setLinks(loaded.quickLinks); setEventBanners(loaded.eventBanners); setCategoryTabs(loaded.categoryTabs);
                savedRef.current = loaded;
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
        // Focus the new card: fold the others like the design does.
        setCollapsed(previous => ({ ...previous, ...Object.fromEntries(banners.map(b => [b.id, true])), [newId]: false }));
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
    const addLink = (preset?: QuickLink) => {
        const newId = `link-${Date.now()}`;
        setLinks(previous => [...previous, preset ? { ...preset, id: newId } : { id: newId, icon: 'star', label: '새 메뉴', path: '#' }]);
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
        setCollapsed(previous => ({ ...previous, ...Object.fromEntries(eventBanners.map(e => [e.id, true])), [newId]: false }));
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

    const clearEventImage = (id: string) => {
        setEventBanners(previous => previous.map(e => e.id === id ? { ...e, image: '' } : e));
        markUnsaved();
    };

    // Save Action via API
    const saveAll = async () => {
        if (isLoading || loadError || !dirty.current) return;
        const release = task.current.begin('save'); if (!release) return;
        setBusy('save'); setNotice('');
        const snapshot = dataRef.current;
        try {
            await api.banners.save(snapshot);
            if (!mounted.current) return;
            savedRef.current = snapshot; setSavedAt(nowLabel());
            dirty.current = false; setHasUnsavedChanges(false); setShowToast(true);
            setTimeout(() => { if (mounted.current) setShowToast(false); }, 3000);
        } catch (error: any) { if (mounted.current) setNotice('저장하지 못했습니다. 입력한 내용은 유지됩니다. ' + (error?.message || '다시 시도해 주세요.')); }
        finally { release(); if (mounted.current) setBusy(null); }
    };

    // Discard local edits back to the last loaded/saved content. Nothing is sent to the server.
    const revertAll = () => {
        const saved = savedRef.current;
        if (!saved || task.current.busy() || !dirty.current) return;
        if (!confirm('저장하지 않은 변경사항을 모두 되돌릴까요?')) return;
        setBanners(saved.banners); setLinks(saved.quickLinks); setEventBanners(saved.eventBanners); setCategoryTabs(saved.categoryTabs);
        dirty.current = false; setHasUnsavedChanges(false); setNotice('');
    };

    const isOpen = (id: string) => !collapsed[id];
    const toggleOpen = (id: string) => setCollapsed(previous => ({ ...previous, [id]: !previous[id] }));
    const setAllOpen = (ids: string[], open: boolean) => setCollapsed(previous => ({ ...previous, ...Object.fromEntries(ids.map(id => [id, !open])) }));
    // Land the section head just below the sticky bar, whatever height it wrapped to.
    const jumpTo = (id: string) => {
        const target = document.getElementById(id), bar = barRef.current;
        if (!target) return;
        const barBottom = bar ? (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight : 0;
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - barBottom - 16, behavior: 'smooth' });
    };

    const locked = !!busy || isLoading || !!loadError;
    const canSave = hasUnsavedChanges && !locked;
    const statusText = isLoading ? '홈 화면 자료를 불러오는 중…'
        : loadError ? '자료를 불러오지 못했어요'
        : busy === 'upload' ? '이미지 업로드 중… 완료 후 변경사항을 저장해 주세요.'
        : busy === 'save' ? '홈 화면 저장 중…'
        : hasUnsavedChanges ? '저장하지 않은 변경사항이 있어요'
        : savedAt ? `${savedAt} 저장됨 · 홈에 공개 중` : '홈에 공개된 내용과 같아요';
    const statusTone = loadError ? 'is-error' : busy || isLoading ? 'is-busy' : hasUnsavedChanges ? 'is-dirty' : 'is-clean';
    const jumps: [string, string, number][] = [
        ['메인 배너', 'hm-banner', banners.length], ['바로가기 아이콘', 'hm-icon', links.length],
        ['이벤트 배너', 'hm-event', eventBanners.length], ['여행지 테마', 'hm-theme', categoryTabs.length],
    ];
    const anyBannerOpen = banners.some(b => isOpen(b.id));
    const anyEventOpen = eventBanners.some(e => isOpen(e.id));
    const linkSuggestions = DEFAULT_LINKS.filter(s => !links.some(l => l.path === s.path));

    const sectionHead = (id: string, title: string, count: number, description: string, add?: { label: string; onClick: () => void }) => (
        <div id={id} className="hm-sec-head">
            <div className="hm-sec-text">
                <div className="hm-sec-title"><h3>{title}</h3><span className="hm-count">{count}</span></div>
                <p>{description}</p>
            </div>
            {add && <button type="button" className="hm-add" onClick={add.onClick}><DashboardIcon name="lc-plus" size={16} />{add.label}</button>}
        </div>
    );

    const renderBanner = (banner: Banner, index: number) => {
        const open = isOpen(banner.id), pcTextUsed = !!(banner.pcTag || banner.pcTitle || banner.pcSubtitle), pcShown = !!pcOpen[banner.id];
        const summary = [banner.tag || '태그 없음', banner.link || '링크 없음', banner.image ? '모바일 이미지 ✓' : '모바일 이미지 없음', banner.pcImage ? 'PC 이미지 ✓' : ''].filter(Boolean).join(' · ');
        const name = banner.title?.split('\n')[0];
        return (
            <section className="hm-card" key={banner.id}>
                <div className="hm-card-head">
                    <button type="button" className="hm-card-toggle" aria-expanded={open} aria-label={`메인 배너 #${index + 1} ${open ? '접기' : '펼치기'}`} onClick={() => toggleOpen(banner.id)}>
                        <span className={`hm-chev${open ? ' is-open' : ''}`}><DashboardIcon name="lc-chevron-down" size={18} /></span>
                        <span className="hm-thumb" style={coverStyle(banner.image)} />
                        <span className="hm-num">#{index + 1}</span>
                        <span className="hm-head-text">
                            <span className={`hm-name${name ? '' : ' is-empty'}`}>{name || '제목 없음'}</span>
                            <span className="hm-summary">{summary}</span>
                        </span>
                    </button>
                    <span className="hm-tools">
                        <button type="button" className="hm-tool" aria-label="메인 배너 위로" title="위로" onClick={() => moveBanner(index, -1)} disabled={index === 0}><DashboardIcon name="lc-arrow-up" size={16} /></button>
                        <button type="button" className="hm-tool" aria-label="메인 배너 아래로" title="아래로" onClick={() => moveBanner(index, 1)} disabled={index === banners.length - 1}><HmIcon name="lc-arrow-down" /></button>
                        <button type="button" className="hm-tool danger" aria-label="메인 배너 삭제" title="삭제" onClick={() => deleteBanner(banner.id)}><DashboardIcon name="lc-trash" size={16} /></button>
                    </span>
                </div>
                {open && (
                    <div className="hm-card-body">
                        <div className="hm-media">
                            <div className="hm-media-item">
                                <span className="hm-media-label"><HmIcon name="lc-smartphone" size={14} />모바일 · 16:10<em>필수</em></span>
                                <button type="button" className={`hm-mbox${banner.image ? ' has-image' : ''}`} style={coverStyle(banner.image)} title="모바일 이미지 변경"
                                    onClick={() => { setSelectedId(banner.id); bannerFileInputRef.current?.click(); }}>
                                    <span className="hm-mov">
                                        {banner.tag && <span className="hm-mov-tag">{banner.tag}</span>}
                                        <span className="hm-mov-title">{banner.title || '제목을 입력하세요'}</span>
                                        {banner.subtitle && <span className="hm-mov-sub">{banner.subtitle}</span>}
                                    </span>
                                    <span className="hm-upload-pill"><HmIcon name="lc-upload" size={12} />{banner.image ? '이미지 바꾸기' : '이미지 올리기'}</span>
                                </button>
                            </div>
                            <div className="hm-media-item">
                                <span className="hm-media-label"><HmIcon name="lc-monitor" size={14} />PC · 21:9<em>선택</em></span>
                                <button type="button" className={`hm-pbox${banner.pcImage ? ' has-image' : ''}`} style={coverStyle(banner.pcImage)} title="PC 와이드 이미지 변경"
                                    onClick={() => { setSelectedId(banner.id); pcBannerFileInputRef.current?.click(); }}>
                                    {!banner.pcImage && <span className="hm-pbox-empty"><DashboardIcon name="lc-image-plus" size={16} /><span>없으면 모바일 이미지 사용</span></span>}
                                </button>
                                {banner.pcImage && <button type="button" className="hm-btn-sm" onClick={() => clearPcImage(banner.id)}>PC 이미지 제거</button>}
                            </div>
                        </div>
                        <div className="hm-fields">
                            <div className="hm-basic">
                                <span className="hm-box-title"><HmIcon name="lc-smartphone" />기본 문구<small>모바일과 PC에 함께 쓰여요</small></span>
                                <div className="hm-grid">
                                    <label className="hm-field"><span>태그</span>
                                        <input type="text" className="hm-inp" value={banner.tag} placeholder="예: Premium Trip" onChange={(e) => handleBannerChange(banner.id, 'tag', e.target.value)} />
                                    </label>
                                    <label className="hm-field"><span>링크</span>
                                        <input type="text" className="hm-inp" value={banner.link || ''} placeholder="/products/..." onChange={(e) => handleBannerChange(banner.id, 'link', e.target.value)} />
                                    </label>
                                </div>
                                <label className="hm-field"><span>제목 <small>· 줄바꿈은 Enter</small></span>
                                    <textarea className="hm-inp hm-textarea" value={banner.title} placeholder="예: 은하수 아래 게르에서 보내는 3박 4일" onChange={(e) => handleBannerChange(banner.id, 'title', e.target.value)} />
                                </label>
                                <label className="hm-field"><span>부제목</span>
                                    <input type="text" className="hm-inp" value={banner.subtitle} placeholder="예: 소규모 단독 투어 · 한국어 가이드" onChange={(e) => handleBannerChange(banner.id, 'subtitle', e.target.value)} />
                                </label>
                            </div>
                            <div className="hm-pc">
                                <button type="button" className="hm-pc-toggle" aria-expanded={pcShown} onClick={() => setPcOpen(previous => ({ ...previous, [banner.id]: !previous[banner.id] }))}>
                                    <HmIcon name="lc-monitor" /><b>PC 전용 문구</b>
                                    <span className={`hm-badge${pcTextUsed ? ' is-on' : ''}`}>{pcTextUsed ? '사용 중' : '기본 문구 사용'}</span>
                                    <span className="hm-pc-hint">비워 두면 기본 문구를 써요</span>
                                    <span className={`hm-chev${pcShown ? ' is-open' : ''}`}><DashboardIcon name="lc-chevron-down" size={16} /></span>
                                </button>
                                {pcShown && (
                                    <div className="hm-pc-body">
                                        <label className="hm-field"><span>PC 태그</span>
                                            <input type="text" className="hm-inp" value={banner.pcTag || ''} placeholder={banner.tag || '(기본 태그 사용)'} onChange={(e) => handleBannerChange(banner.id, 'pcTag', e.target.value)} />
                                        </label>
                                        <label className="hm-field"><span>PC 제목 <small>· 줄바꿈은 Enter</small></span>
                                            <textarea className="hm-inp hm-textarea" value={banner.pcTitle || ''} placeholder={banner.title || '(기본 제목 사용)'} onChange={(e) => handleBannerChange(banner.id, 'pcTitle', e.target.value)} />
                                        </label>
                                        <label className="hm-field"><span>PC 부제목</span>
                                            <input type="text" className="hm-inp" value={banner.pcSubtitle || ''} placeholder={banner.subtitle || '(기본 부제목 사용)'} onChange={(e) => handleBannerChange(banner.id, 'pcSubtitle', e.target.value)} />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </section>
        );
    };

    const renderLink = (link: QuickLink, index: number) => (
        <div className="hm-icon-card" key={link.id}>
            <div className="hm-icon-top">
                <button type="button" className={`hm-icon-img${link.image ? ' has-image' : ''}`} title="이미지 변경" aria-label={`바로가기 #${index + 1} 이미지 변경`}
                    onClick={() => { setSelectedId(link.id); iconFileInputRef.current?.click(); }}>
                    {link.image ? <img src={link.image} alt="" /> : <Icon name={link.icon} />}
                </button>
                <span className="hm-icon-meta"><span className="hm-icon-num">#{index + 1}</span><span className={`hm-name${link.label ? '' : ' is-empty'}`}>{link.label || '이름 없음'}</span></span>
            </div>
            <input type="text" className="hm-inp" aria-label="라벨" value={link.label} placeholder="이름 (예: 여행상품)" onChange={(e) => handleLinkChange(link.id, 'label', e.target.value)} />
            <input type="text" className="hm-inp" aria-label="링크" value={link.path} placeholder="링크 (예: /products)" onChange={(e) => handleLinkChange(link.id, 'path', e.target.value)} />
            <div className="hm-icon-tools">
                <button type="button" className="hm-tool" title="앞으로" aria-label="바로가기 앞으로" onClick={() => moveLink(index, 'left')} disabled={index === 0}><HmIcon name="lc-arrow-left" /></button>
                <button type="button" className="hm-tool" title="뒤로" aria-label="바로가기 뒤로" onClick={() => moveLink(index, 'right')} disabled={index === links.length - 1}><DashboardIcon name="lc-arrow-right" size={16} /></button>
                <button type="button" className="hm-tool danger" title="삭제" aria-label="바로가기 삭제" onClick={() => deleteLink(link.id)}><DashboardIcon name="lc-trash" size={16} /></button>
            </div>
        </div>
    );

    const renderEvent = (banner: EventBanner, index: number) => {
        const open = isOpen(banner.id), color = isHex(banner.backgroundColor) ? banner.backgroundColor : '#0F766E';
        const place = EVENT_PLACES.find(p => p.value === (banner.location || 'all')) || EVENT_PLACES[0];
        const summary = [banner.tag || '태그 없음', place.summary, banner.link || '링크 없음'].join(' · ');
        const name = (banner.title || '').split('\n')[0];
        return (
            <section className="hm-card" key={banner.id}>
                <div className="hm-card-head">
                    <button type="button" className="hm-card-toggle" aria-expanded={open} aria-label={`이벤트 배너 #${index + 1} ${open ? '접기' : '펼치기'}`} onClick={() => toggleOpen(banner.id)}>
                        <span className={`hm-chev${open ? ' is-open' : ''}`}><DashboardIcon name="lc-chevron-down" size={18} /></span>
                        <span className="hm-thumb hm-thumb-event" style={{ background: color, ...coverStyle(banner.image) }}>{!banner.image && <HmIcon name="lc-megaphone" size={14} />}</span>
                        <span className="hm-num">#{index + 1}</span>
                        <span className="hm-head-text">
                            <span className={`hm-name${name ? '' : ' is-empty'}`}>{name || '제목 없음'}</span>
                            <span className="hm-summary">{summary}</span>
                        </span>
                    </button>
                    <span className="hm-tools">
                        <button type="button" className="hm-tool" title="위로" aria-label="이벤트 배너 위로" onClick={() => moveEventBanner(index, 'left')} disabled={index === 0}><DashboardIcon name="lc-arrow-up" size={16} /></button>
                        <button type="button" className="hm-tool" title="아래로" aria-label="이벤트 배너 아래로" onClick={() => moveEventBanner(index, 'right')} disabled={index === eventBanners.length - 1}><HmIcon name="lc-arrow-down" /></button>
                        <button type="button" className="hm-tool danger" title="삭제" aria-label="이벤트 배너 삭제" onClick={() => deleteEventBanner(banner.id)}><DashboardIcon name="lc-trash" size={16} /></button>
                    </span>
                </div>
                {open && (
                    <div className="hm-card-body">
                        <div className="hm-media">
                            <button type="button" className={`hm-ev-pv${banner.image ? ' has-image' : ''}`} style={{ background: color, ...coverStyle(banner.image) }} title="이벤트 이미지 변경"
                                onClick={() => { setSelectedId(banner.id); eventFileInputRef.current?.click(); }}>
                                <span className="hm-ev-text">
                                    <span className="hm-mov-tag">{banner.tag}</span>
                                    <span className="hm-mov-title">{banner.title}</span>
                                </span>
                                {!banner.image && banner.icon && <Icon name={banner.icon} />}
                                <span className="hm-upload-pill"><HmIcon name="lc-upload" size={12} />{banner.image ? '이미지 바꾸기' : '이미지 올리기 (선택)'}</span>
                            </button>
                            {banner.image && <button type="button" className="hm-btn-sm" onClick={() => clearEventImage(banner.id)}>이미지 제거 · 배경색 사용</button>}
                        </div>
                        <div className="hm-fields">
                            <div className="hm-grid hm-grid-wide">
                                <div className="hm-field"><span>배경색 <small>· 이미지가 없을 때</small></span>
                                    <div className="hm-color-row">
                                        <label className="hm-swatch" style={{ background: color }} title="색 고르기">
                                            <input type="color" value={color} onChange={(e) => handleEventChange(banner.id, 'backgroundColor', e.target.value)} />
                                        </label>
                                        <input type="text" className="hm-inp hm-mono" aria-label="배경색 코드" value={banner.backgroundColor} onChange={(e) => handleEventChange(banner.id, 'backgroundColor', e.target.value)} />
                                    </div>
                                    <div className="hm-presets">
                                        {EVENT_COLORS.map(c => (
                                            <button type="button" key={c} title={c} aria-label={`배경색 ${c}`} className={`hm-preset${color.toLowerCase() === c.toLowerCase() ? ' is-on' : ''}`} style={{ background: c }} onClick={() => handleEventChange(banner.id, 'backgroundColor', c)} />
                                        ))}
                                    </div>
                                </div>
                                <div className="hm-field"><span>노출 위치</span>
                                    <div className="hm-seg" role="group" aria-label="노출 위치">
                                        {EVENT_PLACES.map(p => (
                                            <button type="button" key={p.value} aria-pressed={place.value === p.value} className={place.value === p.value ? 'is-on' : ''} onClick={() => handleEventChange(banner.id, 'location', p.value)}>{p.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <label className="hm-field"><span>태그</span>
                                    <input type="text" className="hm-inp" value={banner.tag} placeholder="예: NEW" onChange={(e) => handleEventChange(banner.id, 'tag', e.target.value)} />
                                </label>
                                <div className="hm-field"><span>링크</span>
                                    <div className="hm-link-row">
                                        <select className="hm-inp hm-select" aria-label="링크 빠른 선택"
                                            onChange={(e) => { if (e.target.value) handleEventChange(banner.id, 'link', e.target.value); }}
                                            value={PREDEFINED_LINKS.some(l => l.value === banner.link) ? banner.link : ''}>
                                            {PREDEFINED_LINKS.map(l => (
                                                <option key={l.label} value={l.value}>{l.label}</option>
                                            ))}
                                        </select>
                                        <input type="text" className="hm-inp" aria-label="링크 주소" value={banner.link} onChange={(e) => handleEventChange(banner.id, 'link', e.target.value)} placeholder="https:// 또는 #" />
                                    </div>
                                </div>
                            </div>
                            <label className="hm-field"><span>제목 <small>· 줄바꿈은 Enter</small></span>
                                <textarea className="hm-inp hm-textarea" value={banner.title} placeholder="예: 겨울 은하수 얼리버드" onChange={(e) => handleEventChange(banner.id, 'title', e.target.value)} />
                            </label>
                        </div>
                    </div>
                )}
            </section>
        );
    };

    return (
        <AdminLayout activePage="banners" title="홈 화면 관리">
            <div className="hm-page">
                <div className="hm-bar" ref={barRef}>
                    <nav className="hm-tabs" aria-label="홈 화면 구역">
                        {jumps.map(([label, id, count]) => (
                            <button type="button" key={id} onClick={() => jumpTo(id)}>{label}<span>{count}</span></button>
                        ))}
                    </nav>
                    <div className="hm-bar-end">
                        <span className={`hm-status ${statusTone}`} role="status" aria-live="polite"><span className="hm-dot" />{statusText}</span>
                        {hasUnsavedChanges && <button type="button" className="hm-revert" onClick={revertAll} disabled={locked}>되돌리기</button>}
                        <button type="button" className="hm-save" onClick={saveAll} disabled={!canSave}>{busy === 'save' ? '저장 중…' : '변경사항 저장'}</button>
                    </div>
                </div>

                {notice && <p role="alert" className="hm-alert">{notice}</p>}
                {loadError && <div role="alert" className="hm-alert">{loadError}<button type="button" className="hm-btn-sm" onClick={() => setLoadAttempt(value => value + 1)}>다시 불러오기</button></div>}

                <fieldset className="hm-body" disabled={locked} inert={locked}>
                    <input type="file" ref={bannerFileInputRef} hidden accept="image/*" onChange={(e) => handleUpload(e, 'banner')} />
                    <input type="file" ref={pcBannerFileInputRef} hidden accept="image/*" onChange={(e) => handleUpload(e, 'pcBanner')} />
                    <input type="file" ref={iconFileInputRef} hidden accept="image/*" onChange={(e) => handleUpload(e, 'icon')} />
                    <input type="file" ref={eventFileInputRef} hidden accept="image/*" onChange={(e) => handleUpload(e, 'event')} />
                    <input type="file" ref={categoryFileInputRef} hidden accept="image/*" onChange={(e) => handleUpload(e, 'category')} />

                    {/* ============ Main Banners ============ */}
                    {sectionHead('hm-banner', '메인 배너', banners.length, "홈 상단 슬라이드 배너예요. 이미지와 문구를 고친 뒤 '변경사항 저장'을 누르면 공개돼요.", { label: '배너 추가', onClick: addBanner })}
                    {banners.length > 1 && (
                        <div className="hm-toggle-all"><button type="button" onClick={() => setAllOpen(banners.map(b => b.id), !anyBannerOpen)}>{anyBannerOpen ? '모두 접기' : '모두 펼치기'}</button></div>
                    )}
                    {banners.map(renderBanner)}
                    {banners.length === 0 && (
                        <button type="button" className="hm-empty" onClick={addBanner}><DashboardIcon name="lc-image-plus" size={24} />배너가 없어요. 눌러서 첫 배너를 추가하세요.</button>
                    )}

                    {/* ============ Quick Icons ============ */}
                    {sectionHead('hm-icon', '바로가기 아이콘', links.length, '홈 화면 숏컷 줄이에요. 이미지나 아이콘과 이름, 링크로 구성해요.', { label: '아이콘 추가', onClick: () => addLink() })}
                    {links.length > 0 ? (
                        <div className="hm-icon-grid">{links.map(renderLink)}</div>
                    ) : (
                        <div className="hm-empty is-static">
                            <HmIcon name="lc-layout-grid" size={28} />
                            <strong>등록된 아이콘이 없어요</strong>
                            {linkSuggestions.length > 0 && (
                                <div className="hm-suggest">
                                    <span>자주 쓰는 바로가기</span>
                                    {linkSuggestions.map(s => <button type="button" key={s.id} onClick={() => addLink(s)}>+ {s.label}</button>)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ============ Event Banners ============ */}
                    {sectionHead('hm-event', '이벤트 배너', eventBanners.length, '가로로 넘겨 보는 이벤트 배너예요. 노출 위치를 고를 수 있어요.', { label: '이벤트 추가', onClick: addEventBanner })}
                    {eventBanners.length > 1 && (
                        <div className="hm-toggle-all"><button type="button" onClick={() => setAllOpen(eventBanners.map(e => e.id), !anyEventOpen)}>{anyEventOpen ? '모두 접기' : '모두 펼치기'}</button></div>
                    )}
                    {eventBanners.map(renderEvent)}
                    {eventBanners.length === 0 && (
                        <button type="button" className="hm-empty" onClick={addEventBanner}><HmIcon name="lc-megaphone" size={24} />이벤트 배너가 없어요. 눌러서 추가하세요.</button>
                    )}

                    {/* ============ Category Tabs ============ */}
                    {sectionHead('hm-theme', '여행지 테마 배너', categoryTabs.length, '홈 화면 여행지 탭마다 보이는 대표 이미지와 문구예요.')}
                    {categoryTabs.length > 0 ? (
                        <div className="hm-theme-grid">
                            {categoryTabs.map((tab) => (
                                <div className="hm-theme-card" key={tab.id}>
                                    <button type="button" className="hm-theme-img" style={coverStyle(tab.bannerImage)} title="이미지 변경" aria-label={`${tab.name} 테마 이미지 변경`}
                                        onClick={() => { setSelectedId(tab.id); categoryFileInputRef.current?.click(); }}>
                                        <span className="hm-theme-name">{tab.name}</span>
                                        <span className="hm-upload-pill"><HmIcon name="lc-upload" size={12} />이미지 바꾸기</span>
                                    </button>
                                    <div className="hm-theme-fields">
                                        <label className="hm-field"><span>제목</span>
                                            <input type="text" className="hm-inp" value={tab.title} onChange={(e) => handleCategoryChange(tab.id, 'title', e.target.value)} />
                                        </label>
                                        <label className="hm-field"><span>부제목 <small>· 줄바꿈은 Enter</small></span>
                                            <textarea className="hm-inp hm-textarea" value={tab.subtitle} onChange={(e) => handleCategoryChange(tab.id, 'subtitle', e.target.value)} />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="hm-empty is-static"><DashboardIcon name="lc-image-plus" size={24} /><strong>등록된 테마 배너가 없어요</strong></div>
                    )}
                </fieldset>
            </div>
            {/* Toast Notification */}
            {showToast && (
                <div className="page-toast">
                    <Icon name="check_circle" />
                    <span>저장되었습니다!</span>
                </div>
            )}
        </AdminLayout>
    );
};
