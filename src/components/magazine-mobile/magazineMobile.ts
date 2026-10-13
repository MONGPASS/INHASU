export interface TocItem {
    text: string;
    level: 2 | 3;
}

/**
 * Headings inside embedded widgets (LocationCard …) are rendered inside `.not-prose`
 * and are not part of the article outline, so jump targets skip them.
 */
export const BODY_HEADING_SKIP = '.not-prose';

/** Table of contents from the article's own h2/h3 headings (same rule as the PC article). */
export function buildToc(content: string): TocItem[] {
    const doc = new DOMParser().parseFromString(content || '', 'text/html');
    return [...doc.querySelectorAll('h2, h3')]
        .map((el) => ({ text: (el.textContent || '').trim(), level: (el.tagName === 'H2' ? 2 : 3) as 2 | 3 }))
        .filter((it) => it.text);
}
