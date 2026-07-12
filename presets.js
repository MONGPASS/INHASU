/* ═══════════════════════════════════════════════════════════════
   프리셋 라이브러리 — 여행지(명소) + 코스 + 요금 옵션
   ---------------------------------------------------------------
   견적서 만들기 편집기에서 클릭으로 불러오는 재료들입니다.
   여기에 명소나 코스를 추가하면 편집기 목록에 자동으로 나타납니다.
   ═══════════════════════════════════════════════════════════════ */
window.PRESETS = {

  /* ── 명소 라이브러리 ──────────────────────────────
     name(한글)이 키 역할. 지도 좌표(lat/lng)와 설명을 함께 둡니다.
     여기 등록해두면: ① 대표 명소 페이지 ② 지도 핀 이 자동 생성됩니다. */
  spots: {
    "차강소브라가": {
      nameMn: "Цагаан суварга", region: "고비", lat: 44.7086, lng: 105.7469,
      short: "'하얀 탑' 침식지형",
      desc: "수천만 년 전 바다였던 지역이 융기·풍화되며 만들어진 지형으로, 높이 약 30~60m·길이 약 400m 규모의 붉은빛·주황빛·회백색 퇴적층이 겹겹이 드러납니다. 멀리서 보면 오래된 성벽이나 협곡 같아 '하얀 탑'이라는 이름이 붙었습니다. 경사가 가파른 구간이 있어 미끄러지지 않는 운동화나 등산화 착용을 권장합니다.",
    },
    "욜린암": {
      nameMn: "Ёлын ам", region: "고비", lat: 43.4903, lng: 104.0669,
      short: "얼음 계곡 협곡 트레킹",
      desc: "수백만 년 동안 얼음이 깎아낸 협곡에 형성된 계곡으로, 양옆으로 높은 절벽이 이어집니다. 협곡 사이로 시원한 냇물이 흐르고, 지형 특성상 여름에도 얼음이 남아 있어 '얼음 계곡'이라 불리기도 합니다. 안쪽은 좁고 오르내리는 구간이 있어 편한 운동화나 트레킹화 착용을 추천합니다.",
    },
    "홍고린엘스": {
      nameMn: "Хонгорын элс", region: "고비", lat: 43.7600, lng: 102.2800,
      short: "노래하는 모래언덕",
      desc: "몽골 남부 고비사막에 위치한 거대한 모래언덕 지형으로, 길이 약 100km·높이 최대 300m에 달하는 모래언덕이 이어져 있습니다. 바람이 불면 '노래하는 모래'라 불리는 소리가 나기도 합니다. 해질 무렵의 실루엣과 낙타 체험, 모래썰매가 인기 있는 명소입니다.",
    },
    "바양작": {
      nameMn: "Баянзаг", region: "고비", lat: 44.1381, lng: 103.7285,
      short: "불타는 절벽",
      desc: "해질 무렵 붉게 물드는 사암 절벽으로 '불타는 절벽(Flaming Cliffs)'이라 불립니다. 세계 최초로 공룡알 화석이 발견된 곳으로도 유명하며, 붉은 대지와 사막 관목이 어우러진 풍경이 인상적입니다.",
    },
    "박가즈린촐로": {
      nameMn: "Багга газрын чулуу", region: "고비", lat: 46.2200, lng: 106.0200,
      short: "화강암 기암지대",
      desc: "초원 한가운데 솟은 화강암 기암 지대로, 오랜 세월 풍화된 바위 사이로 동굴과 약수터가 있습니다. 눈이 좋아진다는 전설의 약수와 암벽 트레킹으로 알려져 있습니다.",
    },
    "테를지": {
      nameMn: "Тэрэлж", region: "중앙", lat: 47.9900, lng: 107.4600,
      short: "테를지 국립공원",
      desc: "울란바토르에서 가장 가까운 국립공원으로, 기암괴석과 초원, 소나무 숲이 어우러진 대표적인 힐링 명소입니다. 거북바위, 아리야발 사원, 승마와 게르 체험을 함께 즐길 수 있어 첫 몽골 여행에 인기가 많습니다.",
    },
    "칭기즈칸기마상": {
      nameMn: "Чингис хааны хөшөө", region: "중앙", lat: 47.8081, lng: 107.5300,
      short: "40m 스테인리스 기마상",
      desc: "높이 40m에 달하는 세계 최대 규모의 칭기즈칸 기마 동상입니다. 말 머리 부분 전망대까지 올라갈 수 있으며, 광활한 초원을 배경으로 한 압도적인 스케일이 인상적입니다.",
    },
    "엘승타사르하이": {
      nameMn: "Элсэн тасархай", region: "중앙", lat: 47.3500, lng: 103.6700,
      short: "미니 고비 사막",
      desc: "초원과 사막이 맞닿은 지역으로 '미니 고비'라 불립니다. 울란바토르에서 비교적 가까워 사막 분위기와 낙타 체험을 짧은 일정으로 즐기기 좋습니다.",
    },
    "카라코룸": {
      nameMn: "Хархорум", region: "중앙", lat: 47.1970, lng: 102.8230,
      short: "몽골제국의 옛 수도",
      desc: "13세기 몽골제국의 수도였던 유서 깊은 도시로, 몽골 최초의 불교 사원인 에르덴조 사원이 자리합니다. 108개의 하얀 불탑에 둘러싸인 사원과 초원의 유적이 어우러진 역사 명소입니다.",
    },
    "홉스골": {
      nameMn: "Хөвсгөл нуур", region: "북부", lat: 51.0000, lng: 100.5000,
      short: "몽골의 바다, 홉스골 호수",
      desc: "'몽골의 푸른 진주'라 불리는 거대한 담수호로, 맑은 물과 침엽수림, 설산이 어우러진 절경을 자랑합니다. 트레킹, 카약, 순록 유목민 차탄족 방문 등 청정 자연을 만끽할 수 있습니다.",
    },
  },

  /* ── 요금 자주 쓰는 옵션 ──────────────────────────
     편집기에서 토글로 켜고 끄는 옵션들. amount는 1인 기준. */
  priceOptions: [
    { label: "얼리스타트 (04~)",       amount:  40000, calc: "240,000원/6인" },
    { label: "차량 업그레이드",         amount:  25000, calc: "5,000원*5일" },
    { label: "1박실 LV4",             amount:  50000, calc: "50,000원*1박" },
    { label: "가이드 LV4 지정",         amount:  50000, calc: "" },
    { label: "울린암 호텔 변경 이벤트",  amount: -50000, calc: "-50,000원*1박" },
    { label: "단체 할인",              amount: -50000, calc: "" },
  ],

  /* ── 코스 프리셋 ──────────────────────────────────
     하나 고르면 여행지·일정·명소·기본가가 한 번에 채워집니다.
     highlights는 위 spots의 키(한글 이름)를 나열합니다. */
  courses: {
    "고비 4박5일": {
      destination: "고비", nights: "4박5일", intensity: 4, vehicle: "스타렉스급 or 하이스급",
      highlights: ["차강소브라가", "욜린암", "홍고린엘스"],
      days: [
        { d:1, dest:"차강소브라가<br>욜린암", move:"이동 10시간", dist:"(600 km)",
          items:["가이드 접선 후 여행시작 (얼리스타트)","이동 중 아침식사","차강소브라가 도착 / 침식지형 트래킹","점심식사 후 욜린암으로 출발","숙소 도착 (저녁식사 및 휴식)","🌌은하수헌팅"],
          stay:{name:"여행자 캠프<br>(일반/고급게르)", tags:["전기 O","샤워 O","인터넷 O"]}, meals:["현지식당","현지식당","캠프식"] },
        { d:2, dest:"홍고린엘스", move:"이동 5시간", dist:"(250 km)",
          items:["아침식사 후 욜린암 협곡 투어","욜린암 얼음협곡 승마트레킹","점심식사 후 홍고린엘스로 출발","홍고린엘스 사막투어","(선셋투어, 모래썰매, 낙타체험)","숙소 도착 (저녁식사 및 휴식)","🌌은하수헌팅"],
          stay:{name:"여행자 캠프<br>(일반/고급게르)", tags:["전기 O","샤워 O","인터넷 O"]}, meals:["캠프식","허르헉","캠프식"] },
        { d:3, dest:"바양작", move:"이동 6시간", dist:"(300 km)",
          items:["아침식사 후 바양작으로 출발","점심식사","바양작(불타는 절벽) 도착 후 트래킹","(바양작 전시, 영상 관람)","숙소 도착 (저녁식사 및 휴식)","🌌은하수헌팅"],
          stay:{name:"여행자 캠프<br>(일반/고급게르)", tags:["전기 O","샤워 O","인터넷 O"]}, meals:["캠프식","현지식당","캠프식"] },
        { d:4, dest:"박가즈린촐로", move:"이동 8시간", dist:"(500 km)",
          items:["아침식사 후 박가즈린촐로 출발","이동 중 점심식사","박가즈린촐로 트래킹","(동굴, 눈이 좋아지는 약수 등)","숙소 도착 (저녁식사 및 휴식)","🌌은하수헌팅"],
          stay:{name:"여행자 캠프<br>(일반게르)", tags:["전기 제한","샤워 제한","인터넷 O"]}, meals:["캠프식","현지식당","캠프식"] },
        { d:5, dest:"울란바토르", move:"이동 6시간", dist:"(350 km)",
          items:["아침식사 후 울란바토르로 출발","점심식사 (The bull 샤브샤브)","울란바토르 시내투어 (희망장소)","공항 드랍 후 투어종료"],
          stay:{name:"숙소미포함", tags:[]}, meals:["캠프식","샤브샤브","X"] },
      ],
    },

    "테를지·중앙몽골 3박4일": {
      destination: "중앙 몽골", nights: "3박4일", intensity: 2, base: 620000, vehicle: "스타렉스",
      highlights: ["테를지", "칭기즈칸기마상", "엘승타사르하이"],
      days: [
        { d:1, dest:"칭기즈칸기마상<br>테를지", move:"이동 2시간", dist:"(80 km)",
          items:["공항 미팅 후 여행시작","칭기즈칸 기마상 전망대","테를지 국립공원 이동","거북바위 / 아리야발 사원","게르 캠프 체크인 (저녁식사)"],
          stay:{name:"여행자 캠프", tags:["전기 O","샤워 O"]}, meals:["기내식","현지식당","캠프식"] },
        { d:2, dest:"테를지", move:"이동 소량", dist:"(공원 내)",
          items:["아침식사 후 승마 트레킹","유목민 게르 방문 (아이락 시음)","점심식사","자유시간 / 하이킹","캠프파이어 & 별관측"],
          stay:{name:"여행자 캠프", tags:["전기 O","샤워 O"]}, meals:["캠프식","현지식당","캠프식"] },
        { d:3, dest:"엘승타사르하이", move:"이동 4시간", dist:"(280 km)",
          items:["아침식사 후 엘승타사르하이(미니고비) 이동","낙타 트레킹","점심식사","초원·사막 경계 트레킹","숙소 도착 (저녁식사)"],
          stay:{name:"여행자 캠프", tags:["전기 O","샤워 O"]}, meals:["캠프식","현지식당","캠프식"] },
        { d:4, dest:"울란바토르", move:"이동 4시간", dist:"(280 km)",
          items:["아침식사 후 울란바토르 복귀","시내 관광 / 기념품","점심식사 (샤브샤브)","공항 드랍 후 투어종료"],
          stay:{name:"숙소미포함", tags:[]}, meals:["캠프식","샤브샤브","X"] },
      ],
    },

    "홉스골 호수 4박5일": {
      destination: "홉스골", nights: "4박5일", intensity: 3, base: 950000, vehicle: "랜드크루저",
      highlights: ["홉스골", "카라코룸"],
      days: [
        { d:1, dest:"무릉 → 홉스골", move:"국내선+이동", dist:"(무릉 경유)",
          items:["국내선으로 무릉 이동","차량으로 홉스골 호수 이동","호숫가 게르 캠프 체크인","저녁식사 및 휴식"],
          stay:{name:"호숫가 캠프", tags:["전기 O","샤워 O"]}, meals:["기내식","현지식당","캠프식"] },
        { d:2, dest:"홉스골", move:"호수 일대", dist:"",
          items:["아침식사 후 호수 트레킹","카약 또는 보트 체험","점심식사","승마 / 자유시간","캠프파이어 & 별관측"],
          stay:{name:"호숫가 캠프", tags:["전기 O","샤워 O"]}, meals:["캠프식","현지식당","캠프식"] },
        { d:3, dest:"차탄족 방문", move:"이동 반나절", dist:"",
          items:["아침식사 후 순록 유목민 차탄족 방문","순록 체험 및 문화 교류","점심식사","호수로 복귀","저녁식사 및 휴식"],
          stay:{name:"호숫가 캠프", tags:["전기 O","샤워 O"]}, meals:["캠프식","현지식당","캠프식"] },
        { d:4, dest:"무릉 복귀", move:"이동+국내선", dist:"",
          items:["아침식사 후 무릉 이동","현지 시장 관광","국내선으로 울란바토르 복귀","시내 석식 (샤브샤브)"],
          stay:{name:"호텔(4성급)", tags:[]}, meals:["캠프식","현지식당","샤브샤브"] },
        { d:5, dest:"울란바토르", move:"시내", dist:"",
          items:["아침식사 후 자유시간","기념품 쇼핑","공항 이동 / 출국"],
          stay:{name:"숙소미포함", tags:[]}, meals:["호텔조식","X","X"] },
      ],
    },
  },

  /* ── 일정 조각(하루 일정 스니펫) ────────────────────
     자주 쓰는 '하루 일정'을 미리 만들어 두는 곳.
     견적서 만들기의 각 일자에서 "일정 불러오기"로 클릭 한 번에 채웁니다.
     (일차 번호 d는 불러올 때 자동으로 매겨지므로 여기선 생략) */
  snippets: {
    "차강소브라가·욜린암 (이동일)": {
      dest:"차강소브라가<br>욜린암", move:"이동 10시간", dist:"(600 km)",
      items:["가이드 접선 후 여행시작 (얼리스타트)","이동 중 아침식사","차강소브라가 도착 / 침식지형 트래킹","점심식사 후 욜린암으로 출발","숙소 도착 (저녁식사 및 휴식)"],
      stay:{name:"LV4.디럭스<br>숙소", tags:[]}, meals:["현지식당","현지식당","캠프식"] },
    "홍고린엘스 사막투어": {
      dest:"홍고린엘스", move:"이동 5시간", dist:"(250 km)",
      items:["아침식사 후 욜린암 협곡 투어","욜린암 얼음협곡 승마트레킹","점심식사 후 홍고린엘스로 출발","홍고린엘스 사막투어","(선셋투어, 모래썰매, 낙타체험)","숙소 도착 (저녁식사 및 휴식)"],
      stay:{name:"여행자 캠프", tags:["전기 제한","샤워 제한","인터넷 O"]}, meals:["캠프식","허르헉","캠프식"] },
    "바양작 (불타는 절벽)": {
      dest:"바양작", move:"이동 6시간", dist:"(300 km)",
      items:["아침식사 후 바양작으로 출발","점심식사","바양작(불타는 절벽) 도착 후 트래킹","(바양작 전시, 영상 관람)","숙소 도착 (저녁식사 및 휴식)","*캠프파이어/삼겹살파티 (현지 상황에 따라 진행)"],
      stay:{name:"여행자 캠프", tags:["전기 O","샤워 O","인터넷 O"]}, meals:["캠프식","현지식당","삼겹살파티"] },
    "박가즈린촐로": {
      dest:"박가즈린촐로", move:"이동 8시간", dist:"(500 km)",
      items:["아침식사 후 박가즈린촐로 출발","이동 중 점심식사","박가즈린촐로 트래킹","(동굴, 눈이 좋아지는 약수 등)","숙소 도착 (저녁식사 및 휴식)"],
      stay:{name:"여행자 캠프", tags:["전기 제한","샤워 제한","인터넷 O"]}, meals:["캠프식","현지식당","캠프식"] },
    "울란바토르 복귀·출국": {
      dest:"울란바토르", move:"이동 6시간", dist:"(350 km)",
      items:["아침식사 후 울란바토르로 출발","점심식사 (The bull 샤브샤브)","울란바토르 시내투어 (희망장소)","공항 드랍 후 투어종료"],
      stay:{name:"숙소미포함", tags:[]}, meals:["캠프식","샤브샤브","X"] },
    "테를지 승마·유목민 체험": {
      dest:"테를지", move:"이동 소량", dist:"(공원 내)",
      items:["아침식사 후 승마 트레킹","유목민 게르 방문 (아이락 시음)","점심식사","자유시간 / 하이킹","캠프파이어 & 별관측"],
      stay:{name:"여행자 캠프", tags:["전기 O","샤워 O"]}, meals:["캠프식","현지식당","캠프식"] },
    "칭기즈칸 기마상·테를지 (도착일)": {
      dest:"칭기즈칸기마상<br>테를지", move:"이동 2시간", dist:"(80 km)",
      items:["공항 미팅 후 여행시작","칭기즈칸 기마상 전망대","테를지 국립공원 이동","거북바위 / 아리야발 사원","게르 캠프 체크인 (저녁식사)"],
      stay:{name:"여행자 캠프", tags:["전기 O","샤워 O"]}, meals:["기내식","현지식당","캠프식"] },
    "홉스골 호수 액티비티": {
      dest:"홉스골", move:"호수 일대", dist:"",
      items:["아침식사 후 호수 트레킹","카약 또는 보트 체험","점심식사","승마 / 자유시간","캠프파이어 & 별관측"],
      stay:{name:"호숫가 캠프", tags:["전기 O","샤워 O"]}, meals:["캠프식","현지식당","캠프식"] },
  },
};

/* ═══════════════════════════════════════════════════════════════
   명소 라이브러리 읽기/쓰기 (관리자 "명소 관리"에서 편집)
   ---------------------------------------------------------------
   · getSpots()  : 관리자가 편집한 내용이 있으면 그것을, 없으면 위 기본값
   · saveSpots() : 편집 내용을 브라우저에 저장
   견적서·지도·편집기가 모두 이 함수를 통해 같은 명소를 봅니다.
   ═══════════════════════════════════════════════════════════════ */
window.getSpots = function () {
  try {
    const saved = JSON.parse(localStorage.getItem("leaders_spots") || "null");
    if (saved && typeof saved === "object") return saved;
  } catch (e) {}
  return window.PRESETS.spots;
};
window.saveSpots = function (obj) {
  localStorage.setItem("leaders_spots", JSON.stringify(obj));
  return window.cloudPush ? window.cloudPush("spots", obj) : Promise.resolve({ ok: false, local: true });
};

/* ───────────────────────────────────────────────────────────────
   명소 카테고리(지역/여행지) 목록 읽기/쓰기
   · 각 명소의 s.region 값이 어느 카테고리에 속하는지를 나타냅니다.
   · 예전에는 고비/중앙/북부/서부 4개 고정이었지만, 이제 자유롭게
     추가·이름변경·삭제할 수 있습니다. (순서·빈 카테고리 보존용 목록)
   ─────────────────────────────────────────────────────────────── */
window.DEFAULT_SPOT_CATS = ["고비", "중앙", "북부", "서부"];
window.getSpotCats = function () {
  try {
    const saved = JSON.parse(localStorage.getItem("leaders_spot_cats") || "null");
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  return window.DEFAULT_SPOT_CATS.slice();
};
window.saveSpotCats = function (arr) {
  const a = Array.isArray(arr) ? arr : [];
  localStorage.setItem("leaders_spot_cats", JSON.stringify(a));
  return window.cloudPush ? window.cloudPush("spot_cats", a) : Promise.resolve({ ok: false, local: true });
};

/* ═══════════════════════════════════════════════════════════════
   코스(일정 프리셋) 읽기/쓰기 (관리자 "코스 관리"에서 편집)
   ---------------------------------------------------------------
   · getCourses()  : 관리자가 편집한 내용이 있으면 그것을, 없으면 위 기본값
   · saveCourses() : 편집 내용을 브라우저에 저장
   견적서 만들기의 "코스 불러오기"가 이 함수를 통해 코스를 봅니다.
   ═══════════════════════════════════════════════════════════════ */
window.getCourses = function () {
  try {
    const saved = JSON.parse(localStorage.getItem("leaders_courses") || "null");
    if (saved && typeof saved === "object") return saved;
  } catch (e) {}
  return window.PRESETS.courses;
};
window.saveCourses = function (obj) {
  localStorage.setItem("leaders_courses", JSON.stringify(obj));
  return window.cloudPush ? window.cloudPush("courses", obj) : Promise.resolve({ ok: false, local: true });
};

/* ═══════════════════════════════════════════════════════════════
   일정 조각(하루 일정) 읽기/쓰기 (관리자 "일정 관리"에서 편집)
   견적서 만들기의 각 일자 "일정 불러오기"가 이 함수를 사용합니다.
   ═══════════════════════════════════════════════════════════════ */
window.getSnippets = function () {
  try {
    const saved = JSON.parse(localStorage.getItem("leaders_snippets") || "null");
    if (saved && typeof saved === "object") return saved;
  } catch (e) {}
  return window.PRESETS.snippets;
};
window.saveSnippets = function (obj) {
  localStorage.setItem("leaders_snippets", JSON.stringify(obj));
  return window.cloudPush ? window.cloudPush("snippets", obj) : Promise.resolve({ ok: false, local: true });
};

/* ───────────────────────────────────────────────────────────────
   일정 카테고리(지역) 목록 읽기/쓰기
   · 각 일정 조각의 s.cat 값이 어느 카테고리(지역)에 속하는지를 나타냅니다.
   · 이 배열은 카테고리 순서와 "비어있는 카테고리"까지 보존하기 위한 목록입니다.
   ─────────────────────────────────────────────────────────────── */
window.getSnippetCats = function () {
  try {
    const saved = JSON.parse(localStorage.getItem("leaders_snippet_cats") || "null");
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  return [];
};
window.saveSnippetCats = function (arr) {
  const a = Array.isArray(arr) ? arr : [];
  localStorage.setItem("leaders_snippet_cats", JSON.stringify(a));
  return window.cloudPush ? window.cloudPush("snippet_cats", a) : Promise.resolve({ ok: false, local: true });
};

/* ═══════════════════════════════════════════════════════════════
   예약 리소스 라이브러리 (가이드·숙소·차량) 읽기/쓰기
   관리자 "리소스 관리"에서 편집 — 예약관리 배정과 고객 확정안내가 사용합니다.
   ═══════════════════════════════════════════════════════════════ */
const _libGet = (lsKey) => {
  try {
    const saved = JSON.parse(localStorage.getItem(lsKey) || "null");
    if (saved && typeof saved === "object") return saved;
  } catch (e) {}
  return {};
};
window.getGuides = () => _libGet("leaders_guides");
window.saveGuides = (obj) => {
  localStorage.setItem("leaders_guides", JSON.stringify(obj));
  return window.cloudPush ? window.cloudPush("guides", obj) : Promise.resolve({ ok: false, local: true });
};
window.getDrivers = () => _libGet("leaders_drivers");
window.saveDrivers = (obj) => {
  localStorage.setItem("leaders_drivers", JSON.stringify(obj));
  return window.cloudPush ? window.cloudPush("drivers", obj) : Promise.resolve({ ok: false, local: true });
};
window.getLodges = () => _libGet("leaders_lodges");
window.saveLodges = (obj) => {
  localStorage.setItem("leaders_lodges", JSON.stringify(obj));
  return window.cloudPush ? window.cloudPush("lodges", obj) : Promise.resolve({ ok: false, local: true });
};
window.getVehicles = () => _libGet("leaders_vehicles");
window.saveVehicles = (obj) => {
  localStorage.setItem("leaders_vehicles", JSON.stringify(obj));
  return window.cloudPush ? window.cloudPush("vehicles", obj) : Promise.resolve({ ok: false, local: true });
};

/* ═══════════════════════════════════════════════════════════════
   서버 영구 저장 동기화 (Cloudflare D1 · /api/data/:key)
   ---------------------------------------------------------------
   · 지금까지 명소·코스·일정은 이 브라우저(localStorage)에만 저장돼,
     다른 기기/브라우저에서는 보이지 않았습니다.
   · 이제 저장하면 서버로 올라가고(cloudPush), 페이지를 열 때
     서버에서 받아옵니다(cloudReady). localStorage는 캐시/오프라인 대비.
   · 명소 이미지는 이미 R2에 WebP로 업로드되고, 그 공개 URL이
     이 라이브러리에 함께 저장되므로 이미지까지 영구 보존됩니다.
   ═══════════════════════════════════════════════════════════════ */
window.CLOUD_KEYS = {
  spots: "leaders_spots",
  spot_cats: "leaders_spot_cats",
  courses: "leaders_courses",
  snippets: "leaders_snippets",
  snippet_cats: "leaders_snippet_cats",
  guides: "leaders_guides",
  drivers: "leaders_drivers",
  lodges: "leaders_lodges",
  vehicles: "leaders_vehicles",
};

// 서버에서 마지막으로 받은 각 키의 updatedAt — 동시 편집 충돌 감지용
window.CLOUD_META = {};

// 서버에서 한 종류를 받아 localStorage에 반영. 성공 시 데이터, 없거나 실패 시 null.
window.cloudPull = async function (key) {
  const lsKey = window.CLOUD_KEYS[key];
  if (!lsKey) return null;
  try {
    const adminToken = sessionStorage.getItem("leaders_admin_token") || "";
    const r = await fetch("/api/data/" + key, {
      cache: "no-store",
      headers: adminToken ? { "x-admin-token": adminToken } : {},
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (j && j.ok) {
      window.CLOUD_META[key] = j.updatedAt || "";   // 이 시점 기준으로 충돌 검사
      if (j.data != null) {
        localStorage.setItem(lsKey, JSON.stringify(j.data));
        return j.data;
      }
    }
  } catch (e) { /* 서버 없음(로컬 데모) 또는 네트워크 오류 → localStorage 유지 */ }
  return null;
};

// 서버에 저장(관리자 토큰 필요). {ok, ...} 반환.
// 다른 기기/탭이 먼저 저장했으면(409) 덮어쓸지 물어보고, 취소하면 저장을 중단합니다.
window.cloudPush = async function (key, obj) {
  if (!window.CLOUD_KEYS[key]) return { ok: false, error: "unknown key" };
  const token = sessionStorage.getItem("leaders_admin_token") || "";
  if (!token) return { ok: false, error: "no-token", local: true };
  // 토큰은 URL에 남지 않도록 헤더로 전달 (base/force는 쿼리 유지)
  const put = (qs) => fetch("/api/data/" + key + (qs ? "?" + qs : ""), {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify(obj),
  });
  try {
    const base = window.CLOUD_META[key];
    let r = await put(base !== undefined ? "base=" + encodeURIComponent(base) : "");
    if (r.status === 409) {
      const ow = confirm("다른 기기(또는 다른 탭)에서 먼저 저장한 내용이 있어요.\n\n[확인] 지금 화면의 내용으로 덮어쓰기\n[취소] 저장 중단 — 새로고침해서 최신 내용을 확인하세요");
      if (!ow) return { ok: false, conflict: true, error: "다른 기기에서 먼저 저장했어요. 새로고침 후 다시 작업해 주세요." };
      r = await put("force=1");
    }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) return { ok: false, error: "관리자 인증이 만료됐어요. 관리자 페이지에서 다시 로그인해 주세요." };
    if (!j.ok) return { ok: false, error: j.error || "서버 저장 실패" };
    window.CLOUD_META[key] = j.updatedAt || "";
    return j;
  } catch (e) {
    return { ok: false, error: String(e), local: true };
  }
};

// 페이지 로드 시: 서버에서 모든 라이브러리를 받아 localStorage에 채웁니다.
// 각 페이지는 `await window.cloudReady` 후에 렌더링하면 서버 데이터를 반영합니다.
window.cloudReady = (async function () {
  await Promise.all(Object.keys(window.CLOUD_KEYS).map((k) => window.cloudPull(k)));
  try { window.dispatchEvent(new Event("cloud-ready")); } catch (e) {}
})();
