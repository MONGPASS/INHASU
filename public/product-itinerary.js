/* 상품 예약도 기존 확정 일정표의 표지·요금·배정 디자인을 그대로 사용한다. */
export const escapeDocumentText = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const imageUrl = value => /^(https?:\/\/|\/(?!\/)|img\/)/i.test(String(value || '')) ? String(value) : '';
const photos = values => (Array.isArray(values) ? values : []).map(imageUrl).filter(Boolean);

export async function loadProductItinerary(params) {
    const id = params.get('reservationId');
    const query = new URLSearchParams({ format: 'quote' });
    if (params.get('preview') === '1') query.set('preview', '1');
    const res = await fetch(`/api/documents/itinerary/${encodeURIComponent(id)}?${query}`, { cache: 'no-store', credentials: 'same-origin' });
    const result = await res.json();
    if (!res.ok || !result.quote || result.quote.source !== 'product') {
        throw new Error(result.error || '확정 일정표를 불러오지 못했습니다.');
    }
    const q = result.quote;
    // 공항 안내·허가증 등 공통 디자인 자산만 보충. 상품 표지는 빈 값도 존중한다.
    q.images = { ...(window.QUOTE?.images || {}), ...q.images };
    return q;
}

const heading = (title, sub = '') => `<div style="color:#1C8571;font-size:11px;letter-spacing:.08em;font-weight:700;">MONGOLIA MILKY WAY</div><h2 style="color:#0A1F2E;font-size:28px;line-height:1.3;margin:10px 0 16px;">${escapeDocumentText(title)}</h2>${sub ? `<p style="color:#5C6B75;font-size:12px;line-height:1.7;margin-bottom:16px;">${escapeDocumentText(sub)}</p>` : ''}`;
const page = (title, body, mobile) => mobile
    ? `<div class="card"><div class="pad">${heading(title)}${body}</div></div>`
    : `<div class="page" data-product-page style="padding:48px 52px;">${heading(title)}<div data-product-content>${body}</div><div class="pfoot"><span>몽골리아 은하수 현지 여행사 확정 일정표 · ${escapeDocumentText(title)}</span><span></span></div></div>`;
const box = body => `<div data-product-block style="padding:18px;margin:0 0 14px;border:1px solid #E3E6E2;border-radius:14px;background:#F7FAF9;break-inside:avoid;">${body}</div>`;
const paragraph = s => `<p style="color:#23323D;font-size:12px;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeDocumentText(s)}</p>`;
const photoGrid = (urls, title, mobile) => `<div style="display:grid;grid-template-columns:repeat(${mobile ? 1 : Math.min(2, urls.length)},1fr);gap:10px;margin-top:12px;">${urls.map(src => `<img src="${escapeDocumentText(src)}" alt="${escapeDocumentText(title)}" style="width:100%;height:${mobile ? 210 : 190}px;object-fit:contain;border-radius:10px;background:white;">`).join('')}</div>`;
const chunks = (s, size) => {
    const result = [];
    for (let i = 0; i < String(s || '').length; i += size) result.push(String(s).slice(i, i + size));
    return result;
};

export function productDocumentSections(q, mobile = false) {
    const list = (title, items) => `<h3 style="font-size:17px;color:#1C8571;margin-bottom:12px;">${title}</h3>` + (items.length ? items.flatMap(s => chunks(s, 500).map(part => box(paragraph(`• ${part}`)))).join('') : box(paragraph('담당자에게 확인해 주세요.')));
    const inclusions = page('투어 포함사항과 불포함 사항', list('포함 사항', q.included || []) + list('불포함 사항', q.excluded || []), mobile);
    let details = '';
    for (const day of q.detailDays || []) {
        const activities = [
            ...(day.summary || photos(day.images).length ? [{ title: day.title, description: day.summary, images: day.images }] : []),
            ...(day.activities || []),
        ];
        const blocks = activities.flatMap(a => {
            const title = [a.time, a.title].filter(Boolean).join(' ') || '일정 사진';
            const textParts = chunks(a.description, 500);
            const urls = photos(a.images);
            const count = Math.max(1, textParts.length, Math.ceil(urls.length / 2));
            return Array.from({ length: count }, (_, i) => box(`<h3 style="color:#0A1F2E;font-size:16px;line-height:1.5;margin-bottom:8px;">${escapeDocumentText(title)}${i ? ' · 계속' : ''}</h3>${textParts[i] ? paragraph(textParts[i]) : ''}${urls.slice(i * 2, i * 2 + 2).length ? photoGrid(urls.slice(i * 2, i * 2 + 2), title, mobile) : ''}`));
        });
        if (day.accommodation?.description || photos(day.accommodation?.images).length) {
            const stay = day.accommodation;
            const urls = photos(stay.images);
            const descriptions = chunks(stay.description, 500);
            for (let i = 0; i < Math.max(1, descriptions.length, Math.ceil(urls.length / 2)); i++) {
                blocks.push(box(`<h3 style="color:#1C8571;font-size:16px;margin-bottom:8px;">숙소 · ${escapeDocumentText(stay.name)}${i ? ' · 계속' : ''}</h3>${paragraph(descriptions[i] || '')}${photoGrid(urls.slice(i * 2, i * 2 + 2), stay.name, mobile)}`));
            }
        }
        if (blocks.length) details += page(`${day.day}일차 · ${day.title || '상세 일정'}`, blocks.join(''), mobile);
    }
    return { inclusions, details };
}

/** 폰트·사진 로딩 뒤 실제 높이를 재서 A4 페이지를 나눈다. */
export function paginateProductPages(root) {
    for (const pageEl of [...root.querySelectorAll('[data-product-page]')]) {
        let current = pageEl;
        let content = current.querySelector('[data-product-content]');
        let blocks = [...content.children];
        let used = 0;
        const maximum = current.querySelector('.pfoot').offsetTop - content.offsetTop - 20;
        for (const block of blocks) {
            const height = block.offsetHeight + 14;
            if (used && used + height > maximum) {
                const next = pageEl.cloneNode(true);
                next.querySelector('[data-product-content]').replaceChildren();
                current.after(next);
                current = next;
                content = next.querySelector('[data-product-content]');
                used = 0;
            }
            content.append(block);
            used += height;
        }
    }
}

export function productDocumentToolbar(params, mobile) {
    const preview = params.get('preview') === '1';
    const toolbar = document.createElement('nav');
    toolbar.className = 'customer-bar web-only';
    const back = preview ? `/admin/reservations?open=${encodeURIComponent(params.get('reservationId'))}` : `/mypage/reservations/${encodeURIComponent(params.get('reservationId'))}`;
    toolbar.innerHTML = `<a href="${back}">← ${preview ? '예약 관리' : '내 예약'}</a><span class="cb-title">${preview ? '관리자 미리보기' : '확정 일정표'}</span><button type="button" style="border:0;border-radius:24px;background:#27AB8F;color:#0A1F2E;padding:10px 16px;font:700 13px Pretendard,sans-serif;cursor:pointer;">PDF 저장</button>`;
    const print = () => {
        if (mobile) {
            const p = new URLSearchParams(params); p.set('m', '0'); p.set('print', '1');
            window.location.assign(`/확정일정표?${p}`);
        } else if (window.printSchedule) window.printSchedule();
    };
    toolbar.querySelector('button').addEventListener('click', print);
    document.body.prepend(toolbar);
    if (mobile) {
        const save = document.getElementById('tbSave');
        if (save) save.onclick = print;
        const fab = document.getElementById('fab');
        if (fab) { fab.onclick = print; fab.style.display = ''; }
    }
    return print;
}
