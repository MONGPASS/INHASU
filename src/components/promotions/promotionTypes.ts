/**
 * 여행 기획전 (promotion) as stored in the `promotions` table and returned by /api/promotions.
 * Shared by the admin editor and the public list / detail pages.
 */
export const PROMO_THEME_KEYS = ['mint', 'navy', 'jade', 'deep', 'light', 'paper', 'night', 'soft'] as const;
export type PromoThemeKey = (typeof PROMO_THEME_KEYS)[number];

export interface Promotion {
    id: string;
    /** Card title, e.g. '고비사막 별밤 캠프'. */
    title: string;
    /** One-line description under the title. */
    subtitle: string;
    /** Tab the card is filed under on the list page (free text set by the admin). */
    group_name: string;
    /** Small pill on the card; empty for none. */
    badge: string;
    /** Large display lettering in the middle of the card (latin, "\n" for a line break); empty for none. */
    art_text: string;
    theme: PromoThemeKey;
    image: string;
    /** Tours shown on the promotion's detail page, in display order. */
    product_ids: string[];
    is_active: boolean;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
}
