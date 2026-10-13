import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { getOptimizedImageUrl } from '../../utils/cloudflareImage';
import { won } from '../desktop-primitives/mwTokens';

export const GobiSection: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = React.useState<any[]>([]);

    React.useEffect(() => {
        const fetchProducts = async () => {
            try {
                const data = await api.products.list();
                if (Array.isArray(data)) {
                    const gobiData = data.filter((p: any) => p.category === '고비사막').slice(0, 4);
                    setProducts(gobiData.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        price: p.price,
                        mainImages: p.mainImages || p.main_images || [],
                        isPopular: p.is_popular,
                        tags: p.tags || []
                    })));
                }
            } catch (error) {
                console.error('Error fetching Gobi products:', error);
            }
        };
        fetchProducts();
    }, []);

    // Filter for Gobi Desert products
    const gobiProducts = products.filter(p => p.category === '고비사막').slice(0, 4);

    return (
        <section className="py-10 bg-slate-900 relative overflow-hidden">
            <div className="absolute inset-0 opacity-40">
                {products.length > 0 && products[0].mainImages?.[0] ? (
                    <img
                        alt=""
                        aria-hidden="true"
                        className="w-full h-full object-cover"
                        src={getOptimizedImageUrl(products[0].mainImages[0], 'heroBanner')}
                        width={1920}
                        height={600} loading="lazy" decoding="async" />
                ) : null}
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/90"></div>

            <div className="relative z-10 px-5 mb-6 flex items-end justify-between">
                <div>
                    <h3 className="text-xl font-extrabold text-white">신비로운 고비사막</h3>
                    <p className="text-[13px] text-white/60 mt-1 text-shadow-sm">모래언덕과 쏟아지는 별빛의 향연</p>
                </div>
                <button onClick={() => navigate('/products?category=gobi')} className="text-primary text-sm font-bold flex items-center">전체 보기 <span className="material-symbols-outlined text-sm">chevron_right</span></button>
            </div>

            <div className="relative z-10 flex overflow-x-auto gap-4 px-5 pb-4 scrollbar-hide snap-x snap-mandatory">
                {gobiProducts.length > 0 ? (
                    gobiProducts.map((product) => (
                        <div
                            key={product.id}
                            onClick={() => navigate(`/products/${product.id}`)}
                            className="min-w-[260px] w-[260px] snap-center cursor-pointer active:scale-95 transition-transform"
                        >
                            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-white/10 group">
                                <img
                                    alt={`${product.name} | 고비사막 투어·몽골 여행`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    src={getOptimizedImageUrl(product.mainImages[0], 'productThumbnail')}
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                <div className="absolute bottom-5 left-5 right-5">
                                    {/* Display 'Popular' or 'Private' tag if specific criteria met, or generic 'Gobi' tag */}
                                    <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-[10px] text-white font-bold mb-2">
                                        {product.isPopular ? '인기 코스' : (product.tags?.[0] || '고비사막')}
                                    </span>
                                    <h4 className="text-lg font-bold text-white mb-1 leading-tight line-clamp-2">
                                        {product.name}
                                    </h4>
                                    <p className="text-primary font-bold">{won(product.price)}~</p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-white/60 text-sm py-10 px-5">등록된 상품이 없습니다.</div>
                )}
            </div>
        </section>
    );
};
