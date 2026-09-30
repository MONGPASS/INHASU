/* Shared lodging presentation. No inferred amenities or writes to legacy prose. */
(function (root) {
  const fields = ['address', 'phone', 'roomAmenities', 'sharedFacilities', 'operatingNotes', 'officialSources'];
  const publicFields = ['day', 'name', 'region', 'grade', 'img', 'imgs', 'tags', 'desc', 'representativePhotos', ...fields];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function webUrl(value) {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) return '';
    try { const u = new URL(value.trim()); return !u.username && !u.password ? u.href : ''; } catch { return ''; }
  }
  function imageUrl(value) {
    if (typeof value !== 'string') return '';
    if (/^\/(?!\/)[^\s\\]*$/.test(value)) return value;
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
    if (/^(?:\.\.?\/)?[A-Za-z0-9_-][^:\\\s]*$/.test(value)) return value;
    return webUrl(value);
  }
  function photos(l = {}) {
    const all = Array.isArray(l.representativePhotos) ? l.representativePhotos : [l.img, ...(Array.isArray(l.imgs) ? l.imgs : [])];
    return [...new Set(all.map(imageUrl).filter(Boolean))].slice(0, 3);
  }
  function publicData(l = {}) {
    return Object.fromEntries(publicFields.filter(k => Object.hasOwn(l, k)).map(k => [k, l[k]]));
  }
  function snapshot(library, previous = {}) {
    if (!library) return publicData(previous);
    return { ...publicData(previous), ...publicData(library),
      representativePhotos: photos(library),
      imgs: [...new Set([library.img, ...(library.imgs || []), previous.img, ...(previous.imgs || []), ...(previous.representativePhotos || [])].filter(Boolean))] };
  }
  function render(l = {}) {
    const row = (label, value, inner) => value ? `<div style="display:grid;grid-template-columns:82px minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid #eef4f1"><strong style="color:#0a6a5e">${label}</strong><div style="white-space:pre-wrap;overflow-wrap:anywhere">${inner || esc(value)}</div></div>` : '';
    const phone = typeof l.phone === 'string' ? l.phone : '';
    const tel = /^[+\d\s().-]+$/.test(phone) ? phone.replace(/[\s().-]/g, '') : '';
    const phoneLink = /^\+?\d{6,15}$/.test(tel) ? `<a href="tel:${esc(tel)}">${esc(phone)}</a>` : '';
    const address = typeof l.address === 'string' ? l.address : '';
    const map = address ? `${esc(address)} <a href="https://www.google.com/maps/search/?api=1&amp;query=${esc(encodeURIComponent(address))}" target="_blank" rel="noopener noreferrer">지도 보기</a>` : '';
    // Only explicit standalone source labels are moved for display; original prose remains editable.
    const sources = String(l.officialSources || '').split(/\r?\n/);
    const desc = String(l.desc || '').split(/\r?\n/).filter(line => {
      const m = line.match(/^\s*(?:공식출처|공식 출처|출처)\s*[:：]\s*(https?:\/\/\S+)\s*$/);
      if (!m || !webUrl(m[1])) return true;
      sources.push(m[1]); return false;
    }).join('\n');
    const links = [...new Set(sources.map(webUrl).filter(Boolean))];
    return `<div class="lodging-details" style="font-size:12px;line-height:1.65;color:#40544f;margin-top:10px">` +
      row('숙소 소개', desc) + row('주소', address, map) + row('전화번호', phone, phoneLink) +
      row('객실 비치용품', l.roomAmenities) + row('공용시설', l.sharedFacilities) + row('운영 참고', l.operatingNotes) +
      (links.length ? `<div style="font-size:11px;margin-top:10px;line-height:1.8">공식 출처 · ${links.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(new URL(u).hostname)}${links.length > 1 ? ` (${i + 1})` : ''}</a>`).join(' · ')}</div>` : '') + '</div>';
  }
  root.Lodging = { fields, publicData, snapshot, photos, render, webUrl, imageUrl };
})(globalThis);
