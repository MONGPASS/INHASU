import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from '../lib/api';
import { SEO } from '../components/seo/SEO';
import { SimpleSlider } from '../components/ui/SimpleSlider';
import { LocationCard } from '../components/magazine/LocationCard';
import type { LocationInfo } from '../components/magazine/LocationCard';
import { useTranslation } from 'react-i18next';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MagazineArticleDesktop } from '../components/magazine-desktop/MagazineArticleDesktop';
import type { MagazineListItem } from '../components/magazine-desktop/MagazineListDesktop';
import { MobileShell } from '../components/mobile/MobileShell';
import { MEmpty, MLoading } from '../components/mobile/mobileUi';
import { MagazineArticleMobile } from '../components/magazine-mobile/MagazineArticleMobile';
import { BRAND } from '../constants/company';
import { SEO_CONSTANTS, isPublishedMagazine } from '../constants/seo';

const SITE_URL = SEO_CONSTANTS.SITE_URL;

interface Magazine {
    id: string;
    title: string;
    description: string;
    content: string;
    category: string;
    image: string;
    tag?: string;
    author?: string;
    authorImage?: string;
    createdAt: string;
    updatedAt?: string;
}

/** List row as returned by /api/magazines (snake_case). */
interface RawMagazine {
    id: string;
    title: string;
    subtitle?: string;
    description?: string;
    category: string;
    thumbnail?: string;
    image?: string;
    is_active?: boolean | number | null;
    is_published?: boolean | number | null;
    order?: number;
}

interface MagazineFaq {
    question: string;
    answer: string;
}

const buildMagazineFaqs = (magazine: Magazine): MagazineFaq[] => [
    {
        question: `'${magazine.title}' 내용을 여행 계획에 반영할 때 알아 둘 점은 무엇인가요?`,
        answer: `계절, 이동 시간, 체류 일수에 따라 가장 좋은 구성이 달라집니다. 이 글의 내용을 참고하시되, ${magazine.category || '몽골 여행'} 일정에 무리가 없도록 여유를 두시길 권합니다.`,
    },
    {
        question: '몽골 여행이 처음이어도 참가할 수 있나요?',
        answer: '네. 한국어 사전 안내와 현지 지원이 제공되는 투어를 고르시면 안심입니다. 체력과 희망 사항에 맞춰 이동 거리와 체험 내용을 조정할 수 있습니다.',
    },
    {
        question: '옷차림과 준비물은 어떻게 챙기면 되나요?',
        answer: '몽골은 일교차가 크므로 겹쳐 입을 수 있는 옷, 방풍·방한복, 걷기 편한 신발을 준비해 주세요. 계절과 방문 지역에 따른 자세한 내용은 출발 전에 안내해 드립니다.',
    },
    {
        question: '이 글과 관련된 투어 상담이나 견적을 받을 수 있나요?',
        answer: '네. 인원, 여행 일정, 관심 있는 체험을 알려 주시면 기존 투어를 조정하거나 맞춤 일정을 제안해 드립니다.',
    },
];

export const TravelGuideDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [magazine, setMagazine] = useState<Magazine | null>(null);
    // Every published article in list order — used for prev/next and "다른 글".
    const [allMagazines, setAllMagazines] = useState<MagazineListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const isDesktop = useIsDesktop();

    useEffect(() => {
        const fetchMagazine = async () => {
            if (!id) return;
            setLoading(true);

            try {
                // 1. Fetch current magazine
                const magData = await api.magazines.get(id);

                if (!magData || !isPublishedMagazine(magData)) {
                    console.error('Magazine not found');
                    setLoading(false);
                    return;
                }

                const currentMagazine: Magazine = {
                    id: magData.id,
                    title: magData.title,
                    description: magData.subtitle || magData.description || '',
                    content: magData.content,
                    category: magData.category,
                    image: magData.thumbnail || magData.image || '',
                    tag: magData.tag,
                    author: magData.author,
                    authorImage: magData.author_image || magData.authorImage,
                    createdAt: magData.created_at,
                    updatedAt: magData.updated_at,
                };
                setMagazine(currentMagazine);

                // 2. Fetch the article list (prev/next + related articles are picked client-side)
                const allMagazines = await api.magazines.list();
                if (Array.isArray(allMagazines)) {
                    setAllMagazines(allMagazines
                        .filter(isPublishedMagazine)
                        .sort((a: RawMagazine, b: RawMagazine) => (a.order || 0) - (b.order || 0))
                        .map((m: RawMagazine) => ({
                            id: m.id,
                            title: m.title,
                            description: m.subtitle || m.description || '',
                            category: m.category,
                            image: m.thumbnail || m.image || '',
                        })));
                }
            } catch (error) {
                console.error('Error fetching magazine details:', error);
            }
            setLoading(false);
        };

        fetchMagazine();
    }, [id]);

    // Content Renderer
    const renderContent = (content: string) => {
        if (!content) {
            return (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
                    <span className="material-symbols-outlined text-4xl text-gray-300">article</span>
                    <p className="mt-3 font-bold text-gray-700 dark:text-gray-200">글을 준비 중입니다</p>
                    <p className="mt-1 text-sm text-gray-500">공개될 때까지 잠시만 기다려 주세요.</p>
                </div>
            );
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        doc.querySelectorAll('img').forEach((image, imageIndex) => {
            const currentAlt = image.getAttribute('alt')?.trim() || '';
            const isGenericAlt = /^(image|img|photo|picture|slide|画像|写真|이미지|사진)\s*\d*$/i.test(currentAlt);
            // 한국어판: 한국어 alt는 그대로 둔다(일본어판에서는 한국어 alt를 자동 생성 alt로 덮어썼음).
            if (!currentAlt || isGenericAlt) {
                image.setAttribute(
                    'alt',
                    `${magazine?.title || '몽골 여행'} 사진 ${imageIndex + 1} | 몽골 여행 가이드`,
                );
            }
            image.setAttribute('loading', 'lazy');
            image.setAttribute('decoding', 'async');
        });
        const childNodes = Array.from(doc.body.childNodes);

        const result: React.ReactNode[] = [];
        let htmlBuffer = '';

        const flushBuffer = (key: string) => {
            if (htmlBuffer) {
                result.push(<div key={key} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlBuffer) }} />);
                htmlBuffer = '';
            }
        };

        childNodes.forEach((node, index) => {
            if (node.nodeType === Node.ELEMENT_NODE && (node as Element).classList.contains('magazine-slider')) {
                flushBuffer(`html-${index}`);

                // Render Slider
                const imagesStr = (node as Element).getAttribute('data-images');
                if (imagesStr) {
                    const images = imagesStr.split(',');
                    result.push(
                        <SimpleSlider
                            key={`slider-${index}`}
                            images={images}
                            altPrefix={magazine?.title}
                        />
                    );
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).classList.contains('magazine-location')) {
                flushBuffer(`html-${index}`);

                // Render inline LocationCard
                const payload = (node as Element).getAttribute('data-payload');
                if (payload) {
                    try {
                        const data = JSON.parse(decodeURIComponent(payload));
                        const loc: LocationInfo = {
                            name: data.name || undefined,
                            address: data.address || undefined,
                            phone: data.phone || undefined,
                            website: data.website || undefined,
                            hours: data.hours || undefined,
                            mapEmbedUrl: data.mapEmbedUrl || undefined,
                            mapQuery: data.mapQuery || undefined,
                        };
                        result.push(<LocationCard key={`location-${index}`} location={loc} />);
                    } catch {
                        // Malformed payload — skip silently
                    }
                }
            } else {
                // Aggressive Zombie Cleanup:
                // Check if this node is the editor visual representation (thumbnails) but missing the class
                const element = node as Element;
                if (node.nodeType === Node.ELEMENT_NODE &&
                    element.tagName === 'DIV' &&
                    element.textContent &&
                    element.textContent.includes('イメージスライダー') ||
                    element.textContent.includes('이미지 슬라이더') &&
                    element.querySelector('img')) {
                    // This is likely a zombie thumbnail artifact. Skip it.
                    return;
                }

                // Accumulate HTML
                if (node.nodeType === Node.ELEMENT_NODE) {
                    htmlBuffer += (node as Element).outerHTML;
                } else if (node.nodeType === Node.TEXT_NODE) {
                    htmlBuffer += node.textContent || '';
                }
            }
        });

        // Flush remaining buffer
        if (htmlBuffer) {
            result.push(<div key="html-end" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlBuffer) }} />);
        }

        return <>{result}</>;
    };

    // Both shells keep the site header/footer around loading and not-found states.
    if (!isDesktop && (loading || !magazine)) {
        return (
            <>
                {/* Empty slot where <SEO> sits once loaded: same tree shape, so the shell is not remounted. */}
                {null}
                <MobileShell title="여행 매거진">
                    {loading ? (
                        <MLoading />
                    ) : (
                        <div style={{ padding: '24px 16px 0' }}>
                            <MEmpty
                                text={t('travel_guide.detail.loading_or_not_found')}
                                action={{ label: t('travel_guide.detail.go_back_to_list'), onClick: () => navigate('/travel-guide') }}
                            />
                        </div>
                    )}
                </MobileShell>
            </>
        );
    }

    if (loading) {
        return (
            <DesktopLayout>
                <div className="min-h-[60vh] bg-white dark:bg-slate-900 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                </div>
            </DesktopLayout>
        );
    }

    if (!magazine) {
        return (
            <DesktopLayout>
                <div className="min-h-[60vh] bg-white dark:bg-slate-900 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-slate-500 mb-4">{t('travel_guide.detail.loading_or_not_found')}</p>
                        <button
                            onClick={() => navigate('/travel-guide')}
                            className="text-primary font-bold hover:underline"
                        >
                            {t('travel_guide.detail.go_back_to_list')}
                        </button>
                    </div>
                </div>
            </DesktopLayout>
        );
    }

    // ─── SEO: Article JSON-LD (BlogPosting) + BreadcrumbList ───────────
    const canonicalPath = `/travel-guide/${id}`;
    const absoluteUrl = `${SITE_URL}${canonicalPath}`;
    const absoluteImage = magazine.image
        ? (magazine.image.startsWith('http') ? magazine.image : `${SITE_URL}${magazine.image}`)
        : `${SITE_URL}/favicon.png`;
    const authorName = magazine.author?.trim() || '몽골리아 은하수 편집부';

    const articleLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: magazine.title,
        description: magazine.description,
        image: [absoluteImage],
        datePublished: magazine.createdAt,
        dateModified: magazine.updatedAt || magazine.createdAt,
        author: {
            '@type': magazine.author ? 'Person' : 'Organization',
            name: authorName,
        },
        publisher: {
            '@type': 'Organization',
            name: BRAND.name,
            logo: {
                '@type': 'ImageObject',
                url: `${SITE_URL}/favicon.png`,
            },
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': absoluteUrl,
        },
        articleSection: magazine.category || undefined,
        keywords: [magazine.category, magazine.tag].filter(Boolean).join(', ') || undefined,
        inLanguage: 'ko',
    };

    const breadcrumbLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: '여행 가이드', item: `${SITE_URL}/travel-guide` },
            { '@type': 'ListItem', position: 3, name: magazine.title, item: absoluteUrl },
        ],
    };
    const magazineFaqs = buildMagazineFaqs(magazine);
    const faqLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: magazineFaqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };
    const seo = (
        <SEO
            title={magazine.title}
            description={magazine.description}
            image={magazine.image}
            keywords={`${magazine.category}, ${magazine.tag || ''}`}
            canonical={canonicalPath}
            structuredData={[articleLd, breadcrumbLd, faqLd]}
        />
    );

    const pos = allMagazines.findIndex((m) => m.id === magazine.id);
    const others = allMagazines.filter((m) => m.id !== magazine.id);
    // Same-category articles first, then the rest, three in total.
    const more = [
        ...others.filter((m) => m.category === magazine.category),
        ...others.filter((m) => m.category !== magazine.category),
    ].slice(0, 3);
    const prev = pos > 0 ? allMagazines[pos - 1] : undefined;
    const next = pos >= 0 && pos < allMagazines.length - 1 ? allMagazines[pos + 1] : undefined;

    if (isDesktop) {
        return (
            <>
                {seo}
                <DesktopLayout>
                    <MagazineArticleDesktop
                        magazine={magazine}
                        body={renderContent(magazine.content || '')}
                        faqs={magazineFaqs}
                        more={more}
                        prev={prev}
                        next={next}
                    />
                </DesktopLayout>
            </>
        );
    }

    return (
        <>
            {seo}
            <MobileShell title="여행 매거진">
                <MagazineArticleMobile
                    magazine={magazine}
                    body={renderContent(magazine.content || '')}
                    faqs={magazineFaqs}
                    more={more}
                    prev={prev}
                    next={next}
                />
            </MobileShell>
        </>
    );
};
