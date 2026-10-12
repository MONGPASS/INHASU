import { useLayoutEffect, type RefObject } from 'react';

/**
 * Motion for 회사 소개 (/about), shared by the PC and mobile screens.
 *
 * - Scroll reveal: every `.mw-about-fx` element gets `data-ab-in` once its trigger enters the
 *   viewport. The trigger is the closest ancestor-or-self carrying `data-ab-trigger`, else the
 *   element itself (lines that rise out of a clipping box need the box as trigger, because the
 *   line itself starts outside it).
 * - Scroll-linked: `data-ab-parallax` (photo drifting against the scroll), `data-ab-drift`
 *   (outlined ghost word sliding sideways) and the `.mw-about-progress` reading bar.
 *
 * The hidden start state exists only while the root carries `data-ab-armed`, which is set here,
 * after mount and before the first paint. Without this hook (reduced motion, script failure)
 * nothing is ever hidden. The looping animations (zoom, marquee, stars…)
 * are pure CSS in about.css.
 */
export function useAboutMotion(rootRef: RefObject<HTMLElement | null>) {
    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

        // --- scroll reveal -------------------------------------------------------------
        const groups = new Map<Element, HTMLElement[]>();
        const items = Array.from(root.querySelectorAll<HTMLElement>('.mw-about-fx'));
        for (const el of items) {
            const trigger = el.closest('[data-ab-trigger]') ?? el;
            const list = groups.get(trigger);
            if (list) list.push(el);
            else groups.set(trigger, [el]);
        }
        // Triggers are measured by their layout box on scroll rather than with an
        // IntersectionObserver: several start states clip the element away entirely
        // (clip-path wipes, lines parked below their clipping box), and a fully clipped
        // target never reports an intersection, which left those blocks hidden for good.
        const pending = new Set(groups.keys());
        const revealVisible = (vh: number) => {
            for (const trigger of pending) {
                const box = trigger.getBoundingClientRect();
                const need = Math.min(box.height * 0.15, vh * 0.2);
                // Entered the viewport (minus a 6% bottom margin), or already scrolled past.
                if (box.top + need <= vh * 0.94) {
                    groups.get(trigger)?.forEach((el) => el.setAttribute('data-ab-in', ''));
                    pending.delete(trigger);
                }
            }
        };
        root.setAttribute('data-ab-armed', '');

        // --- scroll-linked effects -----------------------------------------------------
        const parallax = Array.from(root.querySelectorAll<HTMLElement>('[data-ab-parallax]'));
        const drift = Array.from(root.querySelectorAll<HTMLElement>('[data-ab-drift]'));
        const bar = root.querySelector<HTMLElement>('.mw-about-progress');
        let raf = 0;
        let timer = 0;
        const update = () => {
            if (raf) cancelAnimationFrame(raf);
            window.clearTimeout(timer);
            raf = 0;
            timer = 0;
            const vh = window.innerHeight;
            if (pending.size) revealVisible(vh);
            for (const el of parallax) {
                const box = el.parentElement?.getBoundingClientRect();
                if (!box || box.bottom < -200 || box.top > vh + 200) continue;
                const fromCentre = box.top + box.height / 2 - vh / 2;
                el.style.transform = `translate3d(0,${(-fromCentre * Number(el.dataset.abParallax)).toFixed(1)}px,0)`;
            }
            for (const el of drift) {
                const box = el.parentElement?.getBoundingClientRect();
                if (!box || box.bottom < -200 || box.top > vh + 200) continue;
                el.style.transform = `translate3d(${((box.top - vh) * Number(el.dataset.abDrift)).toFixed(1)}px,0,0)`;
            }
            if (bar) {
                const max = document.documentElement.scrollHeight - vh;
                bar.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0})`;
            }
        };
        // The timer covers contexts where frames are not being produced (a page that is
        // not painted yet), so revealed content never depends on rAF alone.
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(update);
            if (!timer) timer = window.setTimeout(update, 200);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        onScroll();

        return () => {
            pending.clear();
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (raf) cancelAnimationFrame(raf);
            window.clearTimeout(timer);
            root.removeAttribute('data-ab-armed');
            items.forEach((el) => el.removeAttribute('data-ab-in'));
            [...parallax, ...drift].forEach((el) => { el.style.transform = ''; });
            if (bar) bar.style.transform = '';
        };
    }, [rootRef]);
}
