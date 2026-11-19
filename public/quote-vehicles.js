import { escapeDocumentText as esc, documentUrl } from './document-safe.js';

export async function loadQuoteVehicles(signal) {
  try {
    const response = await fetch('/api/data/vehicles?view=quote', { credentials: 'omit', cache: 'no-store', signal: signal ?? globalThis.AbortSignal?.timeout?.(8000) });
    if (!response.ok) return [];
    const result = await response.json();
    return result.ok && Array.isArray(result.vehicles) ? result.vehicles : [];
  } catch {
    return [];
  }
}

const modelKey = name => String(name || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

export function quoteVehicleCards(vehicles, quoteModel) {
  const selected = modelKey(quoteModel);
  return vehicles.map(v => {
    const seats = /^\d+$/.test(v.seats) ? v.seats + '인승' : v.seats;
    const photos = v.photos.map(src => documentUrl(src, true)).filter(Boolean);
    return `<article class="qv-card">
      ${photos.length ? `<div class="qv-photos">${photos.map((src, i) => {
        // 같은 등록 사진을 견적서와 /estimate/:id 양쪽에서 사이트 루트 기준으로 연다.
        const href = new URL(src, new URL('/', location.href)).href;
        return `<img src="${esc(href)}" alt="${esc(v.name)} ${i === 0 ? '대표 사진' : '추가 사진 ' + i}">`;
      }).join('')}</div>` : ''}
      <div class="qv-details"><h3>${esc(v.name)}</h3>
        ${selected && selected === modelKey(v.name) ? '<span class="qv-selected">견적 기재 차량</span>' : ''}
        ${seats || v.luggage ? `<dl>${seats ? `<div><dt>탑승 인원</dt><dd>${esc(seats)}</dd></div>` : ''}${v.luggage ? `<div><dt>수하물</dt><dd>${esc(v.luggage)}</dd></div>` : ''}</dl>` : ''}
        ${v.description ? `<p>${esc(v.description)}</p>` : ''}
      </div>
    </article>`;
  }).join('');
}
