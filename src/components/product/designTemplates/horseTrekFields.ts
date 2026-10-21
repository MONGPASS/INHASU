import type { DesignSectionDef, DesignTemplateField } from './types';

/**
 * 「몽골 승마 트레킹 상세페이지」 디자인의 편집 가능 필드 목록.
 * default는 원본 디자인(몽골 승마 트레킹 상세페이지.dc.html)의 문구를 그대로 옮긴 것.
 * 줄바꿈이 있는 textarea 값은 \n 그대로 화면에 줄바꿈으로 표시된다.
 */
export const horseTrekFields: DesignTemplateField[] = [
    // ── 01 오프닝 ──────────────────────────────────────────────
    { key: 'op_line1', label: '상단 문구', type: 'text', section: '01 오프닝', default: '여행은 끝,' },
    { key: 'op_line2', label: '메인 문구', type: 'text', section: '01 오프닝', default: '모험의 시작' },
    { key: 'op_bg1', label: '배경 사진 1 (순환)', type: 'image', section: '01 오프닝' },
    { key: 'op_bg2', label: '배경 사진 2 (순환)', type: 'image', section: '01 오프닝' },
    { key: 'op_bg3', label: '배경 사진 3 (순환)', type: 'image', section: '01 오프닝' },

    // ── 02 별하늘 히어로 ──────────────────────────────────────
    { key: 'hero_kicker', label: '작은 제목', type: 'text', section: '02 별하늘 히어로', default: '세계 3대 별 관측지 · 몽골' },
    { key: 'hero_title', label: '큰 제목', type: 'text', section: '02 별하늘 히어로', default: '매일 밤, 쏟아지는 별' },
    { key: 'hero_body', label: '본문', type: 'textarea', section: '02 별하늘 히어로', default: '도시의 불빛이 닿지 않는 몽골의 밤.\n손을 뻗으면 닿을 듯 쏟아지는 수많은 별.\n지금, 별과 가장 가까운 밤을 보내 보세요.' },
    { key: 'hero_bg', label: '배경 사진 (은하수 아래 게르)', type: 'image', section: '02 별하늘 히어로' },
    { key: 'hero_img1', label: '하단 사진 1 (밤 캠프)', type: 'image', section: '02 별하늘 히어로' },
    { key: 'hero_img2', label: '하단 사진 2 (별 관측)', type: 'image', section: '02 별하늘 히어로' },

    // ── 03 소개 배너 ──────────────────────────────────────────
    { key: 'intro_title', label: '제목', type: 'text', section: '03 소개 배너', default: '진짜 몽골을 만나다.' },
    { key: 'intro_body', label: '본문', type: 'textarea', section: '03 소개 배너', default: '뻔한 여행은 싫지만,\n새로운 경험은 조금 걱정되시나요?\n몽골리아 은하수와 함께\n모험의 세계로 안심하고 한 걸음 내디뎌 보세요.' },
    { key: 'intro_bg', label: '배경 사진 (산맥 아래 초원)', type: 'image', section: '03 소개 배너' },

    // ── 04 이용자 특전 ────────────────────────────────────────
    { key: 'perks_title', label: '제목', type: 'text', section: '04 이용자 특전', default: '2026년 여름 투어 이용 고객 한정 특전' },
    { key: 'perks_sub', label: '부제', type: 'text', section: '04 이용자 특전', default: '― 4월~10월 출발 투어 대상 ―' },
    { key: 'perk1_img', label: '특전 1 사진', type: 'image', section: '04 이용자 특전' },
    { key: 'perk1_title', label: '특전 1 제목', type: 'text', section: '04 이용자 특전', default: '공항 픽업·샌딩 서비스' },
    { key: 'perk1_sub', label: '특전 1 설명', type: 'text', section: '04 이용자 특전', default: '왕복 1회 무료' },
    { key: 'perk2_img', label: '특전 2 사진', type: 'image', section: '04 이용자 특전' },
    { key: 'perk2_title', label: '특전 2 제목', type: 'text', section: '04 이용자 특전', default: '커피 모카포트' },
    { key: 'perk2_sub', label: '특전 2 설명', type: 'text', section: '04 이용자 특전', default: '6명 이하 그룹 한정' },
    { key: 'perk3_img', label: '특전 3 사진', type: 'image', section: '04 이용자 특전' },
    { key: 'perk3_title', label: '특전 3 제목', type: 'text', section: '04 이용자 특전', default: '캠핑 의자 & 테이블' },
    { key: 'perk3_sub', label: '특전 3 설명', type: 'text', section: '04 이용자 특전', default: '6명 이하 그룹 한정' },
    { key: 'perk4_img', label: '특전 4 사진', type: 'image', section: '04 이용자 특전' },
    { key: 'perk4_title', label: '특전 4 제목', type: 'text', section: '04 이용자 특전', default: '몽골 낙타털 양말' },
    { key: 'perk4_sub', label: '특전 4 설명', type: 'text', section: '04 이용자 특전', default: '6명 이하 그룹 한정' },
    { key: 'perk5_img', label: '특전 5 사진', type: 'image', section: '04 이용자 특전' },
    { key: 'perk5_title', label: '특전 5 제목', type: 'text', section: '04 이용자 특전', default: '매일 생수 제공' },
    { key: 'perk5_sub', label: '특전 5 설명', type: 'text', section: '04 이용자 특전', default: '※ 총 1L' },
    { key: 'perk6_img', label: '특전 6 사진', type: 'image', section: '04 이용자 특전' },
    { key: 'perk6_title', label: '특전 6 제목', type: 'text', section: '04 이용자 특전', default: '새벽 은하수 헌팅' },
    { key: 'perk6_sub', label: '특전 6 설명', type: 'text', section: '04 이용자 특전', default: '6명 이하 그룹 한정' },
    { key: 'perk_air_img', label: '공항 배너 사진', type: 'image', section: '04 이용자 특전' },
    { key: 'perk_air_title', label: '공항 배너 제목', type: 'text', section: '04 이용자 특전', default: '투어 진행 날에 속하는 공항 이동 무료' },
    { key: 'perk_air_note', label: '공항 배너 설명', type: 'textarea', section: '04 이용자 특전', default: '* 본 투어 일정 외 이용 시 *\n공항 - 시내 편도 80,000원/6명' },

    // ── 05 여행 고민 (말풍선) ─────────────────────────────────
    { key: 'worry_kicker', label: '작은 제목', type: 'text', section: '05 여행 고민', default: '몽골 여행 계획…' },
    { key: 'worry_title', label: '제목', type: 'text', section: '05 여행 고민', default: '이런 경험, 한 번쯤 있지 않으신가요?' },
    { key: 'worry1', label: '말풍선 1', type: 'textarea', section: '05 여행 고민', default: '도대체 답장은 언제 오는 거야? 답변이 너무 늦어… 😧' },
    { key: 'worry2', label: '말풍선 2', type: 'textarea', section: '05 여행 고민', default: '싼 줄 알았는데, 현지에서 결국 이것저것 추가 요금이 붙네…' },
    { key: 'worry3', label: '말풍선 3', type: 'textarea', section: '05 여행 고민', default: '한국어가 전혀 통하지 않아서 불안하고 불편했어요… 😵' },
    { key: 'worry4', label: '말풍선 4', type: 'textarea', section: '05 여행 고민', default: '따뜻한 물이 안 나온다는 게 진짜야?🥶 난 찬물로 샤워는 못 해~😭' },
    { key: 'worry5', label: '말풍선 5', type: 'textarea', section: '05 여행 고민', default: '헉… 게르 화장실이 재래식이라고!?😨' },

    // ── 06 숙소 ───────────────────────────────────────────────
    { key: 'ger_kicker', label: '작은 제목', type: 'text', section: '06 숙소', default: '몽골리아 은하수는 다릅니다.' },
    { key: 'ger_sub', label: '부제', type: 'text', section: '06 숙소', default: '현지 답사를 거듭하며 저희가 직접 확인하고 골랐습니다.' },
    { key: 'ger_title1', label: '제목 첫 줄', type: 'text', section: '06 숙소', default: '여행자 캠프에서도 추가 요금 없이' },
    { key: 'ger_title2', label: '제목 강조 줄', type: 'text', section: '06 숙소', default: '고급 게르에서 숙박' },
    { key: 'ger_img1', label: '사진 1 (게르 내부)', type: 'image', section: '06 숙소' },
    { key: 'ger_img2', label: '사진 2 (화장실)', type: 'image', section: '06 숙소' },
    { key: 'ger_img3', label: '사진 3 (샤워실)', type: 'image', section: '06 숙소' },
    { key: 'ger_img4', label: '사진 4 (고급형 게르)', type: 'image', section: '06 숙소' },
    { key: 'ger_check1', label: '체크 항목 1', type: 'text', section: '06 숙소', default: '온수 샤워 (게르 내)' },
    { key: 'ger_check2', label: '체크 항목 2', type: 'text', section: '06 숙소', default: '양변기 화장실 (게르 내)' },
    { key: 'ger_check3', label: '체크 항목 3', type: 'text', section: '06 숙소', default: '전기 사용 가능' },
    { key: 'ger_note', label: '하단 주석', type: 'text', section: '06 숙소', default: '일반 게르와 고급 게르는 실내 설비와 쾌적함에 차이가 있습니다.' },

    // ── 07 루트 소개 + 지도 ───────────────────────────────────
    { key: 'route_intro_title', label: '인트로 제목', type: 'text', section: '07 루트/지도', default: '그럼, 투어에서 방문하는 곳을 자세히 살펴볼까요?' },
    { key: 'route_intro_p1', label: '인트로 문단 1', type: 'textarea', section: '07 루트/지도', default: '새롭게 리뉴얼한 투어 일정입니다.' },
    { key: 'route_intro_p2', label: '인트로 문단 2', type: 'textarea', section: '07 루트/지도', default: '몽골을 대표하는 절경을 한 번에 만끽하는 여행입니다.' },
    { key: 'route_wide_img', label: '와이드 사진', type: 'image', section: '07 루트/지도' },
    { key: 'route_card_title', label: '지도 카드 제목', type: 'text', section: '07 루트/지도', default: '여행 루트 정보' },
    {
        key: 'map_stops', label: '지도 경유지', type: 'map-stops', section: '07 루트/지도',
        default: '울란바토르|울란바토르\n체체를렉 초원|체체를렉 초원\n쳉헤르 온천|쳉헤르 온천\n테를지 국립공원|테를지 국립공원',
        help: '한 줄에 한 곳: 지역명|표시문구|사진URL|위도,경도 (사진·좌표 생략 가능). 울란바토르·테를지·홉스굴·카라코룸·고비 등 주요 관광지는 이름만 넣으면 지도에 자동 표시되고, 미등록 지역은 마지막에 위도,경도를 넣으면 그 위치에 표시됩니다. 예: 새 캠프|새 캠프||47.5,105.2',
    },
    { key: 'spots_label', label: '관광 스팟 라벨', type: 'text', section: '07 루트/지도', default: '투어에서 방문하는 관광지' },
    { key: 'spots_hint', label: '스와이프 안내', type: 'text', section: '07 루트/지도', default: '옆으로 밀어서 보세요 →' },

    // ── 08 방문 여행지 카드 ──────────────────────────────────
    {
        key: 'spot_cards', label: '방문 여행지', type: 'spot-cards', section: '08 방문 여행지',
        default: '울란바토르|\n쳉헤르 온천|\n테를지 국립공원|',
        help: '한 줄에 한 곳: 표시이름|사진URL. 공통 여행지를 선택하면 이름과 대표 사진이 추가됩니다.',
    },

    // ── 09 고비 히어로 ────────────────────────────────────────
    { key: 'gobi_hero_img', label: '배경 사진', type: 'image', section: '09 고비 히어로' },
    { key: 'gobi_kicker', label: '작은 제목', type: 'text', section: '09 고비 히어로', default: '최대한 빠르게 고비 핵심을 둘러보고 싶다면' },
    { key: 'gobi_title', label: '큰 제목 1줄', type: 'text', section: '09 고비 히어로', default: '고비 4박 5일' },
    { key: 'gobi_title2', label: '큰 제목 2줄', type: 'text', section: '09 고비 히어로', default: '시그니처 코스' },
    { key: 'gobi_body', label: '본문', type: 'textarea', section: '09 고비 히어로', default: '바가가즈링출로 + 욜링암\n고비 + 바양작 + 차강소브라가' },

    // ── 10 하이라이트 ─────────────────────────────────────────
    { key: 'hl_title', label: '제목', type: 'text', section: '10 하이라이트', default: '여정 하이라이트' },
    { key: 'hl_hint', label: '스와이프 안내', type: 'text', section: '10 하이라이트', default: '옆으로 밀어서 보세요 →' },
    { key: 'pt1_img', label: '포인트 1 사진', type: 'image', section: '10 하이라이트' },
    { key: 'pt1_caption', label: '포인트 1 캡션', type: 'text', section: '10 하이라이트', default: '유목민 게르 방문' },
    { key: 'pt2_img', label: '포인트 2 사진', type: 'image', section: '10 하이라이트' },
    { key: 'pt2_caption', label: '포인트 2 캡션', type: 'text', section: '10 하이라이트', default: '승마 체험' },
    { key: 'pt3_img', label: '포인트 3 사진', type: 'image', section: '10 하이라이트' },
    { key: 'pt3_caption', label: '포인트 3 캡션', type: 'text', section: '10 하이라이트', default: '낙타 타기 체험' },
    { key: 'pt4_img', label: '포인트 4 사진', type: 'image', section: '10 하이라이트' },
    { key: 'pt4_caption', label: '포인트 4 캡션', type: 'text', section: '10 하이라이트', default: '몽골 전통 의상 체험' },
    { key: 'pt5_img', label: '포인트 5 사진', type: 'image', section: '10 하이라이트' },
    { key: 'pt5_caption', label: '포인트 5 캡션', type: 'text', section: '10 하이라이트', default: '검독수리를 팔에 올리고 기념 촬영' },
    { key: 'and_word', label: '연결 문구', type: 'text', section: '10 하이라이트', default: '그리고,' },

    // ── 11 은하수 ─────────────────────────────────────────────
    { key: 'mw_img', label: '은하수 사진', type: 'image', section: '11 은하수' },
    { key: 'mw_caption', label: '캡션', type: 'text', section: '11 은하수', default: '밤하늘에 빛나는 은하수 감상까지' },

    // ── 12 공항 도착 ──────────────────────────────────────────
    { key: 'arr_from', label: '출발지', type: 'text', section: '12 공항 도착', default: '인천국제공항' },
    { key: 'arr_to', label: '도착지', type: 'text', section: '12 공항 도착', default: '칭기스칸 국제공항' },
    { key: 'arr_img', label: '공항 사진', type: 'image', section: '12 공항 도착' },
    { key: 'arr_lead', label: '리드 문구', type: 'textarea', section: '12 공항 도착', default: '인천에서 약 3시간 30분 비행 후\n칭기스칸 국제공항에 도착.' },
    { key: 'arr_body', label: '픽업 안내 본문', type: 'textarea', section: '12 공항 도착', default: '칭기스칸 국제공항으로 마중 나갑니다. 직접 예약하신 울란바토르 시내 호텔에 묵으시는 경우에는 가이드가 호텔로 찾아가며, 만난 뒤 바로 투어를 시작할 수 있습니다.  예약·상담 시 항공편 도착 시간 또는 호텔 이름·주소를 알려 주세요. 고객님 일정에 맞춰 픽업 장소와 시간을 안내해 드립니다.' },
    { key: 'arr_band1', label: '민트 배너 1줄', type: 'text', section: '12 공항 도착', default: '공항 픽업·샌딩은 그룹당 왕복 1회 무료로 제공해 드립니다♪' },
    { key: 'arr_band2', label: '민트 배너 2줄', type: 'text', section: '12 공항 도착', default: '일행분들과 도착 시간을 맞춰 무료 픽업을 이용해 보세요!' },
    { key: 'welcome_img', label: '웰컴카드 사진', type: 'image', section: '12 공항 도착' },
    { key: 'welcome_side', label: '사진 옆 문구', type: 'textarea', section: '12 공항 도착', default: 'Welcome\nTo\nMongolia' },
    { key: 'welcome_caption', label: '하단 캡션', type: 'text', section: '12 공항 도착', default: '담당 가이드가 팀 이름이 적힌 보드를 들고 기다리고 있습니다♪' },

    // ── 06 숙소 — 일반 게르 페이지 (모바일 v3의 2페이지 슬라이더 중 2번째) ──
    { key: 'ger_hint1', label: '슬라이드 안내 (고급)', type: 'text', section: '06 숙소', default: '옆으로 넘겨 보세요' },
    { key: 'ger_std_badge', label: '일반 게르 뱃지', type: 'text', section: '06 숙소', default: '일반 게르' },
    { key: 'ger_std_img1', label: '일반 게르 사진 1 (외관)', type: 'image', section: '06 숙소' },
    { key: 'ger_std_img2', label: '일반 게르 사진 2 (내부)', type: 'image', section: '06 숙소' },
    { key: 'ger_std_img3', label: '일반 게르 사진 3 (침구)', type: 'image', section: '06 숙소' },
    { key: 'ger_std_img4', label: '일반 게르 사진 4 (주변)', type: 'image', section: '06 숙소' },
    { key: 'ger_hint2', label: '슬라이드 안내 (일반)', type: 'text', section: '06 숙소', default: '옆으로 밀어 보세요 →' },
    { key: 'ger_std_check1', label: '일반 게르 항목 1', type: 'text', section: '06 숙소', default: '온수 샤워 (공용·외부)' },
    { key: 'ger_std_check2', label: '일반 게르 항목 2', type: 'text', section: '06 숙소', default: '양변기 화장실 (공용·외부)' },
    { key: 'ger_std_check3', label: '일반 게르 항목 3', type: 'text', section: '06 숙소', default: '전기 사용 가능' },

    // ── 14 전용차량 ───────────────────────────────────────────
    { key: 'veh_kicker', label: '작은 제목', type: 'text', section: '14 전용차량', default: '몽골의 오프로드를 거침없이 달리는 최강의 터프한 차량!' },
    { key: 'veh_title', label: '큰 제목', type: 'text', section: '14 전용차량', default: '전용 차량' },
    { key: 'veh_sub', label: '차종 나열', type: 'text', section: '14 전용차량', default: '푸르공 / 스타렉스 / 알파드' },
    { key: 'veh_body', label: '본문', type: 'textarea', section: '14 전용차량', default: '몽골의 드넓은 초원과 사막, 험한 산악 지대를 달리는 전용 차량입니다.\n여정과 도로 상황에 맞춰 가장 알맞은 차량을 준비합니다. (최대 6명)' },
    { key: 'veh1_img', label: '차량 1 사진', type: 'image', section: '14 전용차량' },
    { key: 'veh1_name', label: '차량 1 이름', type: 'text', section: '14 전용차량', default: 'Alphard' },
    { key: 'veh2_img', label: '차량 2 사진', type: 'image', section: '14 전용차량' },
    { key: 'veh2_name', label: '차량 2 이름', type: 'text', section: '14 전용차량', default: 'Velpire' },
    { key: 'veh3_img', label: '차량 3 사진', type: 'image', section: '14 전용차량' },
    { key: 'veh3_name', label: '차량 3 이름', type: 'text', section: '14 전용차량', default: 'Starex' },
    { key: 'veh4_img', label: '차량 4 사진', type: 'image', section: '14 전용차량' },
    { key: 'veh4_name', label: '차량 4 이름', type: 'text', section: '14 전용차량', default: 'Landcriuser' },
    { key: 'veh5_img', label: '차량 5 사진', type: 'image', section: '14 전용차량' },
    { key: 'veh5_name', label: '차량 5 이름', type: 'text', section: '14 전용차량', default: 'Haice' },
    { key: 'veh_hint', label: '스와이프 안내', type: 'text', section: '14 전용차량', default: '옆으로 밀어 보세요 →' },
    { key: 'veh_note', label: '하단 주석', type: 'textarea', section: '14 전용차량', default: '※ 차량은 랜덤으로 배정됩니다. 원하시는 차종이 있으면 최대한 맞춰 드리지만, 현지 배차 상황에 따라 어려울 수 있습니다.' },

    // ── 15 식사 안내 ──────────────────────────────────────────
    { key: 'meal_img1', label: '식사 사진 1 (조식)', type: 'image', section: '15 식사 안내' },
    { key: 'meal_img2', label: '식사 사진 2 (현지식)', type: 'image', section: '15 식사 안내' },
    { key: 'meal_img3', label: '식사 사진 3 (캠프식)', type: 'image', section: '15 식사 안내' },
    { key: 'meal_img4', label: '식사 사진 4 (석식)', type: 'image', section: '15 식사 안내' },
    { key: 'meal_img5', label: '식사 사진 5 (게르 식당)', type: 'image', section: '15 식사 안내' },
    { key: 'meal_img6', label: '식사 사진 6 (휴게소)', type: 'image', section: '15 식사 안내' },
    { key: 'meal_kicker', label: '작은 제목', type: 'text', section: '15 식사 안내', default: '여행의 즐거움은 역시 식사!' },
    { key: 'meal_title1', label: '제목 앞부분', type: 'text', section: '15 식사 안내', default: '몽골 여행 ' },
    { key: 'meal_title2', label: '제목 강조부분', type: 'text', section: '15 식사 안내', default: '식사 안내' },
    { key: 'meal_points', label: '요약 3줄', type: 'textarea', section: '15 식사 안내', default: '아침부터 든든하게\n몽골 음식도 부담 없이\n하루 세 끼 모두 제공' },
    { key: 'meal_local_title', label: '현지식 제목', type: 'text', section: '15 식사 안내', default: '현지식' },
    { key: 'meal_local_body', label: '현지식 본문', type: 'textarea', section: '15 식사 안내', default: '이동 중 도로변 현지 식당이나 푸드트럭 등에서 맛보는 몽골 전통 음식입니다. 양고기와 소고기 위주의 요리가 많고, 간은 비교적 담백하며 향신료도 강하지 않습니다.' },
    { key: 'meal_camp_title', label: '캠프식 제목', type: 'text', section: '15 식사 안내', default: '캠프식' },
    { key: 'meal_camp_body', label: '캠프식 본문', type: 'textarea', section: '15 식사 안내', default: '숙소인 게르 캠프 안 전용 레스토랑에서 제공하는 식사입니다. 외국인 여행객의 입맛에 맞춰 조리하기 때문에 비교적 먹기 편하고, 몽골 음식이 낯선 분도 부담 없이 즐길 수 있습니다.' },
    { key: 'meal_hint', label: '스와이프 안내', type: 'text', section: '15 식사 안내', default: '옆으로 밀어 보세요 →' },
    { key: 'sp1_img', label: '특별식 1 사진', type: 'image', section: '15 식사 안내' },
    { key: 'sp1_tags', label: '특별식 1 태그 (줄바꿈 구분)', type: 'textarea', section: '15 식사 안내', default: '#테를지특별식\n#몽골전통음식' },
    { key: 'sp1_title', label: '특별식 1 제목', type: 'text', section: '15 식사 안내', default: '테를지 특별식: 허르헉 1회 제공' },
    { key: 'sp1_body', label: '특별식 1 본문', type: 'textarea', section: '15 식사 안내', default: '허르헉은 몽골 유목민이 귀한 손님을 대접하거나 가족의 특별한 날에 먹는 전통 음식입니다. 양고기와 감자 등에 달군 돌을 함께 넣고 천천히 쪄 내는, 몽골에서만 맛볼 수 있는 고기 요리입니다.' },
    { key: 'sp1_note', label: '특별식 1 주석', type: 'text', section: '15 식사 안내', default: '※ 테를지 일정에서만 제공합니다.' },
    { key: 'sp2_img', label: '특별식 2 사진', type: 'image', section: '15 식사 안내' },
    { key: 'sp2_tags', label: '특별식 2 태그 (줄바꿈 구분)', type: 'textarea', section: '15 식사 안내', default: '#몽골샤브샤브\n#인기메뉴' },
    { key: 'sp2_title', label: '특별식 2 제목', type: 'text', section: '15 식사 안내', default: '샤브샤브: 양고기 & 채소 샤브샤브(저녁) 1회 제공' },
    { key: 'sp2_body', label: '특별식 2 본문', type: 'textarea', section: '15 식사 안내', default: '울란바토르 시내 관광 때 즐기는, 몽골에서도 인기 있는 샤브샤브. 신선한 양고기와 채소를 육수에 살짝 익혀 담백하게 드실 수 있습니다.' },
    { key: 'sp2_note', label: '특별식 2 주석', type: 'text', section: '15 식사 안내', default: '※ 일정에 따라 제공 시점이 바뀔 수 있습니다.' },

    // ── 11 은하수 (모바일 v3 추가 항목) ───────────────────────
    { key: 'mw_body', label: '본문 (모바일)', type: 'textarea', section: '11 은하수', default: '도시의 불빛이 닿지 않는 몽골의 밤이기에\n고개만 들어도 은하수가 펼쳐집니다.' },
    { key: 'milky_img1', label: '은하수 사진 1', type: 'image', section: '11 은하수' },
    { key: 'milky_img2', label: '은하수 사진 2', type: 'image', section: '11 은하수' },
    { key: 'milky_img3', label: '은하수 사진 3', type: 'image', section: '11 은하수' },
    { key: 'milky_img4', label: '은하수 사진 4', type: 'image', section: '11 은하수' },

    // ── 12 공항 도착 (모바일 v3 웰컴 블록) ────────────────────
    { key: 'welcome_w1', label: '웰컴 단어 1', type: 'text', section: '12 공항 도착', default: 'Welcome' },
    { key: 'welcome_w2', label: '웰컴 단어 2', type: 'text', section: '12 공항 도착', default: 'To' },
    { key: 'welcome_w3', label: '웰컴 단어 3', type: 'text', section: '12 공항 도착', default: 'Mongolia' },
    { key: 'mn_icon1', label: '아이콘 1', type: 'image', section: '12 공항 도착' },
    { key: 'mn_icon2', label: '아이콘 2', type: 'image', section: '12 공항 도착' },
    { key: 'mn_icon3', label: '아이콘 3', type: 'image', section: '12 공항 도착' },
    { key: 'mn_icon4', label: '아이콘 4', type: 'image', section: '12 공항 도착' },
    { key: 'mn_icon5', label: '아이콘 5', type: 'image', section: '12 공항 도착' },
    { key: 'mn_icon6', label: '아이콘 6', type: 'image', section: '12 공항 도착' },

    // ── 16 여행의 순간들 ──────────────────────────────────────
    { key: 'moment_text1', label: '문구 1 (왼쪽)', type: 'textarea', section: '16 여행의 순간들', default: '몸도 마음도 쉬어 가는\n몽골에서,\n아름다운 추억을\n만들어 보세요.' },
    { key: 'moment_text2', label: '문구 2 (오른쪽)', type: 'textarea', section: '16 여행의 순간들', default: '함께 경험하는\n몽골의\n특별한 순간' },
    { key: 'moment_img1', label: '사진 1 (절벽 위)', type: 'image', section: '16 여행의 순간들' },
    { key: 'moment_img2', label: '사진 2 (캠프파이어)', type: 'image', section: '16 여행의 순간들' },
    { key: 'moment_img3', label: '사진 3 (샌드보딩)', type: 'image', section: '16 여행의 순간들' },
    { key: 'moment_img4', label: '사진 4 (허르헉 조리)', type: 'image', section: '16 여행의 순간들' },
    { key: 'moment_img5', label: '사진 5 (낙타 트레킹)', type: 'image', section: '16 여행의 순간들' },
    { key: 'moment_img6', label: '사진 6 (양털 기념품)', type: 'image', section: '16 여행의 순간들' },
    { key: 'moment_img7', label: '사진 7 (단체 점프)', type: 'image', section: '16 여행의 순간들' },
    { key: 'moment_img8', label: '사진 8 (별 관측)', type: 'image', section: '16 여행의 순간들' },

    // ── 17 포함/불포함 ────────────────────────────────────────
    { key: 'notice_bg', label: '배경 사진', type: 'image', section: '17 포함/불포함' },
    { key: 'notice_title', label: '큰 제목', type: 'text', section: '17 포함/불포함', default: 'NOTICE IT' },
    { key: 'notice_sub', label: '부제', type: 'text', section: '17 포함/불포함', default: '포함 사항 · 불포함 사항' },
    { key: 'inc_title', label: '포함 제목', type: 'text', section: '17 포함/불포함', default: '포함 사항' },
    { key: 'inc_items', label: '포함 항목 (줄바꿈 구분)', type: 'textarea', section: '17 포함/불포함', default: '- 전 일정 숙박비\n- 전 일정 식사비 (허르헉 특별식 1회 포함)\n- 일정표에 기재된 관광지 입장료\n- 일정표에 기재된 낙타 타기·승마 체험\n- 공항 픽업·샌딩\n- 매일 생수 1병 제공\n- 전용 차량·연료비·기사 비용\n- 한국어 가능한 현지 가이드' },
    { key: 'exc_title', label: '불포함 제목', type: 'text', section: '17 포함/불포함', default: '불포함 사항' },
    { key: 'exc_items', label: '불포함 항목 (줄바꿈 구분)', type: 'textarea', section: '17 포함/불포함', default: '- 국제선 왕복 항공권\n- 각종 팁 (낙타·승마 체험 등)\n- 개인 경비\n- 해외여행자보험' },

    // ── 18 투어 가격 ──────────────────────────────────────────
    { key: 'price_kicker', label: '작은 제목', type: 'text', section: '18 투어 가격', default: '모일수록 이득!' },
    { key: 'price_title', label: '큰 제목', type: 'text', section: '18 투어 가격', default: '투어 요금' },
    { key: 'price_head', label: '표 헤더 (| 구분)', type: 'text', section: '18 투어 가격', default: '참가 인원|예약금 (원)|잔금 (원)|1인당 합계 금액' },
    { key: 'price_rows', label: '표 내용 (한 줄에 한 행, | 구분)', type: 'textarea', section: '18 투어 가격', default: '2명일 때|200,000원|2,000,000원|2,000,000원\n3명일 때|200,000원|2,000,000원|2,000,000원\n4명일 때|200,000원|2,000,000원|2,000,000원\n5명일 때|200,000원|2,000,000원|2,000,000원\n6명일 때|200,000원|2,000,000원|2,000,000원' },
    { key: 'price_tag1', label: '결제 태그 1', type: 'text', section: '18 투어 가격', default: '예약금' },
    { key: 'price_tag1_desc', label: '결제 설명 1', type: 'text', section: '18 투어 가격', default: '계좌이체 (예약 신청 후 안내해 드리는 계좌로 입금)' },
    { key: 'price_tag2', label: '결제 태그 2', type: 'text', section: '18 투어 가격', default: '잔금' },
    { key: 'price_tag2_desc', label: '결제 설명 2', type: 'text', section: '18 투어 가격', default: '현지에서 현금으로 결제 (담당 가이드에게 전달해 주세요)' },
    { key: 'price_img', label: '하단 사진', type: 'image', section: '18 투어 가격' },

    // ── 19 예약 전 확인사항 ───────────────────────────────────
    { key: 'terms_title', label: '섹션 제목', type: 'text', section: '19 예약 전 확인사항', default: '예약 전에 꼭 확인해 주세요!' },
    { key: 'cancel_title', label: '취소 규정 제목', type: 'text', section: '19 예약 전 확인사항', default: '투어 예약금 취소 규정' },
    { key: 'cancel_body', label: '취소 규정 본문 (줄바꿈 구분)', type: 'textarea', section: '19 예약 전 확인사항', default: '예약 후 취소하시는 경우 예약금은 환불되지 않습니다.\n예약금은 호텔·게르 등 숙박 시설의 선결제 금액으로 사용되므로, 취소 시점과 관계없이 환불이 불가한 점 미리 양해 부탁드립니다.' },
    { key: 'cancel_box', label: '취소 규정 강조 박스 (줄바꿈 구분)', type: 'textarea', section: '19 예약 전 확인사항', default: '★ 예약금은 취소 시점과 관계없이 환불 불가' },
    { key: 'tour_title', label: '투어 안내 제목', type: 'text', section: '19 예약 전 확인사항', default: '투어 안내' },
    { key: 'tour_body', label: '투어 안내 본문 (줄바꿈 구분)', type: 'textarea', section: '19 예약 전 확인사항', default: '· 홈페이지에 게재된 모든 투어에는 해외여행자보험이 포함되어 있지 않습니다. 반드시 해외여행자보험에 가입하시기를 권장합니다.\n· 몽골에서는 날씨(비 등)와 도로 상황(도로 파손 등), 고객님의 관광 스타일에 따라 이동·투어 시간이 크게 달라질 수 있습니다. 따라서 기재된 투어 시간은 어디까지나 참고용입니다.\n· 가이드의 안내나 안전 지시를 따르지 않아 발생한 사고는 여행사 차원의 대응·보상이 어려울 수 있습니다.\n· 매일 캠프 도착 후와 저녁 식사 후는 자유 시간입니다. 자유 시간 중 발생한 사고는 대응이 어려울 수 있으니 안전에 각별히 유의해 주세요.\n· 저녁 식사 후는 가이드의 근무가 끝난 개인 시간입니다. 또한 캠프 안에서는 과도한 음주나 소음으로 다른 고객에게 피해가 가지 않도록 매너를 지켜 주세요.\n· 서비스로 무료 제공하는 물품은 7~8월 최성수기에는 일부 준비되지 않을 수 있습니다. 이 경우 보상·환불 대상이 아니니 미리 양해 부탁드립니다.\n· 만일 예기치 못한 차량 고장이 발생하면 여행사가 신속히 대체 차량을 수배합니다. 다만 몽골은 이동 거리가 매우 길어 대체 차량 도착까지 시간이 걸릴 수 있습니다.\n· 승마·낙타 타기 체험 시 동물을 놀라게 하는 행동은 삼가 주세요. 체험 중에는 반드시 손잡이나 고삐를 단단히 잡고 현지 스태프의 지시에 따라 주세요.\n· 체험 액티비티는 발생할 수 있는 사고와 주의 사항을 충분히 확인하신 뒤, 동의서에 서명하고 참가하시게 됩니다.\n· 해외여행자보험에 가입한 뒤 투어에 참가해 주세요. 승마·낙타 타기 등 체험 중 사고도 보장되는 특약을 추가하시기를 권장합니다.\n· 휴대전화와 귀중품(현금 등)은 반드시 각자 관리하시고, 숙박 시설이나 식당 등에 둔 채 자리를 비우지 않도록 부탁드립니다. 분실 시 당사는 책임지지 않습니다.' },
    { key: 'tour_banner', label: '투어 안내 배너', type: 'text', section: '19 예약 전 확인사항', default: '해외여행자보험은 반드시 각자 가입해 주세요.' },
    { key: 'gerstay_title', label: '게르 숙박 제목', type: 'text', section: '19 예약 전 확인사항', default: '여행자 게르 숙박 안내' },
    { key: 'gerstay_lead', label: '게르 숙박 강조 문구', type: 'text', section: '19 예약 전 확인사항', default: '몽골리아 은하수는 추가 요금 없이 기본적으로 고급 게르를 제공합니다.' },
    { key: 'gerstay_body', label: '게르 숙박 본문', type: 'textarea', section: '19 예약 전 확인사항', default: '다만 몽골의 특성상 지역에 따라 숙박 시설의 설비에 차이가 있으며, 고급 게르·럭셔리 게르가 없는 지역도 있습니다. 그 경우에는 일반 타입 게르를 이용하시게 됩니다.' },
    { key: 'gt_head', label: '게르 표 헤더 (| 구분)', type: 'text', section: '19 예약 전 확인사항', default: '게르 타입|참고 사진|게르 설비' },
    { key: 'gt1_name', label: '게르 유형 1 이름', type: 'textarea', section: '19 예약 전 확인사항', default: '여행자 게르\n(일반 타입)' },
    { key: 'gt1_img', label: '게르 유형 1 사진', type: 'image', section: '19 예약 전 확인사항' },
    { key: 'gt1_spec', label: '게르 유형 1 설비', type: 'textarea', section: '19 예약 전 확인사항', default: '전기: 사용 가능\n샤워: 온수 / 야외 공용\n화장실: 양변기 / 야외 공용\n난방: 장작 난로 난방' },
    { key: 'gt2_name', label: '게르 유형 2 이름', type: 'textarea', section: '19 예약 전 확인사항', default: '여행자 게르\n(고급 타입)' },
    { key: 'gt2_img', label: '게르 유형 2 사진', type: 'image', section: '19 예약 전 확인사항' },
    { key: 'gt2_spec', label: '게르 유형 2 설비', type: 'textarea', section: '19 예약 전 확인사항', default: '전기: 사용 가능\n샤워: 온수 / 야외 공용\n화장실: 양변기 / 야외 공용\n난방: 완비' },
    { key: 'gt3_name', label: '게르 유형 3 이름', type: 'textarea', section: '19 예약 전 확인사항', default: '모던 게르' },
    { key: 'gt3_img', label: '게르 유형 3 사진', type: 'image', section: '19 예약 전 확인사항' },
    { key: 'gt3_spec', label: '게르 유형 3 설비', type: 'textarea', section: '19 예약 전 확인사항', default: '전기: 사용 가능\n샤워: 게르 내 완비\n화장실: 게르 내 완비\n난방: 완비' },
    { key: 'gt4_name', label: '게르 유형 4 이름', type: 'textarea', section: '19 예약 전 확인사항', default: '모던 펜션' },
    { key: 'gt4_img', label: '게르 유형 4 사진', type: 'image', section: '19 예약 전 확인사항' },
    { key: 'gt4_spec', label: '게르 유형 4 설비', type: 'textarea', section: '19 예약 전 확인사항', default: '전기: 사용 가능\n샤워: 실내 완비\n화장실: 실내 완비\n난방: 완비' },
    { key: 'animal_title', label: '동물 체험 제목', type: 'text', section: '19 예약 전 확인사항', default: '동물 체험 안내' },
    { key: 'animal_body', label: '동물 체험 본문 (줄바꿈 구분)', type: 'textarea', section: '19 예약 전 확인사항', default: '· 낙타 타기·승마 체험 시 낙마 사고에 각별히 주의해 주세요. 안전을 위해 반드시 가이드의 지시에 따르고, 갑작스러운 움직임이나 위험한 행동은 삼가 주세요.\n· 동물에 타기 전이나 체험을 시작하기 전에는 반드시 장비 상태를 확인해 주세요. 특히 사진 촬영 시 동물이 놀라지 않도록 갑작스러운 움직임에 주의해 주세요.' },

    // ── 20 FAQ ───────────────────────────────────────────────
    { key: 'faq_title', label: '큰 제목', type: 'text', section: '20 FAQ', default: 'FAQ' },
    { key: 'faq_sub', label: '부제', type: 'text', section: '20 FAQ', default: '자주 묻는 질문' },
    { key: 'faq1_q', label: '질문 1', type: 'text', section: '20 FAQ', default: '항공편 도착 시간에 맞춰 투어 일정을 변경할 수 있나요?' },
    { key: 'faq1_a', label: '답변 1', type: 'textarea', section: '20 FAQ', default: '네, 가능합니다.\n항공 스케줄에 맞춰 투어 일정 일부를 조정할 수 있습니다.\n이미 항공권을 구매하셨다면 반드시 e티켓을 공유해 주세요!' },
    { key: 'faq2_q', label: '질문 2', type: 'text', section: '20 FAQ', default: '항공권은 투어 요금에 포함되어 있나요?' },
    { key: 'faq2_a', label: '답변 2', type: 'textarea', section: '20 FAQ', default: '기본적으로 항공권은 투어 요금에 포함되어 있지 않습니다. 항공권은 고객님이 직접 예약·발권하시기를 권장합니다.  고객님의 항공 스케줄에 맞춰 몽골 현지 투어 일정을 조정하는 현지 풀 패키지 투어입니다.' },
    { key: 'faq3_q', label: '질문 3', type: 'text', section: '20 FAQ', default: '여행 요금은 어떻게 결제하나요?' },
    { key: 'faq3_a', label: '답변 3', type: 'textarea', section: '20 FAQ', default: '예약금은 계좌이체로 받습니다. 예약 신청 후 안내해 드리는 계좌로 예약금을 입금하고, 마이페이지에서 \'입금 완료\'를 알려 주세요. 담당자가 확인한 뒤 예약이 확정됩니다.  잔금은 현지에서 현금으로 결제합니다. 숙소에 도착한 뒤 담당 가이드에게 전달해 주세요.  지불 후에는 현금 수령증에 서명하고 반드시 사본을 받아 두세요.' },
    { key: 'faq4_q', label: '질문 4', type: 'text', section: '20 FAQ', default: '가이드는 한국어가 가능한가요?' },
    { key: 'faq4_a', label: '답변 4', type: 'textarea', section: '20 FAQ', default: '한국어로 소통할 수 있는 몽골인 현지 가이드를 배정해 드립니다.  담당 가이드의 성별은 랜덤으로 배정됩니다.' },
    { key: 'faq5_q', label: '질문 5', type: 'text', section: '20 FAQ', default: '투어는 완전 프라이빗인가요?' },
    { key: 'faq5_a', label: '답변 5', type: 'textarea', section: '20 FAQ', default: '네, 당사 홈페이지에 게재된 모든 투어는 다른 고객과 합류하지 않는 100% 프라이빗 투어입니다.  투어 중은 물론 숙박도 다른 그룹과 방을 함께 쓰는 일 없이 고객님 일행만 이용하십니다.' },
];

/**
 * 관리자에서 복제·삭제하는 단위인 섹션 목록 (템플릿의 실제 렌더 순서와 같아야 한다).
 * fieldSections는 그 섹션이 포함하는 매니페스트 section 이름 — 복제 시 이 필드들이 함께 복사된다.
 * repeatable: false는 한 상품에 하나만 있는 게 자연스러운 섹션(오프닝/히어로 등).
 */
export const horseTrekSectionDefs: DesignSectionDef[] = [
    { id: '01 오프닝', fieldSections: ['01 오프닝'] },
    { id: '02 별하늘 히어로', fieldSections: ['02 별하늘 히어로'] },
    { id: '03 소개 배너', fieldSections: ['03 소개 배너'] },
    { id: '04 이용자 특전', fieldSections: ['04 이용자 특전'] },
    { id: '05 여행 고민', fieldSections: ['05 여행 고민'] },
    { id: '06 숙소', fieldSections: ['06 숙소'], repeatable: true },
    { id: '14 전용차량', fieldSections: ['14 전용차량'], repeatable: true },
    { id: '15 식사 안내', fieldSections: ['15 식사 안내'], repeatable: true },
    { id: '07 루트/지도', fieldSections: ['07 루트/지도', '08 방문 여행지'] },
    { id: '09 고비 히어로', fieldSections: ['09 고비 히어로'], repeatable: true },
    { id: '10 하이라이트', fieldSections: ['10 하이라이트'], repeatable: true },
    { id: '11 은하수', fieldSections: ['11 은하수'], repeatable: true },
    { id: '12 공항 도착', fieldSections: ['12 공항 도착'] },    { id: '16 여행의 순간들', fieldSections: ['16 여행의 순간들'], repeatable: true },
    { id: '17 포함/불포함', fieldSections: ['17 포함/불포함'] },
    { id: '18 투어 가격', fieldSections: ['18 투어 가격'] },
    { id: '19 예약 전 확인사항', fieldSections: ['19 예약 전 확인사항'] },
    { id: '20 FAQ', fieldSections: ['20 FAQ'] },
];
