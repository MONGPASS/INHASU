import ReactGA from 'react-ga4';

const MEASUREMENT_ID = 'G-PZ55YEJ7WL';

export const initGA = () => {
    if (MEASUREMENT_ID) {
        ReactGA.initialize(MEASUREMENT_ID);
        // console.log('GA Initialized');
    }
};

export const logPageView = () => {
    ReactGA.send({ hitType: "pageview", page: window.location.pathname + window.location.search });
};

export const logEvent = (category: string, action: string, label?: string) => {
    ReactGA.event({
        category,
        action,
        label
    });
};

export const logCustomEvent = (eventName: string, params?: Record<string, any>) => {
    ReactGA.event(eventName, params);
};
