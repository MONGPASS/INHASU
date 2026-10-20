import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api'; 
import { CUSTOMER_SESSION_CHANGED } from '../lib/customerSessionCache';

export interface Notification {
    id: string;
    type: 'reservation' | 'comment' | 'event' | 'system';
    title: string;
    message: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const identityGeneration = useRef(0);

    const fetchNotifications = async () => {
        const generation = identityGeneration.current;
        try {
            const me = await api.auth.me();
            if (generation !== identityGeneration.current) return;
            if (!me || me.error) {
                setNotifications([]);
                setLoading(false);
                return;
            }

            const data = await api.notifications.list();

            if (data && generation === identityGeneration.current) {
                setNotifications(data);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            if (generation === identityGeneration.current) setLoading(false);
        }
    };

    useEffect(() => {
        const changed = (event: Event) => {
            identityGeneration.current += 1;
            setNotifications([]);
            const signedIn = !!(event as CustomEvent<{ userId: string | null }>).detail?.userId;
            setLoading(signedIn);
            if (signedIn) void fetchNotifications();
        };
        window.addEventListener(CUSTOMER_SESSION_CHANGED, changed);
        void fetchNotifications();
        return () => { identityGeneration.current += 1; window.removeEventListener(CUSTOMER_SESSION_CHANGED, changed); };
    }, []);

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

        try {
            await api.notifications.update(id, { is_read: true });
        } catch (error) {
            console.error('Error marking as read:', error);
            // Revert on error (optional)
        }
    };

    const markAllAsRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

        try {
            const me = await api.auth.me();
            if (!me) return;

            // Assuming there is a bulk update or we iterate? 
            // Or maybe passing special ID/flag to update endpoint?
            // Since api.notifications.update takes ID, we technically need a bulk endpoint or iterate.
            // For now, let's just use a loop or if backend supports 'all'.
            // I'll implementation loop for safety, or check if API has bulk.
            // api.ts doesn't show bulk mark read.
            // I'll just iterate for now or assuming backend 'update' can handle it? No.
            // Let's iterate client side for now to be safe, or just fire and forget.
            await api.notifications.markAllRead();

        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, loading }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
