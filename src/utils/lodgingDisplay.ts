/**
 * 숙소 표시 규칙 — `public/lodging.js`(window.Lodging, 견적 도구·고객 확정 안내가 함께 쓰는 정본)의 일부를 React 관리자용으로 옮긴 것.
 * 등록 정보(가이드·숙소·차량) 화면이 카드 사진·상세 요약·공식 출처 확인에 쓴다.
 * 규칙을 바꿀 때는 public/lodging.js와 함께 바꾼다 — tests/resource-registry.test.mjs가 두 파일의 결과를 비교한다.
 */
export const LODGING_FIELDS = ['address', 'phone', 'roomAmenities', 'sharedFacilities', 'operatingNotes', 'officialSources'] as const;
export type LodgingField = typeof LODGING_FIELDS[number];
export type LodgingRecord = Record<string, unknown>;

/** http/https 주소만(아이디·비밀번호가 든 주소 제외). 아니면 빈 문자열. */
export function webUrl(value: unknown): string {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) return '';
    try { const u = new URL(value.trim()); return !u.username && !u.password ? u.href : ''; } catch { return ''; }
}

/** 사진으로 보여도 되는 주소(같은 사이트 경로·작은 data 이미지·http/https). 아니면 빈 문자열. */
export function imageUrl(value: unknown): string {
    if (typeof value !== 'string') return '';
    if (/^\/(?!\/)[^\s\\]*$/.test(value)) return value;
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
    if (/^(?:\.\.?\/)?[A-Za-z0-9_-][^:\\\s]*$/.test(value)) return value;
    return webUrl(value);
}

/** 숙소 대표 사진(최대 3장): 고른 대표 사진 목록이 있으면 그것, 없으면 img + imgs */
export function lodgingPhotos(l: LodgingRecord = {}): string[] {
    const all = Array.isArray(l.representativePhotos) ? l.representativePhotos : [l.img, ...(Array.isArray(l.imgs) ? l.imgs : [])];
    return [...new Set(all.map(imageUrl).filter(Boolean))].slice(0, 3);
}

/** 예전 소개 글에 ‘전화: …’·‘주소: …’처럼 적힌 내용을 표시용 칸으로 나눠 읽는다(저장하지 않음). */
export function displayDetails(record: LodgingRecord = {}): LodgingRecord & { sourceNotes: string } {
    const l: LodgingRecord = { ...record }, text = String(record.desc || '');
    const marker = /(?:전화번호|전화|주소|객실 비치용품|객실 비품|객실비품|공용시설|운영 참고|운영참고|숙소 정보[·ㆍ]사진 출처|공식 출처|공식출처|출처)(?:\([^\n)]*\))?\s*[:：]\s*|\d{4}-\d{2}-\d{2} 공식 안내 기준/g;
    const matches = [...text.matchAll(marker)];
    const introduction: string[] = [], sourceNotes: string[] = [];
    if (!matches.length) return { ...l, sourceNotes: '' };
    introduction.push(text.slice(0, matches[0].index).trim());
    for (let i = 0; i < matches.length; i++) {
        const m = matches[i], label = m[0];
        let value = text.slice((m.index ?? 0) + label.length, matches[i + 1]?.index ?? text.length).trim();
        let key = '';
        if (/^전화/.test(label)) {
            const number = value.match(/^\+?\d[\d ().-]*\d/);
            if (!number || !/^\+?\d{6,15}$/.test(number[0].replace(/[ ().-]/g, ''))) { introduction.push(label + value); continue; }
            introduction.push(value.slice(number[0].length).trim()); value = number[0]; key = 'phone';
        } else if (/^주소/.test(label)) key = 'address';
        else if (/^객실/.test(label)) {
            key = 'roomAmenities';
            const qualifier = label.match(/\([^)]*\)/);
            if (qualifier) value = qualifier[0] + ' ' + value;
        } else if (/^공용시설/.test(label)) key = 'sharedFacilities';
        else if (/^(?:운영|\d{4}-)/.test(label)) {
            key = 'operatingNotes'; if (/^\d/.test(label)) value = label + ' ' + value;
        } else {
            const urls = value.match(/https?:\/\/[^\s<>"']+/g) || [];
            const safe = urls.filter(webUrl);
            if (!safe.length) { introduction.push(label + value); continue; }
            l.officialSources = [l.officialSources, ...safe].filter(Boolean).join('\n');
            for (const url of safe) value = value.replace(url, '');
            if (value.trim()) sourceNotes.push(value.trim());
            continue;
        }
        if (!l[key]) l[key] = value;
        else if (String(l[key]).trim() !== value) introduction.push(label + value);
    }
    l.desc = introduction.filter(Boolean).join('\n');
    return { ...l, sourceNotes: sourceNotes.join(' · ') };
}

/** 카드·목록에 보이는 숙소 상세 한 줄(주소·전화·객실 비품·공용시설) */
export function lodgingSummary(record: LodgingRecord = {}): string {
    const details = displayDetails(record);
    return ([['address', '주소'], ['phone', '전화'], ['roomAmenities', '객실 비품'], ['sharedFacilities', '공용시설']] as const)
        .filter(([key]) => typeof details[key] === 'string' && (details[key] as string).trim())
        .map(([key, label]) => `${label}: ${(details[key] as string).trim()}`).join(' · ')
        || (typeof record.grade === 'string' && record.grade.trim() ? `유형·등급: ${record.grade.trim()}` : '등록된 상세 정보가 없습니다');
}
