declare global {
    interface Window {
        openChannelTalk?: () => void;
        ChannelIO?: unknown;
        ChannelIOInitialized?: boolean;
        __appMounted?: () => void;
    }
}

export {};
