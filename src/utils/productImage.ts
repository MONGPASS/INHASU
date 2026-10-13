// New uploads carry actual dimensions and the widths saved in R2. Older uploads
// retain their original URL unless the zone's optional transformation service is enabled.
// (이 파일은 scripts/test-product-images.mjs 가 단독으로 변환해 실행하므로 다른 모듈을 import 하지 않는다 — 도메인은 constants/seo.ts 와 같은 값)
const ORIGIN = 'https://mongolia-milkyway.com';
const WIDTHS = [320, 480, 640, 960, 1280, 1720];
const LOCAL_WIDTHS = [320, 640, 960, 1280];

let transformEnabled = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_IMAGE_TRANSFORM === '1';

/** 변환 사용 여부를 바꾼다 (테스트용). */
export function setImageTransformEnabled(enabled: boolean): void {
    transformEnabled = enabled;
}

/** Only our public uploaded images use the zone's working transformation service. */
export function uploadedImagePath(src: string): string | null {
    try {
        const url = new URL(src, ORIGIN);
        const preview = ['milkway-mongolia.pages.dev', 'inhasu.pages.dev'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
        const current = typeof window !== 'undefined' && url.origin === window.location.origin;
        if (url.origin !== ORIGIN && !preview && !current) return null;
        return url.pathname.startsWith('/api/images/') ? url.pathname : null;
    } catch { return null; }
}

function localImage(src: string): { width: number; height: number; widths: number[] } | null {
    const path = uploadedImagePath(src);
    const match = path?.match(/_v1_(\d+)x(\d+)_(none|\d+(?:-\d+)*)\.webp$/);
    if (!match) return null;
    const width = Number(match[1]), height = Number(match[2]);
    const widths = match[3] === 'none' ? [] : match[3].split('-').map(Number);
    if (width < 1 || width > 16383 || height < 1 || height > 16383 || width * height > 32_000_000 ||
        new Set(widths).size !== widths.length || widths.some(w => !LOCAL_WIDTHS.includes(w) || w >= width)) return null;
    return { width, height, widths: widths.sort((a, b) => a - b) };
}

export function uploadedImageDimensions(src: string): { width: number; height: number } | undefined {
    const image = localImage(src);
    return image ? { width: image.width, height: image.height } : undefined;
}

function localVariantUrl(src: string, width: number): string {
    return src.replace(/\.webp(?=[?#]|$)/, `.w${width}.webp`);
}

export function productImageUrl(src: string, width = 1280): string {
    const image = localImage(src);
    if (image) {
        const chosen = [...image.widths, image.width].find(w => w >= width) ?? image.width;
        return chosen === image.width ? src : localVariantUrl(src, chosen);
    }
    if (!transformEnabled) return src;
    const path = uploadedImagePath(src);
    if (!path) return src;
    const bounded = WIDTHS.find(w => w >= width) ?? WIDTHS[WIDTHS.length - 1];
    // scale-down preserves the entire image, including long artwork with text.
    return `${ORIGIN}/cdn-cgi/image/width=${bounded},quality=85,format=auto,fit=scale-down${path}`;
}

export function productImageSet(src: string): string | undefined {
    const image = localImage(src);
    if (image) return [...image.widths.map(w => `${localVariantUrl(src, w)} ${w}w`), `${src} ${image.width}w`].join(', ');
    if (!transformEnabled) return undefined;
    return uploadedImagePath(src) ? WIDTHS.map(w => `${productImageUrl(src, w)} ${w}w`).join(', ') : undefined;
}
