/**
 * 관리자가 정하는 홈 설정(2026-11-25): 테마 줄 2개 · 이달의 추천 PICK 탭 3개 · 혜택 배너.
 * 관리자 ‘사이트 관리 → 홈 화면 관리’에서 고치고, 설정 표(settings)의 `home_v2` 한 칸에 JSON으로 저장한다(GET/PUT /api/settings).
 * 테마 줄·PICK 탭은 문구와 카테고리 하나만 고른다 — 그 카테고리의 판매 중 상품이 자동으로 나온다(상품을 하나하나 고르지 않는다).
 * 카테고리를 고르지 않았거나 그 카테고리가 지워졌으면 상품 이름·분류·태그의 낱말로 묶는다(homeContent.ts의 THEME_WORDS).
 * 저장한 적이 없거나 값이 깨졌으면 homeContent.ts의 기본 문구·사진·배너를 쓴다.
 */
import type { Category } from '../../types/category';
import { BENEFIT_BANDS, PICK_TABS, THEME_ROWS, inTheme, type ThemeKey, type ThemeProductLike } from './homeContent';

export const HOME_SETTING_KEY = 'home_v2';
export const BAND_MAX = 8;

export interface HomeThemeRow {
    title: string;
    sub: string;
    /** 큰 사진. */
    image: string;
    /** 이 줄에 상품을 보여 줄 카테고리 id. 비우면 낱말로 자동으로 묶는다. */
    categoryId: string;
}

export interface HomePickTab {
    label: string;
    categoryId: string;
}

export interface HomeBand {
    id: string;
    /** 두 줄 제목(줄 바꿈은 \n). */
    title: string;
    /** 휴대폰용 짧은 제목. 비우면 title을 쓴다. */
    titleShort: string;
    tags: string;
    /** 큰 동그란 사진. */
    image: string;
    /** 작은 동그란 사진(PC에만 보인다). */
    image2: string;
    alt: string;
    /** 누르면 가는 곳: 사이트 안 경로(/…)나 https 주소. 비우면 눌리지 않는다. */
    link: string;
}

export interface HomeSettings {
    /** 테마 줄 2개(순서 고정). */
    themeRows: HomeThemeRow[];
    /** 이달의 추천 PICK의 ‘전체’ 다음 탭 3개(순서 고정). */
    pickTabs: HomePickTab[];
    /** 혜택 배너. 빈 배열로 저장하면 홈에서 이 띠가 빠진다. */
    bands: HomeBand[];
}

/** 자리마다 카테고리를 고르지 않았을 때 쓰는 낱말 묶음. */
export const ROW_FALLBACK: ThemeKey[] = THEME_ROWS.map((row) => row.theme);
export const PICK_FALLBACK: ThemeKey[] = PICK_TABS.filter((tab) => tab.id !== 'all').map((tab) => tab.id as ThemeKey);
/** PICK 탭 사진(PC 왼쪽 알약 배경). 자리마다 고정. */
export const PICK_TAB_IMAGES: string[] = PICK_TABS.filter((tab) => tab.id !== 'all').map((tab) => tab.image);

export const DEFAULT_BANDS: HomeBand[] = BENEFIT_BANDS.map((band, i) => ({ id: `band-default-${i + 1}`, ...band }));

export const defaultHomeSettings = (): HomeSettings => ({
    themeRows: THEME_ROWS.map((row) => ({ title: row.title, sub: row.sub, image: row.image, categoryId: '' })),
    pickTabs: PICK_TABS.filter((tab) => tab.id !== 'all').map((tab) => ({ label: tab.label, categoryId: '' })),
    bands: DEFAULT_BANDS.map((band) => ({ ...band })),
});

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null);

/** 저장된 값(JSON 글자 또는 객체)을 화면이 쓰는 모양으로 고른다. 모르는 값은 버리고, 빈 칸은 기본값으로 채운다. */
export function parseHomeSettings(value: unknown): HomeSettings {
    let raw = value;
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { raw = null; }
    }
    const settings = defaultHomeSettings();
    const source = record(raw);
    if (!source) return settings;

    if (Array.isArray(source.themeRows)) {
        settings.themeRows = settings.themeRows.map((fallback, i) => {
            const row = record((source.themeRows as unknown[])[i]);
            if (!row) return fallback;
            return {
                title: text(row.title, 60).trim() || fallback.title,
                sub: text(row.sub, 120),
                image: text(row.image, 600) || fallback.image,
                categoryId: text(row.categoryId, 120),
            };
        });
    }
    if (Array.isArray(source.pickTabs)) {
        settings.pickTabs = settings.pickTabs.map((fallback, i) => {
            const tab = record((source.pickTabs as unknown[])[i]);
            if (!tab) return fallback;
            return { label: text(tab.label, 20).trim() || fallback.label, categoryId: text(tab.categoryId, 120) };
        });
    }
    if (Array.isArray(source.bands)) {
        settings.bands = source.bands
            .map(record)
            .filter((band): band is Record<string, unknown> => !!band)
            .map((band, i) => ({
                id: text(band.id, 60) || `band-${i + 1}`,
                title: text(band.title, 120), titleShort: text(band.titleShort, 120), tags: text(band.tags, 120),
                image: text(band.image, 600), image2: text(band.image2, 600), alt: text(band.alt, 120), link: text(band.link, 600),
            }))
            .filter((band) => band.title.trim())
            .slice(0, BAND_MAX);
    }
    return settings;
}

/** 저장할 JSON 글자. 제목 없는 혜택 배너는 뺀다. */
export const serializeHomeSettings = (settings: HomeSettings) => JSON.stringify(parseHomeSettings(settings));

type CategoryLike = Pick<Category, 'id' | 'name'>;
const inCategory = (p: ThemeProductLike, c: CategoryLike) => p.category === c.name || p.category === c.id;

/** 고른 카테고리(있으면)와 자리 이름. 지워진 카테고리는 없는 것으로 본다. */
export const findCategory = <C extends CategoryLike>(categories: C[], categoryId: string): C | undefined =>
    categoryId ? categories.find((c) => c.id === categoryId) : undefined;

/** 그 자리에 보일 상품: 고른 카테고리의 상품, 고르지 않았으면 낱말로 묶은 상품. 상품 순서는 받은 순서 그대로. */
export function slotProducts<P extends ThemeProductLike>(products: P[], categories: CategoryLike[], categoryId: string, fallback: ThemeKey): P[] {
    const category = findCategory(categories, categoryId);
    return category ? products.filter((p) => inCategory(p, category)) : products.filter((p) => inTheme(p, fallback));
}

/** 줄 사진·‘전체 보기’가 가는 곳: 카테고리를 골랐으면 그 카테고리 페이지, 아니면 전체 상품. */
export const slotLink = (categories: CategoryLike[], categoryId: string) => {
    const category = findCategory(categories, categoryId);
    return category ? `/category/${category.id}` : '/products';
};

/** 배너 링크로 쓸 수 있는 주소만 돌려준다(사이트 안 경로 또는 https). 그 밖은 빈 글자 — 눌리지 않는 배너가 된다. */
export const safeBandLink = (link: string) => {
    const value = (link || '').trim();
    return /^\/(?!\/)/.test(value) || /^https:\/\//.test(value) ? value : '';
};
