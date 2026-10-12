import { api } from '../lib/api';

export type NotificationType = 'reservation' | 'comment' | 'event' | 'system';

interface SendNotificationParams {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
}

/**
 * Sends a real-time notification to a user.
 * Now uses API instead of direct DB insert.
 */
export const sendNotification = async ({ userId, type, title, message, link }: SendNotificationParams) => {
    try {
        if (!userId) {
            console.warn('sendNotification: No userId provided');
            return;
        }

        // Using direct fetch to the API endpoint we created
        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, type, title, message, link })
        });

    } catch (error) {
        console.error('Error in sendNotification:', error);
    }
};
