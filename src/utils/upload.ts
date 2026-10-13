import { imageUploadPlan, MAX_UPLOAD_BYTES } from './imageUploadPlan';

/**
 * Uploads a file to Cloudflare R2.
 * @param file The file object to upload
 * @param bucket The storage bucket name (default: 'images')
 * @param folder (Optional) The folder path within the bucket
 * @returns Promise<string> The public URL of the uploaded file
 */
export const uploadFile = async (file: File, _bucket = 'images', folder = 'common'): Promise<string> => sendUpload({ file }, folder);

/**
 * Uploads an image file with client-side WebP compression.
 * The original image is compressed and converted to WebP format before uploading,
 * preventing large file sizes and Base64 storage.
 * 
 * @param file The original image file
 * @param folder The folder path within the 'images' bucket
 * @returns Promise<string> The public URL of the uploaded image
 */
const queuedImages: (() => void)[] = [];
let activeImages = 0;

export const uploadImage = async (file: File, folder = 'common'): Promise<string> => {
    // Bulk uploads share two slots so large camera photos do not exhaust browser memory.
    await new Promise<void>(resolve => {
        if (activeImages < 2) { activeImages++; resolve(); }
        else queuedImages.push(resolve);
    });
    try { return await processImage(file, folder); }
    finally {
        const next = queuedImages.shift();
        if (next) next();
        else activeImages--;
    }
};

async function processImage(file: File, folder: string): Promise<string> {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        throw new Error('JPG, PNG, WebP 등 사진 파일을 선택해 주세요.');
    }
    // Preserve animated GIFs instead of flattening them to their first frame.
    if (file.type === 'image/gif') return sendUpload({ file }, folder);
    const decoded = await decodeImage(file);
    try {
        const plan = imageUploadPlan(decoded.width, decoded.height, folder);
        if (!plan.canEncode) return sendUpload({ file }, folder);
        let main: File;
        try {
            main = await encodeWebP(decoded.source, plan.width, plan.height, plan.quality, file.name);
        } catch (error) {
            console.warn('이미지 변환을 사용할 수 없어 원본을 업로드합니다.', error);
            return sendUpload({ file }, folder);
        }
        // Do not expand an already small file merely to change its format.
        if (plan.width === decoded.width && plan.height === decoded.height && main.size > file.size) {
            return sendUpload({ file }, folder);
        }
        const variants: { width: number; file: File }[] = [];
        // Sequential encoding bounds peak canvas memory when several images are selected.
        for (const width of plan.variants) {
            try {
                const variant = await encodeWebP(decoded.source, width, Math.max(1, Math.round(plan.height * width / plan.width)), 0.78, file.name);
                variants.push({ width, file: variant });
            } catch (error) {
                console.warn('이미지 축소본을 만들 수 없어 생성된 크기만 사용합니다.', error);
                break;
            }
        }
        return sendUpload({ file: main, width: plan.width, height: plan.height, variants }, folder);
    } finally { decoded.release(); }
}

interface PreparedImage {
    file: File;
    width?: number;
    height?: number;
    variants?: { width: number; file: File }[];
}

async function sendUpload(prepared: PreparedImage, folder: string): Promise<string> {
    if (prepared.file.size > MAX_UPLOAD_BYTES) throw new Error('이미지는 10MB 이하로 업로드해 주세요.');
    const formData = new FormData();
    formData.append('file', prepared.file);
    formData.append('folder', folder);
    if (prepared.width && prepared.height) {
        formData.append('imageManifest', JSON.stringify({
            version: 1, width: prepared.width, height: prepared.height,
            widths: (prepared.variants || []).map(v => v.width),
        }));
        for (const variant of prepared.variants || []) formData.append(`variant_${variant.width}`, variant.file);
    }
    const response = await fetch('/api/site-upload', { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '이미지 업로드에 실패했습니다.');
    return data.url;
}

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file);
            return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
        } catch { /* Some browsers decode HEIC/JPEG through <img> only. */ }
    }
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch {
        URL.revokeObjectURL(url);
        throw new Error('이 이미지를 읽을 수 없습니다. JPG, PNG 또는 WebP 파일로 다시 업로드해 주세요.');
    }
}

async function encodeWebP(source: CanvasImageSource, width: number, height: number, quality: number, name: string): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('이미지 변환을 사용할 수 없습니다.');
        context.drawImage(source, 0, 0, width, height);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        // Browsers without WebP encoding return PNG; never mislabel it as .webp.
        if (!blob || blob.type !== 'image/webp') throw new Error('WebP 변환을 사용할 수 없습니다.');
        return new File([blob], `${name.replace(/\.[^/.]+$/, '')}.webp`, { type: 'image/webp' });
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}
