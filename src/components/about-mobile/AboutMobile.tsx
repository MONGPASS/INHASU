import { AboutBand, AboutCta, AboutHero, AboutMarquee, AboutPhilosophy, AboutPromise, AboutRoot, AboutValues } from '../about-desktop/AboutSections';

/**
 * 회사 소개 (/about), mobile — page content only; MobileShell supplies the header, back bar,
 * footer and tab bar. Same sections as the PC screen at phone sizes (see AboutSections).
 */
export function AboutMobile() {
    return (
        <AboutRoot m>
            <AboutHero m />
            <AboutMarquee m />
            <AboutPhilosophy m />
            <AboutBand m />
            <AboutValues m />
            <AboutPromise m />
            <AboutCta m />
        </AboutRoot>
    );
}
