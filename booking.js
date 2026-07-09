/* ══════════ 예약(booking) 공유 로직 ══════════
   admin.html(예약확정 트리거)과 예약관리.html이 같은 "정답 모양"을 쓰도록 한 곳에 모음.
   두 화면이 각자 booking을 만들면 시간이 지나며 구조가 어긋나므로(=흐름이 끊기는 원인),
   틀·정규화·견적 승계 로직을 여기 한 곳에서만 정의한다.
     - blankBooking / normBooking : booking 객체의 표준 틀·정규화 (구버전 데이터 호환)
     - daysFromQuote              : 발행 견적의 일정(days)을 확정 일정으로 복사
     - seedBookingFromQuote       : 예약확정 순간, 견적에서 booking 스켈레톤을 만들어 승계 */

function blankBooking() {
  return {
    confirmedAt: new Date().toISOString().slice(0, 10),
    days: [],
    assign: { guide:{name:"",nameEn:"",role:"",phone:"",qr:"",img:"",desc:""},
              vehicle:{model:"",seats:"",plate:"",img:"",imgs:[],desc:""}, lodges:[] },
    travelers: [],
    flight: { inDate:"", inTime:"", inNo:"", outDate:"", outTime:"", outNo:"" },
    contractInfo: { productName:"", region:"", totalAmount:0, depositAmount:0, depositStatus:"미입금", balanceAmount:0, balanceStatus:"미수령", cashReceipt:"", note:"" },
    checklist: { deposit:false, balance:false, flight:false, insurance:false, contract:false },
    contract: null,   // 고객 서명 시 서버(/api/sign)가 채움 — {signedAt, signImg, snapshot…}
    highlights: [],   // 대표 명소 — 확정일정표 "대표 명소" 페이지에 노출 {nameMn,name,desc,img,subImgs}
    notes: "", adminMemo: "",
  };
}

// 저장돼 있던 booking + 빈 틀 병합 (구버전 데이터 호환)
function normBooking(b) {
  const base = blankBooking();
  if (!b) return base;
  return { ...base, ...b,
    assign: { ...base.assign, ...(b.assign || {}),
      guide: { ...base.assign.guide, ...((b.assign||{}).guide || {}) },
      vehicle: { ...base.assign.vehicle, ...((b.assign||{}).vehicle || {}) },
      lodges: Array.isArray((b.assign||{}).lodges) ? b.assign.lodges : [] },
    travelers: Array.isArray(b.travelers) ? b.travelers : [],
    flight: { ...base.flight, ...(b.flight || {}) },
    contractInfo: { ...base.contractInfo, ...(b.contractInfo || {}) },
    checklist: { ...base.checklist, ...(b.checklist || {}) },
    highlights: Array.isArray(b.highlights) ? b.highlights : [],
  };
}

// 견적 일정 → 확정 일정 복사 (견적서 days 구조 그대로)
const daysFromQuote = q => (q && Array.isArray(q.days)) ? JSON.parse(JSON.stringify(q.days)) : [];

/* 예약확정 순간 호출 — 발행된 견적(rec.quote)과 문의 레코드 기본정보에서 booking 스켈레톤 생성.
   예약관리 init()의 승계 규칙과 동일하되, 견적 일정·대표명소를 자동으로 끌어온다
   (예약관리에서 "↺ 견적 일정 불러오기"를 누르지 않아도 확정 시점에 일정이 채워지게).
   rec: 문의 레코드 { quote, finance, destination, depart, return_, ... } */
function seedBookingFromQuote(rec) {
  rec = rec || {};
  const bk = blankBooking();
  const fin = rec.finance || {};
  const q = rec.quote || null;
  bk.days = daysFromQuote(q);
  if (q && Array.isArray(q.highlights)) bk.highlights = JSON.parse(JSON.stringify(q.highlights));
  bk.contractInfo = {
    ...bk.contractInfo,
    productName: rec.destination || "",
    region: rec.destination || "",
    totalAmount: fin.salesAmount || 0,
    depositAmount: fin.depositAmount || 0,
    depositStatus: fin.depositStatus || "미입금",
    balanceAmount: fin.balanceAmount || 0,
    balanceStatus: fin.balanceStatus || "미수령",
    cashReceipt: fin.cashReceipt || "",
  };
  bk.flight = { ...bk.flight, inDate: rec.depart || "", outDate: rec.return_ || "" };
  return bk;
}
