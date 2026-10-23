import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { optimizeImage } from '../../utils/imageOptimizer';
import type { TourProduct } from '../../types/product';
import { StartingPrice } from './StartingPrice';
import type { PublicProductPriceFields } from '../../utils/publicProductPrice';

interface ProductCardProps {
    product: Pick<TourProduct, 'id' | 'name' | 'price' | 'originalPrice' | 'category' | 'duration' | 'mainImages'> & PublicProductPriceFields;
    className?: string;
    imageHeight?: string; // Optional height for card image
}

export const ProductCard = memo(({ product, className = '', imageHeight = 'aspect-square' }: ProductCardProps) => {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => navigate(`/products/${product.id}`)}
            className={`flex flex-col bg-white dark:bg-white/5 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/5 cursor-pointer active:scale-95 transition-transform h-full ${className}`}
        >
            <div className={`relative w-full ${imageHeight} bg-gray-100 dark:bg-gray-800 overflow-hidden`}>
                <img
                    src={optimizeImage(product.mainImages[0], { width: 400 })} // Only width to maintain aspect ratio
                    alt={`${product.name} | 몽골 여행·몽골 투어`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    width="400"
                    height="300"
                />
                <button className="absolute top-2 right-2 size-8 flex items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm hover:bg-black/30 transition-colors">
                    <span className="material-symbols-outlined text-sm">favorite</span>
                </button>
            </div>
            <div className="p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {product.category} | {product.duration}
                </p>
                <p className="text-sm font-bold line-clamp-2 mb-2 text-[#0e1a18] dark:text-white min-h-[40px]">
                    {product.name}
                </p>
                <p className="text-sm font-bold text-primary">
                    <StartingPrice product={product} />
                </p>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for React.memo to minimize re-renders
    return (
        prevProps.product.id === nextProps.product.id &&
        prevProps.product.name === nextProps.product.name &&
        prevProps.product.price === nextProps.product.price &&
        prevProps.product.startingPrice === nextProps.product.startingPrice &&
        prevProps.product.priceBasisPeople === nextProps.product.priceBasisPeople &&
        prevProps.product.priceReady === nextProps.product.priceReady &&
        prevProps.product.pricingOptions === nextProps.product.pricingOptions &&
        prevProps.product.pricing_options === nextProps.product.pricing_options &&
        prevProps.product.mainImages[0] === nextProps.product.mainImages[0]
    );
});

ProductCard.displayName = 'ProductCard';
