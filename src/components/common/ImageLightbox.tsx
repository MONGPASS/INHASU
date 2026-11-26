import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../../utils/bodyScrollLock';

// ─── Fullscreen image lightbox ────────────────────────────────────────
// Tap/click any gallery image → opens here. Supports prev/next buttons,
// ArrowLeft/ArrowRight/Escape keys, body scroll lock, thumbnail strip.
// Shared by mobile + desktop (originally MobileItineraryTimeline's private
// MobileLightbox, promoted so review pages can reuse it).
// document.body에 그린다: 상품 디자인 틀은 휴대폰 폭에 맞추려고 transform(scale)으로 줄이는데,
// 그 안에 그리면 position: fixed가 화면이 아니라 그 틀 기준이 돼 검은 막만 덮이고 사진이 화면 밖으로 밀린다.
export function ImageLightbox({
    images,
    startIndex,
    onClose,
}: {
    images: string[];
    startIndex: number;
    onClose: () => void;
}) {
    const [i, setI] = useState(startIndex);

    // 스크롤 잠금은 열려 있는 동안 한 번만(창이 겹쳐도 세어서 푼다 — utils/bodyScrollLock)
    useEffect(() => lockBodyScroll(), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') setI((x) => (x + 1) % images.length);
            if (e.key === 'ArrowLeft') setI((x) => (x - 1 + images.length) % images.length);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [images.length, onClose]);

    return createPortal(
        <div role="dialog" aria-modal="true" aria-label="사진 크게 보기" data-mw-overlay="" className="fixed inset-0 z-[300] bg-black/95 flex flex-col" onClick={onClose}>
            <div
                className="flex items-center justify-between p-4 text-white text-sm font-semibold"
                onClick={(e) => e.stopPropagation()}
            >
                <span>{i + 1} / {images.length}</span>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="닫기"
                    className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"
                >
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>close</span>
                </button>
            </div>

            <div className="flex-1 flex items-center justify-center relative px-4" onClick={(e) => e.stopPropagation()}>
                {images.length > 1 && (
                    <button
                        type="button"
                        aria-label="이전"
                        onClick={() => setI((i - 1 + images.length) % images.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center z-10"
                    >
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 26 }}>chevron_left</span>
                    </button>
                )}
                <img
                    src={images[i]}
                    alt={`이미지 ${i + 1} / ${images.length}`}
                    className="max-w-full max-h-[75vh] object-contain rounded-lg"
                />
                {images.length > 1 && (
                    <button
                        type="button"
                        aria-label="다음"
                        onClick={() => setI((i + 1) % images.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center z-10"
                    >
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 26 }}>chevron_right</span>
                    </button>
                )}
            </div>

            <div
                className="flex justify-center gap-2 p-4 overflow-x-auto scrollbar-hide"
                onClick={(e) => e.stopPropagation()}
            >
                {images.map((src, j) => (
                    <button
                        key={j}
                        type="button"
                        onClick={() => setI(j)}
                        aria-label={`썸네일 ${j + 1}`}
                        className={`shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-opacity ${
                            j === i ? 'border-white opacity-100' : 'border-transparent opacity-55'
                        }`}
                        style={{ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    />
                ))}
            </div>
        </div>,
        document.body,
    );
}
