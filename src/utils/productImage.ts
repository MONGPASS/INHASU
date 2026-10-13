// 이미지 변환(/cdn-cgi/image)은 Cloudflare 존마다 따로 켜야 한다.
// 통합 플랫폼 도메인(mongolia-milkyway.com)은 2026-10 현재 꺼져 있어(404), 기본값은 "변환 없이 원본 주소 사용"이다.
// 존에서 Image Transformations 를 켠 뒤 빌드 환경변수 VITE_IMAGE_TRANSFORM=1 을 주면 화면 크기에 맞는 축소본을 쓴다.
// (이 파일은 scripts/test-product-images.mjs 가 단독으로 변환해 실행하므로 다른 모듈을 import 하지 않는다 — 도메인은 constants/seo.ts 와 같은 값)
const ORIGIN = 'https://mongolia-milkyway.com';
const WIDTHS = [320, 480, 640, 960, 1280, 1720];

let transformEnabled = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_IMAGE_TRANSFORM === '1';

/** 변환 사용 여부를 바꾼다 (테스트용). */
export function setImageTransformEnabled(enabled: boolean): void {
    transformEnabled = enabled;
}

/** Only our public uploaded images use the zone's working transformation service. */
export function uploadedImagePath(src: string): string | null {
    try {
        const url = new URL(src, ORIGIN);
        if (url.origin !== ORIGIN && !url.hostname.endsWith('.milkway-mongolia.pages.dev')) return null;
        return url.pathname.startsWith('/api/images/') ? url.pathname : null;
    } catch { return null; }
}

export function productImageUrl(src: string, width = 1280): string {
    if (!transformEnabled) return src;
    const path = uploadedImagePath(src);
    if (!path) return src;
    const bounded = WIDTHS.find(w => w >= width) ?? WIDTHS[WIDTHS.length - 1];
    // scale-down preserves the entire image, including long artwork with text.
    return `${ORIGIN}/cdn-cgi/image/width=${bounded},quality=85,format=auto,fit=scale-down${path}`;
}

export function productImageSet(src: string): string | undefined {
    if (!transformEnabled) return undefined;
    return uploadedImagePath(src) ? WIDTHS.map(w => `${productImageUrl(src, w)} ${w}w`).join(', ') : undefined;
}
