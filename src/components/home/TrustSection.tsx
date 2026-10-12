import React from 'react';
import { useTranslation } from 'react-i18next';

export const TrustSection: React.FC = () => {
    const { t } = useTranslation();

    const trustItems = [
        {
            icon: 'g_translate',
            title: t('home.magazine.trust.item1_title', { defaultValue: '1. 한국어 완벽 지원' }),
            desc: t('home.magazine.trust.item1_desc', { defaultValue: '한국어에 능통한 전문 가이드가 동행해 언어의 벽 없이 안심하고 여행할 수 있습니다.' })
        },
        {
            icon: 'support_agent',
            title: t('home.magazine.trust.item2_title', { defaultValue: '2. 24시간 지원' }),
            desc: t('home.magazine.trust.item2_desc', { defaultValue: '여행 중 긴급 상황에도 한국어 채팅으로 24시간 신속하게 대응합니다' })
        },
        {
            icon: 'restaurant',
            title: t('home.magazine.trust.item3_title', { defaultValue: '3. 한국인 입맛에 맞춘 식사' }),
            desc: t('home.magazine.trust.item3_desc', { defaultValue: '위생 관리를 철저히 하고, 한국인 입맛에 맞는 맛있는 몽골 요리를 제안합니다.' })
        },
        {
            icon: 'verified_user',
            title: t('home.magazine.trust.item4_title', { defaultValue: '4. 안전 최우선 차량 관리' }),
            desc: t('home.magazine.trust.item4_desc', { defaultValue: '정기 점검을 통과한 안전한 차량만 사용해 쾌적한 이동을 보장합니다.' })
        }
    ];

    return (
        <section className="py-16 bg-slate-50 dark:bg-slate-900/50">
            <div className="max-w-7xl mx-auto px-5">
                <div className="text-center mb-12">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mb-4">
                        {t('home.magazine.trust.title', { defaultValue: '몽골리아 은하수를 선택하는 이유' })}
                    </h2>
                    <div className="w-12 h-1 bg-primary mx-auto rounded-full"></div>
                </div>

                <div className="grid grid-cols-1 gap-5">
                    {trustItems.map((item, index) => (
                        <div 
                            key={index} 
                            className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-start gap-4 hover:shadow-md transition-shadow"
                        >
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                                <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
                                    {item.title}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
