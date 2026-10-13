import React, { useRef, useEffect, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';

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

    // Initial Load from API
    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await api.banners.get();
                if (data.banners && data.banners.length > 0) {
                    setBanners(data.banners.map((b: any) => ({
                        id: b.id, image: b.image, pcImage: b.pc_image || b.pcImage || '',
                        tag: b.tag || 'Premium Trip',
                        title: b.title, subtitle: b.subtitle, link: b.link,
                        pcTitle: b.pc_title || b.pcTitle || '',
                        pcSubtitle: b.pc_subtitle || b.pcSubtitle || '',
                        pcTag: b.pc_tag || b.pcTag || '',
                    })));
                }
                if (data.quickLinks && data.quickLinks.length > 0) {
                    setLinks(data.quickLinks.map((l: any) => ({
                        id: l.id, icon: l.icon, image: l.image, label: l.label, path: l.path
                    })));
                }
                if (data.eventBanners && data.eventBanners.length > 0) {
                    setEventBanners(data.eventBanners.map((e: any) => ({
                        id: e.id, image: e.image, backgroundColor: e.background_color,
                        tag: e.tag, title: e.title, icon: e.icon, link: e.link, location: e.location
                    })));
                }
                if (data.categoryTabs && data.categoryTabs.length > 0) {
                    setCategoryTabs(data.categoryTabs.map((c: any) => ({
                        id: c.id, name: c.name, title: c.title, subtitle: c.subtitle, bannerImage: c.banner_image
                    })));
                }
            } catch (error) {
                console.error('Error fetching admin banner data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // Change Detection
    const markUnsaved = () => setHasUnsavedChanges(true);

    // CRUD - Banners
    const addBanner = () => {
        const newId = `banner-${Date.now()}`;
        setBanners([...banners, {
            id: newId, image: "", pcImage: "",
            tag: "", title: "", subtitle: "", link: "",
            pcTitle: "", pcSubtitle: "", pcTag: "",
        }]);
        markUnsaved();
    };

    const deleteBanner = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setBanners(banners.filter(b => b.id !== id));
            markUnsaved();
        }
    };

    const handleBannerChange = (id: string, field: keyof Banner, value: string) => {
        setBanners(banners.map(b => b.id === id ? { ...b, [field]: value } : b));
        markUnsaved();
    };

    // CRUD - Links
    const addLink = () => {
        const newId = `link-${Date.now()}`;
        setLinks([...links, { id: newId, icon: 'star', label: '새 메뉴', path: '#' }]);
        markUnsaved();
    };

    const deleteLink = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setLinks(links.filter(l => l.id !== id));
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
        setLinks(links.map(l => l.id === id ? { ...l, [field]: value } : l));
        markUnsaved();
    };

    // CRUD - Event Banners
    const addEventBanner = () => {
        const newId = `event-${Date.now()}`;
        setEventBanners([...eventBanners, {
            id: newId, backgroundColor: '#0F766E', tag: 'NEW', title: '새로운 이벤트', icon: 'campaign', link: '#', location: 'all'
        }]);
        markUnsaved();
    };
    const deleteEventBanner = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setEventBanners(eventBanners.filter(e => e.id !== id));
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
        setEventBanners(eventBanners.map(e => e.id === id ? { ...e, [field]: value } : e));
        markUnsaved();
    };

    // CRUD - Category Tabs
    const handleCategoryChange = (id: string, field: keyof CategoryTab, value: string) => {
        setCategoryTabs(categoryTabs.map(c => c.id === id ? { ...c, [field]: value } : c));
        markUnsaved();
    };



    // Images
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'pcBanner' | 'icon' | 'event' | 'category') => {
        const file = e.target.files?.[0];
        if (file && selectedId) {
            try {
                // Upload to Cloudflare R2
                // Use different folders for organization
                let folder = 'banners';
                if (type === 'pcBanner') folder = 'banners';
                if (type === 'icon') folder = 'icons';
                if (type === 'event') folder = 'events';
                if (type === 'category') folder = 'categories';

                const publicUrl = await uploadImage(file, folder);

                if (type === 'banner') setBanners(banners.map(b => b.id === selectedId ? { ...b, image: publicUrl } : b));
                if (type === 'pcBanner') setBanners(banners.map(b => b.id === selectedId ? { ...b, pcImage: publicUrl } : b));
                if (type === 'icon') setLinks(links.map(l => l.id === selectedId ? { ...l, image: publicUrl } : l));
                if (type === 'event') setEventBanners(eventBanners.map(ev => ev.id === selectedId ? { ...ev, image: publicUrl } : ev));
                if (type === 'category') setCategoryTabs(categoryTabs.map(c => c.id === selectedId ? { ...c, bannerImage: publicUrl } : c));
                // Reset input so picking the same file twice still triggers onChange.
                e.target.value = '';
                markUnsaved();
            } catch (error) {
                console.error('Image upload failed:', error);
                alert('이미지 업로드 중 오류가 발생했습니다.');
            }
        }
    };

    const clearPcImage = (id: string) => {
        setBanners(banners.map(b => b.id === id ? { ...b, pcImage: '' } : b));
        markUnsaved();
    };

    // Save Action via API
    const saveAll = async () => {
        try {
            await api.banners.save({ banners, quickLinks: links, eventBanners, categoryTabs });
            setHasUnsavedChanges(false);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        } catch (error: any) {
            console.error('Save failed:', error);
            alert('저장 중 오류가 발생했습니다:\n\n' + (error.message || '알 수 없는 오류'));
        }
    };

    // Preview tone for the main-banner thumbnail when no image is set.
    const bannerTone = (index: number) => ['bp-blue', 'bp-purple', 'bp-red'][index % 3];

    return (
        <AdminLayout
            activePage="banners"
            title="홈 화면 관리"
            actions={
                <button
                    className="btn btn-ink"
                    onClick={saveAll}
                    disabled={!hasUnsavedChanges}
                >
                    <Icon name="save" />변경사항 저장
                    {hasUnsavedChanges && <span className="badge b-amber" style={{ padding: '0 6px', marginLeft: 2 }}>•</span>}
                </button>
            }
        >
            <div className="route-anim">

                {/* ============ Main Banners ============ */}
                <div className="sec-head">
                    <div>
                        <h3>메인 배너</h3>
                        <div className="cell-muted" style={{ fontSize: 13 }}>홈 상단 슬라이드 배너 · 이미지와 문구를 수정한 뒤 ‘변경사항 저장’을 누르면 공개됩니다.</div>
                    </div>
                    <div className="spacer" />
                    <button className="btn btn-ink" onClick={addBanner}>
                        <Icon name="add" />배너 추가
                    </button>
                </div>

                <input type="file" ref={bannerFileInputRef} className="hidden" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUpload(e, 'banner')} />
                <input type="file" ref={pcBannerFileInputRef} className="hidden" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUpload(e, 'pcBanner')} />

                <div className="stack" style={{ gap: 12 }}>
                    {banners.map((banner, index) => (
                        <div className="banner-card" key={banner.id} style={{ alignItems: 'flex-start' }}>
                            <div className="row" style={{ flexDirection: 'column', gap: 10, flex: 'none' }}>
                                {/* Mobile image preview */}
                                <div
                                    className={`banner-prev ${banner.image ? '' : bannerTone(index)}`}
                                    style={{ cursor: 'pointer', position: 'relative', backgroundImage: banner.image ? `url('${banner.image}')` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
                                    onClick={() => { setSelectedId(banner.id); bannerFileInputRef.current?.click(); }}
                                    title="모바일 이미지 변경"
                                >
                                    {!banner.image && (
                                        <>
                                            <div className="bt">{banner.title || `배너 #${index + 1}`}</div>
                                            <div className="bs">{banner.subtitle || '클릭하여 이미지 업로드'}</div>
                                        </>
                                    )}
                                </div>
                                <div className="cell-muted row" style={{ fontSize: 11, gap: 4, justifyContent: 'center' }}>
                                    <Icon name="smartphone" style={{ fontSize: 14 }} />모바일 (16:10)
                                </div>

                                {/* PC wide image preview */}
                                <div
                                    className="banner-prev"
                                    style={{ width: 150, height: 64, cursor: 'pointer', position: 'relative', border: '1.5px dashed var(--border-strong)', background: banner.pcImage ? `url('${banner.pcImage}') center/cover` : 'var(--mrt-gray-50)', color: 'var(--text-tertiary)' }}
                                    onClick={() => { setSelectedId(banner.id); pcBannerFileInputRef.current?.click(); }}
                                    title="PC 와이드 이미지 변경"
                                >
                                    {!banner.pcImage && (
                                        <div className="bs" style={{ color: 'var(--text-tertiary)', textAlign: 'center', opacity: 1 }}>PC 와이드<br />(선택)</div>
                                    )}
                                </div>
                                <div className="cell-muted row" style={{ fontSize: 11, gap: 4, justifyContent: 'center' }}>
                                    <Icon name="desktop_windows" style={{ fontSize: 14 }} />PC (21:9)
                                </div>
                                {banner.pcImage && (
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearPcImage(banner.id)}>
                                        PC 이미지 제거
                                    </button>
                                )}
                            </div>

                            {/* Edit fields */}
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                                    <span className="badge b-gray">#{index + 1}</span>
                                    <span className="cell-strong" style={{ fontSize: 15 }}>{banner.title?.split('\n')[0] || '제목 없음'}</span>
                                </div>

                                {/* Mobile (default) text */}
                                <div className="edit-sec" style={{ marginBottom: 12 }}>
                                    <div className="edit-sec-head">
                                        <Icon name="smartphone" />
                                        <h4>모바일 텍스트 (기본값 — PC에도 자동 적용)</h4>
                                    </div>
                                    <div className="field-row">
                                        <div className="field" style={{ marginBottom: 0 }}>
                                            <label>태그 (Tag)</label>
                                            <input
                                                type="text"
                                                className="inp"
                                                value={banner.tag}
                                                onChange={(e) => handleBannerChange(banner.id, 'tag', e.target.value)}
                                            />
                                        </div>
                                        <div className="field" style={{ marginBottom: 0 }}>
                                            <label>링크 (Link)</label>
                                            <input
                                                type="text"
                                                className="inp"
                                                value={banner.link || ''}
                                                placeholder="/products/..."
                                                onChange={(e) => handleBannerChange(banner.id, 'link', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                                        <label>제목 (Title)</label>
                                        <textarea
                                            className="inp"
                                            style={{ height: 60 }}
                                            value={banner.title}
                                            onChange={(e) => handleBannerChange(banner.id, 'title', e.target.value)}
                                        />
                                    </div>
                                    <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                                        <label>부제목 (Subtitle)</label>
                                        <input
                                            type="text"
                                            className="inp"
                                            value={banner.subtitle}
                                            onChange={(e) => handleBannerChange(banner.id, 'subtitle', e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* PC-only override */}
                                <div className="edit-sec">
                                    <div className="edit-sec-head">
                                        <Icon name="desktop_windows" />
                                        <h4>PC 전용 텍스트 (선택)</h4>
                                        <span className="muted cell-muted">비워두면 모바일 텍스트 사용</span>
                                    </div>
                                    <div className="field-row">
                                        <div className="field" style={{ marginBottom: 0 }}>
                                            <label>PC 태그</label>
                                            <input
                                                type="text"
                                                className="inp"
                                                value={banner.pcTag || ''}
                                                placeholder={banner.tag || '(모바일 값 사용)'}
                                                onChange={(e) => handleBannerChange(banner.id, 'pcTag', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                                        <label>PC 제목 (줄바꿈은 Enter로)</label>
                                        <textarea
                                            className="inp"
                                            style={{ height: 60 }}
                                            value={banner.pcTitle || ''}
                                            placeholder={banner.title || '(모바일 값 사용)'}
                                            onChange={(e) => handleBannerChange(banner.id, 'pcTitle', e.target.value)}
                                        />
                                    </div>
                                    <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                                        <label>PC 부제목</label>
                                        <input
                                            type="text"
                                            className="inp"
                                            value={banner.pcSubtitle || ''}
                                            placeholder={banner.subtitle || '(모바일 값 사용)'}
                                            onChange={(e) => handleBannerChange(banner.id, 'pcSubtitle', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <span className="row-actions" style={{ flex: 'none' }}>
                                <button className="act-btn danger" title="삭제" onClick={() => deleteBanner(banner.id)}>
                                    <Icon name="delete" />
                                </button>
                            </span>
                        </div>
                    ))}

                    {banners.length === 0 && (
                        <div className="empty">
                            <Icon name="ad_units" />
                            <p>등록된 배너가 없습니다.</p>
                        </div>
                    )}
                </div>

                {/* ============ Quick Icons ============ */}
                <div className="sec-head" style={{ marginTop: 32 }}>
                    <div>
                        <h3>바로가기 아이콘</h3>
                        <div className="cell-muted" style={{ fontSize: 13 }}>홈 화면 숏컷 행 · 이미지 또는 아이콘으로 구성</div>
                    </div>
                    <div className="spacer" />
                    <button className="btn btn-ink" onClick={addLink}>
                        <Icon name="add" />아이콘 추가
                    </button>
                </div>

                <input type="file" ref={iconFileInputRef} className="hidden" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUpload(e, 'icon')} />

                <div className="grid-3">
                    {links.map((link, index) => (
                        <div className="card card-pad" key={link.id}>
                            <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
                                <div
                                    className="metric-ico tint-ink"
                                    style={{ width: 56, height: 56, borderRadius: 14, cursor: 'pointer', overflow: 'hidden', flex: 'none' }}
                                    onClick={() => { setSelectedId(link.id); iconFileInputRef.current?.click(); }}
                                    title="이미지 변경"
                                >
                                    {link.image
                                        ? <img src={link.image} alt="icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <Icon name={link.icon} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="field" style={{ marginBottom: 10 }}>
                                        <label>라벨</label>
                                        <input
                                            type="text"
                                            className="inp"
                                            value={link.label}
                                            placeholder="라벨"
                                            onChange={(e) => handleLinkChange(link.id, 'label', e.target.value)}
                                        />
                                    </div>
                                    <div className="field" style={{ marginBottom: 0 }}>
                                        <label>링크</label>
                                        <input
                                            type="text"
                                            className="inp"
                                            value={link.path}
                                            placeholder="링크"
                                            onChange={(e) => handleLinkChange(link.id, 'path', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="row" style={{ marginTop: 14 }}>
                                <button className="act-btn" title="앞으로" onClick={() => moveLink(index, 'left')} disabled={index === 0}>
                                    <Icon name="chevron_left" />
                                </button>
                                <button className="act-btn" title="뒤로" onClick={() => moveLink(index, 'right')} disabled={index === links.length - 1}>
                                    <Icon name="chevron_right" />
                                </button>
                                <div className="spacer" style={{ flex: 1 }} />
                                <button className="act-btn danger" title="삭제" onClick={() => deleteLink(link.id)}>
                                    <Icon name="delete" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {links.length === 0 && (
                        <div className="empty" style={{ gridColumn: '1 / -1' }}>
                            <Icon name="grid_view" />
                            <p>등록된 아이콘이 없습니다.</p>
                        </div>
                    )}
                </div>

                {/* ============ Event Banners ============ */}
                <div className="sec-head" style={{ marginTop: 32 }}>
                    <div>
                        <h3>이벤트 배너</h3>
                        <div className="cell-muted" style={{ fontSize: 13 }}>가로 스크롤 이벤트 배너 · 노출 위치 설정 가능</div>
                    </div>
                    <div className="spacer" />
                    <button className="btn btn-ink" onClick={addEventBanner}>
                        <Icon name="add" />이벤트 추가
                    </button>
                </div>

                <input type="file" ref={eventFileInputRef} className="hidden" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUpload(e, 'event')} />

                <div className="stack" style={{ gap: 12 }}>
                    {eventBanners.map((banner, index) => (
                        <div className="banner-card" key={banner.id} style={{ alignItems: 'flex-start' }}>
                            <div className="row" style={{ flexDirection: 'column', gap: 8, flex: 'none' }}>
                                {/* Preview */}
                                <div
                                    className="banner-prev"
                                    style={{
                                        cursor: 'pointer', position: 'relative',
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                        background: banner.image ? `url('${banner.image}') center/cover` : banner.backgroundColor
                                    }}
                                    onClick={() => { setSelectedId(banner.id); eventFileInputRef.current?.click(); }}
                                    title="이미지 변경"
                                >
                                    {!banner.image && (
                                        <>
                                            <div>
                                                <div className="bs" style={{ textTransform: 'uppercase' }}>{banner.tag}</div>
                                                <div className="bt">{banner.title}</div>
                                            </div>
                                            <Icon name={banner.icon} style={{ fontSize: 24, opacity: 0.6 }} />
                                        </>
                                    )}
                                </div>
                                <div className="row" style={{ gap: 4, justifyContent: 'center' }}>
                                    <button className="act-btn" title="위로" onClick={() => moveEventBanner(index, 'left')} disabled={index === 0}>
                                        <Icon name="arrow_upward" />
                                    </button>
                                    <button className="act-btn" title="아래로" onClick={() => moveEventBanner(index, 'right')} disabled={index === eventBanners.length - 1}>
                                        <Icon name="arrow_downward" />
                                    </button>
                                </div>
                            </div>

                            {/* Edit fields */}
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="field-row" style={{ marginBottom: 14 }}>
                                    <div className="field" style={{ marginBottom: 0 }}>
                                        <label>배경색 (이미지 없을 때)</label>
                                        <div className="row" style={{ gap: 8 }}>
                                            <input type="color" value={banner.backgroundColor} onChange={(e) => handleEventChange(banner.id, 'backgroundColor', e.target.value)} style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1px solid var(--border-default)', padding: 2, flex: 'none' }} />
                                            <input type="text" className="inp" value={banner.backgroundColor} onChange={(e) => handleEventChange(banner.id, 'backgroundColor', e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="field" style={{ marginBottom: 0 }}>
                                        <label>표시 위치</label>
                                        <select
                                            className="inp"
                                            value={banner.location || 'all'}
                                            onChange={(e) => handleEventChange(banner.id, 'location', e.target.value)}
                                        >
                                            <option value="all">전체 (홈 + 여행상품)</option>
                                            <option value="home">홈 화면만</option>
                                            <option value="products">여행상품 페이지만</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="field-row" style={{ marginBottom: 14 }}>
                                    <div className="field" style={{ marginBottom: 0 }}>
                                        <label>태그</label>
                                        <input type="text" className="inp" value={banner.tag} onChange={(e) => handleEventChange(banner.id, 'tag', e.target.value)} />
                                    </div>
                                    <div className="field" style={{ marginBottom: 0 }}>
                                        <label>링크</label>
                                        <div className="row" style={{ gap: 8 }}>
                                            <select
                                                className="inp"
                                                style={{ width: 120, flex: 'none' }}
                                                onChange={(e) => {
                                                    if (e.target.value) handleEventChange(banner.id, 'link', e.target.value);
                                                    // If selecting a predefined link that isn't empty, valid. If empty (direct input), handled by input.
                                                }}
                                                value={PREDEFINED_LINKS.some(l => l.value === banner.link) ? banner.link : ''}
                                            >
                                                {PREDEFINED_LINKS.map(l => (
                                                    <option key={l.label} value={l.value}>{l.label}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                className="inp"
                                                value={banner.link}
                                                onChange={(e) => handleEventChange(banner.id, 'link', e.target.value)}
                                                placeholder="https://..."
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="field" style={{ marginBottom: 0 }}>
                                    <label>제목 (줄바꿈 가능)</label>
                                    <textarea className="inp" style={{ height: 52 }} value={banner.title} onChange={(e) => handleEventChange(banner.id, 'title', e.target.value)} />
                                </div>
                            </div>

                            <span className="row-actions" style={{ flex: 'none' }}>
                                <button className="act-btn danger" title="삭제" onClick={() => deleteEventBanner(banner.id)}>
                                    <Icon name="delete" />
                                </button>
                            </span>
                        </div>
                    ))}

                    {eventBanners.length === 0 && (
                        <div className="empty">
                            <Icon name="campaign" />
                            <p>등록된 이벤트 배너가 없습니다.</p>
                        </div>
                    )}
                </div>

                {/* ============ Category Tabs ============ */}
                <div className="sec-head" style={{ marginTop: 32 }}>
                    <div>
                        <h3>여행지 테마 배너</h3>
                        <div className="cell-muted" style={{ fontSize: 13 }}>홈 화면 탭별 대표 이미지와 문구</div>
                    </div>
                </div>

                <input type="file" ref={categoryFileInputRef} className="hidden" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUpload(e, 'category')} />

                <div className="grid-3">
                    {categoryTabs.map((tab) => (
                        <div className="card" key={tab.id} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {/* Image preview */}
                            <div
                                style={{ width: '100%', aspectRatio: '4 / 3', background: `url('${tab.bannerImage}') center/cover, var(--mrt-gray-100)`, position: 'relative', cursor: 'pointer' }}
                                onClick={() => { setSelectedId(tab.id); categoryFileInputRef.current?.click(); }}
                                title="이미지 변경"
                            >
                                <span className="badge b-ink" style={{ position: 'absolute', top: 12, left: 12 }}>{tab.name}</span>
                            </div>

                            {/* Edit fields */}
                            <div className="card-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div className="field" style={{ marginBottom: 14 }}>
                                    <label>제목</label>
                                    <input
                                        type="text"
                                        className="inp"
                                        value={tab.title}
                                        onChange={(e) => handleCategoryChange(tab.id, 'title', e.target.value)}
                                    />
                                </div>
                                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                                    <label>부제목</label>
                                    <textarea
                                        className="inp"
                                        style={{ height: 72 }}
                                        value={tab.subtitle}
                                        onChange={(e) => handleCategoryChange(tab.id, 'subtitle', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    {categoryTabs.length === 0 && (
                        <div className="empty" style={{ gridColumn: '1 / -1' }}>
                            <Icon name="category" />
                            <p>등록된 테마 배너가 없습니다.</p>
                        </div>
                    )}
                </div>

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
