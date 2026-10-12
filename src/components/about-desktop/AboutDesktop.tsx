import { AboutBand, AboutCta, AboutHero, AboutMarquee, AboutPhilosophy, AboutPromise, AboutRoot, AboutValues } from './AboutSections';

/** 회사 소개 (/about), PC — page content only; DesktopLayout supplies header and footer. */
export function AboutDesktop() {
    return (
        <AboutRoot m={false}>
            <AboutHero m={false} />
            <AboutMarquee m={false} />
            <AboutPhilosophy m={false} />
            <AboutBand m={false} />
            <AboutValues m={false} />
            <AboutPromise m={false} />
            <AboutCta m={false} />
        </AboutRoot>
    );
}
