const text = (value, max = 100) => String(value || "").trim().slice(0, max);

export function travelerTypes(counts = {}) {
  const out = [];
  [["성인", counts.adult], ["아동", counts.child], ["유아", counts.infant]].forEach(([type, count]) => {
    const n = Math.max(0, Math.min(30, Number(count) || 0));
    for (let i = 0; i < n; i += 1) out.push(type);
  });
  return out;
}

const validDate = value => {
  const normalized = text(value, 10).replace(/[./]/g, "-");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  const date = new Date(normalized + "T00:00:00Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) return "";
  if (date > new Date()) return "";
  return normalized;
};

/* "4:30" "0430" "04:30:00" → "04:30" (24시간). 형식이 틀리면 null */
const time24 = value => {
  const v = text(value, 8).replace(/[.시\s]/g, ":").replace(/:+/g, ":").replace(/:$/, "");
  const m = v.match(/^(\d{1,2}):?(\d{2})(?::\d{2})?$/) || v.match(/^(\d{2})(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]), minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const TIME_FIELDS = {
  inDepTime: "몽골 도착 항공권의 출발시간",
  inTime: "몽골 도착 항공권의 도착시간",
  outTime: "몽골 출발 항공권의 출발시간",
  outArrTime: "몽골 출발 항공권의 도착시간",
};
const NO_FIELDS = { inNo: "몽골 도착 항공편명", outNo: "몽골 출발 항공편명" };

/* 고객이 여행자 정보와 함께 적는 항공권·픽업 숙소·특이사항.
   전부 선택 입력(발권 전일 수 있음) — 적었을 때만 형식을 검사한다. */
export function sanitizeTripInfo(input = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const rawFlight = raw.flight && typeof raw.flight === "object" ? raw.flight : {};
  const flight = {};

  for (const [key, label] of Object.entries(TIME_FIELDS)) {
    const value = text(rawFlight[key], 8);
    if (!value) { flight[key] = ""; continue; }
    const parsed = time24(value);
    if (!parsed) return { ok:false, error:`${label}을 24시간 기준으로 입력해 주세요. (예: 04:30, 20:30)` };
    flight[key] = parsed;
  }
  for (const [key, label] of Object.entries(NO_FIELDS)) {
    const value = text(rawFlight[key], 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value && !/^[A-Z0-9]{3,8}$/.test(value)) return { ok:false, error:`${label}을 확인해 주세요. (예: OM310)` };
    flight[key] = value;
  }
  return {
    ok: true,
    flight,
    pickupLodge: text(raw.pickupLodge, 80),
    travelerNote: text(raw.travelerNote, 500),
  };
}

export function sanitizeTravelers(input, counts = {}) {
  const types = travelerTypes(counts);
  if (!types.length) return { ok:false, error:"예약 인원 정보가 없습니다." };
  if (!Array.isArray(input) || input.length !== types.length) {
    return { ok:false, error:`여행자 ${types.length}명의 정보를 모두 입력해 주세요.` };
  }

  const travelers = [];
  for (let i = 0; i < types.length; i += 1) {
    const raw = input[i] || {};
    const type = types[i];
    const nameKo = text(raw.nameKo, 40);
    const passportName = text(raw.passportName, 60).toUpperCase().replace(/\s+/g, " ");
    const birth = validDate(raw.birth);
    const phone = text(raw.phone, 20).replace(/\D/g, "");
    const gender = text(raw.gender, 2);
    const passportNo = text(raw.passportNo, 20).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const label = `${i + 1}번째 ${type}`;

    if (nameKo.length < 2) return { ok:false, error:`${label}의 한글 이름을 입력해 주세요.` };
    if (!/^[A-Z][A-Z '\-]{1,59}$/.test(passportName)) return { ok:false, error:`${label}의 여권 영문명을 여권과 동일하게 입력해 주세요.` };
    if (!birth) return { ok:false, error:`${label}의 생년월일을 확인해 주세요.` };
    if (type === "성인" && !/^\d{9,11}$/.test(phone)) return { ok:false, error:`${label}의 연락처를 확인해 주세요.` };
    if (phone && !/^\d{9,11}$/.test(phone)) return { ok:false, error:`${label}의 연락처를 확인해 주세요.` };
    if (!["남", "여"].includes(gender)) return { ok:false, error:`${label}의 성별을 선택해 주세요.` };
    if (!/^[A-Z0-9]{5,20}$/.test(passportNo)) return { ok:false, error:`${label}의 여권번호를 확인해 주세요.` };

    travelers.push({ type, nameKo, passportName, birth, phone, gender, passportNo });
  }
  return { ok:true, travelers };
}
