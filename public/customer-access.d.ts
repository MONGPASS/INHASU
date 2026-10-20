export type CustomerSource = 'request' | 'quote' | 'reservation';
export interface CustomerReference { source: CustomerSource; key: string; returnTo: string }
export function safeCustomerReturnPath(value: unknown, fallback?: string, allowLinking?: boolean): string;
export function customerLoginPath(returnTo: string): string;
export function customerLinkPath(source: CustomerSource, key: string, returnTo: string): string;
export function parseCustomerReference(value: string, origin: string): CustomerReference | null;
export function requireCustomerAccess(source: CustomerSource, key: string, surface?: Window): Promise<boolean>;
export function requireCustomerDocumentAccess(source: CustomerSource, key: string, surface?: Window): Promise<boolean>;
export function requireAdminDocumentAccess(surface?: Window): Promise<boolean>;
export function customerDocumentFetch(input: RequestInfo | URL, options: RequestInit | undefined, reference?: { source: CustomerSource; key: string }, surface?: Window): Promise<Response>;
