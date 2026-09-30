// Customer-visible lodging fields only. Never forward arbitrary library/internal keys.
export function publicLodge(l = {}) {
  const out = {};
  for (const key of ['name', 'region', 'grade', 'img', 'tags', 'desc', 'address', 'phone', 'roomAmenities', 'sharedFacilities', 'operatingNotes', 'officialSources']) {
    if (typeof l[key] === 'string') out[key] = l[key];
  }
  if (typeof l.day === 'number') out.day = l.day;
  for (const key of ['imgs', 'representativePhotos']) {
    if (Array.isArray(l[key])) out[key] = l[key].filter(v => typeof v === 'string');
  }
  return out;
}
