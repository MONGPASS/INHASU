import { MW, isUsableImage } from '../desktop-primitives/mwTokens';
import { hideBroken } from '../mates-desktop/matesData';
import { M_GRADIENT } from '../mobile/mobileTheme';

/** Round initial avatar; the profile photo covers it when one exists. */
export function MateAvatar({ initial, image, size, fontSize, background = M_GRADIENT }: { initial: string; image?: string; size: number; fontSize: number; background?: string }) {
    return (
        <span style={{ position: 'relative', width: size, height: size, borderRadius: '50%', overflow: 'hidden', background, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, fontWeight: 700, color: MW.navy, flexShrink: 0 }}>
            {initial}
            {isUsableImage(image) && <img src={image} onError={hideBroken} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        </span>
    );
}

/** Photo filling its (relatively positioned) parent; the parent's background shows when there is none. */
export function MatePhoto({ src, alt, eager }: { src: string; alt: string; eager?: boolean }) {
    if (!isUsableImage(src)) return null;
    return (
        <img src={src} onError={hideBroken} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    );
}
