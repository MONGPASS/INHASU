import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { siteSchemaReady } from '../lib/siteSchema';

const app = new Hono().basePath('/api');

// 사이트 표(상품·예약·배너 등)가 준비됐는지 서버 인스턴스마다 한 번 확인한다.
// 처음 배포한 데이터베이스면 이때 표가 만들어진다 — functions/lib/siteSchema.ts
app.use('*', async (c, next) => {
    const db = (c.env as any)?.DB;
    if (db) await siteSchemaReady(db);
    await next();
});

app.get('/', (c) => {
    return c.json({ message: 'Mongolia Milkyway API' });
});

// Import route modules
import products from './products';
import reservations from './reservations';
import auth from './auth';
import emailNotifications from './notifications/email';
import notifications from './notifications/index';
import banners from './banners';
import settings from './settings';
import faqs from './faqs';
import faqCategories from './faq-categories';
import tourFaqs from './tour-faqs';
import reviews from './reviews';
import magazines from './magazines';
import accommodations from './accommodations';
import hotels from './hotels';
import touristSpots from './tourist-spots';
import categories from './categories';
import guides from './guides';
import quotes from './quotes';
import upload from './site-upload';
import images from './images/[...path]';
import quickLinks from './quick-links';
import eventBanners from './event-banners';
import migrateDb from './migrate-db';
import wishlist from './wishlist';
import recentlyViewed from './recently-viewed';
import travelMates from './travel-mates';
import chats from './chats';
import messages from './messages';
import paymentReminder from './cron/payment-reminder';
import dailyDigest from './cron/daily-digest';
import reviewRequest from './cron/review-request';
import paypalWebhook from './webhooks/paypal';
import testPaypal from './test-paypal';
import tourGuides from './tour-guides';
import itineraryTemplates from './itinerary-templates';
import documents from './documents';
import promotions from './promotions';
import inquiries from './inquiries';
import adminBookings from './admin-bookings';
import adminWorkspace from './admin-workspace';
import adminTraffic from './admin-traffic';
import adminDeliveries from './admin-deliveries';
import adminAssignments from './admin-assignments';
import adminCustomerNotices from './admin-customer-notices';
import customerAccess from './customer-access';

// Register routes
app.route('/products', products);
app.route('/admin/deliveries', adminDeliveries);
app.route('/admin/assignments', adminAssignments);
app.route('/admin/customer-notices', adminCustomerNotices);
app.route('/reservations', reservations);
app.route('/auth', auth);
app.route('/customer-access', customerAccess);
app.route('/notifications/email', emailNotifications);
app.route('/notifications', notifications);
app.route('/banners', banners);
app.route('/settings', settings);
app.route('/faqs', faqs);
app.route('/faq-categories', faqCategories);
app.route('/tour-faqs', tourFaqs);
app.route('/reviews', reviews);
app.route('/magazines', magazines);
app.route('/accommodations', accommodations);
app.route('/hotels', hotels);
app.route('/tourist-spots', touristSpots);
app.route('/categories', categories);
app.route('/guides', guides);
app.route('/quotes', quotes);
app.route('/site-upload', upload);
app.route('/images', images);
app.route('/quick-links', quickLinks);
app.route('/event-banners', eventBanners);
app.route('/migrate-db', migrateDb);
app.route('/wishlist', wishlist);
app.route('/recently-viewed', recentlyViewed);
app.route('/travel-mates', travelMates);
app.route('/chats', chats);
app.route('/messages', messages);
app.route('/cron/payment-reminder', paymentReminder);
app.route('/cron/daily-digest', dailyDigest);
app.route('/cron/review-request', reviewRequest);
app.route('/webhooks/paypal', paypalWebhook);
app.route('/test-paypal', testPaypal);
app.route('/tour-guides', tourGuides);
app.route('/itinerary-templates', itineraryTemplates);
app.route('/documents', documents);
app.route('/promotions', promotions);
app.route('/inquiries', inquiries);
app.route('/admin/bookings', adminBookings);
app.route('/admin/workspace', adminWorkspace);
app.route('/admin/traffic', adminTraffic);

export const onRequest = handle(app);
