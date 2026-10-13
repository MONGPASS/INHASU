export const IMAGE_VARIANT_WIDTHS = [320, 640, 960, 1280];
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const PUBLIC_IMAGE_CACHE = 'public, max-age=31536000, immutable';

/** Read the actual dimensions from WebP chunks, rather than trusting form fields. */
export function webpDimensions(buffer: ArrayBuffer): { width: number; height: number } | null {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 30) return null;
    const textAt = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));
    if (textAt(0, 4) !== 'RIFF' || textAt(8, 4) !== 'WEBP') return null;
    const view = new DataView(buffer);
    const total = view.getUint32(4, true) + 8;
    if (total > bytes.length || total < 30) return null;
    const u24 = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    for (let offset = 12; offset + 8 <= total;) {
        const chunk = textAt(offset, 4);
        const size = view.getUint32(offset + 4, true);
        const start = offset + 8;
        if (start + size > total) return null;
        if (chunk === 'VP8X' && size >= 10) return { width: u24(start + 4) + 1, height: u24(start + 7) + 1 };
        if (chunk === 'VP8 ' && size >= 10 && textAt(start + 3, 3) === '\x9d\x01\x2a') {
            return { width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff };
        }
        if (chunk === 'VP8L' && size >= 5 && bytes[start] === 0x2f) {
            const bits = view.getUint32(start + 1, true);
            return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
        }
        offset = start + size + (size % 2);
    }
    return null;
}

export interface ImageManifest { version: 1; width: number; height: number; widths: number[] }

export function parseImageManifest(value: unknown, dimensions: { width: number; height: number } | null): ImageManifest | null {
    if (value == null || value === '') return null;
    let data: any;
    try { data = JSON.parse(String(value)); } catch { throw new Error('이미지 크기 정보가 올바르지 않습니다.'); }
    if (!data || typeof data !== 'object' || data.version !== 1 || !dimensions || data.width !== dimensions.width || data.height !== dimensions.height ||
        !Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width < 1 || data.height < 1 ||
        data.width > 16383 || data.height > 16383 || data.width * data.height > 32_000_000 ||
        !Array.isArray(data.widths) || data.widths.length > IMAGE_VARIANT_WIDTHS.length ||
        data.widths.some((w: unknown) => !IMAGE_VARIANT_WIDTHS.includes(Number(w)) || typeof w !== 'number' || Number(w) >= data.width) ||
        new Set(data.widths).size !== data.widths.length) {
        throw new Error('이미지 크기 정보가 실제 파일과 일치하지 않습니다.');
    }
    return { version: 1, width: data.width, height: data.height, widths: [...data.widths].sort((a, b) => a - b) };
}

export function variantMatches(dimensions: { width: number; height: number } | null, width: number, manifest: ImageManifest): boolean {
    return !!dimensions && dimensions.width === width && dimensions.height === Math.max(1, Math.round(manifest.height * width / manifest.width));
}

/** This is an image upload API, including for admins; HTML/SVG cannot run on our origin. */
export function rasterContentType(type: string, buffer: ArrayBuffer): string | null {
    const bytes = new Uint8Array(buffer);
    const ascii = (from: number, length: number) => String.fromCharCode(...bytes.slice(from, from + length));
    const declared = type.toLowerCase();
    if (declared === 'image/webp' && webpDimensions(buffer)) return declared;
    if (declared === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return declared;
    if (declared === 'image/png' && bytes[0] === 0x89 && ascii(1, 7) === 'PNG\r\n\x1a\n') return declared;
    if (declared === 'image/gif' && /^GIF8[79]a$/.test(ascii(0, 6))) return declared;
    if (ascii(4, 4) === 'ftyp') {
        const brand = ascii(8, 4);
        if (declared === 'image/avif' && /^(avif|avis)$/.test(brand)) return declared;
        if (['image/heic', 'image/heif'].includes(declared) && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) return declared;
    }
    return null;
}
