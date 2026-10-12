// One-off optimizer for static UI assets shipped with the bundle.
// Reads every PNG under src/assets and public/assets, emits a WebP sibling
// at a size appropriate for the max rendered use (2x for retina).
// Run: node scripts/optimize-static-images.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Manual size hints per file. Unlisted files fall back to DEFAULT.
// Sizes represent the max displayed width in CSS pixels — we render at 2x for retina.
const DEFAULT = { maxWidth: 256, quality: 85 };
const HINTS = {
    'src/assets/logo_square.png':          { maxWidth: 180, quality: 90 },
    'src/assets/logo_horizontal.png':      { maxWidth: 240, quality: 90 },
    'src/assets/logo_white_full.png':      { maxWidth: 240, quality: 90 },
    // Icons shown small in Footer / grids
    'public/assets/icons/line.png':        { maxWidth: 96,  quality: 85 },
    'public/assets/icons/instagram.png':   { maxWidth: 96,  quality: 85 },
    'public/assets/icons/channel_talk.png':{ maxWidth: 96,  quality: 85 },
    'public/assets/icons/kakaotalk.png':   { maxWidth: 96,  quality: 85 },
    'public/assets/icons/facebook.png':    { maxWidth: 96,  quality: 85 },
    'public/assets/icons/travel guide.png':{ maxWidth: 256, quality: 85 },
    // 3D illustrated icons on MyPage etc.
    'src/assets/icons/business_quote.png':     { maxWidth: 256, quality: 85 },
    'src/assets/icons/faq.png':                { maxWidth: 256, quality: 85 },
    'src/assets/icons/notification-bell-3d.png':{maxWidth: 128, quality: 85 },
    'src/assets/icons/recent.png':             { maxWidth: 256, quality: 85 },
    'src/assets/icons/review.png':             { maxWidth: 256, quality: 85 },
    'src/assets/icons/support.png':            { maxWidth: 256, quality: 85 },
    'src/assets/icons/tour_quote.png':         { maxWidth: 256, quality: 85 },
    'src/assets/icons/travel_mates.png':       { maxWidth: 256, quality: 85 },
    'src/assets/icons/wishlist.png':           { maxWidth: 256, quality: 85 },
};

const files = Object.keys(HINTS);

(async () => {
    console.log('Optimizing', files.length, 'files...\n');
    let totalOriginal = 0;
    let totalNew = 0;
    for (const rel of files) {
        const src = path.join(ROOT, rel);
        if (!fs.existsSync(src)) { console.log('  skip (missing):', rel); continue; }
        const { maxWidth, quality } = HINTS[rel] || DEFAULT;
        const destWebp = src.replace(/\.png$/i, '.webp');
        const originalSize = fs.statSync(src).size;

        const meta = await sharp(src).metadata();
        const resize = meta.width && meta.width > maxWidth ? { width: maxWidth, withoutEnlargement: true } : undefined;
        const pipeline = sharp(src);
        if (resize) pipeline.resize(resize);
        const { size: newSize } = await pipeline.webp({ quality, effort: 6 }).toFile(destWebp);
        totalOriginal += originalSize;
        totalNew += newSize;
        const reduction = (100 * (1 - newSize / originalSize)).toFixed(1);
        console.log(`  ✓ ${rel.padEnd(48)} ${(originalSize/1024).toFixed(1).padStart(7)}KB → ${(newSize/1024).toFixed(1).padStart(6)}KB (-${reduction}%)`);
    }
    console.log(`\nTotal: ${(totalOriginal/1024).toFixed(1)}KB → ${(totalNew/1024).toFixed(1)}KB (-${(100*(1-totalNew/totalOriginal)).toFixed(1)}%)`);
})();
