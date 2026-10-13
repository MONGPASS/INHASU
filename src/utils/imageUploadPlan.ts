export const UPLOAD_VARIANT_WIDTHS = [320, 640, 960, 1280] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function imageUploadPlan(width: number, height: number, folder: string) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
        throw new Error('이미지 크기를 확인할 수 없습니다.');
    }
    // Only body artwork keeps its width: a 900 × 10000 itinerary must not become 173 × 1920.
    const artwork = folder.includes('detail') || folder === 'magazine-content' || folder === 'itinerary-templates';
    const scale = artwork ? Math.min(1, 1720 / width) : Math.min(1, 1920 / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    // WebP's maximum side is 16383; avoid silent canvas downscaling/cropping on long artwork.
    const canEncode = targetWidth <= 16383 && targetHeight <= 16383 && targetWidth * targetHeight <= 32_000_000;
    return {
        width: targetWidth,
        height: targetHeight,
        quality: artwork ? 0.88 : 0.82,
        canEncode,
        // Long body artwork is read at its full width and needs no small card copies.
        variants: artwork && height > width * 3 ? [] : UPLOAD_VARIANT_WIDTHS.filter(w => w < targetWidth),
    };
}
