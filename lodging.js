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
  // Display-only compatibility for explicitly labelled legacy prose. Never persisted.
  function displayDetails(record = {}) {
    const l = { ...record }, text = String(record.desc || '');
    const marker = /(?:전화번호|전화|주소|객실 비치용품|객실 비품|객실비품|공용시설|운영 참고|운영참고|숙소 정보[·ㆍ]사진 출처|공식 출처|공식출처|출처)(?:\([^\n)]*\))?\s*[:：]\s*|\d{4}-\d{2}-\d{2} 공식 안내 기준/g;
    const matches = [...text.matchAll(marker)];
    const introduction = [], sourceNotes = [];
    if (!matches.length) return { ...l, sourceNotes: '' };
    introduction.push(text.slice(0, matches[0].index).trim());
    for (let i=0; i<matches.length; i++) {
      const m=matches[i], label=m[0];
      let value=text.slice(m.index+label.length, matches[i+1]?.index ?? text.length).trim();
      let key='';
      if (/^전화/.test(label)) {
        const number=value.match(/^\+?\d[\d ().-]*\d/);
        if (!number || !/^\+?\d{6,15}$/.test(number[0].replace(/[ ().-]/g,''))) { introduction.push(label+value); continue; }
        introduction.push(value.slice(number[0].length).trim()); value=number[0]; key='phone';
      } else if (/^주소/.test(label)) key='address';
      else if (/^객실/.test(label)) {
        key='roomAmenities';
        const qualifier=label.match(/\([^)]*\)/);
        if (qualifier) value=qualifier[0]+' '+value;
      } else if (/^공용시설/.test(label)) key='sharedFacilities';
      else if (/^(?:운영|\d{4}-)/.test(label)) {
        key='operatingNotes'; if (/^\d/.test(label)) value=label+' '+value;
      } else {
        const urls=value.match(/https?:\/\/[^\s<>"']+/g) || [];
        const safe=urls.filter(webUrl);
        if (!safe.length) { introduction.push(label+value); continue; }
        l.officialSources=[l.officialSources, ...safe].filter(Boolean).join('\n');
        for (const url of safe) value=value.replace(url,'');
        if (value.trim()) sourceNotes.push(value.trim());
        continue;
      }
      if (!l[key]) l[key]=value;
      else if (String(l[key]).trim()!==value) introduction.push(label+value);
    }
    l.desc=introduction.filter(Boolean).join('\n');
    return { ...l, sourceNotes:sourceNotes.join(' · ') };
  }
  function render(record = {}) {
    const l = displayDetails(record);
    const row = (label, value, inner) => value ? `<div style="display:grid;grid-template-columns:82px minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid #eef4f1"><strong style="color:#0a6a5e">${label}</strong><div style="white-space:pre-wrap;overflow-wrap:anywhere">${inner || esc(value)}</div></div>` : '';
    const phone = typeof l.phone === 'string' ? l.phone : '';
    const tel = /^[+\d\s().-]+$/.test(phone) ? phone.replace(/[\s().-]/g, '') : '';
    const phoneLink = /^\+?\d{6,15}$/.test(tel) ? `<a href="tel:${esc(tel)}">${esc(phone)}</a>` : '';
    const address = typeof l.address === 'string' ? l.address : '';
    const map = address ? `${esc(address)} <a href="https://www.google.com/maps/search/?api=1&amp;query=${esc(encodeURIComponent(address))}" target="_blank" rel="noopener noreferrer">지도 보기</a>` : '';
    const sources = String(l.officialSources || '').split(/\r?\n/);
    const grade = typeof l.grade === 'string' ? l.grade.trim() : '';
    // Display only the registered type/grade; preserve introduction and operating notes in storage.
    const links = [...new Set(sources.map(webUrl).filter(Boolean))];
    return `<div class="lodging-details" style="font-size:12px;line-height:1.65;color:#40544f;margin-top:10px">` +
      row('유형·등급', grade) + row('주소', address, map) + row('전화번호', phone, phoneLink) +
      row('객실 비치용품', l.roomAmenities) + row('공용시설', l.sharedFacilities) +
      (links.length ? `<div style="font-size:11px;margin-top:10px;line-height:1.8">공식 출처${l.sourceNotes ? ` · ${esc(l.sourceNotes)}` : ''} · ${links.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(new URL(u).hostname)}${links.length > 1 ? ` (${i + 1})` : ''}</a>`).join(' · ')}</div>` : '') + '</div>';
  }
  root.Lodging = { fields, publicData, snapshot, photos, displayDetails, render, webUrl, imageUrl };
})(globalThis);
