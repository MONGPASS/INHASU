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
