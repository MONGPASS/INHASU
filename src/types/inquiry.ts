// 문의 (/contact form) as stored by /api/inquiries. Field names follow functions/api/inquiries.ts.

export type InquiryStatus = 'new' | 'answered' | 'closed';

export interface InquiryRecord {
    id: string;
    /** Set only when the sender was signed in. */
    user_id: string | null;
    name: string;
    email: string;
    kind: string;
    reservation_number: string;
    message: string;
    status: InquiryStatus;
    /** Staff-only memo; never shown to the sender. */
    admin_note: string;
    /** UTC, "YYYY-MM-DD HH:MM:SS". */
    created_at: string;
    updated_at: string;
}

/** Body of POST /api/inquiries. The server decides id, status, timestamps and the account. */
export interface InquiryInput {
    name: string;
    email: string;
    kind: string;
    reservation_number: string;
    message: string;
    /** Honeypot; real visitors leave it empty. */
    website: string;
}

/**
 * Error.message of a rejected api.inquiries.create: the server's error code
 * (RATE_LIMITED, BUSY, EMAIL_INVALID, MIGRATION_REQUIRED, …) or this value when there is none.
 */
export const INQUIRY_REQUEST_FAILED = 'REQUEST_FAILED';
