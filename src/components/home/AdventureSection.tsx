import React, { useMemo } from 'react';
import { getOptimizedImageUrl } from '../../utils/cloudflareImage';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PublicProductPriceFields } from '../../utils/publicProductPrice';
import { StartingPrice } from '../product/StartingPrice';

interface Product extends PublicProductPriceFields {
    id: string;
    name: string;
    price: number;
    mainImages: string[];
    duration: string;
}

interface AdventureSectionProps {
    products: Product[];
}

export const AdventureSection: React.FC<AdventureSectionProps> = ({ products }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Filter or slice to show only a few items
    const displayProducts = useMemo(() => products.slice(0, 5), [products]);

    if (products.length === 0) {
        return null;
    }

    return (
        <section className="pt-4 pb-8 px-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[19px] font-bold text-slate-900 dark:text-white">{t('home.adventure.title')}</h3>

            </div>

            {/* Horizontal Scroll List */}
            <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-5 px-5 pb-4">
                {displayProducts.map((product) => (
                    <div
                        key={product.id}
                        onClick={() => navigate(`/products/${product.id}`)}
                        className="min-w-[220px] w-[220px] cursor-pointer group snap-center"
                    >
                        {/* Image */}
                        <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-slate-100">
                            {product.mainImages?.[0] ? (
                                <img
                                    src={getOptimizedImageUrl(product.mainImages[0], 'productThumbnail')}
                                    alt={`${product.name} | 몽골 여행·몽골 투어`}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                        const icon = document.createElement('span');
                                        icon.className = 'material-symbols-outlined text-3xl text-slate-300';
                                        icon.textContent = 'landscape';
                                        target.parentElement?.appendChild(icon);
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-3xl text-slate-300">landscape</span>
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="space-y-1">
                            {/* Title */}
                            <h4 className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">
                                {product.name}
                            </h4>

                            {/* Duration/Tag */}
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                                <span>{product.duration}</span>
                            </div>

                            {/* Price */}
                            <div className="pt-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[15px] font-bold text-primary">
                                        <StartingPrice product={product} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};
