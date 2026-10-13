import { useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { productImageSet, productImageUrl } from '../../utils/productImage';

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
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        window.addEventListener('resize', measure);
        return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
    }, []);
    const original = failedSrc === src;
    return <img {...props} ref={ref}
        src={width ? (original ? src : productImageUrl(src, width)) : undefined}
        srcSet={width && !original ? productImageSet(src) : undefined}
        sizes={`${width || 860}px`} loading={loading} decoding="async"
        onError={(event) => {
            if (!original && productImageSet(src)) setFailedSrc(src);
            else onError?.(event);
        }} />;
}
