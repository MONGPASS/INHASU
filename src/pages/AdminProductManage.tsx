import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useBlocker } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { adminProductFromApi, adminProductNavigationDecision, updateAdminProductEditorForm, readAdminProductDraft, writeAdminProductDraft, removeAdminProductDraft, finishAdminProductSave, runAdminProductSaveOnce, productDraftFingerprint, type AdminProductDraft, type AdminProductDraftScope, type AdminProductNavigationDecision, type DraftResult } from '../utils/adminProductDraft';
import { AdminLayout } from '../components/admin/AdminLayout';
import { DashboardIcon, type DashboardIconName } from '../components/admin/dashboard/DashboardIcon';
import './AdminProductList.css';
import './AdminProductEditor.css';
import { Icon } from '../components/admin/console/Icon';
import { DesignTemplateBlockEditor } from '../components/admin/DesignTemplateBlockEditor';
import { designTemplates } from '../components/product/designTemplates/registry';
import { api } from '../lib/api';
import { uploadImage as uploadProductImage } from '../utils/upload';
import { optimizeImage } from '../utils/imageOptimizer';
import { getOptimizedImageUrl } from '../utils/cloudflareImage';
import type { TourProduct, PackageType, TourPricingOption, AccommodationOption, VehicleOption, DetailSlide, DetailContentBlock, DividerContent, TimelineContent, DayInfoContent, DesignBlockContent } from '../types/product';
import type { Category } from '../types/category';
import type { Hotel } from '../types/hotel';
import type { TouristSpot } from '../types/touristSpot';
import { HotelPickerModal } from '../components/admin/HotelPickerModal';
import { TouristSpotPickerModal } from '../components/admin/TouristSpotPickerModal';
import { ItineraryImportModal } from '../components/admin/ItineraryImportModal';
import { cloneItineraryBlocks, renumberDayLabels, type ItinerarySource } from '../components/admin/itineraryImport';
import { stripDayLabelReading } from '../utils/dayLabel';
import { ProductRepresentativeSpots } from '../components/admin/QuoteSpotSelector';



export const AdminProductManage: React.FC = () => {
    const { user, loading: userLoading } = useUser();
    const [searchParams, setSearchParams] = useSearchParams();
    const openProductId = searchParams.get('open');
    const handledOpenProduct = useRef<string | null>(null);
    const editorOpenRequest = useRef(0);
    const [productsLoaded, setProductsLoaded] = useState(false);
    const [productOpenNotice, setProductOpenNotice] = useState('');
    const [products, setProducts] = useState<TourProduct[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<TourProduct | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);


    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [featuredFilter, setFeaturedFilter] = useState<string>('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Load from API
    const fetchProducts = async () => {
        try {
            const data = await api.products.list();
            if (Array.isArray(data)) {
                const mappedProducts = data.map(adminProductFromApi);
                setProducts(mappedProducts);
                return mappedProducts;
            }
            return null;
        } catch (error) {
            console.error('Error fetching products:', error);
            return null;
        } finally {
            setProductsLoaded(true);
        }
    };

    const fetchCategories = async () => {
        try {
            const data = await api.categories.list('product');
            if (Array.isArray(data)) {
                setCategories(data.map((c: any) => ({
                    id: c.id,
                    icon: c.icon,
                    name: c.name,
                    description: c.description,
                    isActive: c.is_active ?? true,
                    order: c.sort_order ?? 0,
                    type: c.type || 'product'
                })));
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    useEffect(() => {
        if (!openProductId) {
            const wasDeepLinked = handledOpenProduct.current !== null;
            handledOpenProduct.current = null;
            if (wasDeepLinked) { setIsModalOpen(false); setSelectedProduct(null); }
            return;
        }
        if (!productsLoaded || handledOpenProduct.current === openProductId) return;
        handledOpenProduct.current = openProductId;
        const request = ++editorOpenRequest.current;
        const requestedId = openProductId;
        let active = true;
        void (async () => {
            // Search can navigate within this same mounted page; refresh the server version too.
            const latest = await fetchProducts();
            if (!active || request !== editorOpenRequest.current) return;
            const target = latest?.find(item => item.id === requestedId);
            if (!target) {
                setProductOpenNotice(latest ? '검색한 상품이 없거나 삭제되었습니다. 상품 목록에서 다시 확인해 주세요.' : '상품 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.');
                return;
            }
            setProductOpenNotice('');
            setSelectedProduct(target);
            setIsModalOpen(true);
        })();
        return () => { active = false; };
    }, [openProductId, productsLoaded]);

    const closeProductEditor = () => {
        editorOpenRequest.current += 1;
        setIsModalOpen(false);
        setSelectedProduct(null);
        if (openProductId) {
            const next = new URLSearchParams(searchParams);
            next.delete('open');
            setSearchParams(next, { replace: true });
        }
    };

    const editProduct = async (product: TourProduct) => {
        const request = ++editorOpenRequest.current;
        const latest = await fetchProducts();
        if (request !== editorOpenRequest.current) return;
        const target = latest?.find(item => item.id === product.id);
        if (!latest || !target) {
            setProductOpenNotice(latest ? '이 상품이 삭제되었습니다. 목록을 다시 확인해 주세요.' : '상품의 최신 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.');
            return;
        }
        setProductOpenNotice('');
        setSelectedProduct(target);
        setIsModalOpen(true);
    };

    // Save via API (Upsert)
    const saveProducts = async (updatedProducts: TourProduct[], productToSave?: TourProduct): Promise<boolean> => {
        if (!productToSave) return false;
        try {
            console.log('Sending payload to API:', productToSave);
            const dbPayload = {
                id: productToSave.id,
                name: productToSave.name,
                price: productToSave.price,
                original_price: productToSave.originalPrice,
                duration: productToSave.duration,
                category: productToSave.category,
                main_images: productToSave.mainImages,
                is_popular: productToSave.isPopular,
                tags: productToSave.tags,
                description: productToSave.description,
                gallery_images: productToSave.galleryImages,
                detail_images: productToSave.detailImages,
                itinerary_images: productToSave.itineraryImages,
                detail_slides: productToSave.detailSlides,
                detail_blocks: productToSave.detailBlocks,
                itinerary_blocks: productToSave.itineraryBlocks,
                status: productToSave.status,
                is_featured: productToSave.isFeatured,
                package_type: productToSave.packageType ?? null,
                highlights: productToSave.highlights,
                representative_spots: productToSave.representativeSpots || [],
                included: productToSave.included,
                excluded: productToSave.excluded,
                faqs: productToSave.faqs,
                pricing_options: productToSave.pricingOptions,
                accommodation_options: productToSave.accommodationOptions,
                vehicle_options: productToSave.vehicleOptions,
            };

            // If ID matches an existing one in our list, it's an update. Otherwise, it's a create.
            const isEditing = products.some(p => p.id === productToSave.id);
            console.log('Is editing?', isEditing);

            try {
                if (isEditing) {
                    await api.products.update(productToSave.id, dbPayload);
                } else {
                    await api.products.create(dbPayload);
                }
            } catch (apiError: any) {
                console.error('API call failed:', apiError);
                throw apiError; // Throw up so the outer catch can alert it
            }

            console.log('Save successful, fetching latest products...');
            await fetchProducts();
            return true;
        } catch (error: any) {
            console.error('Failed to save product:', error);
            alert('상품 저장 중 오류가 발생했습니다: ' + (error.message || JSON.stringify(error)));
            return false;
        }
    };

    // Filtered and sorted products
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
            const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
            const matchesFeatured = featuredFilter === 'all' ||
                (featuredFilter === 'featured' && product.isFeatured) ||
                (featuredFilter === 'normal' && !product.isFeatured);

            return matchesSearch && matchesCategory && matchesStatus && matchesFeatured;
        });
    }, [products, searchQuery, categoryFilter, statusFilter, featuredFilter]);

    // Pagination logic... (same)
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Stats
    const stats = useMemo(() => ({
        total: products.length,
        active: products.filter(p => p.status === 'active').length,
        inactive: products.filter(p => p.status === 'inactive').length,
        soldout: products.filter(p => p.status === 'soldout').length,
        featured: products.filter(p => p.isFeatured).length
    }), [products]);

    // Toggle status
    const toggleStatus = async (id: string) => {
        const product = products.find(p => p.id === id);
        if (!product) return;
        const newStatus = product.status === 'active' ? 'inactive' : 'active';
        try {
            await api.products.update(id, { status: newStatus });
            setProducts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
        } catch (e) { console.error(e); }
    };

    // Toggle featured
    const toggleFeatured = async (id: string) => {
        const product = products.find(p => p.id === id);
        if (!product) return;
        const newVal = !product.isFeatured;
        try {
            await api.products.update(id, { is_featured: newVal });
            setProducts(prev => prev.map(p => p.id === id ? { ...p, isFeatured: newVal } : p));
        } catch (e) { console.error(e); }
    };

    // Toggle popular
    const togglePopular = async (id: string) => {
        const product = products.find(p => p.id === id);
        if (!product) return;
        const newVal = !product.isPopular;
        try {
            await api.products.update(id, { is_popular: newVal });
            setProducts(prev => prev.map(p => p.id === id ? { ...p, isPopular: newVal } : p));
        } catch (e) { console.error(e); }
    };

    const deleteProduct = async (id: string) => {
        if (confirm('정말 이 상품을 삭제하시겠습니까?')) {
            try {
                await api.products.delete(id);
                setProducts(prev => prev.filter(p => p.id !== id));
            } catch (error: any) {
                alert('삭제 실패: ' + error.message);
            }
        }
    };

    const duplicateProduct = async (product: TourProduct) => {
        if (confirm(`'${product.name}' 상품을 복제하시겠습니까?`)) {
            const duplicatedProduct: TourProduct = {
                ...product,
                id: `prod-${Date.now()}`,
                name: `${product.name} (복제본)`,
                status: 'inactive',
                isFeatured: false,
                isPopular: false,
                viewCount: 0,
                bookingCount: 0
            };
            
            await saveProducts([], duplicatedProduct);
        }
    };

    // Drag and Drop for Products List
    const [draggedProductIndex, setDraggedProductIndex] = useState<number | null>(null);

    const handleProductDragStart = (e: React.DragEvent, index: number) => {
        setDraggedProductIndex(index);
        // Required for Firefox
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleProductDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (draggedProductIndex === null || draggedProductIndex === index) return;
        
        // When filtering or pagination is active, reordering might be tricky.
        // For simplicity, we'll only allow reordering if we are showing all items or searching.
        // And we'll apply it to the main `products` array.
        const draggedProduct = paginatedProducts[draggedProductIndex];
        const targetProduct = paginatedProducts[index];

        // Find their actual indices in the main `products` array
        const actualDragIndex = products.findIndex(p => p.id === draggedProduct.id);
        const actualTargetIndex = products.findIndex(p => p.id === targetProduct.id);

        if (actualDragIndex === -1 || actualTargetIndex === -1) return;

        const newProducts = [...products];
        // Remove from old position
        newProducts.splice(actualDragIndex, 1);
        // Insert at new position
        newProducts.splice(actualTargetIndex, 0, draggedProduct);
        
        setProducts(newProducts);
        setDraggedProductIndex(index);
    };

    const handleProductDragEnd = async () => {
        setDraggedProductIndex(null);
        
        try {
            // Update the sort_order in the backend based on the current products array order
            const orderData = products.map((p, index) => ({
                id: p.id,
                sortOrder: index
            }));
            
            await api.products.reorder(orderData);
            // Optionally show a toast for successful save
        } catch (error) {
            console.error('Failed to save product order:', error);
            alert('순서 저장에 실패했습니다.');
        }
    };

    const getStatusBadge = (status: string) => {
        const tones = {
            active: 'b-green',
            inactive: 'b-gray',
            soldout: 'b-red'
        };
        const labels = {
            active: '판매중',
            inactive: '비활성',
            soldout: '품절'
        };
        return (
            <span className={`badge ${tones[status as keyof typeof tones]}`}>
                {labels[status as keyof typeof labels]}
            </span>
        );
    };

    // Summary cards double as the status / featured filter (design "04-1 상품 목록").
    const STAT_CARDS: Array<{ key: string; label: string; value: number; icon: DashboardIconName; tone: string }> = [
        { key: 'total', label: '전체 상품', value: stats.total, icon: 'lc-archive', tone: 'mint' },
        { key: 'active', label: '판매중', value: stats.active, icon: 'lc-circle-check', tone: 'green' },
        { key: 'inactive', label: '비활성', value: stats.inactive, icon: 'lc-circle-x', tone: 'gray' },
        { key: 'soldout', label: '품절', value: stats.soldout, icon: 'lc-shopping-cart', tone: 'red' },
        { key: 'featured', label: '추천 상품', value: stats.featured, icon: 'lc-star', tone: 'purple' },
    ];
    const activeCard = featuredFilter === 'featured' ? 'featured' : statusFilter !== 'all' ? statusFilter : featuredFilter === 'all' ? 'total' : '';
    const pickCard = (key: string) => {
        setStatusFilter(['active', 'inactive', 'soldout'].includes(key) ? key : 'all');
        setFeaturedFilter(key === 'featured' ? 'featured' : 'all');
        setCurrentPage(1);
    };
    const categoryChips = [{ value: 'all', label: '전체', count: products.length },
        ...categories.map(cat => ({ value: cat.name, label: cat.name, count: products.filter(p => p.category === cat.name).length }))];
    const maxBookings = Math.max(1, ...products.map(p => Number(p.bookingCount) || 0));
    const statusLabels: Record<string, string> = { active: '판매중', inactive: '비활성', soldout: '품절' };
    const clearFilters = () => { setSearchQuery(''); setCategoryFilter('all'); setStatusFilter('all'); setFeaturedFilter('all'); setCurrentPage(1); };

    return (
        <AdminLayout
            activePage="products"
            title={isModalOpen ? (selectedProduct ? '상품 수정' : '상품 추가') : '상품 목록'}
            description={isModalOpen ? undefined : '판매 상태와 추천 노출을 한 화면에서 관리해요.'}
            actions={!isModalOpen && (
                <button
                    className="btn btn-ink"
                    onClick={() => {
                        setSelectedProduct(null);
                        setIsModalOpen(true);
                    }}
                >
                    <Icon name="add" />상품 추가
                </button>
            )}
        >
            {productOpenNotice && <div className="card-pad" role="status" style={{ background: '#fff5e8', borderRadius: 12, marginBottom: 16 }}>{productOpenNotice}</div>}
            <div className="route-anim" style={{ display: isModalOpen ? 'none' : undefined }}>
                <div className="pd-list">
                <div className="pd-kpis">
                    {STAT_CARDS.map(card => (
                        <button key={card.key} type="button" className={`pd-kpi${activeCard === card.key ? ' is-active' : ''}`} aria-pressed={activeCard === card.key} onClick={() => pickCard(card.key)}>
                            <span className="pd-kpi-icon" data-tone={card.tone}><DashboardIcon name={card.icon} size={18} /></span>
                            <span><span className="pd-kpi-label">{card.label}</span><strong>{card.value}</strong></span>
                        </button>
                    ))}
                </div>

                <section className="pd-card" aria-label="상품 목록">
                    <div className="pd-toolbar">
                        <label className="pd-search">
                            <DashboardIcon name="lc-search" size={16} />
                            <input type="text" aria-label="상품명 검색" placeholder="상품명 검색" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
                        </label>
                        <div className="pd-chips" role="group" aria-label="카테고리">
                            {categoryChips.map(chip => (
                                <button key={chip.value} type="button" className={categoryFilter === chip.value ? 'is-active' : ''} aria-pressed={categoryFilter === chip.value} onClick={() => { setCategoryFilter(chip.value); setCurrentPage(1); }}>
                                    {chip.label}<span>{chip.count}</span>
                                </button>
                            ))}
                        </div>
                        <span className="pd-count"><b>{filteredProducts.length}</b>개 상품</span>
                    </div>
                    <div className="pd-table-wrap">
                        <table className="pd-table">
                            <thead>
                                <tr>
                                    <th>상품</th>
                                    <th>카테고리</th>
                                    <th>기간</th>
                                    <th className="r">가격 (1인~)</th>
                                    <th>상태</th>
                                    <th>추천 · 인기</th>
                                    <th>조회 / 예약</th>
                                    <th className="r">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedProducts.map((product, index) => {
                                    const price = typeof product.price === 'number' ? product.price : Number(product.price) || 0;
                                    const original = typeof product.originalPrice === 'number' ? product.originalPrice : Number(product.originalPrice) || 0;
                                    const bookings = Number(product.bookingCount) || 0;
                                    return <tr
                                        key={product.id}
                                        draggable
                                        onDragStart={(e) => handleProductDragStart(e, index)}
                                        onDragOver={(e) => handleProductDragOver(e, index)}
                                        onDrop={handleProductDragEnd}
                                        onDragEnd={handleProductDragEnd}
                                        className={draggedProductIndex === index ? 'is-dragging' : undefined}
                                    >
                                        <td>
                                            <div className="pd-product">
                                                <span className="pd-grip" title="끌어서 순서 변경"><DashboardIcon name="lc-grip-vertical" size={16} /></span>
                                                <span className="pd-thumb">
                                                    {product.mainImages?.[0]
                                                        ? <img src={getOptimizedImageUrl(product.mainImages[0], 'productThumbnail')} alt={product.name} />
                                                        : product.name.replace('은하수 ', '').slice(0, 1)}
                                                </span>
                                                <span className="pd-name">
                                                    <b>{product.name}</b>
                                                    <small>{product.isPopular ? <em>인기</em> : null}{product.id}</small>
                                                </span>
                                            </div>
                                        </td>
                                        <td className="pd-muted">{product.category}</td>
                                        <td className="pd-dur">{product.duration}</td>
                                        <td className="r">
                                            <span className="pd-price">{price ? `${price.toLocaleString('ko-KR')}원` : '미정'}</span>
                                            {original ? <s className="pd-original">{original.toLocaleString('ko-KR')}원</s> : null}
                                        </td>
                                        <td>
                                            <button type="button" className="pd-status" data-status={product.status} title="눌러서 판매중 / 비활성 전환" onClick={() => toggleStatus(product.id)}>
                                                {statusLabels[product.status] || product.status}
                                            </button>
                                        </td>
                                        <td>
                                            <span className="pd-flags">
                                                <button type="button" className={`pd-flag${product.isFeatured ? ' is-on' : ''}`} data-flag="featured" aria-pressed={!!product.isFeatured} aria-label={`${product.name} 추천`} title="추천" onClick={() => toggleFeatured(product.id)}><DashboardIcon name="lc-star" size={16} /></button>
                                                <button type="button" className={`pd-flag${product.isPopular ? ' is-on' : ''}`} data-flag="popular" aria-pressed={!!product.isPopular} aria-label={`${product.name} 인기`} title="인기" onClick={() => togglePopular(product.id)}><DashboardIcon name="lc-heart" size={16} /></button>
                                            </span>
                                        </td>
                                        <td>
                                            <span className="pd-stats">
                                                <span><b>{(Number(product.viewCount) || 0).toLocaleString('ko-KR')}</b> · 예약 <b>{bookings}</b></span>
                                                <span className="pd-bar"><span style={{ width: `${bookings / maxBookings * 100}%` }} /></span>
                                            </span>
                                        </td>
                                        <td className="r">
                                            <span className="pd-actions">
                                                <button type="button" aria-label={`${product.name} 수정`} title="수정" onClick={() => { void editProduct(product); }}><DashboardIcon name="lc-pencil" size={16} /></button>
                                                <button type="button" aria-label={`${product.name} 복제`} title="복제" onClick={() => duplicateProduct(product)}><DashboardIcon name="lc-copy" size={16} /></button>
                                                <button type="button" className="is-danger" aria-label={`${product.name} 삭제`} title="삭제" onClick={() => deleteProduct(product.id)}><DashboardIcon name="lc-trash" size={16} /></button>
                                            </span>
                                        </td>
                                    </tr>;
                                })}
                            </tbody>
                        </table>
                        {paginatedProducts.length === 0 && (
                            <div className="pd-empty">
                                <DashboardIcon name="lc-archive" size={28} />
                                <p>조건에 맞는 상품이 없어요.</p>
                                <button type="button" onClick={clearFilters}>필터 지우기</button>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)' }}>
                            <p className="cell-muted" style={{ fontSize: 13 }}>
                                총 {filteredProducts.length}개 상품 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredProducts.length)}개 표시
                            </p>
                            <div className="row" style={{ gap: 6 }}>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="btn btn-ghost btn-sm"
                                >
                                    이전
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`btn btn-sm ${page === currentPage ? 'btn-ink' : 'btn-ghost'}`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="btn btn-ghost btn-sm"
                                >
                                    다음
                                </button>
                            </div>
                        </div>
                    )}
                </section>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <ProductModal
                    key={`${user?.id || 'unverified'}:${selectedProduct?.id || 'new'}`}
                    adminUserId={userLoading ? null : user?.id || null}
                    product={selectedProduct}
                    categories={categories}
                    onClose={closeProductEditor}
                    onSave={async (product) => {
                        let success = false;
                        if (selectedProduct) {
                            // Edit existing
                            // We don't need full list update here, just pass the product to save
                            success = await saveProducts([], product);
                        } else {
                            // Add new
                            const newProduct = {
                                ...product,
                                id: `prod-${Date.now()}`, // Or let DB generate UUID if preferred, but existing logic uses text ID
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                viewCount: 0,
                                bookingCount: 0
                            };
                            success = await saveProducts([], newProduct);
                        }

                        return success;
                    }}
                />
            )}
        </AdminLayout>
    );
};

// Product Modal Component
interface ProductModalProps {
    product: TourProduct | null;
    categories: Category[];
    onClose: () => void;
    onSave: (product: TourProduct) => Promise<boolean>;
    adminUserId?: string | null;
}

/** 예전 골격이 저장한 후리가나 붙은 라벨('1日目（いちにちめ）')에서 괄호를 뗀다 — 폼에 올릴 때 한 번 정리 */
const cleanDayLabels = (p: TourProduct): TourProduct => ({
    ...p,
    itineraryBlocks: (p.itineraryBlocks || []).map(b => {
        if (b.type !== 'dayInfo') return b;
        const c = b.content as DayInfoContent;
        const label = stripDayLabelReading(c.dayLabel);
        return label === c.dayLabel ? b : { ...b, content: { ...c, dayLabel: label } };
    }),
});

export const ProductModal: React.FC<ProductModalProps> = ({ product, categories, onClose, onSave, adminUserId = null }) => {
    const [formData, setFormDataState] = useState<Partial<TourProduct>>(() =>
        product ? structuredClone(cleanDayLabels(product)) : {
            name: '',
            category: categories.length > 0 ? categories[0].name : '',
            duration: '',
            price: 0,
            originalPrice: 0,
            mainImages: [],
            galleryImages: [],
            detailImages: [],
            detailSlides: [],
            detailBlocks: [],
            itineraryBlocks: [],
            status: 'active',
            isFeatured: false,
            isPopular: false,
            tags: [],
            highlights: [],
            representativeSpots: [],
            included: [],
            excluded: [],
            faqs: [],
            pricingOptions: [],
            accommodationOptions: [],
            vehicleOptions: []
        }
    );

    const formRef = useRef(formData);
    const [initialBaseline] = useState(() => structuredClone(formData));
    const baselineRef = useRef(initialBaseline);
    const mountedRef = useRef(true);
    const savedRef = useRef(false);
    const savingRef = useRef(false);
    const uploadsRef = useRef(0);
    const designUploadsRef = useRef(new Set<string>());
    const scopeRef = useRef<AdminProductDraftScope | null>(null);
    const draftReadyRef = useRef(false);
    const pendingDraftRef = useRef(false);
    const closingRef = useRef(false);
    const approvedExternalNavigation = useRef(false);
    const navigationDecisionRef = useRef<AdminProductNavigationDecision>({ blocked: false });
    const handledBlockedAttempt = useRef<string | null>(null);
    const lastStoredFingerprint = useRef('');
    const [saving, setSaving] = useState(false);
    const [uploadCount, setUploadCount] = useState(0);
    const [designUploading, setDesignUploading] = useState(false);
    const [draftReady, setDraftReady] = useState(false);
    const [pendingDraft, setPendingDraft] = useState<{ draft: AdminProductDraft; conflict: boolean } | null>(null);
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
    const [draftError, setDraftError] = useState('');
    const [saveNotice, setSaveNotice] = useState('');
    const fingerprint = useMemo(() => productDraftFingerprint(formData), [formData]);
    const dirty = fingerprint !== productDraftFingerprint(baselineRef.current);

    // Update the ref synchronously so a navigation in the same turn flushes the latest input.
    const setFormData = useCallback<React.Dispatch<React.SetStateAction<Partial<TourProduct>>>>(next => {
        const value = updateAdminProductEditorForm(formRef, { mounted: mountedRef.current, saving: savingRef.current, saved: savedRef.current }, next);
        if (value) setFormDataState(value);
    }, []);

    const flushDraft = useCallback((notify = true): DraftResult => {
        if (savedRef.current || pendingDraftRef.current || !draftReadyRef.current) return { ok: true };
        const scope = scopeRef.current;
        if (!scope) return { ok: false, error: '관리자 계정을 확인할 수 없어 초안을 보관하지 못했습니다.' };
        const current = productDraftFingerprint(formRef.current);
        if (current === productDraftFingerprint(baselineRef.current) || current === lastStoredFingerprint.current) return { ok: true };
        let result: DraftResult & { savedAt?: string };
        try { result = writeAdminProductDraft(window.localStorage, scope, baselineRef.current, formRef.current); }
        catch { result = { ok: false, error: '브라우저 저장소를 사용할 수 없어 초안을 보관하지 못했습니다.' }; }
        if (result.ok) {
            lastStoredFingerprint.current = current;
            if (notify && mountedRef.current) { setDraftSavedAt(result.savedAt || null); setDraftError(''); }
        } else if (notify && mountedRef.current) setDraftError(result.error);
        return result;
    }, []);

    useEffect(() => {
        if (!adminUserId || scopeRef.current) return;
        const scope = { userId: adminUserId, productId: product?.id || null };
        scopeRef.current = scope;
        let loaded: ReturnType<typeof readAdminProductDraft>;
        try { loaded = readAdminProductDraft(window.localStorage, scope, baselineRef.current); }
        catch { loaded = { kind: 'error', error: '브라우저 저장소를 사용할 수 없어 초안을 보관하지 못했습니다.' }; }
        if (loaded.kind === 'draft') {
            pendingDraftRef.current = true;
            setPendingDraft({ draft: loaded.draft, conflict: loaded.conflict });
            setDraftSavedAt(loaded.draft.savedAt);
        } else if (loaded.kind === 'error') setDraftError(loaded.error);
        draftReadyRef.current = true;
        setDraftReady(true);
    }, [adminUserId, product?.id]);

    useEffect(() => {
        if (!dirty || !draftReady || pendingDraft || saving) return;
        const timer = window.setTimeout(() => flushDraft(), 650);
        return () => window.clearTimeout(timer);
    }, [fingerprint, dirty, draftReady, pendingDraft, saving, flushDraft]);

    const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => {
        if (closingRef.current || savedRef.current) return false;
        const busy = savingRef.current || uploadsRef.current > 0 || designUploadsRef.current.size > 0;
        const decision = adminProductNavigationDecision(currentLocation, nextLocation, busy, flushDraft);
        navigationDecisionRef.current = decision;
        return decision.blocked;
    }, [flushDraft]));

    useEffect(() => {
        if (blocker.state === 'unblocked') { handledBlockedAttempt.current = null; return; }
        if (blocker.state !== 'blocked') return;
        const attempt = blocker.location.key + blocker.location.pathname + blocker.location.search;
        if (handledBlockedAttempt.current === attempt) return;
        handledBlockedAttempt.current = attempt;
        const decision = navigationDecisionRef.current;
        if (savingRef.current || uploadsRef.current > 0 || designUploadsRef.current.size > 0 || (decision.blocked && decision.reason === 'busy')) {
            setSaveNotice('저장 또는 사진 업로드가 끝난 뒤 다른 메뉴로 이동해 주세요.');
            blocker.reset();
            return;
        }
        if (decision.blocked && decision.reason === 'draft_storage_failure') {
            if (window.confirm(decision.error + '\n\n초안을 보관하지 못한 상태로 이동할까요?')) blocker.proceed();
            else blocker.reset();
        } else blocker.proceed();
    }, [blocker]);

    useEffect(() => {
        mountedRef.current = true;
        const isBusy = () => savingRef.current || uploadsRef.current > 0 || designUploadsRef.current.size > 0;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            const result = flushDraft(false);
            const alreadyApproved = approvedExternalNavigation.current;
            approvedExternalNavigation.current = false;
            if (isBusy() || (!result.ok && !alreadyApproved)) { event.preventDefault(); event.returnValue = ''; }
        };
        const pageHide = () => { flushDraft(false); };
        const beforeNavigate = (event: MouseEvent) => {
            if (event.defaultPrevented || !(event.target instanceof Element)) return;
            const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
            if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.getAttribute('href')?.startsWith('#')) return;
            // Internal SPA navigation is handled by useBlocker; native same-origin exits by beforeunload.
            if (!['http:', 'https:'].includes(anchor.protocol) || anchor.origin === window.location.origin) return;
            if (isBusy()) {
                event.preventDefault(); event.stopPropagation();
                setSaveNotice('저장 또는 사진 업로드가 끝난 뒤 다른 메뉴로 이동해 주세요.');
                return;
            }
            const result = flushDraft();
            if (!result.ok && !window.confirm(result.error + '\n\n초안을 보관하지 못한 상태로 이동할까요?')) {
                event.preventDefault(); event.stopPropagation();
            } else approvedExternalNavigation.current = true;
        };
        window.addEventListener('beforeunload', beforeUnload);
        window.addEventListener('pagehide', pageHide);
        document.addEventListener('click', beforeNavigate, true);
        return () => {
            flushDraft(false);
            mountedRef.current = false;
            window.removeEventListener('beforeunload', beforeUnload);
            window.removeEventListener('pagehide', pageHide);
            document.removeEventListener('click', beforeNavigate, true);
        };
    }, [flushDraft]);

    const uploadImage = async (file: File, folder?: string) => {
        if (savingRef.current || savedRef.current) throw new Error('상품 저장 중에는 사진을 변경할 수 없습니다.');
        uploadsRef.current += 1;
        if (mountedRef.current) setUploadCount(uploadsRef.current);
        try { return await uploadProductImage(file, folder); }
        finally {
            uploadsRef.current -= 1;
            if (mountedRef.current) setUploadCount(uploadsRef.current);
        }
    };

    const reportDesignBusy = (id: string, busy: boolean) => {
        if (busy) designUploadsRef.current.add(id);
        else designUploadsRef.current.delete(id);
        if (mountedRef.current) setDesignUploading(designUploadsRef.current.size > 0);
    };

    const restoreDraft = () => {
        if (!pendingDraft || savingRef.current) return;
        const base = baselineRef.current;
        const restored = { ...structuredClone(base), ...structuredClone(pendingDraft.draft.form), id: base.id, createdAt: base.createdAt, updatedAt: base.updatedAt, viewCount: base.viewCount, bookingCount: base.bookingCount };
        lastStoredFingerprint.current = productDraftFingerprint(restored);
        pendingDraftRef.current = false;
        setPendingDraft(null);
        setFormData(restored);
        setSaveNotice('보관된 초안을 복원했습니다. 상품 저장 버튼을 눌러야 공개 상품에 반영됩니다.');
    };

    const discardDraft = () => {
        if (!scopeRef.current || savingRef.current) return;
        let result: DraftResult;
        try { result = removeAdminProductDraft(window.localStorage, scopeRef.current); }
        catch { result = { ok: false, error: '브라우저 저장소에서 초안을 삭제하지 못했습니다.' }; }
        if (!result.ok) { setDraftError(result.error); return; }
        pendingDraftRef.current = false;
        setPendingDraft(null);
        setDraftSavedAt(null);
        setDraftError('');
        lastStoredFingerprint.current = '';
        setSaveNotice('보관된 초안을 버렸습니다. 현재 서버에 저장된 상품으로 시작합니다.');
    };

    const closeEditor = () => {
        if (savingRef.current || uploadsRef.current > 0 || designUploadsRef.current.size > 0) {
            setSaveNotice('저장 또는 사진 업로드가 끝난 뒤 편집을 닫아 주세요.');
            return;
        }
        const result = flushDraft();
        if (!result.ok && !window.confirm(result.error + '\n\n초안을 보관하지 못한 상태로 편집을 닫을까요?')) return;
        closingRef.current = true;
        onClose();
    };

    const [currentTab, setCurrentTab] = useState<'basic' | 'details' | 'itinerary' | 'spots' | 'options' | 'includes'>('basic');

    // 페이지형 편집 화면 — 목록에서 진입할 때 스크롤을 맨 위로
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    // Drag and Drop state
    const [draggedDetailIndex, setDraggedDetailIndex] = useState<number | null>(null);

    // Handlers
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (savingRef.current || uploadsRef.current > 0 || designUploadsRef.current.size > 0 || !draftReadyRef.current || pendingDraftRef.current || savedRef.current) return;

        // Validate required fields
        if (!formData.name || !formData.name.trim()) {
            alert('상품명을 입력해주세요.');
            return;
        }
        if (!formData.category) {
            alert('카테고리를 선택해주세요.');
            return;
        }
        if (!formData.duration || !formData.duration.trim()) {
            alert('기간을 입력해주세요.');
            return;
        }
        if (!formData.price || formData.price <= 0) {
            alert('판매가를 입력해주세요.');
            return;
        }

        await runAdminProductSaveOnce(savingRef, async () => {
            flushDraft();
            setSaving(true);
            setSaveNotice('상품을 저장하고 있습니다.');
            try {
                const success = await onSave(formRef.current as TourProduct);
                if (!success) {
                    flushDraft();
                    if (mountedRef.current) setSaveNotice('상품을 저장하지 못했습니다. 작성한 내용은 유지되며 다시 저장할 수 있습니다.');
                    return;
                }
                // Mark success before any close/unmount flush can recreate the deleted draft.
                savedRef.current = true;
                baselineRef.current = structuredClone(formRef.current);
                let cleared: DraftResult = { ok: true };
                try { if (scopeRef.current) cleared = finishAdminProductSave(window.localStorage, scopeRef.current, true); }
                catch { cleared = { ok: false, error: '상품은 저장됐지만 브라우저의 초안을 삭제하지 못했습니다.' }; }
                if (!cleared.ok) {
                    if (mountedRef.current) { setDraftError(cleared.error); setSaveNotice('상품 저장 완료. 이전 초안은 초안 버리기로 정리해 주세요.'); }
                } else if (mountedRef.current) onClose();
            } catch (error) {
                flushDraft();
                if (mountedRef.current) setSaveNotice('상품 저장에 실패했습니다. 작성한 내용은 유지됩니다. ' + (error instanceof Error ? error.message : '다시 시도해 주세요.'));
            } finally {
                if (mountedRef.current) setSaving(false);
            }
        });
    };

    const addHighlight = () => {
        setFormData({
            ...formData,
            highlights: [...(formData.highlights || []), { icon: 'star', title: '', description: '' }]
        });
    };

    const updateHighlight = (index: number, field: string, value: string) => {
        const updated = [...(formData.highlights || [])];
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, highlights: updated });
    };

    const removeHighlight = (index: number) => {
        setFormData({
            ...formData,
            highlights: formData.highlights?.filter((_, i) => i !== index)
        });
    };

    // FAQ Handlers — per-product Q&A list. When empty the frontend falls
    // back to the site-wide common FAQs.
    const addFAQ = () => {
        setFormData({
            ...formData,
            faqs: [...(formData.faqs || []), { q: '', a: '' }],
        });
    };
    const updateFAQ = (index: number, field: 'q' | 'a', value: string) => {
        const updated = [...(formData.faqs || [])];
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, faqs: updated });
    };
    const removeFAQ = (index: number) => {
        setFormData({
            ...formData,
            faqs: formData.faqs?.filter((_, i) => i !== index),
        });
    };

    // Pricing Option Handlers
    const addPricingOption = () => {
        setFormData({
            ...formData,
            pricingOptions: [...(formData.pricingOptions || []), { people: 2, pricePerPerson: 0, depositPerPerson: 0, localPaymentPerPerson: 0 }]
        });
    };
    const updatePricingOption = (index: number, field: keyof TourPricingOption, value: number) => {
        const updated = [...(formData.pricingOptions || [])];
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, pricingOptions: updated });
    };
    const removePricingOption = (index: number) => {
        setFormData({
            ...formData,
            pricingOptions: formData.pricingOptions?.filter((_, i) => i !== index)
        });
    };

    // Accommodation Option Handlers
    const addAccommodationOption = () => {
        setFormData({
            ...formData,
            accommodationOptions: [...(formData.accommodationOptions || []), {
                id: `acc-${Date.now()}`,
                name: '',
                description: '',
                priceModifier: 0,
                isDefault: (formData.accommodationOptions?.length || 0) === 0
            }]
        });
    };
    const updateAccommodationOption = (index: number, field: keyof AccommodationOption, value: any) => {
        const updated = [...(formData.accommodationOptions || [])];
        updated[index] = { ...updated[index], [field]: value };

        // Handle default selection logic (radio behavior)
        if (field === 'isDefault' && value === true) {
            updated.forEach((opt, i) => {
                if (i !== index) opt.isDefault = false;
            });
        }

        setFormData({ ...formData, accommodationOptions: updated });
    };
    const removeAccommodationOption = (index: number) => {
        setFormData({
            ...formData,
            accommodationOptions: formData.accommodationOptions?.filter((_, i) => i !== index)
        });
    };

    // Vehicle Option Handlers
    const addVehicleOption = () => {
        setFormData({
            ...formData,
            vehicleOptions: [...(formData.vehicleOptions || []), {
                id: `veh-${Date.now()}`,
                name: '',
                description: '',
                priceModifier: 0,
                isDefault: (formData.vehicleOptions?.length || 0) === 0
            }]
        });
    };
    const updateVehicleOption = (index: number, field: keyof VehicleOption, value: any) => {
        const updated = [...(formData.vehicleOptions || [])];
        updated[index] = { ...updated[index], [field]: value };

        // Handle default selection logic
        if (field === 'isDefault' && value === true) {
            updated.forEach((opt, i) => {
                if (i !== index) opt.isDefault = false;
            });
        }

        setFormData({ ...formData, vehicleOptions: updated });
    };
    const removeVehicleOption = (index: number) => {
        setFormData({
            ...formData,
            vehicleOptions: formData.vehicleOptions?.filter((_, i) => i !== index)
        });
    };

    // Detail Block Handlers
    const addDetailBlock = (type: 'image' | 'slide' | 'divider' | 'timeline' | 'dayInfo' | 'design', dayLabel?: string, templateId?: string) => {
        let content: any = '';

        if (type === 'design') {
            content = {
                templateId: templateId || designTemplates[0]?.id || '',
                values: {}
            };
        } else if (type === 'slide') {
            content = {
                id: `slide-${Date.now()}`,
                type: 'day',
                dayLabel: '',
                title: '',
                description: '',
                images: []
            };
        } else if (type === 'divider') {
            content = {
                style: 'space',
                height: 40
            };
        } else if (type === 'timeline') {
            content = {
                id: `timeline-${Date.now()}`,
                time: '',
                title: '',
                description: '',
                images: []
            };
        } else if (type === 'dayInfo') {
            content = {
                id: `dayinfo-${Date.now()}`,
                dayLabel: dayLabel || '',
                dayDate: '',
                title: '',
                description: '',
                meals: { breakfast: '', lunch: '', dinner: '' },
                accommodation: ''
            };
        }

        const newBlock: DetailContentBlock = {
            id: `block-${Date.now()}-${Math.random()}`,
            type,
            content
        };
        setFormData({
            ...formData,
            detailBlocks: [...(formData.detailBlocks || []), newBlock]
        });
    };

    const removeDetailBlock = (index: number) => {
        setFormData({
            ...formData,
            detailBlocks: formData.detailBlocks?.filter((_, i) => i !== index)
        });
    };

    const moveDetailBlock = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= (formData.detailBlocks?.length || 0)) return;
        const blocks = [...(formData.detailBlocks || [])];
        const [moved] = blocks.splice(fromIndex, 1);
        blocks.splice(toIndex, 0, moved);
        setFormData({ ...formData, detailBlocks: blocks });
    };

    const updateBlockContent = (index: number, content: any) => {
        const blocks = [...(formData.detailBlocks || [])];
        blocks[index] = { ...blocks[index], content };
        setFormData({ ...formData, detailBlocks: blocks });
    };

    const updateSlideInBlock = (blockIndex: number, field: string, value: any) => {
        const blocks = [...(formData.detailBlocks || [])];
        const block = blocks[blockIndex];
        if (block.type !== 'slide') return;
        const slide = block.content as DetailSlide;
        const updatedSlide = { ...slide, [field]: value };
        blocks[blockIndex] = { ...block, content: updatedSlide };
        setFormData({ ...formData, detailBlocks: blocks });
    };

    const handleBlockImageUpload = async (index: number, file: File) => {
        try {
            const url = await uploadImage(file, 'product-details'); // Upload to Storage
            updateBlockContent(index, url);
        } catch (error) {
            console.error('Block image upload failed:', error);
            alert('이미지 업로드 실패');
        }
    };

    const handleSlideBlockImages = async (blockIndex: number, files: FileList | null) => {
        if (!files) return;

        try {
            const uploadPromises = Array.from(files).map(file => uploadImage(file, 'product-slides'));
            const urls = await Promise.all(uploadPromises);

            const block = formData.detailBlocks?.[blockIndex];
            if (block && block.type === 'slide') {
                const currentSlide = block.content as DetailSlide;
                const updatedSlide = {
                    ...currentSlide,
                    images: [...currentSlide.images, ...urls]
                };
                /* Actually let's just manually update here for clarity */
                const blocks = [...(formData.detailBlocks || [])];
                blocks[blockIndex] = { ...block, content: updatedSlide };
                setFormData({ ...formData, detailBlocks: blocks });
            }
        } catch (error) {
            console.error('Slide images upload failed:', error);
            alert('이미지 업로드 실패');
        }
    };

    const removeSlideBlockImage = (blockIndex: number, imgIndex: number) => {
        const blocks = [...(formData.detailBlocks || [])];
        const block = blocks[blockIndex];
        if (block.type !== 'slide') return;
        const slide = block.content as DetailSlide;
        const newSlide = { ...slide, images: slide.images.filter((_, i) => i !== imgIndex) };
        blocks[blockIndex] = { ...block, content: newSlide };
        setFormData({ ...formData, detailBlocks: blocks });
    };


    // ─── Hotel picker — works for both dayInfo (숙소) and timeline (일정 항목) ─
    // Target type lets the picker know which block to update on selection.
    const [hotelPickerTarget, setHotelPickerTarget] = useState<
        { kind: 'dayInfoAccommodation' | 'timeline'; index: number } | null
    >(null);
    const handleHotelPick = (hotel: Hotel) => {
        if (!hotelPickerTarget) return;
        const { kind, index } = hotelPickerTarget;
        const block = formData.itineraryBlocks?.[index];
        if (!block) {
            setHotelPickerTarget(null);
            return;
        }

        if (kind === 'dayInfoAccommodation' && block.type === 'dayInfo') {
            // Snapshot the full hotel record so the user-facing page can render
            // photo grid + description even if the master row is later edited
            // or deleted.
            updateItineraryBlockContent(index, {
                ...(block.content as DayInfoContent),
                accommodation: hotel.name_kr,
                accommodationHotelId: hotel.id,
                accommodationImages: hotel.images && hotel.images.length > 0 ? [...hotel.images] : [],
                accommodationDescription: hotel.description || '',
                accommodationAddress: hotel.address || '',
                accommodationSubtitle: hotel.name_local || '',
                accommodationAmenities: hotel.amenities && hotel.amenities.length > 0 ? [...hotel.amenities] : [],
            });
        } else if (kind === 'timeline' && block.type === 'timeline') {
            // For a TIMELINE block: push hotel data into title + description + images.
            // This is the "hotel as a timeline event" flow (e.g., 호텔 체크인).
            const current = block.content as TimelineContent;
            const hotelDesc = [hotel.description, hotel.address].filter(Boolean).join('\n\n');
            updateItineraryBlockContent(index, {
                ...current,
                title: hotel.name_kr,
                description: hotelDesc || current.description,
                images: hotel.images && hotel.images.length > 0 ? [...hotel.images] : current.images,
            });
        }
        setHotelPickerTarget(null);
    };

    // ─── Tourist spot picker — only opens from TIMELINE blocks ─────────
    const [spotPickerForIndex, setSpotPickerForIndex] = useState<number | null>(null);

    // 「일정표 불러오기」 — 다른 상품의 일차들을 복제해 현재 상품에 넣는다 (일차 번호는 다시 매김)
    const [itineraryImportOpen, setItineraryImportOpen] = useState(false);
    const importItineraryFrom = (src: ItinerarySource) => {
        const current = formData.itineraryBlocks || [];
        const currentImages = formData.itineraryImages || [];
        let replace = true;
        if (current.length > 0 || currentImages.length > 0) {
            replace = window.confirm(`「${src.name}」의 일정표를 불러옵니다.\n\n확인: 지금 일정표를 지우고 교체\n취소: 지금 일정표 뒤에 이어 붙이기`);
        }
        const cloned = cloneItineraryBlocks(src.blocks);
        setFormData({
            ...formData,
            itineraryBlocks: renumberDayLabels(replace ? cloned : [...current, ...cloned]),
            itineraryImages: replace ? [...src.images] : [...currentImages, ...src.images],
        });
        setItineraryImportOpen(false);
    };
    const handleSpotPick = (spot: TouristSpot) => {
        if (spotPickerForIndex == null) return;
        const block = formData.itineraryBlocks?.[spotPickerForIndex];
        if (block && block.type === 'timeline') {
            const current = block.content as TimelineContent;
            const desc = [spot.description, spot.address].filter(Boolean).join('\n\n');
            updateItineraryBlockContent(spotPickerForIndex, {
                ...current,
                title: spot.name_kr,
                description: desc || current.description,
                images: spot.images && spot.images.length > 0 ? [...spot.images] : current.images,
            });
        }
        setSpotPickerForIndex(null);
    };

    // Backwards-compat helper for the existing dayInfo button.
    const setHotelPickerForIndex = (index: number | null) => {
        if (index == null) setHotelPickerTarget(null);
        else setHotelPickerTarget({ kind: 'dayInfoAccommodation', index });
    };

    // ─── Bulk image upload (drag&drop multi-file) ─────────────────────
    // Uploads all files in parallel and appends one image block per file.
    // Lets the admin drop 20 photos at once instead of clicking "이미지 추가"
    // → empty box → file picker for each one.
    const [itineraryBulkUploading, setItineraryBulkUploading] = useState(false);
    const [itineraryBulkProgress, setItineraryBulkProgress] = useState<{ done: number; total: number } | null>(null);
    // Day-based itinerary editor UI state: which day cards are collapsed / showing the advanced menu.
    const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
    const [advancedDays, setAdvancedDays] = useState<Set<string>>(new Set());
    const bulkAddItineraryImages = async (files: File[]) => {
        if (files.length === 0) return;
        setItineraryBulkUploading(true);
        setItineraryBulkProgress({ done: 0, total: files.length });
        try {
            // Upload all files. Track progress as each resolves so admin sees
            // "5/20 업로드 중..." instead of just spinning indefinitely.
            let done = 0;
            const urls = await Promise.all(
                files.map((f) =>
                    uploadImage(f, 'product-details').then((url) => {
                        done += 1;
                        setItineraryBulkProgress({ done, total: files.length });
                        return url;
                    })
                )
            );
            const stamp = Date.now();
            const newBlocks: DetailContentBlock[] = urls.map((url, i) => ({
                id: `block-${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}`,
                type: 'image',
                content: url,
            }));
            setFormData((prev) => ({
                ...prev,
                itineraryBlocks: [...(prev.itineraryBlocks || []), ...newBlocks],
            }));
        } catch (e) {
            console.error('Bulk itinerary image upload failed:', e);
            alert('이미지 업로드 중 일부가 실패했습니다.');
        } finally {
            setItineraryBulkUploading(false);
            setItineraryBulkProgress(null);
        }
    };

    // ─── N-day skeleton generator ────────────────────────────────────
    // One click → creates N dayInfo blocks (1일차 … N일차) with dividers
    // between them. Admin then just fills in titles / descriptions per day.
    const DAY_LABELS_JP = [
        '1일차', '2일차', '3일차',
        '4일차', '5일차', '6일차',
        '7일차', '8일차', '9일차',
        '10일차',
    ];
    const addDaysSkeleton = (days: number) => {
        if (!Number.isFinite(days) || days < 1) return;
        const capped = Math.min(14, Math.max(1, Math.floor(days)));
        const stamp = Date.now();
        const newBlocks: DetailContentBlock[] = [];
        for (let i = 0; i < capped; i++) {
            newBlocks.push({
                id: `block-${stamp}-d${i}-info`,
                type: 'dayInfo',
                content: {
                    id: `dayinfo-${stamp}-${i}`,
                    dayLabel: DAY_LABELS_JP[i] || `${i + 1}일차`,
                    dayDate: '',
                    title: '',
                    description: '',
                    meals: { breakfast: '', lunch: '', dinner: '' },
                    accommodation: '',
                },
            });
            if (i < capped - 1) {
                newBlocks.push({
                    id: `block-${stamp}-d${i}-divider`,
                    type: 'divider',
                    content: { style: 'space', height: 40 },
                });
            }
        }
        // Prepend day-skeleton blocks before any existing content. This way if
        // the admin already added timeline events without dayInfo, those events
        // fall under the new day 1 (the frontend groups by dayInfo order).
        setFormData((prev) => {
            const existing = prev.itineraryBlocks || [];
            const hasAnyDayInfo = existing.some((b) => b.type === 'dayInfo');
            if (!hasAnyDayInfo) {
                return { ...prev, itineraryBlocks: [...newBlocks, ...existing] };
            }
            return { ...prev, itineraryBlocks: [...existing, ...newBlocks] };
        });
    };

    // Itinerary Block Handlers (same as Detail Block but for itinerary)
    const addItineraryBlock = (type: 'image' | 'slide' | 'divider' | 'timeline' | 'dayInfo', dayLabel?: string) => {
        let content: any = '';

        if (type === 'slide') {
            content = {
                id: `slide-${Date.now()}`,
                type: 'day',
                dayLabel: '',
                title: '',
                description: '',
                images: []
            };
        } else if (type === 'divider') {
            content = {
                style: 'space',
                height: 40
            };
        } else if (type === 'timeline') {
            content = {
                id: `timeline-${Date.now()}`,
                time: '',
                title: '',
                description: '',
                images: []
            };
        } else if (type === 'dayInfo') {
            content = {
                id: `dayinfo-${Date.now()}`,
                dayLabel: dayLabel || '',
                dayDate: '',
                title: '',
                description: '',
                meals: { breakfast: '', lunch: '', dinner: '' },
                accommodation: ''
            };
        }

        const newBlock: DetailContentBlock = {
            id: `block-${Date.now()}-${Math.random()}`,
            type,
            content
        };
        setFormData({
            ...formData,
            itineraryBlocks: [...(formData.itineraryBlocks || []), newBlock]
        });
    };

    /**
     * Adds a TIMELINE block right after the dayInfo at `afterDayIndex`,
     * i.e. at the *end* of that day's events but *before* the next dayInfo.
     * This lets admin add 5~10 events per day without using ↑/↓ arrows.
     */
    const addTimelineAfterDay = (afterDayIndex: number) => {
        const blocks = formData.itineraryBlocks ?? [];
        if (afterDayIndex < 0 || afterDayIndex >= blocks.length) return;
        if (blocks[afterDayIndex].type !== 'dayInfo') return;

        // Find the index of the next dayInfo block (or end of array).
        let insertAt = blocks.length;
        for (let i = afterDayIndex + 1; i < blocks.length; i++) {
            if (blocks[i].type === 'dayInfo') {
                insertAt = i;
                break;
            }
        }

        const newBlock: DetailContentBlock = {
            id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'timeline',
            content: {
                id: `timeline-${Date.now()}`,
                time: '',
                title: '',
                description: '',
                images: [],
            },
        };

        const next = [...blocks];
        next.splice(insertAt, 0, newBlock);
        setFormData({ ...formData, itineraryBlocks: next });

        // Scroll to the newly inserted block after the next paint so the admin
        // sees where it went.
        setTimeout(() => {
            const el = document.querySelector(`[data-itinerary-block="${newBlock.id}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
    };

    // ─────────────────────────────────────────────────────────────────────
    // Day-based itinerary editor (날짜별 카드).
    //
    // The public renderer groups the flat `itineraryBlocks` array by `dayInfo`
    // markers: each dayInfo starts a new day, the blocks after it are that day's
    // events. We keep that exact storage shape but project it into day cards so
    // the admin never has to hand-order a flat block list. All content editing
    // still flows through the existing index-based handlers (updateTimelineInBlock,
    // handleTimelineBlockImages, master pickers, …) — only structural ops are new.
    // ─────────────────────────────────────────────────────────────────────
    type EditorEvent = { block: DetailContentBlock; flatIndex: number };
    type EditorDay = { dayInfo: DetailContentBlock; dayInfoFlatIndex: number; events: EditorEvent[] };
    type PlainDay = { dayInfo: DetailContentBlock; events: DetailContentBlock[] };

    const isSpacerBlock = (b: DetailContentBlock) =>
        b.type === 'divider' && (b.content as DividerContent)?.style === 'space';

    // Read-only projection for the render layer. Cosmetic spacer dividers (auto
    // inserted between days) are hidden from the per-day event lists.
    const groupItineraryForEditor = (blocks: DetailContentBlock[]): { pre: EditorEvent[]; days: EditorDay[] } => {
        const pre: EditorEvent[] = [];
        const days: EditorDay[] = [];
        let cur: EditorDay | null = null;
        blocks.forEach((block, flatIndex) => {
            if (block.type === 'dayInfo') {
                cur = { dayInfo: block, dayInfoFlatIndex: flatIndex, events: [] };
                days.push(cur);
            } else if (isSpacerBlock(block)) {
                // skip — regenerated on serialize
            } else if (cur) {
                cur.events.push({ block, flatIndex });
            } else {
                pre.push({ block, flatIndex });
            }
        });
        return { pre, days };
    };

    // Serialize day groups back to the canonical flat array: renumber day labels
    // sequentially, put exactly one space divider between consecutive days.
    const flattenItineraryDays = (pre: DetailContentBlock[], days: PlainDay[]): DetailContentBlock[] => {
        const out: DetailContentBlock[] = [...pre];
        days.forEach((d, i) => {
            const dc = d.dayInfo.content as DayInfoContent;
            out.push({ ...d.dayInfo, content: { ...dc, dayLabel: DAY_LABELS_JP[i] || `${i + 1}일차` } });
            out.push(...d.events);
            if (i < days.length - 1) {
                out.push({ id: `block-sep-${d.dayInfo.id}`, type: 'divider', content: { style: 'space', height: 40 } });
            }
        });
        return out;
    };

    // Regroup current blocks → let the mutator edit the plain groups → flatten → set.
    const rebuildItinerary = (mutate: (g: { pre: DetailContentBlock[]; days: PlainDay[] }) => void) => {
        setFormData((prev) => {
            const blocks = prev.itineraryBlocks || [];
            const pre: DetailContentBlock[] = [];
            const days: PlainDay[] = [];
            let cur: PlainDay | null = null;
            for (const b of blocks) {
                if (b.type === 'dayInfo') { cur = { dayInfo: b, events: [] }; days.push(cur); }
                else if (isSpacerBlock(b)) { /* drop cosmetic spacer; regenerated on flatten */ }
                else if (cur) { cur.events.push(b); }
                else { pre.push(b); }
            }
            const g = { pre, days };
            mutate(g);
            return { ...prev, itineraryBlocks: flattenItineraryDays(g.pre, g.days) };
        });
    };

    const makeItineraryBlock = (type: 'timeline' | 'image' | 'slide' | 'divider'): DetailContentBlock => {
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        if (type === 'timeline') return { id: `block-${stamp}`, type, content: { id: `timeline-${stamp}`, time: '', title: '', description: '', images: [] } };
        if (type === 'slide') return { id: `block-${stamp}`, type, content: { id: `slide-${stamp}`, type: 'day', dayLabel: '', title: '', description: '', images: [] } };
        if (type === 'divider') return { id: `block-${stamp}`, type, content: { style: 'line', height: 20 } };
        return { id: `block-${stamp}`, type, content: '' }; // image
    };

    const addItineraryDay = () => {
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        rebuildItinerary((g) => {
            g.days.push({
                dayInfo: {
                    id: `block-${stamp}-info`,
                    type: 'dayInfo',
                    content: { id: `dayinfo-${stamp}`, dayLabel: '', dayDate: '', title: '', description: '', meals: { breakfast: '', lunch: '', dinner: '' }, accommodation: '' },
                },
                events: [],
            });
        });
    };

    const removeItineraryDay = (dayGroupIndex: number) => {
        rebuildItinerary((g) => { g.days.splice(dayGroupIndex, 1); });
    };

    const moveItineraryDay = (dayGroupIndex: number, dir: -1 | 1) => {
        rebuildItinerary((g) => {
            const t = dayGroupIndex + dir;
            if (t < 0 || t >= g.days.length) return;
            [g.days[dayGroupIndex], g.days[t]] = [g.days[t], g.days[dayGroupIndex]];
        });
    };

    // 일차 복제 — dayInfo + 하위 이벤트를 모두 새 id로 복제해 바로 아래 일차로 삽입.
    // dayLabel은 flatten 단계에서 순서대로 재번호되므로 손대지 않는다.
    const duplicateItineraryDay = (dayGroupIndex: number) => {
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        rebuildItinerary((g) => {
            const src = g.days[dayGroupIndex];
            if (!src) return;
            let n = 0;
            const cloneBlock = (b: DetailContentBlock): DetailContentBlock => {
                n += 1;
                const content: any = (b.content && typeof b.content === 'object')
                    ? JSON.parse(JSON.stringify(b.content))
                    : b.content;
                if (content && typeof content === 'object' && 'id' in content) {
                    content.id = `${b.type}-${stamp}-${n}`;
                }
                return { ...b, id: `block-${stamp}-${n}`, content };
            };
            const newDay: PlainDay = {
                dayInfo: cloneBlock(src.dayInfo),
                events: src.events.map(cloneBlock),
            };
            g.days.splice(dayGroupIndex + 1, 0, newDay);
        });
    };

    const addItineraryEvent = (dayGroupIndex: number, type: 'timeline' | 'image' | 'slide' | 'divider') => {
        const block = makeItineraryBlock(type);
        rebuildItinerary((g) => { g.days[dayGroupIndex]?.events.push(block); });
        setTimeout(() => {
            const el = document.querySelector(`[data-itinerary-block="${block.id}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
    };

    const removeItineraryEvent = (dayGroupIndex: number, eventIndex: number) => {
        rebuildItinerary((g) => { g.days[dayGroupIndex]?.events.splice(eventIndex, 1); });
    };

    const moveItineraryEvent = (dayGroupIndex: number, eventIndex: number, dir: -1 | 1) => {
        rebuildItinerary((g) => {
            const evs = g.days[dayGroupIndex]?.events;
            if (!evs) return;
            const t = eventIndex + dir;
            if (t < 0 || t >= evs.length) return;
            [evs[eventIndex], evs[t]] = [evs[t], evs[eventIndex]];
        });
    };

    const toggleDayCollapsed = (id: string) => {
        setCollapsedDays((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    };
    const toggleDayAdvanced = (id: string) => {
        setAdvancedDays((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    };

    const removeItineraryBlock = (index: number) => {
        setFormData({
            ...formData,
            itineraryBlocks: formData.itineraryBlocks?.filter((_, i) => i !== index)
        });
    };

    const moveItineraryBlock = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= (formData.itineraryBlocks?.length || 0)) return;
        const blocks = [...(formData.itineraryBlocks || [])];
        const [moved] = blocks.splice(fromIndex, 1);
        blocks.splice(toIndex, 0, moved);
        setFormData({ ...formData, itineraryBlocks: blocks });
    };

    const updateItineraryBlockContent = (index: number, content: any) => {
        const blocks = [...(formData.itineraryBlocks || [])];
        blocks[index] = { ...blocks[index], content };
        setFormData({ ...formData, itineraryBlocks: blocks });
    };

    const updateItinerarySlideInBlock = (blockIndex: number, field: string, value: any) => {
        const blocks = [...(formData.itineraryBlocks || [])];
        const block = blocks[blockIndex];
        if (block.type !== 'slide') return;
        const slide = block.content as DetailSlide;
        const updatedSlide = { ...slide, [field]: value };
        blocks[blockIndex] = { ...block, content: updatedSlide };
        setFormData({ ...formData, itineraryBlocks: blocks });
    };

    const handleItineraryBlockImageUpload = async (index: number, file: File) => {
        try {
            const url = await uploadImage(file, 'product-details');
            updateItineraryBlockContent(index, url);
        } catch (error) {
            console.error('Itinerary block image upload failed:', error);
            alert('이미지 업로드 실패');
        }
    };

    const handleItinerarySlideBlockImages = async (blockIndex: number, files: FileList | null) => {
        if (!files) return;

        try {
            const uploadPromises = Array.from(files).map(file => uploadImage(file, 'product-details'));
            const urls = await Promise.all(uploadPromises);

            const block = formData.itineraryBlocks?.[blockIndex];
            if (block && block.type === 'slide') {
                const currentSlide = block.content as DetailSlide;
                const updatedSlide = {
                    ...currentSlide,
                    images: [...currentSlide.images, ...urls]
                };
                const blocks = [...(formData.itineraryBlocks || [])];
                blocks[blockIndex] = { ...block, content: updatedSlide };
                setFormData({ ...formData, itineraryBlocks: blocks });
            }
        } catch (error) {
            console.error('Itinerary slide images upload failed:', error);
            alert('이미지 업로드 실패');
        }
    };

    const removeItinerarySlideBlockImage = (blockIndex: number, imageIndex: number) => {
        const block = formData.itineraryBlocks?.[blockIndex];
        if (block && block.type === 'slide') {
            const currentSlide = block.content as DetailSlide;
            const updatedSlide = {
                ...currentSlide,
                images: currentSlide.images.filter((_, i) => i !== imageIndex)
            };
            const blocks = [...(formData.itineraryBlocks || [])];
            blocks[blockIndex] = { ...block, content: updatedSlide };
            setFormData({ ...formData, itineraryBlocks: blocks });
        }
    };

    // Generic Timeline Block Handlers
    const updateTimelineInBlock = (blocksArray: 'detail' | 'itinerary', blockIndex: number, field: string, value: any) => {
        const blocks = [...(blocksArray === 'detail' ? (formData.detailBlocks || []) : (formData.itineraryBlocks || []))];
        const block = blocks[blockIndex];
        if (block.type !== 'timeline') return;
        const timeline = block.content as TimelineContent;
        const updatedTimeline = { ...timeline, [field]: value };
        blocks[blockIndex] = { ...block, content: updatedTimeline };
        
        if (blocksArray === 'detail') setFormData({ ...formData, detailBlocks: blocks });
        else setFormData({ ...formData, itineraryBlocks: blocks });
    };
    
    const handleTimelineBlockImages = async (blocksArray: 'detail' | 'itinerary', blockIndex: number, files: FileList | null) => {
        if (!files) return;
        try {
            const uploadPromises = Array.from(files).map(file => uploadImage(file, 'product-details'));
            const urls = await Promise.all(uploadPromises);
            
            const blocks = [...(blocksArray === 'detail' ? (formData.detailBlocks || []) : (formData.itineraryBlocks || []))];
            const block = blocks[blockIndex];
            if (block.type === 'timeline') {
                const currentTimeline = block.content as TimelineContent;
                const updatedTimeline = {
                    ...currentTimeline,
                    images: [...currentTimeline.images, ...urls]
                };
                blocks[blockIndex] = { ...block, content: updatedTimeline };
                if (blocksArray === 'detail') setFormData({ ...formData, detailBlocks: blocks });
                else setFormData({ ...formData, itineraryBlocks: blocks });
            }
        } catch (error) {
            console.error('Timeline images upload failed:', error);
            alert('이미지 업로드 실패');
        }
    };
    
    /** 일정 상세 디자인용 사진 — 일차 정보 블록에 히어로 1장 / 상단 그리드 최대 5장을 직접 올린다 */
    const handleDayInfoDesignImages = async (flatIndex: number, kind: 'hero' | 'gallery', files: FileList | null) => {
        if (!files || files.length === 0) return;
        try {
            const urls = await Promise.all(Array.from(files).map(file => uploadImage(file, 'product-details')));
            const blocks = [...(formData.itineraryBlocks || [])];
            const block = blocks[flatIndex];
            if (!block || block.type !== 'dayInfo') return;
            const dc = block.content as DayInfoContent;
            const next = kind === 'hero'
                ? { ...dc, heroImage: urls[0] }
                : { ...dc, galleryImages: [...(dc.galleryImages || []), ...urls].slice(0, 5) };
            blocks[flatIndex] = { ...block, content: next };
            setFormData({ ...formData, itineraryBlocks: blocks });
        } catch (error) {
            console.error('Day design images upload failed:', error);
            alert('이미지 업로드 실패');
        }
    };

    const removeTimelineBlockImage = (blocksArray: 'detail' | 'itinerary', blockIndex: number, imgIndex: number) => {
        const blocks = [...(blocksArray === 'detail' ? (formData.detailBlocks || []) : (formData.itineraryBlocks || []))];
        const block = blocks[blockIndex];
        if (block.type !== 'timeline') return;
        const timeline = block.content as TimelineContent;
        const newTimeline = { ...timeline, images: timeline.images.filter((_, i) => i !== imgIndex) };
        blocks[blockIndex] = { ...block, content: newTimeline };
        
        if (blocksArray === 'detail') setFormData({ ...formData, detailBlocks: blocks });
        else setFormData({ ...formData, itineraryBlocks: blocks });
    };

    // Detail Image handlers
    const handleDetailImageUpload = async (files: FileList | null) => {
        if (!files) return;

        try {
            const uploadPromises = Array.from(files).map(file => uploadImage(file, 'product-details'));
            const urls = await Promise.all(uploadPromises);

            setFormData(prev => ({
                ...prev,
                detailImages: [...(prev.detailImages || []), ...urls]
            }));
        } catch (error) {
            console.error('Detail image upload failed:', error);
            alert('이미지 업로드 실패');
        }
    };

    const removeDetailImage = (imageIndex: number) => {
        setFormData({
            ...formData,
            detailImages: formData.detailImages?.filter((_, i) => i !== imageIndex)
        });
    };

    // Drag and Drop handlers for Detail Images
    const handleDetailDragStart = (index: number) => {
        setDraggedDetailIndex(index);
    };

    const handleDetailDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedDetailIndex === null || draggedDetailIndex === index) return;

        const images = [...(formData.detailImages || [])];
        const draggedImage = images[draggedDetailIndex];

        // Remove from old position
        images.splice(draggedDetailIndex, 1);
        // Insert at new position
        images.splice(index, 0, draggedImage);

        setFormData({ ...formData, detailImages: images });
        setDraggedDetailIndex(index);
    };

    const handleDetailDragEnd = () => {
        setDraggedDetailIndex(null);
    };

    // Main Image handlers
    const handleMainImageUpload = async (files: FileList | null) => {
        if (!files) return;

        try {
            const uploadPromises = Array.from(files).map(file => uploadImage(file, 'products'));
            const urls = await Promise.all(uploadPromises);

            setFormData(prev => ({
                ...prev,
                mainImages: [...(prev.mainImages || []), ...urls]
            }));
        } catch (error) {
            console.error('Main image upload failed:', error);
            alert('이미지 업로드 실패');
        }
    };

    const removeMainImage = (imageIndex: number) => {
        setFormData({
            ...formData,
            mainImages: formData.mainImages?.filter((_, i) => i !== imageIndex)
        });
    };

    const moveMainImage = (imageIndex: number, direction: 'up' | 'down') => {
        const images = [...(formData.mainImages || [])];
        const newIndex = direction === 'up' ? imageIndex - 1 : imageIndex + 1;

        if (newIndex < 0 || newIndex >= images.length) return;

        [images[imageIndex], images[newIndex]] = [images[newIndex], images[imageIndex]];
        setFormData({ ...formData, mainImages: images });
    };

    const addTag = (tag: string) => {
        if (tag && !formData.tags?.includes(tag)) {
            setFormData({ ...formData, tags: [...(formData.tags || []), tag] });
        }
    };

    const removeTag = (tag: string) => {
        setFormData({ ...formData, tags: formData.tags?.filter(t => t !== tag) });
    };

    const addIncluded = (item: string) => {
        if (item) {
            setFormData({ ...formData, included: [...(formData.included || []), item] });
        }
    };

    const removeIncluded = (index: number) => {
        setFormData({ ...formData, included: formData.included?.filter((_, i) => i !== index) });
    };

    const addExcluded = (item: string) => {
        if (item) {
            setFormData({ ...formData, excluded: [...(formData.excluded || []), item] });
        }
    };

    const removeExcluded = (index: number) => {
        setFormData({ ...formData, excluded: formData.excluded?.filter((_, i) => i !== index) });
    };

    const busy = saving || uploadCount > 0 || itineraryBulkUploading || designUploading;
    const locked = busy || !draftReady || !!pendingDraft || savedRef.current;

    const requiredChecks: Array<[string, boolean]> = [
        ['상품명', !!formData.name?.trim()], ['카테고리', !!formData.category], ['기간', !!formData.duration?.trim()],
        ['판매가', Number(formData.price) > 0], ['메인 이미지', (formData.mainImages || []).length > 0],
    ];
    const requiredDone = requiredChecks.filter(([, done]) => done).length;
    return (
        <div className="card product-draft-editor pa-editor" style={{ width: '100%' }}>
                {/* Header */}
                <div className="card-head pa-head">
                    <button onClick={closeEditor} disabled={busy} className="pa-back" title="목록으로" type="button">
                        <DashboardIcon name="lc-chevron-left" size={16} />상품 목록
                    </button>
                    <div className="pa-title"><span>카탈로그</span><h2>{product ? '상품 수정' : '상품 추가'}</h2></div>
                    <div className="spacer" />
                </div>

                {/* Tabs */}
                <div className="card-pad pa-tabs-wrap" style={{ paddingTop: 10, paddingBottom: 0 }}>
                    <div className="tabs pa-tabs" style={{ marginBottom: 0 }}>
                        {[
                            { id: 'basic', label: '기본 정보', icon: 'info' },
                            { id: 'details', label: '상세 정보', icon: 'description' },
                            { id: 'itinerary', label: '일정', icon: 'calendar_month' },
                            { id: 'options', label: '가격/옵션', icon: 'attach_money' },
                            { id: 'spots', label: '대표 명소', icon: 'location_on' },
                            { id: 'includes', label: '포함/불포함', icon: 'checklist' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                disabled={busy || !!pendingDraft}
                                onClick={() => setCurrentTab(tab.id as any)}
                                className={`tab${currentTab === tab.id ? ' active' : ''}`}
                            >
                                <Icon name={tab.icon} />{tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pa-body">
                <div className="pa-main">

                <div className="pa-draft-status" role="status" aria-live="polite" style={{ margin: '14px 20px', padding: '12px 14px', borderRadius: 12, background: draftError || pendingDraft?.conflict ? '#fff5e8' : '#edfaf6', border: '1px solid ' + (draftError || pendingDraft?.conflict ? '#f3d5a3' : '#c8eee3'), fontSize: 13, lineHeight: 1.7 }}>
                    {!adminUserId ? '관리자 계정을 확인하고 있습니다. 확인이 끝난 뒤 편집할 수 있습니다.' : pendingDraft ? <>
                        <strong>{pendingDraft.conflict ? '상품이 변경된 뒤 남아 있는 초안입니다.' : '이 브라우저에 저장하지 않은 상품 초안이 있습니다.'}</strong>
                        <div>초안 보관: {new Date(pendingDraft.draft.savedAt).toLocaleString('ko-KR')}{pendingDraft.conflict ? ' · 서버 상품과 다른 버전입니다. 내용을 복원해 검토하거나 초안을 버리고 최신 상품으로 시작하세요.' : ' · 복원하거나 버린 뒤 편집을 계속하세요.'}</div>
                        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-ink btn-sm" onClick={restoreDraft}>초안 복원</button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={discardDraft}>초안 버리기</button>
                        </div>
                    </> : <>
                        <strong>{saving ? '상품 저장 중…' : busy ? '사진 업로드 또는 자료 저장 중…' : dirty ? '변경 내용을 이 브라우저에 자동 보관합니다.' : '현재 저장된 상품 기준입니다.'}</strong>
                        <div>{draftSavedAt ? '마지막 초안 보관: ' + new Date(draftSavedAt).toLocaleString('ko-KR') + ' · ' : ''}초안은 현재 관리자 계정과 이 상품에서만 복원됩니다. 상품 저장 전에는 공개 상품에 반영되지 않습니다.</div>
                    </>}
                    {draftError && <div role="alert" style={{ color: '#9f4d13', marginTop: 6 }}>{draftError}<button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { if (savedRef.current) discardDraft(); else flushDraft(); }} style={{ marginLeft: 8 }}>다시 시도</button>{!pendingDraft && !dirty && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={discardDraft}>초안 버리기</button>}</div>}
                    {saveNotice && <div style={{ marginTop: 6 }}>{saveNotice}</div>}
                </div>
                <form onSubmit={handleSubmit} aria-busy={busy}>
                    <fieldset disabled={locked} inert={locked || undefined} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                    <div className="card-pad">
                        {/* Basic Info Tab */}
                        {currentTab === 'basic' && (
                            <div style={{ maxWidth: 760 }}>
                                <div className="field">
                                    <label>상품명 *</label>
                                    <input
                                        type="text"
                                        className="inp"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="field">
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>상품 설명 / 개요 <span className="muted" style={{ fontWeight: 500 }}>(PC 상세페이지 '개요' + 검색 결과·공유 미리보기)</span></span>
                                        <span className="muted" style={{ color: (formData.description?.length || 0) > 160 ? 'var(--mrt-red)' : undefined }}>
                                            {formData.description?.length || 0} / 160
                                        </span>
                                    </label>
                                    <textarea
                                        className="inp"
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        placeholder="예: 별이 쏟아지는 밤하늘과 노을에 물드는 대초원, 유목민 문화를 체험하는 중앙 몽골 3박 4일 투어. 한국어 가이드 동행, 전 일정 식사·숙박 포함."
                                    />
                                    <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                                        Google 검색·카카오톡 공유 시 표시되는 짧은 소개글입니다. 100~160자가 가장 적당합니다.
                                    </p>
                                </div>

                                <div className="field-row">
                                    <div className="field">
                                        <label id="pa-category-label">카테고리 *</label>
                                        <div className="pa-seg" role="radiogroup" aria-labelledby="pa-category-label">
                                            {categories.map(cat => (
                                                <button key={cat.id} type="button" role="radio" aria-checked={formData.category === cat.name} className={formData.category === cat.name ? 'is-on' : ''} onClick={() => setFormData({ ...formData, category: cat.name })}>{cat.name}</button>
                                            ))}
                                            {categories.length === 0 && <span className="cell-muted">상품 카테고리에서 먼저 카테고리를 등록하세요.</span>}
                                        </div>
                                    </div>

                                    <div className="field">
                                        <label>기간 *</label>
                                        <input
                                            type="text"
                                            className="inp"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                            placeholder="예: 4박 5일"
                                            required
                                        />
                                        <div className="pa-seg pa-seg-sm" aria-label="기간 빠른 입력">
                                            {[1, 2, 3, 4, 5, 6, 7].map(n => {
                                                const label = `${n}박 ${n + 1}일`;
                                                return <button key={n} type="button" className={formData.duration === label ? 'is-on' : ''} onClick={() => setFormData({ ...formData, duration: label })}>{n}박{n + 1}일</button>;
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="field-row">
                                    <div className="field">
                                        <label>판매가 (원) *</label>
                                        <input
                                            type="number"
                                            className="inp"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                                            required
                                        />
                                    </div>

                                    <div className="field">
                                        <label>정가 (원, 선택)</label>
                                        <input
                                            type="number"
                                            className="inp"
                                            value={formData.originalPrice || ''}
                                            onChange={(e) => setFormData({ ...formData, originalPrice: Number(e.target.value) || undefined })}
                                        />
                                    </div>
                                </div>

                                {/* Main Images Upload */}
                                <div className="field">
                                    <label htmlFor="pa-main-images">메인 이미지 업로드 *</label>
                                    <label className="pa-upload" htmlFor="pa-main-images">
                                        <DashboardIcon name="lc-image-plus" size={22} />
                                        <b>이미지 추가</b>
                                        <span>{(formData.mainImages || []).length}장 등록됨 · 여러 장 선택 가능</span>
                                    </label>
                                    <input
                                        id="pa-main-images"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => handleMainImageUpload(e.target.files)}
                                        className="pa-file"
                                    />
                                    <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>대표 사진은 홈 상품 카드와 상품 상세 슬라이드에 사용됩니다. 업로드 후 상품을 저장하고 ‘판매중’으로 설정해야 공개됩니다.</p>

                                    {/* Main Images Grid */}
                                    {formData.mainImages && formData.mainImages.length > 0 && (
                                        <div className="grid-3" style={{ marginTop: 14 }}>
                                            {formData.mainImages.map((img, imgIndex) => (
                                                <div key={imgIndex} style={{ position: 'relative', border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--mrt-gray-100)' }}>
                                                    <img
                                                        src={getOptimizedImageUrl(img, 'productThumbnail')}
                                                        alt={`Main ${imgIndex + 1}`}
                                                        style={{ width: '100%', height: 128, objectFit: 'cover', pointerEvents: 'none', display: 'block' }}
                                                    />

                                                    {/* Image Controls */}
                                                    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                                                        {imgIndex > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => moveMainImage(imgIndex, 'up')}
                                                                className="act-btn"
                                                                title="위로 이동"
                                                            >
                                                                <Icon name="arrow_upward" />
                                                            </button>
                                                        )}
                                                        {imgIndex < (formData.mainImages?.length || 0) - 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => moveMainImage(imgIndex, 'down')}
                                                                className="act-btn"
                                                                title="아래로 이동"
                                                            >
                                                                <Icon name="arrow_downward" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeMainImage(imgIndex)}
                                                            className="act-btn danger"
                                                            title="삭제"
                                                        >
                                                            <Icon name="delete" />
                                                        </button>
                                                    </div>

                                                    {/* Image Number Badge */}
                                                    <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 6 }}>
                                                        {imgIndex + 1} / {formData.mainImages?.length || 0}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="field-row">
                                    <div className="field">
                                        <label id="pa-status-label">판매 상태</label>
                                        <div className="pa-seg" role="radiogroup" aria-labelledby="pa-status-label">
                                            {([['active', '판매중'], ['inactive', '비활성'], ['soldout', '품절']] as const).map(([value, label]) => (
                                                <button key={value} type="button" role="radio" aria-checked={formData.status === value} className={formData.status === value ? 'is-on' : ''} onClick={() => setFormData({ ...formData, status: value })}>{label}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="field">
                                        <label>노출 설정</label>
                                        <div className="stack" style={{ gap: 10 }}>
                                            <div className="toggle-row">
                                                <div>
                                                    <div className="cell-strong">추천 상품</div>
                                                    <div className="cell-muted" style={{ fontSize: 12 }}>홈 상품 목록에서 우선 정렬</div>
                                                </div>
                                                <div className="spacer" style={{ flex: 1 }} />
                                                <button
                                                    type="button"
                                                    className={`switch${formData.isFeatured ? ' on' : ''}`}
                                                    onClick={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })}
                                                >
                                                    <span className="knob" />
                                                </button>
                                            </div>
                                            <div className="toggle-row">
                                                <div>
                                                    <div className="cell-strong">인기 상품</div>
                                                    <div className="cell-muted" style={{ fontSize: 12 }}>인기 뱃지 표시</div>
                                                </div>
                                                <div className="spacer" style={{ flex: 1 }} />
                                                <button
                                                    type="button"
                                                    className={`switch${formData.isPopular ? ' on' : ''}`}
                                                    onClick={() => setFormData({ ...formData, isPopular: !formData.isPopular })}
                                                >
                                                    <span className="knob" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="field">
                                        <label id="pa-package-label">여행 타입</label>
                                        <div className="pa-seg" role="radiogroup" aria-labelledby="pa-package-label">
                                            {([[null, '미지정', ''], ['full', '풀패키지', '4성급 호텔 + 디럭스 게르'], ['value', '실속형 패키지', '3성급 호텔 + 스탠다드 게르']] as const).map(([value, label, stays]) => (
                                                <button key={label} type="button" role="radio" aria-checked={(formData.packageType ?? null) === value} title={stays || undefined} className={(formData.packageType ?? null) === value ? 'is-on' : ''} onClick={() => setFormData({ ...formData, packageType: value as PackageType | null })}>{label}</button>
                                            ))}
                                        </div>
                                        <div className="cell-muted" style={{ fontSize: 12, marginTop: 6 }}>
                                            풀패키지는 4성급 호텔 + 디럭스 게르, 실속형 패키지는 3성급 호텔 + 스탠다드 게르예요. 고객 투어 목록의 여행 타입 필터에 사용됩니다.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Details Tab */}
                        {currentTab === 'details' && (
                            <div className="stack" style={{ maxWidth: 860 }}>
                                {/* Tags */}
                                <div className="field" style={{ marginBottom: 0 }}>
                                    <label>태그</label>
                                    {formData.tags && formData.tags.length > 0 && (
                                        <div className="chip-row" style={{ marginBottom: 8 }}>
                                            {formData.tags?.map(tag => (
                                                <span key={tag} className="chip active">
                                                    {tag}
                                                    <button type="button" onClick={() => removeTag(tag)} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', display: 'inline-flex', padding: 0 }}>
                                                        <Icon name="close" style={{ fontSize: 14 }} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        className="inp"
                                        placeholder="태그 입력 후 Enter"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addTag((e.target as HTMLInputElement).value);
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }}
                                    />
                                </div>

                                {/* Highlights form removed per admin request.
                                    addHighlight/updateHighlight/removeHighlight
                                    handlers are kept in case any legacy data
                                    still flows through saves, but no UI exposes
                                    them now. */}

                                {/* FAQ — per-product Q&A. Empty list = use site-wide common FAQs. */}
                                <section className="edit-sec">
                                    <div className="edit-sec-head">
                                        <Icon name="help" />
                                        <h4>FAQ (자주 묻는 질문)</h4>
                                        <span className="muted">비워두면 공통 FAQ가 표시됩니다</span>
                                    </div>
                                    <div className="stack" style={{ gap: 10 }}>
                                        {formData.faqs?.map((faq, index) => (
                                            <div className="edit-row" key={index}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                                                        <span className="cell-mono" style={{ fontSize: 12, paddingTop: 12, color: 'var(--mrt-blue-strong)' }}>Q{index + 1}.</span>
                                                        <input
                                                            type="text"
                                                            className="inp"
                                                            style={{ flex: 1 }}
                                                            value={faq.q}
                                                            onChange={(e) => updateFAQ(index, 'q', e.target.value)}
                                                            placeholder="질문"
                                                        />
                                                    </div>
                                                    <textarea
                                                        className="inp"
                                                        style={{ marginTop: 8 }}
                                                        value={faq.a}
                                                        onChange={(e) => updateFAQ(index, 'a', e.target.value)}
                                                        placeholder="답변"
                                                        rows={3}
                                                    />
                                                </div>
                                                <button type="button" className="act-btn danger" onClick={() => removeFAQ(index)} title="삭제">
                                                    <Icon name="delete" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!formData.faqs || formData.faqs.length === 0) && (
                                            <div className="card-muted-note">
                                                <Icon name="info" />
                                                <span>Q&A를 추가하지 않으면 사이트 공통 FAQ가 사용됩니다.</span>
                                            </div>
                                        )}
                                        <button type="button" className="add-line" onClick={addFAQ}><Icon name="add" />Q&A 추가</button>
                                    </div>
                                </section>

                                {/* Detail Images Section */}
                                <div>
                                    {/* Detail Block Content Section */}
                                    <div>
                                        <div className="block-add-bar">
                                            <span className="block-add-label"><Icon name="add" />블록 추가</span>
                                            <button type="button" className="chip" onClick={() => addDetailBlock('image')}>
                                                <Icon name="image" style={{ fontSize: 16 }} />이미지
                                            </button>
                                            <button type="button" className="chip" onClick={() => addDetailBlock('slide')}>
                                                <Icon name="view_carousel" style={{ fontSize: 16 }} />슬라이드
                                            </button>
                                            <button type="button" className="chip" onClick={() => addDetailBlock('timeline')}>
                                                <Icon name="schedule" style={{ fontSize: 16 }} />타임라인
                                            </button>
                                            <select
                                                onChange={(e) => { if (e.target.value) { addDetailBlock('dayInfo', e.target.value); e.target.value = ''; } }}
                                                defaultValue=""
                                                className="select"
                                                style={{ height: 36, fontSize: 13 }}
                                            >
                                                <option value="" disabled>📅 일차 추가</option>
                                                <option value="1일차">1일차</option>
                                                <option value="2일차">2일차</option>
                                                <option value="3일차">3일차</option>
                                                <option value="4일차">4일차</option>
                                                <option value="5일차">5일차</option>
                                                <option value="6일차">6일차</option>
                                                <option value="7일차">7일차</option>
                                                <option value="8일차">8일차</option>
                                                <option value="9일차">9일차</option>
                                                <option value="10일차">10일차</option>
                                            </select>
                                            <button type="button" className="chip" onClick={() => addDetailBlock('divider')}>
                                                <Icon name="horizontal_rule" style={{ fontSize: 16 }} />구분선/여백
                                            </button>
                                            {designTemplates.length === 1 ? (
                                                <button type="button" className="chip" onClick={() => addDetailBlock('design', undefined, designTemplates[0].id)}>
                                                    <Icon name="auto_awesome" style={{ fontSize: 16 }} />디자인 템플릿
                                                </button>
                                            ) : (
                                                <select
                                                    onChange={(e) => { if (e.target.value) { addDetailBlock('design', undefined, e.target.value); e.target.value = ''; } }}
                                                    defaultValue=""
                                                    className="select"
                                                    style={{ height: 36, fontSize: 13 }}
                                                >
                                                    <option value="" disabled>✨ 디자인 템플릿</option>
                                                    {designTemplates.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        <div className="card-muted-note" style={{ marginBottom: 14 }}>
                                            <Icon name="info" />
                                            <span>이미지와 슬라이드를 자유롭게 배치하여 상세 페이지를 구성하세요. 순서를 변경하거나 삭제할 수 있습니다.</span>
                                        </div>

                                        <div className="stack" style={{ gap: 12 }}>
                                            {(formData.detailBlocks || []).map((block, index) => (
                                                // 디자인 블록은 분할 편집기(미리보기+폼)라 860px 스택을 벗어나
                                                // 데스크톱 콘텐츠 폭 전체를 쓴다
                                                <div key={block.id} className="edit-row" style={block.type === 'design' ? { width: 'min(1380px, calc(100vw - var(--side-w) - 128px))' } : undefined}>
                                                    <div className="edit-move">
                                                        <button type="button" onClick={() => moveDetailBlock(index, index - 1)} disabled={index === 0}><Icon name="expand_less" /></button>
                                                        <button type="button" onClick={() => moveDetailBlock(index, index + 1)} disabled={index === (formData.detailBlocks?.length || 0) - 1}><Icon name="expand_more" /></button>
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        {/* Block Header */}
                                                        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                                                            <span className="badge b-gray">
                                                                {block.type === 'image' ? 'SINGLE' : (block.type === 'slide' ? 'SLIDE' : (block.type === 'timeline' ? 'TIMELINE' : (block.type === 'dayInfo' ? 'DAY INFO' : (block.type === 'design' ? 'DESIGN' : 'DIVIDER'))))}
                                                            </span>
                                                            <span className="cell-muted" style={{ fontSize: 12 }}>{index + 1}번째 블록</span>
                                                        </div>

                                                        {/* Block Content */}
                                                        {block.type === 'image' ? (
                                                            // IMAGE BLOCK
                                                            <div className="block-img">
                                                                {block.content ? (
                                                                    <div style={{ position: 'relative' }}>
                                                                        <img
                                                                            src={getOptimizedImageUrl(block.content as string, 'productThumbnail')}
                                                                            alt={`Block ${index + 1}`}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateBlockContent(index, '')}
                                                                            className="btn btn-ink btn-sm"
                                                                            style={{ position: 'absolute', top: 8, right: 8 }}
                                                                        >
                                                                            변경
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <label className="block-img-empty" style={{ cursor: 'pointer' }}>
                                                                        <Icon name="add_photo_alternate" />
                                                                        이미지 업로드
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*"
                                                                            onChange={(e) => {
                                                                                if (e.target.files?.[0]) handleBlockImageUpload(index, e.target.files[0]);
                                                                            }}
                                                                            style={{ display: 'none' }}
                                                                        />
                                                                    </label>
                                                                )}
                                                            </div>
                                                        ) : block.type === 'slide' ? (
                                                            // SLIDE BLOCK
                                                            <div className="stack" style={{ gap: 8 }}>
                                                                <input
                                                                    type="text"
                                                                    className="inp"
                                                                    value={(block.content as DetailSlide).title || ''}
                                                                    onChange={(e) => updateSlideInBlock(index, 'title', e.target.value)}
                                                                    placeholder="슬라이드 제목 (예: 1일차 숙소)"
                                                                />
                                                                <div>
                                                                    <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>이미지 목록 (다중 업로드 가능)</label>
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        multiple
                                                                        onChange={(e) => handleSlideBlockImages(index, e.target.files)}
                                                                        className="inp"
                                                                        style={{ height: 'auto', paddingTop: 8, paddingBottom: 8, fontSize: 13 }}
                                                                    />
                                                                </div>
                                                                {(block.content as DetailSlide).images?.length > 0 && (
                                                                    <div className="row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                                                                        {(block.content as DetailSlide).images.map((img, imgIdx) => (
                                                                            <div key={imgIdx} style={{ position: 'relative', flex: 'none' }}>
                                                                                <img src={getOptimizedImageUrl(img, 'productThumbnail')} alt={`Slide Img ${imgIdx}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--border-default)' }} />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => removeSlideBlockImage(index, imgIdx)}
                                                                                    style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'var(--mrt-red)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                                                                                >
                                                                                    <Icon name="close" style={{ fontSize: 14 }} />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : block.type === 'timeline' ? (
                                                            // TIMELINE BLOCK
                                                            <div className="stack" style={{ gap: 8 }}>
                                                                <div className="row" style={{ gap: 8 }}>
                                                                    <input type="text" className="inp" style={{ width: 140 }} value={(block.content as TimelineContent).time || ''} onChange={(e) => updateTimelineInBlock('detail', index, 'time', e.target.value)} placeholder="시간 (예: 10:00)" />
                                                                    <input type="text" className="inp" style={{ flex: 1, fontWeight: 700 }} value={(block.content as TimelineContent).title || ''} onChange={(e) => updateTimelineInBlock('detail', index, 'title', e.target.value)} placeholder="제목 (예: 자이승 전망대)" />
                                                                </div>
                                                                <textarea className="inp" value={(block.content as TimelineContent).description || ''} onChange={(e) => updateTimelineInBlock('detail', index, 'description', e.target.value)} placeholder="설명" rows={3} />
                                                                <div>
                                                                    <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>이미지 목록 (다중 업로드 기능)</label>
                                                                    <input type="file" accept="image/*" multiple onChange={(e) => handleTimelineBlockImages('detail', index, e.target.files)} className="inp" style={{ height: 'auto', paddingTop: 8, paddingBottom: 8, fontSize: 13 }} />
                                                                </div>
                                                                {(block.content as TimelineContent).images?.length > 0 && (
                                                                    <div className="row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                                                                        {(block.content as TimelineContent).images.map((img, imgIdx) => (
                                                                            <div key={imgIdx} style={{ position: 'relative', flex: 'none' }}>
                                                                                <img src={getOptimizedImageUrl(img, 'productThumbnail')} alt={`TL Img ${imgIdx}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--border-default)' }} />
                                                                                <button type="button" onClick={() => removeTimelineBlockImage('detail', index, imgIdx)} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'var(--mrt-red)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" style={{ fontSize: 14 }} /></button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : block.type === 'dayInfo' ? (
                                                            // DAY INFO BLOCK
                                                            <div className="stack" style={{ gap: 8 }}>
                                                                <div className="field-row">
                                                                    <div>
                                                                        <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>일차</label>
                                                                        <div className="badge b-amber" style={{ height: 44, borderRadius: 'var(--r-md)', width: '100%', justifyContent: 'flex-start', padding: '0 14px', fontSize: 14 }}>{stripDayLabelReading((block.content as DayInfoContent).dayLabel) || '미지정'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>날짜 (예: 05/26(화))</label>
                                                                        <input type="text" className="inp" value={(block.content as DayInfoContent).dayDate || ''} onChange={(e) => updateBlockContent(index, { ...(block.content as DayInfoContent), dayDate: e.target.value })} placeholder="05/26(화)" />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>일정 제목</label>
                                                                    <input type="text" className="inp" value={(block.content as DayInfoContent).title || ''} onChange={(e) => updateBlockContent(index, { ...(block.content as DayInfoContent), title: e.target.value })} placeholder="인천, 울란바토르, 고르히-테를지" />
                                                                </div>
                                                                <div>
                                                                    <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>주요 일정 요약</label>
                                                                    <input type="text" className="inp" value={(block.content as DayInfoContent).description || ''} onChange={(e) => updateBlockContent(index, { ...(block.content as DayInfoContent), description: e.target.value })} placeholder="대형마트, 테를지 국립공원, 거북 바위..." />
                                                                </div>
                                                                <div>
                                                                    <label className="cell-strong" style={{ fontSize: 12.5, display: 'block', marginBottom: 6 }}>🍽 식사 정보</label>
                                                                    <div className="meal-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                                                        <div className="inp-mini"><span className="pre" style={{ fontSize: 11 }}>조식</span><input value={(block.content as DayInfoContent).meals?.breakfast || ''} onChange={(e) => updateBlockContent(index, { ...(block.content as DayInfoContent), meals: { ...(block.content as DayInfoContent).meals, breakfast: e.target.value } })} placeholder="캠프식" /></div>
                                                                        <div className="inp-mini"><span className="pre" style={{ fontSize: 11 }}>중식</span><input value={(block.content as DayInfoContent).meals?.lunch || ''} onChange={(e) => updateBlockContent(index, { ...(block.content as DayInfoContent), meals: { ...(block.content as DayInfoContent).meals, lunch: e.target.value } })} placeholder="현지식" /></div>
                                                                        <div className="inp-mini"><span className="pre" style={{ fontSize: 11 }}>석식</span><input value={(block.content as DayInfoContent).meals?.dinner || ''} onChange={(e) => updateBlockContent(index, { ...(block.content as DayInfoContent), meals: { ...(block.content as DayInfoContent).meals, dinner: e.target.value } })} placeholder="캠프식" /></div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="cell-strong" style={{ fontSize: 12.5, display: 'block', marginBottom: 6 }}>🏠 숙소 정보</label>
                                                                    <div className="inp-mini"><span className="pre"><Icon name="hotel" style={{ fontSize: 14 }} /></span><input value={(block.content as DayInfoContent).accommodation || ''} onChange={(e) => updateBlockContent(index, { ...(block.content as DayInfoContent), accommodation: e.target.value })} placeholder="개별화장실과 샤워실이 구비된 디럭스게르" /></div>
                                                                </div>
                                                            </div>
                                                        ) : block.type === 'design' ? (
                                                            // DESIGN TEMPLATE BLOCK
                                                            <DesignTemplateBlockEditor
                                                                content={block.content as DesignBlockContent}
                                                                onChange={(next) => updateBlockContent(index, next)}
                                                                pricingOptions={formData.pricingOptions}
                                                                onBusyChange={busy => reportDesignBusy(block.id, busy)}
                                                            />
                                                        ) : (
                                                            // DIVIDER BLOCK
                                                            <div className="row" style={{ gap: 16, alignItems: 'flex-end' }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>스타일</label>
                                                                    <div className="row" style={{ gap: 8 }}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateBlockContent(index, { ...(block.content as DividerContent), style: 'line' })}
                                                                            className={`btn btn-sm ${(block.content as DividerContent).style === 'line' ? 'btn-ink' : 'btn-ghost'}`}
                                                                            style={{ flex: 1 }}
                                                                        >
                                                                            가로선
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateBlockContent(index, { ...(block.content as DividerContent), style: 'space' })}
                                                                            className={`btn btn-sm ${(block.content as DividerContent).style === 'space' ? 'btn-ink' : 'btn-ghost'}`}
                                                                            style={{ flex: 1 }}
                                                                        >
                                                                            여백
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div style={{ width: 140 }}>
                                                                    <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>높이 ({(block.content as DividerContent).height}px)</label>
                                                                    <input
                                                                        type="range"
                                                                        min="10"
                                                                        max="120"
                                                                        step="10"
                                                                        value={(block.content as DividerContent).height}
                                                                        onChange={(e) => updateBlockContent(index, { ...(block.content as DividerContent), height: parseInt(e.target.value) })}
                                                                        style={{ width: '100%' }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button type="button" className="act-btn danger" onClick={() => removeDetailBlock(index)} title="삭제"><Icon name="delete" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentTab === 'spots' && <ProductRepresentativeSpots value={formData.representativeSpots || []}
                            onChange={representativeSpots => setFormData(current => ({ ...current, representativeSpots }))} />}

                        {/* Itinerary Tab */}
                        {currentTab === 'itinerary' && (
                            <div className="stack" style={{ maxWidth: 860 }}>
                                {/* ─── Quick actions: bulk image upload + N-day skeleton ─── */}
                                <ItineraryQuickActions
                                    onBulkImages={bulkAddItineraryImages}
                                    onSkeleton={addDaysSkeleton}
                                    onImport={() => setItineraryImportOpen(true)}
                                    uploading={itineraryBulkUploading}
                                    progress={itineraryBulkProgress}
                                />

                                {/* Itinerary — day-based editor (날짜별 카드).
                                    Projects the flat itineraryBlocks array into day cards for
                                    editing, then serializes back to the SAME flat shape the public
                                    renderer expects. Public site / DB untouched. */}
                                <div>
                                    <div className="card-muted-note" style={{ marginBottom: 14, display: 'block' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontWeight: 700 }}><Icon name="lightbulb" />날짜별 카드에서 일정을 간단히 작성합니다</div>
                                        <ul style={{ margin: '8px 0 0', paddingLeft: 20, listStyle: 'disc', lineHeight: 1.7 }}>
                                            <li>아래 <strong>DAY 추가</strong> 버튼으로 일차를 추가하면 번호가 자동으로 정리됩니다.</li>
                                            <li>각 카드에 <strong>제목·날짜·식사·숙소</strong>를 입력하고, <strong>일정 항목 추가</strong>로 관광·이동·체험을 순서대로 구성합니다.</li>
                                            <li><strong>관광지·호텔 마스터</strong>에서 선택하면 제목·설명·사진을 자동으로 불러옵니다.</li>
                                            <li>단일 이미지·갤러리·구분선은 각 카드의 <strong>고급 항목</strong>에서 추가할 수 있습니다.</li>
                                        </ul>
                                    </div>

                                    {(() => {
                                        const { pre, days } = groupItineraryForEditor(formData.itineraryBlocks || []);
                                        const typeLabel = (t: string) => (t === 'image' ? '이미지' : t === 'slide' ? '갤러리' : t === 'divider' ? '구분선' : '일정');

                                        const renderEventBody = (block: DetailContentBlock, flatIndex: number) => {
                                            if (block.type === 'timeline') {
                                                const c = block.content as TimelineContent;
                                                return (
                                                    <div className="stack" style={{ gap: 8 }}>
                                                        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                                                            <button type="button" onClick={() => setSpotPickerForIndex(flatIndex)} className="btn btn-blue btn-sm" title="관광지 마스터에서 정보를 불러옵니다"><Icon name="location_on" />관광지 선택</button>
                                                            <button type="button" onClick={() => setHotelPickerTarget({ kind: 'timeline', index: flatIndex })} className="btn btn-ghost btn-sm" title="호텔 마스터에서 정보를 불러옵니다"><Icon name="hotel" />호텔 선택</button>
                                                        </div>
                                                        <div className="row" style={{ gap: 8 }}>
                                                            <input type="text" className="inp" style={{ width: 120 }} value={c.time || ''} onChange={(e) => updateTimelineInBlock('itinerary', flatIndex, 'time', e.target.value)} placeholder="시간 (선택)" />
                                                            <input type="text" className="inp" style={{ flex: 1, fontWeight: 700 }} value={c.title || ''} onChange={(e) => updateTimelineInBlock('itinerary', flatIndex, 'title', e.target.value)} placeholder="일정 제목 (예: 자이승 전망대)" />
                                                        </div>
                                                        <input type="text" className="inp" value={c.badge || ''} onChange={(e) => updateTimelineInBlock('itinerary', flatIndex, 'badge', e.target.value)} placeholder="강조 배지 (선택, 예: 환전 / 장보기) — 넣으면 설명이 배지 달린 강조 박스로 표시" />
                                                        <textarea className="inp" value={c.description || ''} onChange={(e) => updateTimelineInBlock('itinerary', flatIndex, 'description', e.target.value)} placeholder="상세 설명" rows={2} />
                                                        <input type="file" accept="image/*" multiple onChange={(e) => handleTimelineBlockImages('itinerary', flatIndex, e.target.files)} className="inp" style={{ height: 'auto', paddingTop: 8, paddingBottom: 8, fontSize: 13 }} />
                                                        {c.images?.length > 0 && (
                                                            <div className="row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                                                                {c.images.map((img, imgIdx) => (
                                                                    <div key={imgIdx} style={{ position: 'relative', flex: 'none' }}>
                                                                        <img src={getOptimizedImageUrl(img, 'productThumbnail')} alt={`일정 사진 ${imgIdx + 1}`} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--border-default)' }} />
                                                                        <button type="button" onClick={() => removeTimelineBlockImage('itinerary', flatIndex, imgIdx)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'var(--mrt-red)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" style={{ fontSize: 13 }} /></button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            if (block.type === 'image') {
                                                return (
                                                    <div className="block-img">
                                                        {block.content ? (
                                                            <div style={{ position: 'relative' }}>
                                                                <img src={getOptimizedImageUrl(block.content as string, 'productThumbnail')} alt="일정 이미지" />
                                                                <button type="button" onClick={() => updateItineraryBlockContent(flatIndex, '')} className="btn btn-ink btn-sm" style={{ position: 'absolute', top: 8, right: 8 }}>변경</button>
                                                            </div>
                                                        ) : (
                                                            <label className="block-img-empty" style={{ cursor: 'pointer' }}>
                                                                <Icon name="add_photo_alternate" />이미지 업로드
                                                                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) handleItineraryBlockImageUpload(flatIndex, e.target.files[0]); }} style={{ display: 'none' }} />
                                                            </label>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            if (block.type === 'slide') {
                                                const c = block.content as DetailSlide;
                                                return (
                                                    <div className="stack" style={{ gap: 8 }}>
                                                        <input type="text" className="inp" value={c.title || ''} onChange={(e) => updateItinerarySlideInBlock(flatIndex, 'title', e.target.value)} placeholder="갤러리 제목 (선택)" />
                                                        <input type="file" accept="image/*" multiple onChange={(e) => handleItinerarySlideBlockImages(flatIndex, e.target.files)} className="inp" style={{ height: 'auto', paddingTop: 8, paddingBottom: 8, fontSize: 13 }} />
                                                        {c.images?.length > 0 && (
                                                            <div className="row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                                                                {c.images.map((img, imgIdx) => (
                                                                    <div key={imgIdx} style={{ position: 'relative', flex: 'none' }}>
                                                                        <img src={getOptimizedImageUrl(img, 'productThumbnail')} alt={`갤러리 ${imgIdx + 1}`} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--border-default)' }} />
                                                                        <button type="button" onClick={() => removeItinerarySlideBlockImage(flatIndex, imgIdx)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'var(--mrt-red)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" style={{ fontSize: 13 }} /></button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            // divider (line)
                                            const dvc = block.content as DividerContent;
                                            return (
                                                <div className="row" style={{ gap: 16, alignItems: 'flex-end' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>가로 구분선</label>
                                                        <div style={{ height: 1, background: 'var(--border-strong)', width: '100%', marginBottom: 6 }} />
                                                    </div>
                                                    <div style={{ width: 140 }}>
                                                        <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>간격 ({dvc.height}px)</label>
                                                        <input type="range" min="10" max="120" step="10" value={dvc.height} onChange={(e) => updateItineraryBlockContent(flatIndex, { ...dvc, height: parseInt(e.target.value) })} style={{ width: '100%' }} />
                                                    </div>
                                                </div>
                                            );
                                        };

                                        return (
                                            <div className="stack" style={{ gap: 14 }}>
                                                {pre.length > 0 && (
                                                    <div className="stack" style={{ gap: 10, border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-lg)', padding: 14 }}>
                                                        <div className="row" style={{ gap: 6 }}><Icon name="info" /><span className="cell-strong" style={{ fontSize: 12.5 }}>일차가 지정되지 않은 기존 항목</span></div>
                                                        <p className="muted" style={{ fontSize: 11, margin: 0 }}>DAY를 추가하면 이 항목들은 첫째 날 일정으로 정리할 수 있습니다.</p>
                                                        {pre.map((ev) => (
                                                            <div key={ev.block.id} data-itinerary-block={ev.block.id} className="edit-row" style={{ background: 'var(--mrt-gray-50, #f8f9fa)', borderRadius: 'var(--r-md)', padding: 10 }}>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div className="row" style={{ gap: 8, marginBottom: 8 }}><span className="badge b-gray">{typeLabel(ev.block.type)}</span></div>
                                                                    {renderEventBody(ev.block, ev.flatIndex)}
                                                                </div>
                                                                <button type="button" className="act-btn danger" onClick={() => removeItineraryBlock(ev.flatIndex)} title="삭제"><Icon name="delete" /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {days.length === 0 && (
                                                    <div style={{ textAlign: 'center', padding: '32px 16px', border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--r-lg)', color: 'var(--mrt-gray-500)' }}>
                                                        <Icon name="event_note" style={{ fontSize: 32, opacity: 0.4 }} />
                                                        <div style={{ marginTop: 8, fontSize: 14 }}>등록된 DAY가 없습니다. 아래 버튼으로 첫 일차를 추가하세요.</div>
                                                    </div>
                                                )}

                                                {days.map((day, dayIdx) => {
                                                    const dc = day.dayInfo.content as DayInfoContent;
                                                    const collapsed = collapsedDays.has(day.dayInfo.id);
                                                    const showAdv = advancedDays.has(day.dayInfo.id);
                                                    const eventCount = day.events.filter((e) => e.block.type === 'timeline').length;
                                                    return (
                                                        <div key={day.dayInfo.id} data-itinerary-block={day.dayInfo.id} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: '#fff' }}>
                                                            {/* Day header */}
                                                            <div className="row" style={{ gap: 8, alignItems: 'center', padding: '12px 14px', background: 'var(--mrt-gray-50, #f8f9fa)', borderBottom: collapsed ? 'none' : '1px solid var(--border-subtle)' }}>
                                                                <button type="button" className="act-btn" onClick={() => toggleDayCollapsed(day.dayInfo.id)} title={collapsed ? '펼치기' : '접기'}><Icon name={collapsed ? 'expand_more' : 'expand_less'} /></button>
                                                                <span className="badge b-amber" style={{ flex: 'none' }}>{dc.dayLabel || `${dayIdx + 1}일차`}</span>
                                                                <input type="text" className="inp" style={{ flex: 1, fontWeight: 700 }} value={dc.title || ''} onChange={(e) => updateItineraryBlockContent(day.dayInfoFlatIndex, { ...dc, title: e.target.value })} placeholder="일정 제목 (예: 울란바토르 → 테를지)" />
                                                                {collapsed && eventCount > 0 && <span className="cell-muted" style={{ fontSize: 12, flex: 'none' }}>일정 {eventCount}개</span>}
                                                                <div className="edit-move" style={{ flex: 'none' }}>
                                                                    <button type="button" onClick={() => moveItineraryDay(dayIdx, -1)} disabled={dayIdx === 0}><Icon name="expand_less" /></button>
                                                                    <button type="button" onClick={() => moveItineraryDay(dayIdx, 1)} disabled={dayIdx === days.length - 1}><Icon name="expand_more" /></button>
                                                                </div>
                                                                <button type="button" className="act-btn" style={{ flex: 'none' }} onClick={() => duplicateItineraryDay(dayIdx)} title="이 일차 복제 (식사·숙소·일정 그대로 복사)"><Icon name="content_copy" /></button>
                                                                <button type="button" className="act-btn danger" style={{ flex: 'none' }} onClick={() => { if (window.confirm(`${dc.dayLabel || `${dayIdx + 1}일차`} 전체를 삭제할까요?`)) removeItineraryDay(dayIdx); }} title="이 일차 삭제"><Icon name="delete" /></button>
                                                            </div>

                                                            {!collapsed && (
                                                                <div className="stack" style={{ gap: 12, padding: 14 }}>
                                                                    <div className="field-row">
                                                                        <div>
                                                                            <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>날짜 (선택)</label>
                                                                            <input type="text" className="inp" value={dc.dayDate || ''} onChange={(e) => updateItineraryBlockContent(day.dayInfoFlatIndex, { ...dc, dayDate: e.target.value })} placeholder="05/26(화)" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>주요 일정 요약 (선택)</label>
                                                                            <input type="text" className="inp" value={dc.description || ''} onChange={(e) => updateItineraryBlockContent(day.dayInfoFlatIndex, { ...dc, description: e.target.value })} placeholder="대형마트, 테를지 국립공원, 거북바위..." />
                                                                        </div>
                                                                    </div>

                                                                    <div>
                                                                        <label className="cell-strong" style={{ fontSize: 12.5, display: 'block', marginBottom: 6 }}>식사 정보</label>
                                                                        <div className="meal-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                                                            <div className="inp-mini"><span className="pre" style={{ fontSize: 11 }}>조식</span><input value={dc.meals?.breakfast || ''} onChange={(e) => updateItineraryBlockContent(day.dayInfoFlatIndex, { ...dc, meals: { ...dc.meals, breakfast: e.target.value } })} placeholder="호텔식" /></div>
                                                                            <div className="inp-mini"><span className="pre" style={{ fontSize: 11 }}>중식</span><input value={dc.meals?.lunch || ''} onChange={(e) => updateItineraryBlockContent(day.dayInfoFlatIndex, { ...dc, meals: { ...dc.meals, lunch: e.target.value } })} placeholder="현지식" /></div>
                                                                            <div className="inp-mini"><span className="pre" style={{ fontSize: 11 }}>석식</span><input value={dc.meals?.dinner || ''} onChange={(e) => updateItineraryBlockContent(day.dayInfoFlatIndex, { ...dc, meals: { ...dc.meals, dinner: e.target.value } })} placeholder="캠프식" /></div>
                                                                        </div>
                                                                    </div>

                                                                    <div>
                                                                        <div className="row" style={{ marginBottom: 6 }}>
                                                                            <label className="cell-strong" style={{ fontSize: 12.5 }}>숙소 정보</label>
                                                                            <div className="spacer" style={{ flex: 1 }} />
                                                                            <button type="button" onClick={() => setHotelPickerForIndex(day.dayInfoFlatIndex)} className="btn btn-ghost btn-sm"><Icon name="hotel" />호텔 마스터 선택</button>
                                                                        </div>
                                                                        <div className="inp-mini"><span className="pre"><Icon name="hotel" style={{ fontSize: 14 }} /></span>
                                                                            <input value={dc.accommodation || ''} onChange={(e) => updateItineraryBlockContent(day.dayInfoFlatIndex, { ...dc, accommodation: e.target.value, accommodationHotelId: undefined })} placeholder="숙소명을 입력하거나 호텔 마스터에서 선택" />
                                                                        </div>
                                                                        {dc.accommodationHotelId && (
                                                                            <div className="row" style={{ gap: 4, marginTop: 6, fontSize: 11, color: 'var(--mrt-blue-strong)' }}><Icon name="link" style={{ fontSize: 14 }} />호텔 마스터와 연결되었습니다. 직접 입력하면 연결이 해제됩니다.</div>
                                                                        )}
                                                                    </div>

                                                                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                                                                        <label className="cell-strong" style={{ fontSize: 12.5, display: 'block', marginBottom: 2 }}><Icon name="photo_library" style={{ fontSize: 16, verticalAlign: '-3px' }} /> 디자인 사진 (일정 상세 디자인 전용)</label>
                                                                        <p className="muted" style={{ fontSize: 11.5, margin: '0 0 8px' }}>히어로 배경 1장 + 카드 상단 사진 최대 5장. 비워 두면 이 일차의 일정 사진에서 자동으로 채워집니다.</p>
                                                                        <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                                            <div>
                                                                                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>히어로 배경</div>
                                                                                <label title={dc.heroImage ? '사진 변경' : '사진 업로드'} style={{ display: 'block', position: 'relative', width: 120, height: 72, borderRadius: 'var(--r-md)', overflow: 'hidden', border: dc.heroImage ? '2px solid #06C4A0' : '2px dashed var(--border-default)', cursor: 'pointer', background: 'var(--bg-muted, #f8f9fa)' }}>
                                                                                    {dc.heroImage
                                                                                        ? <img src={getOptimizedImageUrl(dc.heroImage, 'productThumbnail')} alt="히어로" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                        : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}><Icon name="add_a_photo" style={{ fontSize: 18 }} /></span>}
                                                                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { handleDayInfoDesignImages(day.dayInfoFlatIndex, 'hero', e.target.files); e.target.value = ''; }} />
                                                                                </label>
                                                                                {dc.heroImage && (
                                                                                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => updateItineraryBlockContent(day.dayInfoFlatIndex, { ...dc, heroImage: undefined })}>제거</button>
                                                                                )}
                                                                            </div>
                                                                            <div style={{ flex: 1, minWidth: 260 }}>
                                                                                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>카드 상단 사진 ({(dc.galleryImages || []).length}/5) — 2열 배치, 홀수 장이면 마지막이 와이드</div>
                                                                                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                                                                                    {(dc.galleryImages || []).map((img, gi) => (
                                                                                        <div key={gi} style={{ position: 'relative', flex: 'none' }}>
                                                                                            <img src={getOptimizedImageUrl(img, 'productThumbnail')} alt={`상단 사진 ${gi + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--border-default)' }} />
                                                                                            <button type="button" onClick={() => updateItineraryBlockContent(day.dayInfoFlatIndex, { ...dc, galleryImages: (dc.galleryImages || []).filter((_, k) => k !== gi) })} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'var(--mrt-red)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" style={{ fontSize: 13 }} /></button>
                                                                                        </div>
                                                                                    ))}
                                                                                    {(dc.galleryImages || []).length < 5 && (
                                                                                        <label title="사진 추가" style={{ width: 72, height: 72, borderRadius: 'var(--r-md)', border: '2px dashed var(--border-default)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', background: 'var(--bg-muted, #f8f9fa)' }}>
                                                                                            <Icon name="add_a_photo" style={{ fontSize: 18 }} />
                                                                                            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { handleDayInfoDesignImages(day.dayInfoFlatIndex, 'gallery', e.target.files); e.target.value = ''; }} />
                                                                                        </label>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                                                                        <label className="cell-strong" style={{ fontSize: 12.5, display: 'block', marginBottom: 8 }}><Icon name="timeline" style={{ fontSize: 16, verticalAlign: '-3px' }} /> 이 일차의 주요 일정</label>
                                                                        {day.events.length === 0 && (
                                                                            <p className="muted" style={{ fontSize: 12, padding: '2px 0 8px', margin: 0 }}>등록된 일정이 없습니다. 아래 버튼으로 추가하세요.</p>
                                                                        )}
                                                                        <div className="stack" style={{ gap: 10 }}>
                                                                            {day.events.map((ev, evIdx) => (
                                                                                <div key={ev.block.id} data-itinerary-block={ev.block.id} className="edit-row" style={{ background: 'var(--mrt-gray-50, #f8f9fa)', borderRadius: 'var(--r-md)', padding: 10 }}>
                                                                                    <div className="edit-move">
                                                                                        <button type="button" onClick={() => moveItineraryEvent(dayIdx, evIdx, -1)} disabled={evIdx === 0}><Icon name="expand_less" /></button>
                                                                                        <button type="button" onClick={() => moveItineraryEvent(dayIdx, evIdx, 1)} disabled={evIdx === day.events.length - 1}><Icon name="expand_more" /></button>
                                                                                    </div>
                                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                                        <div className="row" style={{ gap: 8, marginBottom: 8 }}><span className="badge b-gray">{typeLabel(ev.block.type)}</span></div>
                                                                                        {renderEventBody(ev.block, ev.flatIndex)}
                                                                                    </div>
                                                                                    <button type="button" className="act-btn danger" onClick={() => removeItineraryEvent(dayIdx, evIdx)} title="삭제"><Icon name="delete" /></button>
                                                                                </div>
                                                                            ))}
                                                                        </div>

                                                                        <button type="button" onClick={() => addItineraryEvent(dayIdx, 'timeline')} className="add-line" style={{ marginTop: 10 }}><Icon name="add_circle" />일정 항목 추가</button>

                                                                        <div style={{ marginTop: 8 }}>
                                                                            <button type="button" onClick={() => toggleDayAdvanced(day.dayInfo.id)} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}><Icon name={showAdv ? 'expand_less' : 'tune'} />고급 항목 (이미지·갤러리·구분선)</button>
                                                                            {showAdv && (
                                                                                <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                                                                    <button type="button" onClick={() => addItineraryEvent(dayIdx, 'image')} className="chip"><Icon name="image" style={{ fontSize: 16 }} />이미지 1장</button>
                                                                                    <button type="button" onClick={() => addItineraryEvent(dayIdx, 'slide')} className="chip"><Icon name="view_carousel" style={{ fontSize: 16 }} />갤러리</button>
                                                                                    <button type="button" onClick={() => addItineraryEvent(dayIdx, 'divider')} className="chip"><Icon name="horizontal_rule" style={{ fontSize: 16 }} />구분선</button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                <button type="button" onClick={addItineraryDay} className="add-line" style={{ padding: 14, fontSize: 14, fontWeight: 700, borderWidth: 1.5 }}><Icon name="add" />DAY 추가</button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Options Tab */}
                        {currentTab === 'options' && (
                            <div className="stack" style={{ maxWidth: 860 }}>
                                {/* Pricing Options */}
                                <section className="edit-sec">
                                    <div className="edit-sec-head">
                                        <Icon name="groups" />
                                        <h4>인원별 가격 옵션</h4>
                                        <span className="muted">1인 가격 · 예약금 · 현지결제</span>
                                    </div>
                                    <div className="opt-grid-head"><span>인원</span><span>1인 총가격</span><span>예약금</span><span>현지 결제</span><span></span></div>
                                    <div className="stack" style={{ gap: 10 }}>
                                        {formData.pricingOptions?.map((option, index) => (
                                            <div className="edit-row" key={index}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div className="opt-grid">
                                                        <div className="inp-mini"><input type="number" value={option.people} onChange={(e) => updatePricingOption(index, 'people', Number(e.target.value))} /><span>명</span></div>
                                                        <div className="inp-mini"><input type="number" value={option.pricePerPerson} onChange={(e) => updatePricingOption(index, 'pricePerPerson', Number(e.target.value))} /><span>원</span></div>
                                                        <div className="inp-mini"><input type="number" value={option.depositPerPerson || 0} onChange={(e) => updatePricingOption(index, 'depositPerPerson', Number(e.target.value))} /><span>원</span></div>
                                                        <div className="inp-mini"><input type="number" value={option.localPaymentPerPerson || 0} onChange={(e) => updatePricingOption(index, 'localPaymentPerPerson', Number(e.target.value))} /><span>원</span></div>
                                                    </div>
                                                </div>
                                                <button type="button" className="act-btn danger" onClick={() => removePricingOption(index)} title="삭제"><Icon name="delete" /></button>
                                            </div>
                                        ))}
                                        {(!formData.pricingOptions || formData.pricingOptions.length === 0) && (
                                            <p className="muted" style={{ textAlign: 'center', padding: '8px 0', fontSize: 13 }}>등록된 가격 옵션이 없습니다.</p>
                                        )}
                                        <button type="button" className="add-line" onClick={addPricingOption}><Icon name="add" />인원 옵션 추가</button>
                                    </div>
                                </section>

                                {/* Accommodation Options */}
                                <section className="edit-sec">
                                    <div className="edit-sec-head">
                                        <Icon name="hotel" />
                                        <h4>숙소 옵션</h4>
                                        <span className="muted">기본 1개 선택</span>
                                    </div>
                                    <div className="stack" style={{ gap: 10 }}>
                                        {formData.accommodationOptions?.map((option, index) => (
                                            <div className="edit-row" key={index}>
                                                <div style={{ flex: 1, minWidth: 0 }} className="opt-card">
                                                    <div className="row" style={{ gap: 8 }}>
                                                        <button
                                                            type="button"
                                                            className={`radio${option.isDefault ? ' on' : ''}`}
                                                            onClick={() => updateAccommodationOption(index, 'isDefault', true)}
                                                            title="기본 옵션"
                                                        />
                                                        <input
                                                            type="text"
                                                            className="inp"
                                                            style={{ flex: 1 }}
                                                            value={option.name}
                                                            onChange={(e) => updateAccommodationOption(index, 'name', e.target.value)}
                                                            placeholder="옵션명 (예: 게르)"
                                                        />
                                                        <div className="inp-mini" style={{ width: 130 }}><span className="pre">+</span><input type="number" value={option.priceModifier} onChange={(e) => updateAccommodationOption(index, 'priceModifier', Number(e.target.value))} placeholder="0" /><span>원</span></div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        className="inp"
                                                        style={{ marginTop: 8 }}
                                                        value={option.description}
                                                        onChange={(e) => updateAccommodationOption(index, 'description', e.target.value)}
                                                        placeholder="옵션 설명"
                                                    />
                                                </div>
                                                <button type="button" className="act-btn danger" onClick={() => removeAccommodationOption(index)} title="삭제"><Icon name="delete" /></button>
                                            </div>
                                        ))}
                                        <button type="button" className="add-line" onClick={addAccommodationOption}><Icon name="add" />숙소 옵션 추가</button>
                                    </div>
                                </section>

                                {/* Vehicle Options */}
                                <section className="edit-sec">
                                    <div className="edit-sec-head">
                                        <Icon name="directions_car" />
                                        <h4>차량 옵션</h4>
                                        <span className="muted">기본 1개 선택</span>
                                    </div>
                                    <div className="stack" style={{ gap: 10 }}>
                                        {formData.vehicleOptions?.map((option, index) => (
                                            <div className="edit-row" key={index}>
                                                <div style={{ flex: 1, minWidth: 0 }} className="opt-card">
                                                    <div className="row" style={{ gap: 8 }}>
                                                        <button
                                                            type="button"
                                                            className={`radio${option.isDefault ? ' on' : ''}`}
                                                            onClick={() => updateVehicleOption(index, 'isDefault', true)}
                                                            title="기본 옵션"
                                                        />
                                                        <input
                                                            type="text"
                                                            className="inp"
                                                            style={{ flex: 1 }}
                                                            value={option.name}
                                                            onChange={(e) => updateVehicleOption(index, 'name', e.target.value)}
                                                            placeholder="옵션명 (예: 스타렉스)"
                                                        />
                                                        <div className="inp-mini" style={{ width: 130 }}><span className="pre">+</span><input type="number" value={option.priceModifier} onChange={(e) => updateVehicleOption(index, 'priceModifier', Number(e.target.value))} placeholder="0" /><span>원</span></div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        className="inp"
                                                        style={{ marginTop: 8 }}
                                                        value={option.description}
                                                        onChange={(e) => updateVehicleOption(index, 'description', e.target.value)}
                                                        placeholder="옵션 설명"
                                                    />
                                                </div>
                                                <button type="button" className="act-btn danger" onClick={() => removeVehicleOption(index)} title="삭제"><Icon name="delete" /></button>
                                            </div>
                                        ))}
                                        <button type="button" className="add-line" onClick={addVehicleOption}><Icon name="add" />차량 옵션 추가</button>
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* Includes Tab */}
                        {currentTab === 'includes' && (
                            <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 18, maxWidth: 860 }}>
                                {/* Included */}
                                <section className="edit-sec">
                                    <div className="edit-sec-head">
                                        <Icon name="check_circle" style={{ color: 'var(--mrt-green)' }} />
                                        <h4>포함 사항</h4>
                                    </div>
                                    <div className="stack" style={{ gap: 8 }}>
                                        {formData.included?.map((item, index) => (
                                            <div className="row" style={{ gap: 8 }} key={index}>
                                                <Icon name="check_circle" style={{ color: 'var(--mrt-green)', fontSize: 18, flex: 'none' }} />
                                                <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-body)' }}>{item}</span>
                                                <button type="button" className="act-btn danger" onClick={() => removeIncluded(index)} title="삭제"><Icon name="close" /></button>
                                            </div>
                                        ))}
                                        <input
                                            type="text"
                                            className="inp"
                                            placeholder="포함 항목 입력 후 Enter"
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addIncluded((e.target as HTMLInputElement).value);
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </section>

                                {/* Excluded */}
                                <section className="edit-sec">
                                    <div className="edit-sec-head">
                                        <Icon name="cancel" style={{ color: 'var(--mrt-red)' }} />
                                        <h4>불포함 사항</h4>
                                    </div>
                                    <div className="stack" style={{ gap: 8 }}>
                                        {formData.excluded?.map((item, index) => (
                                            <div className="row" style={{ gap: 8 }} key={index}>
                                                <Icon name="cancel" style={{ color: 'var(--mrt-red)', fontSize: 18, flex: 'none' }} />
                                                <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-body)' }}>{item}</span>
                                                <button type="button" className="act-btn danger" onClick={() => removeExcluded(index)} title="삭제"><Icon name="close" /></button>
                                            </div>
                                        ))}
                                        <input
                                            type="text"
                                            className="inp"
                                            placeholder="불포함 항목 입력 후 Enter"
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addExcluded((e.target as HTMLInputElement).value);
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>

                    {/* Footer — 페이지 스크롤 중에도 항상 보이는 저장 바 */}
                    <div className="card-pad row pa-savebar" style={{ justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border-subtle)', position: 'sticky', bottom: 0, background: 'var(--bg-card, #fff)', zIndex: 5 }}>
                        <span className="pa-save-note">필수 항목 <b>{requiredDone} / {requiredChecks.length}</b>{requiredDone < requiredChecks.length ? ' · 모두 채우면 공개 준비가 끝나요' : ' · 저장할 준비가 됐어요'}</span>
                        <button type="button" onClick={closeEditor} disabled={busy} className="btn btn-ghost">
                            취소
                        </button>
                        <button type="submit" className="btn btn-ink" disabled={locked}>
                            <Icon name="check" />{saving ? '저장 중…' : '상품 저장'}
                        </button>
                    </div>
                    </fieldset>
                </form>
                </div>
                <aside className="pa-aside" aria-label="상품 미리보기와 필수 항목">
                    <section className="pa-preview">
                        <div className="pa-preview-image">{formData.mainImages?.[0] ? <img src={getOptimizedImageUrl(formData.mainImages[0], 'productThumbnail')} alt="" /> : <DashboardIcon name="lc-image-plus" size={28} />}</div>
                        <div className="pa-preview-copy">
                            <b>{formData.name?.trim() || '상품명을 입력하세요'}</b>
                            <span>{[formData.category, formData.duration].filter(Boolean).join(' · ') || '카테고리 · 기간'}</span>
                            <strong>{Number(formData.price) > 0 ? `${Number(formData.price).toLocaleString('ko-KR')}원~` : '0원~'}</strong>
                        </div>
                    </section>
                    <section className="pa-checks">
                        <h3>필수 항목</h3>
                        <ul>{requiredChecks.map(([label, done]) => <li key={label} className={done ? 'is-done' : ''}><span aria-hidden="true"><DashboardIcon name="lc-check" size={12} strokeWidth={3} /></span>{label}</li>)}</ul>
                    </section>
                </aside>
                </div>

                {/* Master pickers — open from either dayInfo or timeline buttons. */}
                <HotelPickerModal
                    open={hotelPickerTarget != null}
                    onPick={handleHotelPick}
                    onClose={() => setHotelPickerTarget(null)}
                />
                <ItineraryImportModal
                    open={itineraryImportOpen}
                    currentProductId={product?.id}
                    onPick={importItineraryFrom}
                    onClose={() => setItineraryImportOpen(false)}
                />
                <TouristSpotPickerModal
                    open={spotPickerForIndex != null}
                    onPick={handleSpotPick}
                    onClose={() => setSpotPickerForIndex(null)}
                />
        </div>
    );
};

// ============================================================================
// Itinerary Quick Actions — bulk image upload zone + N-day skeleton macro.
// Lives at the top of the "일정" tab so adding many photos or stamping out a
// multi-day skeleton is one click away instead of a clicking marathon.
// ============================================================================
interface ItineraryQuickActionsProps {
    onBulkImages: (files: File[]) => void | Promise<void>;
    onSkeleton: (days: number) => void;
    onImport: () => void;
    uploading: boolean;
    progress: { done: number; total: number } | null;
}

const ItineraryQuickActions: React.FC<ItineraryQuickActionsProps> = ({
    onBulkImages,
    onSkeleton,
    onImport,
    uploading,
    progress,
}) => {
    const [drag, setDrag] = useState(false);
    const [skeletonDays, setSkeletonDays] = useState<number>(3);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFiles = (fileList: FileList | null) => {
        if (!fileList) return;
        const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
        if (files.length === 0) return;
        onBulkImages(files);
    };

    return (
        <div className="stack" style={{ gap: 12 }}>
            {/* ─── Bulk image drop zone ─── */}
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!uploading) setDrag(true);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDrag(false);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDrag(false);
                    if (uploading) return;
                    handleFiles(e.dataTransfer.files);
                }}
                onClick={() => {
                    if (uploading) return;
                    fileInputRef.current?.click();
                }}
                style={{
                    position: 'relative',
                    width: '100%',
                    borderRadius: 'var(--r-lg)',
                    border: '1.5px dashed',
                    borderColor: drag ? 'var(--mrt-blue)' : 'var(--border-strong)',
                    background: drag ? 'var(--mrt-blue-50)' : (uploading ? 'var(--mrt-gray-50)' : '#fff'),
                    cursor: uploading ? 'wait' : 'pointer',
                    padding: '24px',
                    transition: 'all var(--dur-fast)',
                }}
                role="button"
                tabIndex={0}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        handleFiles(e.target.files);
                        // reset so picking the same files again still fires
                        e.target.value = '';
                    }}
                />
                <div className="row" style={{ gap: 14 }}>
                    <span className="metric-ico tint-blue" style={{ width: 44, height: 44, flex: 'none' }}>
                        <Icon name={uploading ? 'hourglass_top' : 'cloud_upload'} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cell-strong" style={{ marginBottom: 2 }}>
                            {uploading
                                ? `업로드 중... ${progress ? `${progress.done} / ${progress.total}` : ''}`
                                : '이미지 한 번에 업로드'}
                        </div>
                        <div className="cell-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                            여러 장의 사진을 이 박스에 드래그하거나 클릭해서 선택하세요. 각 사진이 자동으로 일정 끝에 추가됩니다.
                        </div>
                    </div>
                    {!uploading && (
                        <Icon name="add_photo_alternate" style={{ color: 'var(--mrt-gray-400)', fontSize: 22 }} />
                    )}
                </div>
            </div>

            {/* ─── 일정표 불러오기 ─── */}
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', padding: 16, borderRadius: 'var(--r-lg)', background: '#E6FAF4', border: '1px solid #B5E9D9' }}>
                <span className="metric-ico tint-green" style={{ width: 40, height: 40, flex: 'none' }}>
                    <Icon name="content_copy" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cell-strong" style={{ color: '#0f6b58' }}>일정표 불러오기</div>
                    <div style={{ fontSize: 12, color: '#2a7d6a', marginTop: 2 }}>
                        기존 상품의 일정표를 사진·내용 그대로 가져옵니다. 가져온 뒤 이 상품에 맞게 편집만 하면 됩니다.
                    </div>
                </div>
                <button type="button" onClick={onImport} className="btn btn-ink btn-sm" style={{ flex: 'none' }}>
                    <Icon name="download" />불러오기
                </button>
            </div>

            {/* ─── N-day skeleton macro ─── */}
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', padding: 16, borderRadius: 'var(--r-lg)', background: '#FFF3DC', border: '1px solid #F0DBA8' }}>
                <span className="metric-ico tint-amber" style={{ width: 40, height: 40, flex: 'none' }}>
                    <Icon name="calendar_view_day" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cell-strong" style={{ color: '#8a5a12' }}>N일 일정 골격 만들기</div>
                    <div style={{ fontSize: 12, color: '#9a6a22', marginTop: 2 }}>
                        1일차 ~ N일차 헤더와 구분선을 한 번에 생성합니다. 각 날짜는 펼쳐서 내용 채우세요.
                    </div>
                </div>
                <div className="row" style={{ gap: 8, flex: 'none' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#8a5a12' }}>일수</label>
                    <select
                        value={skeletonDays}
                        onChange={(e) => setSkeletonDays(Number(e.target.value))}
                        className="select"
                        style={{ height: 36, fontSize: 13 }}
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <option key={n} value={n}>
                                {n}일
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => onSkeleton(skeletonDays)}
                        className="btn btn-ink btn-sm"
                    >
                        <Icon name="add" />생성
                    </button>
                </div>
            </div>
        </div>
    );
};
