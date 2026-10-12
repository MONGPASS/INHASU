import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const products = sqliteTable('products', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull(),
    duration: text('duration').notNull(),
    price: integer('price').notNull(),
    originalPrice: integer('original_price'),

    // JSON arrays stored as text
    mainImages: text('main_images').notNull(), // JSON.stringify(string[])
    galleryImages: text('gallery_images').notNull(), // JSON.stringify(string[])
    detailImages: text('detail_images').notNull(), // JSON.stringify(string[])
    itineraryImages: text('itinerary_images').notNull(), // JSON.stringify(string[])

    status: text('status').notNull().default('active'), // 'active' | 'inactive' | 'soldout'
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
    isPopular: integer('is_popular', { mode: 'boolean' }).default(false),

    tags: text('tags').notNull(), // JSON.stringify(string[])
    included: text('included').notNull(), // JSON.stringify(string[])
    excluded: text('excluded').notNull(), // JSON.stringify(string[])

    sortOrder: integer('sort_order').default(0),

    viewCount: integer('view_count').default(0),
    bookingCount: integer('booking_count').default(0),

    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});
