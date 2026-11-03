// The router and navigation share the same lazy imports. Importing a screen
// downloads its code/CSS only; it does not mount the screen or request its data.
export const adminPageLoaders = {
    login: () => import('../pages/AdminLogin').then(module => ({ default: module.AdminLogin })),
    dashboard: () => import('../pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })),
    quotes: () => import('../pages/AdminQuoteManage').then(module => ({ default: module.AdminQuoteManage })),
    quoteDesk: () => import('../pages/AdminQuoteDesk').then(module => ({ default: module.AdminQuoteDesk })),
    reservations: () => import('../pages/AdminReservationManage').then(module => ({ default: module.AdminReservationManage })),
    calendar: () => import('../pages/AdminCalendar').then(module => ({ default: module.AdminCalendar })),
    banners: () => import('../pages/AdminBannerManage').then(module => ({ default: module.AdminBannerManage })),
    products: () => import('../pages/AdminProductManage').then(module => ({ default: module.AdminProductManage })),
    categories: () => import('../pages/AdminCategoryManage').then(module => ({ default: module.AdminCategoryManage })),
    guides: () => import('../pages/AdminGuideManage').then(module => ({ default: module.AdminGuideManage })),
    magazines: () => import('../pages/AdminMagazineManage').then(module => ({ default: module.AdminMagazineManage })),
    accommodations: () => import('../pages/AdminAccommodationManage').then(module => ({ default: module.AdminAccommodationManage })),
    accommodationOps: () => import('../pages/AdminAccommodationOps').then(module => ({ default: module.AdminAccommodationOps })),
    templates: () => import('../pages/AdminTemplateManage').then(module => ({ default: module.AdminTemplateManage })),
    reviews: () => import('../pages/AdminReviewManage').then(module => ({ default: module.AdminReviewManage })),
    faq: () => import('../pages/AdminFAQManage').then(module => ({ default: module.AdminFAQManage })),
    promotions: () => import('../pages/AdminPromotionManage').then(module => ({ default: module.AdminPromotionManage })),
    inquiries: () => import('../pages/AdminInquiryManage').then(module => ({ default: module.AdminInquiryManage })),
    tourFaqs: () => import('../pages/AdminTourFAQManage').then(module => ({ default: module.AdminTourFAQManage })),
};

type AdminPageKey = keyof typeof adminPageLoaders;
const routes: Record<string, AdminPageKey> = {
    '/admin': 'dashboard', '/admin/login': 'login', '/admin/quotes': 'quotes',
    '/admin/reservations': 'reservations', '/admin/calendar': 'calendar',
    '/admin/banners': 'banners', '/admin/products': 'products', '/admin/categories': 'categories',
    '/admin/guides': 'guides', '/admin/magazines': 'magazines',
    '/admin/accommodations': 'accommodations', '/admin/accommodation-ops': 'accommodationOps',
    '/admin/templates': 'templates', '/admin/reviews': 'reviews', '/admin/faq': 'faq',
    '/admin/promotions': 'promotions', '/admin/inquiries': 'inquiries', '/admin/tour-faqs': 'tourFaqs',
    '/admin/hotels': 'quoteDesk', '/admin/tourist-spots': 'quoteDesk',
    '/admin/design-spots': 'quoteDesk', '/admin/guide-intro': 'quoteDesk',
};
const prefetched = new Set<AdminPageKey>();

/** Warm only the intended destination, never every admin screen on entry. */
export function preloadAdminPage(href: string): void {
    const pathname = href.split(/[?#]/, 1)[0].replace(/\/+$/, '');
    const page = pathname.startsWith('/admin/quote-desk/') || pathname.startsWith('/admin/customer-workspace/quote/')
        ? 'quoteDesk' : pathname.startsWith('/admin/customer-workspace/') ? 'reservations' : routes[pathname];
    if (!page || prefetched.has(page)) return;
    prefetched.add(page);
    // A failed speculative fetch must not create an unhandled rejection or
    // prevent the normal lazy loader / a later intent from trying again.
    void adminPageLoaders[page]().catch(() => { prefetched.delete(page); });
}
