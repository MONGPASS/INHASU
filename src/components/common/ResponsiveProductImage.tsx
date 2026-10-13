import { useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { productImageSet, productImageUrl, uploadedImageDimensions } from '../../utils/productImage';

/** Measures the displayed width, including ScaledDesign's CSS transform. */
export function ResponsiveProductImage({ src = '', onError, loading = 'lazy', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
    const ref = useRef<HTMLImageElement>(null);
    const [width, setWidth] = useState(0);
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const measure = () => setWidth(Math.max(1, Math.ceil(element.getBoundingClientRect().width)));
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
        observer?.observe(element);
        window.addEventListener('resize', measure);
        return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
    }, []);
    const original = failedSrc === src;
    const dimensions = uploadedImageDimensions(src);
    return <img width={dimensions?.width} height={dimensions?.height} {...props} ref={ref}
        src={width || props.sizes ? (original ? src : productImageUrl(src, width || 1280)) : undefined}
        srcSet={(width || props.sizes) && !original ? productImageSet(src) : undefined}
        sizes={props.sizes || `${width || 860}px`} loading={loading} decoding="async"
        onError={(event) => {
            if (!original && productImageSet(src)) setFailedSrc(src);
            else onError?.(event);
        }} />;
}
