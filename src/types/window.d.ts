declare global {
    interface Window {
        __appMounted?: () => void;
    }
}

export {};
