import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { QUOTE_SCENES } from '../estimate-desktop/quoteScenes';

/**
 * Playback state for the journey film in the mobile quote hero — same rules as the PC
 * QuoteHero: no source (and no download) under reduced motion, paused while off screen,
 * and the caption follows the video's current scene.
 */
export function useJourneyVideo() {
    const root = useRef<HTMLElement>(null);
    const video = useRef<HTMLVideoElement>(null);
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [failed, setFailed] = useState(false);
    // Decide autoplay before attaching a video source (also avoids downloads for reduced motion).
    const [motion, setMotion] = useState<boolean | null>(null);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setMotion(!preference.matches);
        update();
        preference.addEventListener('change', update);
        return () => preference.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        let inView = true;
        const update = () => setVisible(inView && document.visibilityState === 'visible');
        const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); });
        if (root.current) observer.observe(root.current);
        document.addEventListener('visibilitychange', update);
        update();
        return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
    }, []);

    useEffect(() => {
        const element = video.current;
        if (!element) return;
        if (motion && visible && !paused && !failed) {
            void element.play().catch(() => { /* Autoplay may be blocked; the play button stays available. */ });
        } else element.pause();
    }, [motion, visible, paused, failed]);

    const togglePlayback = () => {
        if (playing) {
            setPaused(true);
            video.current?.pause();
        } else {
            setMotion(true);
            setPaused(false);
            // Call within the gesture too, for browsers that block autoplay.
            if (video.current?.getAttribute('src')) void video.current.play().catch(() => {});
        }
    };

    const selectScene = (index: number) => {
        const element = video.current;
        if (!element || element.readyState < 1) return;
        element.currentTime = QUOTE_SCENES[index].start;
        setActive(index);
    };

    const videoEvents = {
        onPlay: () => setPlaying(true),
        onPause: () => setPlaying(false),
        onError: () => { setFailed(true); setPlaying(false); setActive(0); },
        onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => {
            const time = event.currentTarget.currentTime;
            setActive(QUOTE_SCENES.reduce((index, scene, next) => (time >= scene.start ? next : index), 0));
        },
    };

    return { root, video, active, playing, failed, motion: !!motion, togglePlayback, selectScene, videoEvents };
}
