/* ══════════ 예약(booking) 공유 로직 ══════════
   admin.html(예약확정 트리거)과 예약관리.html이 같은 "정답 모양"을 쓰도록 한 곳에 모음.
   두 화면이 각자 booking을 만들면 시간이 지나며 구조가 어긋나므로(=흐름이 끊기는 원인),
   틀·정규화·견적 승계 로직을 여기 한 곳에서만 정의한다.
     - blankBooking / normBooking : booking 객체의 표준 틀·정규화 (구버전 데이터 호환)
     - daysFromQuote              : 발행 견적의 일정(days)을 확정 일정으로 복사
     - seedBookingFromQuote       : 예약확정 순간, 견적에서 booking 스켈레톤을 만들어 승계 */

function blankBooking() {
  return {
    confirmedAt: "",
    publishStatus: "draft",
    publishedAt: "",
    days: [],
    assign: { guide:{name:"",nameEn:"",role:"",phone:"",qr:"",img:"",desc:""},
              vehicle:{model:"",seats:"",plate:"",img:"",imgs:[],desc:""}, lodges:[] },
    travelers: [],
    travelerSubmission: { status:"not_requested", requestedAt:"", submittedAt:"", expectedCount:0, submittedCount:0 },
    flight: { inDate:"", inTime:"", inNo:"", outDate:"", outTime:"", outNo:"" },
    contractInfo: { productName:"", region:"", totalAmount:0, depositAmount:0, depositStatus:"미입금", balanceAmount:0, balanceStatus:"미수령", cashReceipt:"", note:"" },
    checklist: { deposit:false, balance:false, flight:false, insurance:false, contract:false },
    contract: null,   // 고객 서명 시 서버(/api/sign)가 채움 — {signedAt, signImg, snapshot…}
    highlights: [],   // 대표 명소 — 확정일정표 "대표 명소" 페이지에 노출 {nameMn,name,desc,img,subImgs}
    notes: "", adminMemo: "",
    autoSeeded: false,  // 예약확정 시 견적에서 자동 생성만 된 상태 여부 (예약관리에서 저장하면 false로 해제)
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
    travelerSubmission: { ...base.travelerSubmission, ...(b.travelerSubmission || {}) },
    flight: { ...base.flight, ...(b.flight || {}) },
    contractInfo: { ...base.contractInfo, ...(b.contractInfo || {}) },
    checklist: { ...base.checklist, ...(b.checklist || {}) },
    highlights: Array.isArray(b.highlights) ? b.highlights : [],
  };
}

// 견적 일정 → 확정 일정 복사 (견적서 days 구조 그대로)
const daysFromQuote = q => (q && Array.isArray(q.days)) ? JSON.parse(JSON.stringify(q.days)) : [];

// 잔금 2단계: economy=실속형(일반게르), full=풀패키지(고급게르). 구버전 {amount} 호환 (견적서와 동일)
const balEco  = b => (b && b.economy != null ? b.economy : ((b && b.amount) || 0));
const balFull = b => (b && b.full    != null ? b.full    : ((b && b.amount) || 0));

/* 견적(quote.price)에서 계약 정산 금액을 계산.
   견적은 "1인 기준·인원별·티어별"이라 단일 총액이 저장돼 있지 않으므로 환산한다.
     예약금 = 1인 예약금 × 인원
     잔금   = 해당 인원의 잔금(티어) × 인원   (티어: 고급/풀패키지면 full, 아니면 실속형 economy)
     여행경비 = 예약금 + 잔금
   rec: 문의 레코드 { quote, adult/child/infant, pkgTier, gerStay, ... } */
function quoteMoney(rec) {
  rec = rec || {};
  const q = rec.quote || null;
  const p = q && q.price;
  if (!p) return { totalAmount: 0, depositAmount: 0, balanceAmount: 0 };
  const pax = Number(q.pax) || ((rec.adult||0)+(rec.child||0)+(rec.infant||0)) || 0;
  const isFull = /풀패키지|최고급|고급/.test(`${rec.pkgTier||""} ${rec.gerStay||""}`);
  const bals = Array.isArray(p.balances) ? p.balances : [];
  let row = bals.find(b => Number(b.pax) === pax);
  if (!row && bals.length) row = bals.reduce((a,b) => Math.abs(Number(b.pax)-pax) < Math.abs(Number(a.pax)-pax) ? b : a);
  const per = row ? (isFull ? balFull(row) : balEco(row)) : 0;
  const depositAmount = (Number(p.deposit) || 0) * pax;
  const balanceAmount = per * pax;
  return { totalAmount: depositAmount + balanceAmount, depositAmount, balanceAmount };
}

/* 예약확정 순간 호출 — 발행된 견적(rec.quote)과 문의 레코드 기본정보에서 booking 스켈레톤 생성.
   예약관리 init()의 승계 규칙과 동일하되, 견적 일정·대표명소를 자동으로 끌어온다
   (예약관리에서 "↺ 견적 일정 불러오기"를 누르지 않아도 확정 시점에 일정이 채워지게).
   rec: 문의 레코드 { quote, destination, depart, return_, ... } */
function seedBookingFromQuote(rec) {
  rec = rec || {};
  const bk = blankBooking();
  const q = rec.quote || null;
  const qm = quoteMoney(rec);
  bk.days = daysFromQuote(q);
  if (q && Array.isArray(q.highlights)) bk.highlights = JSON.parse(JSON.stringify(q.highlights));
  bk.contractInfo = {
    ...bk.contractInfo,
    productName: rec.destination || "",
    region: rec.destination || "",
    totalAmount: qm.totalAmount,
    depositAmount: qm.depositAmount,
    depositStatus: "미입금",
    balanceAmount: qm.balanceAmount,
    balanceStatus: "미수령",
  };
  bk.flight = { ...bk.flight, inDate: rec.depart || "", outDate: rec.return_ || "" };
  bk.autoSeeded = true;   // 확정 시 자동 생성만 된 상태 — 확정 해제(진행중/신규 복귀) 시 조용히 정리 가능
  return bk;
}
