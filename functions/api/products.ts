import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

type Env = {
    DB: any;
};

const app = new Hono<{ Bindings: Env }>();

// Helper to safely parse JSON
const safeParse = (val: any, fallback: any = []) => {
    if (!val) return fallback;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return fallback; }
    }
    return val;
};

// Helper to stringify if needed
const toJson = (val: any): string => {
    if (typeof val === 'string') return val;
    return JSON.stringify(val || []);
};

// Helper to get value from either snake_case or camelCase
const g = (data: any, snakeKey: string, camelKey: string, defaultVal: any = '') => {
    return data[snakeKey] ?? data[camelKey] ?? defaultVal;
};

// Trip type: 'full' (풀패키지) | 'value' (실속형) | null (미지정)
const toPackageType = (v: any): 'full' | 'value' | null => (v === 'full' || v === 'value' ? v : null);

// package_type is written separately and best-effort so product saves keep working
// on databases where /api/migrate-db hasn't added the column yet.
const savePackageType = async (db: any, id: string, data: any) => {
    if (data.package_type === undefined && data.packageType === undefined) return;
    try {
        await db.prepare('UPDATE products SET package_type = ? WHERE id = ?')
            .bind(toPackageType(data.package_type ?? data.packageType), id)
            .run();
    } catch (e) {
        console.warn('products.package_type not saved (run /api/migrate-db):', e);
    }
};

// GET /api/products
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        let result;
        try {
            result = await db.prepare('SELECT * FROM products ORDER BY sort_order ASC, created_at DESC').all();
        } catch {
            // Fallback if sort_order column doesn't exist
            result = await db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
        }
        const parsed = (result.results || []).map((p: any) => ({
            ...p,
            mainImages: safeParse(p.main_images),
            galleryImages: safeParse(p.gallery_images),
            detailImages: safeParse(p.detail_images),
            itineraryImages: safeParse(p.itinerary_images),
            detailSlides: safeParse(p.detail_slides),
            detailBlocks: safeParse(p.detail_blocks),
            itineraryBlocks: safeParse(p.itinerary_blocks),
            highlights: safeParse(p.highlights),
            pricingOptions: safeParse(p.pricing_options),
            accommodationOptions: safeParse(p.accommodation_options),
            vehicleOptions: safeParse(p.vehicle_options),
            tags: safeParse(p.tags),
            included: safeParse(p.included),
            excluded: safeParse(p.excluded),
            faqs: safeParse(p.faqs),
            images: safeParse(p.images),
            originalPrice: p.original_price,
            isFeatured: p.is_featured === 1 || p.featured === 1,
            isPopular: p.is_popular === 1 || p.popular === 1,
            sortOrder: p.sort_order || 0,
            packageType: toPackageType(p.package_type),
        }));
        return c.json(parsed);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/products/:id
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
        if (!result) return c.json({ error: 'Product not found' }, 404);

        const parsed = {
            ...result,
            mainImages: safeParse(result.main_images),
            galleryImages: safeParse(result.gallery_images),
            detailImages: safeParse(result.detail_images),
            itineraryImages: safeParse(result.itinerary_images),
            detailSlides: safeParse(result.detail_slides),
            detailBlocks: safeParse(result.detail_blocks),
            itineraryBlocks: safeParse(result.itinerary_blocks),
            highlights: safeParse(result.highlights),
            pricingOptions: safeParse(result.pricing_options),
            accommodationOptions: safeParse(result.accommodation_options),
            vehicleOptions: safeParse(result.vehicle_options),
            tags: safeParse(result.tags),
            included: safeParse(result.included),
            excluded: safeParse(result.excluded),
            faqs: safeParse(result.faqs),
            images: safeParse(result.images),
            originalPrice: result.original_price,
            isFeatured: result.is_featured === 1 || result.featured === 1,
            isPopular: result.is_popular === 1 || result.popular === 1,
            sortOrder: result.sort_order || 0,
            packageType: toPackageType(result.package_type),
        };
        return c.json(parsed);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/products (Admin only)
app.post('/', requireAdmin, async (c) => {
    try {
        const data = await c.req.json();
        const db = c.env.DB;
        const id = data.id || `prod-${Date.now()}`;

        const mainImages = g(data, 'main_images', 'mainImages', []);
        const isFeatured = data.is_featured ?? data.isFeatured ?? false;
        const isPopular = data.is_popular ?? data.isPopular ?? false;

        try {
            await db.prepare(`
                INSERT INTO products (
                    id, name, description, category, duration, price, original_price,
                    main_images, gallery_images, detail_images, itinerary_images,
                    images, thumbnail, status,
                    is_featured, is_popular, featured, popular,
                    tags, included, excluded, faqs,
                    detail_slides, detail_blocks, itinerary_blocks,
                    highlights, pricing_options, accommodation_options, vehicle_options,
                    view_count, booking_count, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                id,
                data.name || '',
                data.description || '',
                data.category || '',
                data.duration || '',
                data.price || 0,
                g(data, 'original_price', 'originalPrice', 0),
                toJson(mainImages),
                toJson(g(data, 'gallery_images', 'galleryImages', [])),
                toJson(g(data, 'detail_images', 'detailImages', [])),
                toJson(g(data, 'itinerary_images', 'itineraryImages', [])),
                toJson(mainImages), // images = copy of mainImages
                (Array.isArray(mainImages) && mainImages.length > 0) ? mainImages[0] : '', // thumbnail
                data.status || 'active',
                isFeatured ? 1 : 0,
                isPopular ? 1 : 0,
                isFeatured ? 1 : 0,
                isPopular ? 1 : 0,
                toJson(data.tags || []),
                toJson(data.included || []),
                toJson(data.excluded || []),
                toJson(data.faqs || []),
                toJson(g(data, 'detail_slides', 'detailSlides', [])),
                toJson(g(data, 'detail_blocks', 'detailBlocks', [])),
                toJson(g(data, 'itinerary_blocks', 'itineraryBlocks', [])),
                toJson(data.highlights || []),
                toJson(g(data, 'pricing_options', 'pricingOptions', [])),
                toJson(g(data, 'accommodation_options', 'accommodationOptions', [])),
                toJson(g(data, 'vehicle_options', 'vehicleOptions', [])),
                data.view_count || data.viewCount || 0,
                data.booking_count || data.bookingCount || 0,
                data.sortOrder || 0
            ).run();
        } catch {
            // Fallback if sort_order column doesn't exist
            await db.prepare(`
                INSERT INTO products (
                    id, name, description, category, duration, price, original_price,
                    main_images, gallery_images, detail_images, itinerary_images,
                    images, thumbnail, status,
                    is_featured, is_popular, featured, popular,
                    tags, included, excluded, faqs,
                    detail_slides, detail_blocks, itinerary_blocks,
                    highlights, pricing_options, accommodation_options, vehicle_options,
                    view_count, booking_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                id,
                data.name || '',
                data.description || '',
                data.category || '',
                data.duration || '',
                data.price || 0,
                g(data, 'original_price', 'originalPrice', 0),
                toJson(mainImages),
                toJson(g(data, 'gallery_images', 'galleryImages', [])),
                toJson(g(data, 'detail_images', 'detailImages', [])),
                toJson(g(data, 'itinerary_images', 'itineraryImages', [])),
                toJson(mainImages),
                (Array.isArray(mainImages) && mainImages.length > 0) ? mainImages[0] : '',
                data.status || 'active',
                isFeatured ? 1 : 0,
                isPopular ? 1 : 0,
                isFeatured ? 1 : 0,
                isPopular ? 1 : 0,
                toJson(data.tags || []),
                toJson(data.included || []),
                toJson(data.excluded || []),
                toJson(data.faqs || []),
                toJson(g(data, 'detail_slides', 'detailSlides', [])),
                toJson(g(data, 'detail_blocks', 'detailBlocks', [])),
                toJson(g(data, 'itinerary_blocks', 'itineraryBlocks', [])),
                toJson(data.highlights || []),
                toJson(g(data, 'pricing_options', 'pricingOptions', [])),
                toJson(g(data, 'accommodation_options', 'accommodationOptions', [])),
                toJson(g(data, 'vehicle_options', 'vehicleOptions', [])),
                data.view_count || data.viewCount || 0,
                data.booking_count || data.bookingCount || 0
            ).run();
        }

        await savePackageType(db, id, data);

        return c.json({ success: true, id });
    } catch (e: any) {
        console.error('Product create error:', e);
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/products/reorder (Admin only)
app.post('/reorder', requireAdmin, async (c) => {
    try {
        const { items } = await c.req.json();
        // items should be an array of { id: string, sortOrder: number }
        if (!Array.isArray(items)) {
            return c.json({ error: 'Invalid data format' }, 400);
        }

        const db = c.env.DB;
        
        // Use a transaction or multiple updates
        // Since sqlite in cloudflare workers via Drizzle/binding doesn't support complex bulk updates easily without a loop or transaction
        const statements = items.map((item: any) => 
            db.prepare('UPDATE products SET sort_order = ? WHERE id = ?').bind(item.sortOrder, item.id)
        );

        await db.batch(statements);

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Product reorder error:', e);
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/products/:id (Admin only)
app.put('/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const data = await c.req.json();
        const db = c.env.DB;

        const updateFields: string[] = [];
        const updateValues: any[] = [];

        // Define mapping for frontend keys to database column names, and how to format them
        const fieldMapping: Record<string, { col: string, format?: (v: any) => any }> = {
            name: { col: 'name' },
            description: { col: 'description' },
            category: { col: 'category' },
            duration: { col: 'duration' },
            price: { col: 'price' },
            original_price: { col: 'original_price' },
            originalPrice: { col: 'original_price' },
            
            main_images: { col: 'main_images', format: toJson },
            mainImages: { col: 'main_images', format: toJson },
            gallery_images: { col: 'gallery_images', format: toJson },
            galleryImages: { col: 'gallery_images', format: toJson },
            detail_images: { col: 'detail_images', format: toJson },
            detailImages: { col: 'detail_images', format: toJson },
            itinerary_images: { col: 'itinerary_images', format: toJson },
            itineraryImages: { col: 'itinerary_images', format: toJson },
            
            images: { col: 'images', format: toJson },
            thumbnail: { col: 'thumbnail' },
            status: { col: 'status' },
            
            is_featured: { col: 'is_featured', format: v => v ? 1 : 0 },
            isFeatured: { col: 'is_featured', format: v => v ? 1 : 0 },
            is_popular: { col: 'is_popular', format: v => v ? 1 : 0 },
            isPopular: { col: 'is_popular', format: v => v ? 1 : 0 },
            
            tags: { col: 'tags', format: toJson },
            included: { col: 'included', format: toJson },
            excluded: { col: 'excluded', format: toJson },
            faqs: { col: 'faqs', format: toJson },
            
            detail_slides: { col: 'detail_slides', format: toJson },
            detailSlides: { col: 'detail_slides', format: toJson },
            detail_blocks: { col: 'detail_blocks', format: toJson },
            detailBlocks: { col: 'detail_blocks', format: toJson },
            itinerary_blocks: { col: 'itinerary_blocks', format: toJson },
            itineraryBlocks: { col: 'itinerary_blocks', format: toJson },
            
            highlights: { col: 'highlights', format: toJson },
            pricing_options: { col: 'pricing_options', format: toJson },
            pricingOptions: { col: 'pricing_options', format: toJson },
            accommodation_options: { col: 'accommodation_options', format: toJson },
            accommodationOptions: { col: 'accommodation_options', format: toJson },
            vehicle_options: { col: 'vehicle_options', format: toJson },
            vehicleOptions: { col: 'vehicle_options', format: toJson },
            
            view_count: { col: 'view_count' },
            viewCount: { col: 'view_count' },
            booking_count: { col: 'booking_count' },
            bookingCount: { col: 'booking_count' },
            sort_order: { col: 'sort_order' },
            sortOrder: { col: 'sort_order' }
        };

        const processedCols = new Set<string>();

        // We also want to auto-sync 'featured' and 'popular' if their 'is_' counterparts are present
        if (data.is_featured !== undefined || data.isFeatured !== undefined) {
             const val = data.is_featured ?? data.isFeatured;
             updateFields.push('featured = ?');
             updateValues.push(val ? 1 : 0);
        }
        if (data.is_popular !== undefined || data.isPopular !== undefined) {
             const val = data.is_popular ?? data.isPopular;
             updateFields.push('popular = ?');
             updateValues.push(val ? 1 : 0);
        }

        // Auto-update images, thumbnail if mainImages is updated
        if (data.main_images !== undefined || data.mainImages !== undefined) {
            const m = data.main_images ?? data.mainImages;
            if (!processedCols.has('images')) {
                updateFields.push('images = ?');
                updateValues.push(toJson(m));
                processedCols.add('images');
            }
            if (!processedCols.has('thumbnail')) {
                updateFields.push('thumbnail = ?');
                updateValues.push((Array.isArray(m) && m.length > 0) ? m[0] : '');
                processedCols.add('thumbnail');
            }
        }

        for (const [key, value] of Object.entries(data)) {
            if (fieldMapping[key] && !processedCols.has(fieldMapping[key].col)) {
                updateFields.push(`${fieldMapping[key].col} = ?`);
                updateValues.push(fieldMapping[key].format ? fieldMapping[key].format!(value) : value);
                processedCols.add(fieldMapping[key].col);
            }
        }

        if (updateFields.length > 0) {
            updateFields.push(`updated_at = datetime('now')`);
            updateValues.push(id);
            
            try {
                await db.prepare(
                    `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`
                ).bind(...updateValues).run();
            } catch {
                // Remove sort_order from fields if column doesn't exist
                const filteredFields = [];
                const filteredValues = [];
                for (let i = 0; i < updateFields.length - 1; i++) {
                    if (!updateFields[i].startsWith('sort_order')) {
                        filteredFields.push(updateFields[i]);
                        filteredValues.push(updateValues[i]);
                    }
                }
                filteredFields.push(`updated_at = datetime('now')`);
                filteredValues.push(id);
                
                if (filteredFields.length > 1) { // > 1 because updated_at is always there
                    await db.prepare(
                        `UPDATE products SET ${filteredFields.join(', ')} WHERE id = ?`
                    ).bind(...filteredValues).run();
                }
            }
        }

        await savePackageType(db, id, data);

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Product update error:', e);
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/products/:id (Admin only)
app.delete('/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const db = c.env.DB;
        await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        console.error('Product delete error:', e);
        return c.json({ error: e.message }, 500);
    }
});

export default app;
