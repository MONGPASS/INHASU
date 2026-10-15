import { api } from './api';

type NotificationType = 'ESTIMATE_COMPLETED' | 'GUIDE_ASSIGNED' | 'RESERVATION_REQUESTED' | 'QUOTE_RECEIVED' | 'ITINERARY_READY' | 'CONTRACT_READY' | 'PAYMENT_CONFIRMED';

interface EmailData {
    customerName: string;
    destination?: string;
    productName?: string;
    estimateUrl?: string;
    adminNote?: string;
    guideName?: string;
    guidePhone?: string;
    reservationId?: string;
    depositAmount?: string;
    totalAmount?: string;
    localAmount?: string;
    customerPhone?: string;
    customerEmail?: string;
    [key: string]: any;
}

export const sendNotificationEmail = async (
    to: string,
    type: NotificationType,
    data: EmailData,
    idempotencyKey?: string,
) => {
    try {
        const response = await api.notifications.sendEmail(to, type, data, idempotencyKey);
        console.log('Email sent successfully:', response);
        return { success: true, data: response };
    } catch (error) {
        console.error('Failed to send email:', error);
        return { success: false, error };
    }
};
