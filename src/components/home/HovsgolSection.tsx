import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { getOptimizedImageUrl } from '../../utils/cloudflareImage';
import { withPublicProductPrice } from '../../utils/publicProductPrice';
import { StartingPrice } from '../product/StartingPrice';

export const HovsgolSection: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = React.useState<any[]>([]);

    React.useEffect(() => {
        const fetchProducts = async () => {
            try {
                const data = await api.products.list();
                if (Array.isArray(data)) {
                    const khuvsgulData = data.filter((p: any) => p.category === '홉스굴').slice(0, 3);
                    setProducts(khuvsgulData.map((p: any) => ({
                        ...withPublicProductPrice(p),
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        mainImages: p.mainImages || p.main_images || [],
                        duration: p.duration,
                        highlights: p.highlights || [],
                        isPopular: p.is_popular,
                        tags: p.tags || []
                    })));
                }
            } catch (error) {
                console.error('Error fetching Khuvsgul products:', error);
            }
        };
        fetchProducts();
    }, []);

    // Filter for Khuvsgul products
    const khuvsgulProducts = products.filter(p => p.category === '홉스굴').slice(0, 3);

    return (
        <section className="py-8 px-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-background-dark">
            <div className="flex items-end justify-between mb-6">
                <div>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">푸른 진주 홉스굴</h3>
                    <p className="text-[13px] text-slate-500 mt-1">몽골의 어머니라 불리는 거대한 호수</p>
                </div>
                <button onClick={() => navigate('/products?category=khuvsgul')} className="text-primary text-sm font-bold flex items-center">전체 보기 <span className="material-symbols-outlined text-sm">chevron_right</span></button>
            </div>
            <div className="space-y-4">
                {khuvsgulProducts.length > 0 ? (
                    khuvsgulProducts.map((product) => (
                        <React.Fragment key={product.id}>
                            <div onClick={() => navigate(`/products/${product.id}`)} className="flex gap-4 group cursor-pointer">
                                <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800">
                                    <img
                                        alt={`${product.name} | 홉스굴 호수 투어·몽골 여행`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                        src={getOptimizedImageUrl(product.mainImages[0], 'productThumbnail')}
                                        width={96}
                                        height={96} loading="lazy" decoding="async" />
                                </div>
                                <div className="flex flex-col justify-center py-1 flex-1">
                                    <span className="text-[10px] font-bold text-primary mb-1">
                                        {product.isPopular ? '인기 급상승' : (product.tags?.[0] || '추천')}
                                    </span>
                                    <h4 className="text-[15px] font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">
                                        {product.name}
                                    </h4>
                                    <p className="text-[12px] text-slate-500 mb-2 line-clamp-1">
                                        {product.duration} · {product.highlights?.[0]?.title || '힐링 여행'}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[14px] font-bold text-slate-900 dark:text-white">
                                            <StartingPrice product={product} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full h-px bg-slate-100 dark:bg-slate-800 last:hidden"></div>
                        </React.Fragment>
                    ))
                ) : (
                    <div className="text-center py-8 text-slate-400 text-sm">
                        등록된 홉스굴 상품이 없습니다.
                    </div>
                )}
            </div>
        </section>
    );
};
