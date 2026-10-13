import imageCompression from 'browser-image-compression';

/**
 * Uploads a file to Cloudflare R2.
 * @param file The file object to upload
 * @param bucket The storage bucket name (default: 'images')
 * @param folder (Optional) The folder path within the bucket
 * @returns Promise<string> The public URL of the uploaded file
 */
export const uploadFile = async (file: File, bucket: string = 'images', folder: string = 'common'): Promise<string> => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        const response = await fetch('/api/site-upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to upload to R2');
        }

        const data = await response.json();
        return data.url; // This returns /api/images/folder/filename.webp
    } catch (error) {
        console.error('File upload failed:', error);
        throw error;
    }
};

/**
 * Uploads an image file with client-side WebP compression.
 * The original image is compressed and converted to WebP format before uploading,
 * preventing large file sizes and Base64 storage.
 * 
 * @param file The original image file
 * @param folder The folder path within the 'images' bucket
 * @returns Promise<string> The public URL of the uploaded image
 */
export const uploadImage = async (file: File, folder: string = 'common'): Promise<string> => {
    try {
        const isDetailImage = folder.includes('detail') || folder.includes('product-details') || folder.includes('magazine');
        
        const options: Parameters<typeof imageCompression>[1] = {
            maxSizeMB: isDetailImage ? 2 : 1,
            useWebWorker: true,
            fileType: 'image/webp', // Force WebP output format
            initialQuality: isDetailImage ? 0.86 : 0.85,
            alwaysKeepResolution: isDetailImage // Vital: prevent shrinking long images
        };

        if (!isDetailImage) {
            options.maxWidthOrHeight = 1920;
        }

        let processedFile = file;

        // Only compress if the file is an image
        if (file.type.startsWith('image/')) {
            try {
                if (isDetailImage) {
                    const bitmap = await createImageBitmap(file);
                    // Bound WIDTH, not the longest edge: long artwork must keep
                    // its text readable instead of being shrunk to 1720px tall.
                    options.maxWidthOrHeight = Math.ceil(Math.max(bitmap.width, bitmap.height) * Math.min(1, 1720 / bitmap.width));
                    if (bitmap.height > bitmap.width * 3) options.maxSizeMB = 5;
                    bitmap.close();
                }
                const compressedBlob = await imageCompression(file, options);
                // Create a new File from the compressed Blob with .webp extension
                const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                processedFile = new File([compressedBlob], newFileName, { type: 'image/webp' });
            } catch (compressionError) {
                console.warn('Image compression failed, falling back to original file:', compressionError);
                // Fallback to original file if compression fails unexpectedly
            }
        }

        // Upload the processed (WebP) file
        return await uploadFile(processedFile, 'images', folder);
    } catch (error) {
        console.error('Image upload failed:', error);
        throw error;
    }
};
