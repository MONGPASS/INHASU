import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { SEO } from '../components/seo/SEO';
import { InfoLayoutDesktop } from '../components/info/InfoLayoutDesktop';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { FaqMobile, FaqPanel, type FaqCategory, type FaqItem } from '../components/support-mobile/FaqMobile';

interface RawFaqCategory { id: string; name: string; is_active?: number | boolean }
interface RawFaq { id: string; question: string; answer: string; category?: string; is_active?: number | boolean; view_count?: number }

export const FAQPage: React.FC = () => {
    const isDesktop = useIsDesktop();
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<FaqCategory[]>([]);
    const [faqs, setFaqs] = useState<FaqItem[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            // Loaded independently: the questions must still show when the category list is unavailable.
            const [catRes, faqRes] = await Promise.allSettled([api.faqCategories.list(), api.faqs.list()]);
            const items: FaqItem[] = faqRes.status === 'fulfilled' && Array.isArray(faqRes.value)
                ? (faqRes.value as RawFaq[]).filter((f) => f.is_active).map((f) => ({ id: f.id, question: f.question, answer: f.answer, category: f.category || '', viewCount: f.view_count || 0 }))
                : [];
            if (faqRes.status === 'rejected') console.error('Error fetching FAQ data:', faqRes.reason);
            const used = new Set(items.map((f) => f.category).filter(Boolean));
            const fromApi: FaqCategory[] = catRes.status === 'fulfilled' && Array.isArray(catRes.value)
                ? (catRes.value as RawFaqCategory[]).filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name }))
                : [];
            // Without a category list, group by the categories the questions themselves carry.
            const cats = fromApi.length > 0 ? fromApi : [...used].map((name) => ({ id: name, name }));
            setFaqs(items);
            setCategories(cats.length > 1 ? cats : []);
            setLoading(false);
        };
        fetchData();
    }, []);

    // Build FAQPage structured data from loaded FAQs (only when data exists)
    const faqStructuredData = faqs.length > 0 ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.slice(0, 20).map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
            }
        }))
    } : undefined;

    const seo = (
        <SEO
            title="자주 묻는 질문 (FAQ)"
            description="몽골 여행에 관해 자주 묻는 질문과 답변입니다. 예약 방법, 투어 내용, 준비물, 비자, 결제·취소 등 몽골 투어에 대한 궁금증을 풀어 드립니다."
            keywords="몽골 여행 FAQ, 몽골 투어 질문, 몽골 여행 준비물, 몽골 비자, 몽골 여행사 자주 묻는 질문"
            canonical="/faq"
            structuredData={faqStructuredData}
        />
    );

    if (!isDesktop) {
        return (
            <>
                {seo}
                <FaqMobile faqs={faqs} categories={categories} loading={loading} />
            </>
        );
    }

    // PC: the same panel as the body of the Info layout.
    return (
        <InfoLayoutDesktop page="faqList" heading="몽골 여행 자주 묻는 질문">
            {seo}
            <div style={{ maxWidth: 760 }}>
                <FaqPanel faqs={faqs} categories={categories} loading={loading} bare />
            </div>
        </InfoLayoutDesktop>
    );
};
