import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { getOptimizedImageUrl } from '../../utils/cloudflareImage';
import type { TourProduct } from '../../types/product';
import { withPublicProductPrice } from '../../utils/publicProductPrice';
import { StartingPrice } from '../product/StartingPrice';

export const CentralMongoliaSection: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<TourProduct[]>([]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const data = await api.products.list();
                if (Array.isArray(data)) {
                    const centralData = data.filter((item: any) => item.category === '중앙몽골' && item.status === 'active').slice(0, 4);
                    const formattedProducts = centralData.map((item: any) => ({
                        ...withPublicProductPrice(item),
                        id: item.id,
                        name: item.name,
                        duration: item.duration,
                        category: item.category,
                        mainImages: item.main_images || [],
                        isPopular: item.is_popular,
                        tags: item.tags || [],
                        description: item.description,
                        galleryImages: item.gallery_images || [],
                        detailImages: item.detail_images || [],
                        itineraryImages: item.itinerary_images || [],
                        status: item.status,
                        isFeatured: item.is_featured,
                        highlights: item.highlights || [],
                        included: item.included || [],
                        excluded: item.excluded || [],
                        viewCount: item.view_count,
                        bookingCount: item.booking_count,
                        createdAt: item.created_at,
                        updatedAt: item.updated_at
                    }));
                    setProducts(formattedProducts);
                }
            } catch (error) {
                console.error('Error fetching Central Mongolia products:', error);
            }
        };

        fetchProducts();
    }, []);

    if (products.length === 0) return null;

    return (
        <section className="py-8 px-5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-end justify-between mb-5">
                <div>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">중앙 몽골 클래식</h3>
                    <p className="text-[13px] text-slate-500 mt-1">푸른 초원과 역사가 공존하는 곳</p>
                </div>
                <button
                    onClick={() => navigate('/products?category=central')}
                    className="text-primary text-sm font-bold flex items-center"
                >
                    더 보기 <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
            </div>

            {/* Horizontal Scroll Layout */}
            <div className="flex overflow-x-auto gap-4 scroll-smooth no-scrollbar snap-x snap-mandatory -mx-5 px-5 pb-2">
                {products.map((product) => (
                    <div
                        key={product.id}
                        onClick={() => navigate(`/products/${product.id}`)}
                        className="flex-shrink-0 w-[240px] snap-center flex flex-col group cursor-pointer"
                    >
                        <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 bg-slate-100 dark:bg-slate-800">
                            <img
                                alt={`${product.name} | 중앙 몽골 여행·몽골 투어`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                src={getOptimizedImageUrl(product.mainImages[0], 'productThumbnail')}
                                loading="lazy"
                                width={240}
                                height={240}
                            />
                            {/* Best Badge if applicable - checking tags for 'BEST' or isPopular */}
                            {(product.isPopular || product.tags?.includes('BEST')) && (
                                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-primary rounded text-[9px] font-bold text-white shadow-sm">
                                    BEST
                                </div>
                            )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                            {product.name}
                        </h4>
                        <div className="flex items-center gap-1.5">
                            <span className="text-primary font-bold text-[14px]">
                                <StartingPrice product={product} />
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};
