/** An initial/failed browsing context must retry the known src, not reload about:blank. */
export function quoteFrameNeedsRemount(currentHref: string | null | undefined, origin: string): boolean {
    if (!currentHref) return true;
    try { const current = new URL(currentHref, origin); return !['http:', 'https:'].includes(current.protocol) || current.origin !== origin; }
    catch { return true; }
}

/** Delayed loading prompts one manual retry; it never navigates automatically. */
export function scheduleQuoteFrameDelay(notify: () => void, clock: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'> = globalThis): () => void {
    let cancelled = false;
    const timer = clock.setTimeout(() => { if (!cancelled) notify(); }, 12000);
    return () => { cancelled = true; clock.clearTimeout(timer); };
}
