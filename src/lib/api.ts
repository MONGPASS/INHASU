import type { Promotion } from '../components/promotions/promotionTypes';
import { changedContentResource, notifyContentSaved } from './publicContent';
import type { QuoteBookingSummary } from '../../functions/lib/quoteBookings';
import type { AdminWorkspaceData } from '../types/adminWorkspace';
import { INQUIRY_REQUEST_FAILED, type InquiryInput, type InquiryRecord, type InquiryStatus } from '../types/inquiry';
import { customerLoginPath, customerLinkPath, type CustomerSource } from '../../public/customer-access.js';

const API_BASE = '/api';

/** Body of a promotion create / update; the server assigns id and timestamps (and sort_order when omitted). */
type PromotionInput = Partial<Omit<Promotion, 'id' | 'created_at' | 'updated_at'>>;

/** GET /api/travel-mates/:id/requests. `requesters` is only sent to the post's host or an admin. */
export interface MateJoinRequests {
    count: number;
    mine: boolean;
    requesters?: Array<{ user_id: string; user_name?: string | null; created_at?: string }>;
}

async function request(url: string, options?: RequestInit) {
    // credentials: 'include' guarantees the session cookie is sent even if the
    // API is ever served from a different origin (previews, custom domains).
    // Same-origin requests are unaffected.
    const res = await fetch(url, { credentials: 'include', ...options });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        if (typeof window !== 'undefined' && window.location?.pathname && !window.location.pathname.startsWith('/admin') && /^\/api\/(?:reservations|quotes|documents|customer-access\/history)(?:\/|$)/.test(url)) {
            const returnTo = window.location.pathname + window.location.search + window.location.hash;
            if (res.status === 401) window.location.replace(customerLoginPath(returnTo));
            if (res.status === 403 && err.code === 'claim_required') {
                const quote = url.match(/^\/api\/quotes\/([^/?]+)/);
                const reservation = url.match(/^\/api\/(?:reservations|documents\/(?:itinerary|contract))\/([^/?]+)/);
                const match = quote || reservation;
                if (match) {
                    const source: CustomerSource = quote ? 'quote' : 'reservation';
                    window.location.replace(customerLinkPath(source, decodeURIComponent(match[1]), returnTo));
                }
            }
        }
        const failure = new Error(err.error || `HTTP ${res.status}`) as Error & { delivery?: { state: string }; status?: number; code?: string };
        failure.status = res.status;
        if (typeof err.code === 'string') failure.code = err.code;
        if (err.delivery && typeof err.delivery.state === 'string') failure.delivery = { state: err.delivery.state };
        throw failure;
    }
    const data = await res.json();
    const resource = changedContentResource(url, options?.method);
    if (resource) notifyContentSaved(resource);
    if (typeof window !== 'undefined' && options?.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())
        && /^\/api\/(reservations|quotes|products|documents)(\/|$)/.test(url)) {
        window.dispatchEvent(new Event('admin-workspace-changed'));
    }
    return data;
}

export const api = {
    customerAccess: {
        history: async (): Promise<{ ok: boolean; items: Array<{ id: string; source: 'request' | 'quote'; status: string; destination: string; period: string; headcount: string | number; createdAt: string; href: string }> }> => request(`${API_BASE}/customer-access/history`, { cache: 'no-store' }),
    },
    adminWorkspace: { get: async (): Promise<AdminWorkspaceData> => request(`${API_BASE}/admin/workspace`, { cache: 'no-store' }) },
    adminBookings: {
        quote: async (): Promise<{ items: QuoteBookingSummary[]; skipped: number }> =>
            request(`${API_BASE}/admin/bookings/quote`, { cache: 'no-store' }),
    },
    auth: {
        me: async () => {
            try {
                // credentials: 'include' — always send the session cookie.
                // cache: 'no-store' — never reuse a stale pre-login { user: null }
                // response, which would keep the app "logged out" right after a
                // successful login (an infinite login loop).
                const res = await fetch(`${API_BASE}/auth/me`, {
                    credentials: 'include',
                    cache: 'no-store',
                });
                if (!res.ok) return null;
                const data = await res.json();
                if (data.error) return null;
                // Backend returns { user: {...} } — unwrap so callers can use me.id directly.
                // Falls back to data itself if not wrapped (defensive).
                return data.user ?? (data.id ? data : null);
            } catch (e) {
                return null;
            }
        },
        login: async (email: string, password: string) => {
            return request(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
        },
        logout: async () => {
            return request(`${API_BASE}/auth/logout`, { method: 'POST' });
        },
        /**
         * 맞춤 견적 도구(public/견적관리.html 등)가 쓰는 관리자 값. 관리자 세션이 있어야 받을 수 있고,
         * 서버에 ADMIN_TOKEN 이 설정되어 있지 않으면 null 이 온다.
         */
        quoteDesk: async (signal?: AbortSignal): Promise<{ token: string | null; userId?: string }> => {
            return request(`${API_BASE}/auth/quote-desk`, { cache: 'no-store', signal });
        },
        /** 관리자 계정이 아직 하나도 없으면 true (로그인 화면이 "처음 설정" 폼을 보여 준다). 확인 실패 시 false. */
        adminSetupStatus: async (): Promise<{ needsSetup: boolean }> => {
            try {
                const res = await fetch(`${API_BASE}/auth/admin-setup`, {
                    credentials: 'include',
                    cache: 'no-store',
                });
                if (!res.ok) return { needsSetup: false };
                const data = await res.json();
                return { needsSetup: data?.needsSetup === true };
            } catch (e) {
                return { needsSetup: false };
            }
        },
        /** 최초 관리자 계정 만들기. 첫 인자는 기존 견적 관리자 비밀번호이며 헤더로만 보낸다. */
        adminSetup: async (legacyPassword: string, email: string, password: string): Promise<{ success: boolean; email: string }> => {
            return request(`${API_BASE}/auth/admin-setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': legacyPassword },
                body: JSON.stringify({ email, password }),
            });
        }
    },
    products: {
        list: async () => request(`${API_BASE}/products`),
        summary: async () => request(`${API_BASE}/products?summary=1`),
        get: async (id: string) => request(`${API_BASE}/products/${id}`),
        create: async (data: any) => request(`${API_BASE}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        reorder: async (items: { id: string, sortOrder: number }[]) => request(`${API_BASE}/products/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        }),
        delete: async (id: string) => request(`${API_BASE}/products/${id}`, { method: 'DELETE' }),
    },
    reservations: {
        list: async () => request(`${API_BASE}/reservations`),
        get: async (id: string) => request(`${API_BASE}/reservations/${id}`),
        create: async (data: any) => request(`${API_BASE}/reservations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/reservations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/reservations/${id}`, { method: 'DELETE' }),
        /** 예약금 '입금 완료' 신고 (본인 예약). 서버가 담당자에게 알리고 `{ success, depositReport }`를 돌려준다. */
        reportDeposit: async (id: string, name: string) => request(`${API_BASE}/reservations/${encodeURIComponent(id)}/deposit-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        }),
    },
    quotes: {
        list: async () => request(`${API_BASE}/quotes`),
        get: async (id: string) => request(`${API_BASE}/quotes/${id}`),
        create: async (data: any) => request(`${API_BASE}/quotes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/quotes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/quotes/${id}`, { method: 'DELETE' }),
    },
    banners: {
        get: async () => request(`${API_BASE}/banners`),
        save: async (data: any) => request(`${API_BASE}/banners`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
    },
    settings: {
        get: async (key?: string) => request(`${API_BASE}/settings${key ? `?key=${key}` : ''}`),
        /** 설정 하나를 저장한다 */
        save: async (key: string, value: any) => request(`${API_BASE}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: value })
        }),
        /** 여러 설정을 한 번에 저장한다 */
        saveMany: async (data: Record<string, string>) => request(`${API_BASE}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
    },
    faqs: {
        list: async () => request(`${API_BASE}/faqs`),
        create: async (data: any) => request(`${API_BASE}/faqs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/faqs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/faqs/${id}`, { method: 'DELETE' }),
        bulkSave: async (faqs: any[]) => request(`${API_BASE}/faqs/bulk`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ faqs })
        }),
    },
    // Tour-common FAQ — single global list shown at the bottom of every
    // product detail page (PC + mobile). Per-product `product.faqs` still
    // overrides when set.
    tourFaqs: {
        list: async (): Promise<Array<{ id: string; question: string; answer: string; sort_order: number }>> =>
            request(`${API_BASE}/tour-faqs`),
        saveBulk: async (faqs: Array<{ id?: string; question: string; answer: string }>) =>
            request(`${API_BASE}/tour-faqs`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faqs }),
            }),
    },
    faqCategories: {
        list: async () => request(`${API_BASE}/faq-categories`),
        create: async (data: any) => request(`${API_BASE}/faq-categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/faq-categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/faq-categories/${id}`, { method: 'DELETE' }),
    },
    reviews: {
        list: async () => request(`${API_BASE}/reviews`),
        listForProduct: async (productId: string, approvedOnly: boolean = true) => {
            const params = new URLSearchParams({ product_id: productId });
            if (approvedOnly) params.set('approved', '1');
            return request(`${API_BASE}/reviews?${params.toString()}`);
        },
        get: async (id: string) => request(`${API_BASE}/reviews/${id}`),
        getHelpfulStatus: async (id: string) => request(`${API_BASE}/reviews/${encodeURIComponent(id)}/helpful`),
        toggleHelpful: async (id: string) => request(`${API_BASE}/reviews/${encodeURIComponent(id)}/helpful`, {
            method: 'POST'
        }),
        create: async (data: any) => request(`${API_BASE}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        createForReservation: async (reservationId: string, data: Record<string, unknown>) => request(`${API_BASE}/reviews/reservation/${encodeURIComponent(reservationId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/reviews/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/reviews/${id}`, { method: 'DELETE' }),
    },
    itineraryTemplates: {
        list: async () => request(`${API_BASE}/itinerary-templates`),
        create: async (data: any) => request(`${API_BASE}/itinerary-templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/itinerary-templates/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/itinerary-templates/${id}`, { method: 'DELETE' }),
    },
    documents: {
        itinerary: {
            get: async (reservationId: string) => request(`${API_BASE}/documents/itinerary/${reservationId}`),
            publish: async (reservationId: string) => request(`${API_BASE}/documents/itinerary/${reservationId}/publish`, { method: 'POST' }),
        },
        contract: {
            get: async (reservationId: string) => request(`${API_BASE}/documents/contract/${reservationId}`),
            saveCustomer: async (reservationId: string, data: any) => request(`${API_BASE}/documents/contract/${reservationId}/customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }),
        },
    },
    tourGuides: {
        list: async () => request(`${API_BASE}/tour-guides`),
        create: async (data: any) => request(`${API_BASE}/tour-guides`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/tour-guides/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/tour-guides/${id}`, { method: 'DELETE' }),
    },
    guides: {
        list: async () => request(`${API_BASE}/guides`),
        get: async (id: string) => request(`${API_BASE}/guides/${id}`),
        create: async (data: any) => request(`${API_BASE}/guides`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/guides/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/guides/${id}`, { method: 'DELETE' }),
        save: async (data: any[]) => request(`${API_BASE}/guides/bulk`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guides: data })
        }),
    },
    magazines: {
        list: async () => request(`${API_BASE}/magazines`),
        get: async (id: string) => request(`${API_BASE}/magazines/${id}`),
        create: async (data: any) => request(`${API_BASE}/magazines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/magazines/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/magazines/${id}`, { method: 'DELETE' }),
    },
    touristSpots: {
        // Reusable master library — admin picks from this when filling out
        // a timeline event in the itinerary editor.
        list: async (params?: { q?: string; active?: boolean }) => {
            const qs = new URLSearchParams();
            if (params?.q) qs.set('q', params.q);
            if (params?.active === false) qs.set('active', '0');
            const tail = qs.toString();
            return request(`${API_BASE}/tourist-spots${tail ? '?' + tail : ''}`);
        },
        get: async (id: string) => request(`${API_BASE}/tourist-spots/${id}`),
        create: async (data: any) => request(`${API_BASE}/tourist-spots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/tourist-spots/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }),
        delete: async (id: string) => request(`${API_BASE}/tourist-spots/${id}`, { method: 'DELETE' }),
    },
    hotels: {
        // Reusable master library — admin picks from this when filling out
        // a day's accommodation slot in the itinerary editor.
        // Optional query params: { q, country, city, active }
        list: async (params?: { q?: string; country?: string; city?: string; active?: boolean }) => {
            const qs = new URLSearchParams();
            if (params?.q) qs.set('q', params.q);
            if (params?.country) qs.set('country', params.country);
            if (params?.city) qs.set('city', params.city);
            if (params?.active === false) qs.set('active', '0');
            const tail = qs.toString();
            return request(`${API_BASE}/hotels${tail ? '?' + tail : ''}`);
        },
        get: async (id: string) => request(`${API_BASE}/hotels/${id}`),
        create: async (data: any) => request(`${API_BASE}/hotels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/hotels/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }),
        delete: async (id: string) => request(`${API_BASE}/hotels/${id}`, { method: 'DELETE' }),
    },
    accommodations: {
        list: async () => request(`${API_BASE}/accommodations`),
        get: async (id: string) => request(`${API_BASE}/accommodations/${id}`),
        create: async (data: any) => request(`${API_BASE}/accommodations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/accommodations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/accommodations/${id}`, { method: 'DELETE' }),
        save: async (data: any[]) => request(`${API_BASE}/accommodations/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accommodations: data })
        }),
    },
    categories: {
        reorder: async (items: { id: string; sort_order: number }[], type: 'product' | 'magazine' = 'product') => request(`${API_BASE}/categories/reorder`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, items })
        }),
        list: async (type?: string) => request(`${API_BASE}/categories${type ? `?type=${type}` : ''}`),
        get: async (slug: string) => request(`${API_BASE}/categories/${slug}`),
        create: async (data: any) => request(`${API_BASE}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        rename: async (oldId: string, newId: string) => request(`${API_BASE}/categories/${oldId}/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_id: newId })
        }),
        delete: async (id: string) => request(`${API_BASE}/categories/${id}`, { method: 'DELETE' }),
        bulkSave: async (categories: any[]) => request(`${API_BASE}/categories/bulk`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories })
        }),
    },
    notifications: {
        sendEmail: async (to: string, type: string, data: any, idempotencyKey?: string) => {
            return request('/api/notifications/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, type, data, ...(idempotencyKey ? { idempotencyKey } : {}) })
            });
        },
        list: async () => request(`${API_BASE}/notifications`),
        update: async (id: string, data: any) => request(`${API_BASE}/notifications/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        markAllRead: async () => request(`${API_BASE}/notifications/mark-all-read`, {
            method: 'PUT',
        }),
    },
    travelMates: {
        list: async () => request(`${API_BASE}/travel-mates`),
        get: async (id: string) => request(`${API_BASE}/travel-mates/${id}`),
        create: async (data: any) => request(`${API_BASE}/travel-mates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: async (id: string, data: any) => request(`${API_BASE}/travel-mates/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string) => request(`${API_BASE}/travel-mates/${id}`, { method: 'DELETE' }),
        // Public view counter (editing the post itself is author/admin-only).
        view: async (id: string) => request(`${API_BASE}/travel-mates/${id}/view`, { method: 'POST' }),
        // 참가 요청 — tells the host someone wants to join; it never changes the member count.
        /** Request count and whether the caller asked; the host / an admin also gets `requesters`. */
        requests: async (id: string): Promise<MateJoinRequests> => request(`${API_BASE}/travel-mates/${encodeURIComponent(id)}/requests`),
        /** Signed-in members other than the host, while the post is open. Asking twice is harmless. */
        requestJoin: async (id: string): Promise<{ success: boolean; requested: boolean; count: number }> =>
            request(`${API_BASE}/travel-mates/${encodeURIComponent(id)}/requests`, { method: 'POST' }),
        cancelJoin: async (id: string): Promise<{ success: boolean; requested: boolean; count: number }> =>
            request(`${API_BASE}/travel-mates/${encodeURIComponent(id)}/requests`, { method: 'DELETE' }),
    },
    chats: {
        list: async () => request(`${API_BASE}/chats`),
        get: async (id: string) => request(`${API_BASE}/chats/${id}`),
        create: async (data: any) => request(`${API_BASE}/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
    },
    messages: {
        list: async (roomId: string) => request(`${API_BASE}/messages?room_id=${roomId}`),
        create: async (data: any) => request(`${API_BASE}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
    },
    quickLinks: {
        list: async () => request(`${API_BASE}/quick-links`),
    },
    eventBanners: {
        list: async () => request(`${API_BASE}/event-banners`),
    },
    // 여행 기획전 — the /promotions cards, curated at /admin/promotions.
    promotions: {
        /** Active promotions in display order (public). */
        list: async (): Promise<Promotion[]> => request(`${API_BASE}/promotions`),
        /** Every promotion, hidden ones included (admin only). */
        listAll: async (): Promise<Promotion[]> => request(`${API_BASE}/promotions?all=1`),
        get: async (id: string): Promise<Promotion> => request(`${API_BASE}/promotions/${encodeURIComponent(id)}`),
        create: async (data: PromotionInput): Promise<{ success: boolean; id: string }> => request(`${API_BASE}/promotions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        /** Only the fields passed are changed. */
        update: async (id: string, data: Partial<PromotionInput>): Promise<{ success: boolean }> => request(`${API_BASE}/promotions/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        reorder: async (items: { id: string; sort_order: number }[]): Promise<{ success: boolean }> => request(`${API_BASE}/promotions/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        }),
        delete: async (id: string): Promise<{ success: boolean }> => request(`${API_BASE}/promotions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    },
    // 문의 — the /contact form; read and managed at /admin/inquiries.
    inquiries: {
        /** Public. A rejection throws an Error whose message is the server's error code (see INQUIRY_REQUEST_FAILED). */
        create: async (data: InquiryInput): Promise<{ success: boolean; id: string }> => {
            const res = await fetch(`${API_BASE}/inquiries`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(typeof err?.code === 'string' && err.code ? err.code : INQUIRY_REQUEST_FAILED);
            }
            return res.json();
        },
        /** Newest first (admin only). */
        list: async (status?: InquiryStatus): Promise<InquiryRecord[]> =>
            request(`${API_BASE}/inquiries${status ? `?status=${encodeURIComponent(status)}` : ''}`),
        /** Only the fields passed are changed (admin only). */
        update: async (id: string, data: { status?: InquiryStatus; admin_note?: string }): Promise<{ success: boolean }> => request(`${API_BASE}/inquiries/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: async (id: string): Promise<{ success: boolean }> => request(`${API_BASE}/inquiries/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    },
    recentlyViewed: {
        list: async () => request(`${API_BASE}/recently-viewed`),
        upsert: async (data: any) => request(`${API_BASE}/recently-viewed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        /** Removes one history entry (the row id from `list`, not the product id). */
        remove: async (id: string): Promise<{ success: boolean }> => request(`${API_BASE}/recently-viewed/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        /** Removes the caller's whole history. */
        clear: async (): Promise<{ success: boolean }> => request(`${API_BASE}/recently-viewed`, { method: 'DELETE' }),
    },
    wishlist: {
        list: async () => request(`${API_BASE}/wishlist`),
        add: async (data: any) => request(`${API_BASE}/wishlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        remove: async (id: string) => request(`${API_BASE}/wishlist/${id}`, { method: 'DELETE' }),
    },
    storage: {
        upload: async (file: File, bucket: string = 'milkyway-assets', folder: string = 'uploads') => {
            // TODO: Implement R2 upload
            console.log('Upload not implemented yet');
            return 'https://placehold.co/600x400';
        }
    },
};
