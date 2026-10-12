/**
 * 여정 지도(public/designs/mongolia-map.html)가 좌표를 알고 있는 여행지 목록.
 * ko는 지도 가제티어(GAZETTEER) 키와 일치해야 한다 — 이름만으로 지도에 자동 표시된다.
 * ja는 지도 말풍선·여행지 카드에 표시되는 라벨 기본값 (한국어 버전이므로 값은 한국어 공식 표기.
 * 필드명은 관리자 화면 등 기존 참조와의 호환을 위해 ja 그대로 둔다).
 * jaLegacy는 예전 일본어 버전의 공식 표기 — 기존 상품 데이터에 저장된 일본어 지명을 인식하는 데만 쓴다.
 * 지도에 새 지역을 추가하면 mongolia-map.html의 GAZETTEER(좌표)와 LABEL_KO(옛 일본어 라벨 → 한국어)에도 등록할 것.
 */
export interface MapDestination {
    ko: string;
    /** 운영 페이지에 표시되는 공식 표기 (한국어) */
    ja: string;
    /** 옛 일본어 공식 표기 — 저장된 일본어 지명을 알아보기 위한 값 (화면에는 표시하지 않음) */
    jaLegacy: string;
    /** 영어 표기 — 관리자가 영어로 고를 때 쓰는 라벨 */
    en: string;
    group: string;
}

export const MAP_DESTINATIONS: MapDestination[] = [
    // ── 울란바토르 근교 ──
    { ko: '울란바토르', ja: '울란바토르', jaLegacy: 'ウランバートル', en: 'Ulaanbaatar', group: '울란바토르 근교' },
    { ko: '칭기스칸공항', ja: '칭기스칸 국제공항', jaLegacy: 'チンギスハーン国際空港', en: 'Chinggis Khaan Airport', group: '울란바토르 근교' },
    { ko: '촌진볼독', ja: '칭기스칸 기마상', jaLegacy: 'チンギスハーン騎馬像', en: 'Chinggis Khaan Statue (Tsonjin Boldog)', group: '울란바토르 근교' },
    { ko: '테를지 국립공원', ja: '테를지 국립공원', jaLegacy: 'テレルジ国立公園', en: 'Terelj National Park', group: '울란바토르 근교' },
    { ko: '거북바위', ja: '거북바위', jaLegacy: '亀岩', en: 'Turtle Rock', group: '울란바토르 근교' },
    { ko: '아리야발사원', ja: '아리야발 사원', jaLegacy: 'アリヤバル寺院', en: 'Aryabal Monastery', group: '울란바토르 근교' },
    { ko: '만주시리', ja: '만주시르 사원', jaLegacy: 'マンズシル寺院', en: 'Manzushir Monastery', group: '울란바토르 근교' },
    { ko: '후스타이', ja: '후스타이 국립공원', jaLegacy: 'フスタイ国立公園', en: 'Hustai National Park', group: '울란바토르 근교' },
    { ko: '자이산', ja: '자이산 전망대', jaLegacy: 'ザイサンの丘', en: 'Zaisan Hill', group: '울란바토르 근교' },
    { ko: '간단사원', ja: '간단 사원', jaLegacy: 'ガンダン寺', en: 'Gandan Monastery', group: '울란바토르 근교' },
    { ko: '수흐바타르광장', ja: '수흐바타르 광장', jaLegacy: 'スフバートル広場', en: 'Sukhbaatar Square', group: '울란바토르 근교' },
    { ko: '복드칸궁전', ja: '복드칸 궁전 박물관', jaLegacy: 'ボグドハーン宮殿博物館', en: 'Bogd Khan Palace Museum', group: '울란바토르 근교' },
    { ko: '국립백화점', ja: '국영백화점', jaLegacy: '国営百貨店', en: 'State Department Store', group: '울란바토르 근교' },
    // ── 중앙몽골 ──
    { ko: '엘승타사르해', ja: '엘승타사르해', jaLegacy: 'エルセンタサルハイ', en: 'Elsen Tasarkhai (Mini Gobi)', group: '중앙몽골' },
    { ko: '카라코룸', ja: '카라코룸', jaLegacy: 'カラコルム', en: 'Kharkhorin (Karakorum)', group: '중앙몽골' },
    { ko: '에르덴조', ja: '에르덴조 사원', jaLegacy: 'エルデネゾー寺院', en: 'Erdene Zuu Monastery', group: '중앙몽골' },
    { ko: '어기호수', ja: '어기 호수', jaLegacy: 'オギー湖', en: 'Ugii Lake', group: '중앙몽골' },
    { ko: '체체를렉', ja: '체체를렉', jaLegacy: 'ツェツェルレグ', en: 'Tsetserleg', group: '중앙몽골' },
    { ko: '쳉헤르 온천', ja: '쳉헤르 온천', jaLegacy: 'ツェンヘル温泉', en: 'Tsenkher Hot Springs', group: '중앙몽골' },
    { ko: '타이하르촐로', ja: '타이하르 촐로', jaLegacy: 'タイハルチョロー', en: 'Taikhar Chuluu', group: '중앙몽골' },
    { ko: '테르힝차강', ja: '테르힝 차강 호수', jaLegacy: 'テルヒーンツァガーン湖', en: 'Terkhiin Tsagaan Lake', group: '중앙몽골' },
    { ko: '호르고', ja: '호르고 화산', jaLegacy: 'ホルゴ火山', en: 'Khorgo Volcano', group: '중앙몽골' },
    { ko: '어르헝폭포', ja: '어르헝 폭포', jaLegacy: 'オルホン滝', en: 'Orkhon Waterfall', group: '중앙몽골' },
    { ko: '톱흥사원', ja: '톱흥 사원', jaLegacy: 'トゥブフン寺院', en: 'Tuvkhun Monastery', group: '중앙몽골' },
    // ── 북부 ──
    { ko: '홉스굴', ja: '홉스굴 호수', jaLegacy: 'フブスグル湖', en: 'Khuvsgul Lake', group: '북부' },
    { ko: '하트갈', ja: '하트갈', jaLegacy: 'ハトガル', en: 'Khatgal', group: '북부' },
    { ko: '무릉', ja: '무릉', jaLegacy: 'ムルン', en: 'Murun', group: '북부' },
    { ko: '아마르바야스갈란트', ja: '아마르바야스갈란트 사원', jaLegacy: 'アマルバヤスガラント寺院', en: 'Amarbayasgalant Monastery', group: '북부' },
    { ko: '다르항', ja: '다르항', jaLegacy: 'ダルハン', en: 'Darkhan', group: '북부' },
    { ko: '에르데넷', ja: '에르데넷', jaLegacy: 'エルデネト', en: 'Erdenet', group: '북부' },
    // ── 고비 ──
    { ko: '바가가즈링촐로', ja: '바가가즈링 촐로', jaLegacy: 'バガガズリンチョロー', en: 'Baga Gazriin Chuluu', group: '고비' },
    { ko: '만들고비', ja: '만달고비', jaLegacy: 'マンダルゴビ', en: 'Mandalgovi', group: '고비' },
    { ko: '옹기사원', ja: '옹기 사원', jaLegacy: 'オンギ寺院', en: 'Ongi Monastery', group: '고비' },
    { ko: '차강소브라가', ja: '차강소브라가', jaLegacy: 'ツァガーンスワルガ', en: 'Tsagaan Suvarga', group: '고비' },
    { ko: '달란자드가드', ja: '달란자드가드', jaLegacy: 'ダランザドガド', en: 'Dalanzadgad', group: '고비' },
    { ko: '욜링암', ja: '욜링암', jaLegacy: 'ヨリンアム', en: 'Yolyn Am', group: '고비' },
    { ko: '바양작', ja: '바양작', jaLegacy: 'バヤンザグ', en: 'Bayanzag (Flaming Cliffs)', group: '고비' },
    { ko: '홍고린엘스', ja: '홍고린엘스', jaLegacy: 'ホンゴリンエルス', en: 'Khongoryn Els', group: '고비' },
    { ko: '고비사막', ja: '고비사막', jaLegacy: 'ゴビ砂漠', en: 'Gobi Desert', group: '고비' },
    { ko: '사인샨드', ja: '사인샨드', jaLegacy: 'サインシャンド', en: 'Sainshand', group: '고비' },
    { ko: '하마린사원', ja: '하마린 사원', jaLegacy: 'ハマリン寺院', en: 'Khamaryn Monastery', group: '고비' },
    // ── 서부 ──
    { ko: '홉드', ja: '홉드', jaLegacy: 'ホブド', en: 'Khovd', group: '서부' },
    { ko: '울기', ja: '울기', jaLegacy: 'ウルギー', en: 'Ulgii', group: '서부' },
    { ko: '타왕복드', ja: '타왕복드', jaLegacy: 'タワンボグド', en: 'Tavan Bogd', group: '서부' },
];

/**
 * 영어/한국어/일본어 어느 표기로 들어와도 운영 페이지용 공식 표기(한국어)로 바꿔 준다.
 * 예전에 일본어로 저장된 지명(jaLegacy)도 한국어 표기로 바뀐다.
 * 목록에 없는 이름은 그대로 돌려준다 (직접 입력한 이름 등).
 */
export function toJaDestinationName(name: string): string {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (!key) return name;
    const hit = MAP_DESTINATIONS.find(d =>
        d.en.toLowerCase() === key
        || d.ko === trimmed
        || d.ja === trimmed
        || d.jaLegacy === trimmed
        // 괄호 보조 표기 없이 입력해도 매칭 (예: "Bayanzag" ↔ "Bayanzag (Flaming Cliffs)")
        || d.en.toLowerCase().replace(/\s*\(.*\)$/, '') === key,
    );
    return hit ? hit.ja : name;
}
