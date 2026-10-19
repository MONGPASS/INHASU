export type AdminDeliveryKind = 'quote' | 'contract' | 'itinerary' | 'travel_notice';
export interface AdminDeliveryItem { id: string; kind: AdminDeliveryKind; channel: string; state: string; at: string; error?: string; providerId?: string; legacy?: boolean; revision?: string; }
export interface DocumentDeliveryVersion { revision: string; lastSentRevision?: string; needsResend: boolean; verified: boolean; hasPriorDelivery?: boolean; }
export interface AdminBookingWorkflow { accepted: boolean; deposit: boolean; contract: boolean; schedule: boolean; published: boolean; }
export interface AdminDeliveryData { source: 'product' | 'quote_booking'; bookingId: string; workflow: AdminBookingWorkflow; items: AdminDeliveryItem[]; warnings: string[]; documents?: Record<string, DocumentDeliveryVersion>; }
