import { notifyAdmin } from "../_solapi.js";
import { sanitizeTravelers, travelerTypes } from "../_travelers.mjs";

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers:{ "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" },
});

const getToken = params => Array.isArray(params.token) ? params.token[0] : params.token;
const publicSubmission = value => {
  const s = value && typeof value === "object" ? value : {};
  return {
    status:s.status || "not_requested", requestedAt:s.requestedAt || "",
    submittedAt:s.submittedAt || "", expectedCount:Number(s.expectedCount) || 0,
    submittedCount:Number(s.submittedCount) || 0,
  };
};

async function findRecord(env, token) {
  if (!token || String(token).length < 16) return null;
  return env.DB.prepare("SELECT id, data, status FROM requests WHERE token = ?").bind(token).first();
}

export async function onRequestGet({ env, params }) {
  try {
    const row = await findRecord(env, getToken(params));
    if (!row) return json({ ok:false, error:"존재하지 않거나 만료된 링크입니다." }, 404);
    const rec = JSON.parse(row.data || "{}");
    if (!rec.booking) return json({ ok:false, error:"담당자가 예약 준비를 시작한 뒤 입력할 수 있습니다." }, 409);
    const types = travelerTypes(rec);
    return json({
      ok:true, name:rec.name || "", destination:rec.destination || "", depart:rec.depart || "", return_:rec.return_ || "",
      types, travelers:Array.isArray(rec.booking.travelers) ? rec.booking.travelers.map(t => ({
        type:t.type || "", nameKo:t.nameKo || "", passportName:t.passportName || "", birth:t.birth || "",
        phone:t.phone || "", gender:t.gender || "", passportNo:t.passportNo || "",
      })) : [],
      submission:publicSubmission(rec.booking.travelerSubmission),
    });
  } catch (e) {
    return json({ ok:false, error:String(e) }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  try {
    if (Number(request.headers.get("content-length") || 0) > 50000) return json({ ok:false, error:"입력 내용이 너무 큽니다." }, 413);
    const row = await findRecord(env, getToken(params));
    if (!row) return json({ ok:false, error:"존재하지 않거나 만료된 링크입니다." }, 404);
    const rec = JSON.parse(row.data || "{}");
    if (!rec.booking) return json({ ok:false, error:"담당자가 예약 준비를 시작한 뒤 입력할 수 있습니다." }, 409);
    const body = await request.json();
    if (body.consent !== true) return json({ ok:false, error:"개인정보 수집·이용에 동의해 주세요." }, 400);
    const checked = sanitizeTravelers(body.travelers, rec);
    if (!checked.ok) return json(checked, 400);

    const now = new Date().toISOString();
    rec.booking.travelers = checked.travelers;
    rec.booking.travelerSubmission = {
      ...(rec.booking.travelerSubmission || {}), status:"submitted", submittedAt:now,
      expectedCount:checked.travelers.length, submittedCount:checked.travelers.length, source:"customer",
    };
    rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
    rec.activities.push({ at:now, type:"travelers_submitted", detail:`고객이 여행자 정보 ${checked.travelers.length}명 제출` });
    rec.activities = rec.activities.slice(-100);
    await env.DB.prepare("UPDATE requests SET data = ? WHERE id = ?").bind(JSON.stringify(rec), row.id).run();

    const adminText = `[몽골리아 은하수] ${rec.name || "고객"}님이 여행자 정보 ${checked.travelers.length}명 제출을 완료했습니다. 관리자 예약관리에서 확인해 주세요.`;
    if (context.waitUntil) context.waitUntil(notifyAdmin(env, adminText).catch(() => null));
    return json({ ok:true, submission:publicSubmission(rec.booking.travelerSubmission) });
  } catch (e) {
    return json({ ok:false, error:String(e) }, 500);
  }
}
