export interface AdminWorkBooking {
    id: string; key: string; type: 'product' | 'quote_booking'; reservationNumber: string;
    customerName: string; productName: string; email: string; phone: string;
    status: string; statusLabel: string; totalAmount: number | null;
    startDate: string; endDate: string; createdAt: string; href: string;
    depositPaid: boolean; depositReported: boolean; contractSigned: boolean;
}
export interface AdminWorkInquiry {
    id: string; key: string; type: 'legacy_quote' | 'quote_request'; name: string; destination: string;
    email: string; phone: string; status: string; statusLabel: string; createdAt: string; href: string;
    pending: boolean;
}
export interface AdminWorkProduct { id: string; name: string; category: string; status: string; href: string; }
export interface AdminSearchItem {
    key: string; category: 'reservation' | 'quote' | 'product'; title: string; subtitle: string;
    keywords: string[]; href: string; statusLabel: string;
}
export interface AdminWorkTask {
    key: string; kind: 'deposit_report' | 'contract' | 'assignment' | 'quote';
    title: string; description: string; href: string; createdAt: string; priority: 'urgent' | 'normal';
}
export interface AdminWorkspaceData {
    generatedAt: string; today: string;
    bookings: AdminWorkBooking[]; inquiries: AdminWorkInquiry[]; products: AdminWorkProduct[];
    searchItems: AdminSearchItem[]; tasks: AdminWorkTask[]; warnings: string[];
    availability: { reservations: boolean; requests: boolean; quotes: boolean; products: boolean };
    metrics: { todayReservations: number | null; unpaidReservations: number | null; newQuotes: number | null;
        ongoingTours: number | null; confirmedSales: number | null; depositReports: number | null };
}
