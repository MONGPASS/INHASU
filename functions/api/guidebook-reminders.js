import {
  canSendKakao, guidebookTemplateId, notifyCustomerGuidebook,
} from "./_solapi.js";
import { guidebookEligibility, kstDateString } from "./_guidebook-reminder.mjs";

const json = (obj, status = 200) => new Response(JSON.stringify(obj, null, 2), {
  status, headers:{ "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" },
});

const authorized = (request, env) => {
  const cronSecret = request.headers.get("x-cron-secret") || "";
  const adminToken = request.headers.get("x-admin-token") || "";
  return !!((env.GUIDEBOOK_CRON_SECRET && cronSecret === env.GUIDEBOOK_CRON_SECRET) ||
    (env.ADMIN_TOKEN && adminToken === env.ADMIN_TOKEN));
};

const changes = result => Number(result?.meta?.changes ?? result?.changes ?? 0);

export async function onRequestPost({ request, env }) {
  if (!authorized(request, env)) return json({ ok:false, error:"unauthorized" }, 401);
  if (!env.DB) return json({ ok:false, error:"DB binding not set" }, 500);

  const today = kstDateString();
  const rows = await env.DB.prepare(
    "SELECT id, data, status FROM requests WHERE status = ? ORDER BY received_at ASC"
  ).bind("예약확정").all();
  const summary = { ok:true, today, targetWindowDays:7, checked:0, sent:0, skipped:0, failed:0, results:[] };

  for (const row of rows.results || []) {
    summary.checked += 1;
    let rec;
    try { rec = JSON.parse(row.data || "{}"); }
    catch {
      summary.failed += 1;
      summary.results.push({ id:row.id, status:"failed", reason:"invalid_json" });
      continue;
    }

    const eligibility = guidebookEligibility(rec, row.status, today);
    if (!eligibility.eligible) {
      summary.skipped += 1;
      summary.results.push({ id:row.id, status:"skipped", reason:eligibility.reason });
      continue;
    }
    if (!canSendKakao(env, { phone:rec.phone, templateId:guidebookTemplateId(env) })) {
      summary.skipped += 1;
      summary.results.push({ id:row.id, status:"skipped", reason:"notification_not_configured" });
      continue;
    }

    const originalData = row.data;
    const claimedAt = new Date().toISOString();
    rec.notify = rec.notify && typeof rec.notify === "object" ? rec.notify : {};
    rec.notify.guidebookClaimedAt = claimedAt;
    rec.notify.guidebookClaimDepartureDate = rec.depart;
    const claimedData = JSON.stringify(rec);
    const claimResult = await env.DB.prepare(
      "UPDATE requests SET data = ? WHERE id = ? AND data = ?"
    ).bind(claimedData, row.id, originalData).run();
    if (changes(claimResult) !== 1) {
      summary.skipped += 1;
      summary.results.push({ id:row.id, status:"skipped", reason:"concurrent_update" });
      continue;
    }

    let sendResult;
    try {
      sendResult = await notifyCustomerGuidebook(env, {
        phone:rec.phone, name:rec.name, depart:rec.depart,
      });
    } catch (error) {
      sendResult = { ok:false, error:String(error?.message || error) };
    }

    if (!sendResult?.ok) {
      delete rec.notify.guidebookClaimedAt;
      delete rec.notify.guidebookClaimDepartureDate;
      await env.DB.prepare("UPDATE requests SET data = ? WHERE id = ? AND data = ?")
        .bind(JSON.stringify(rec), row.id, claimedData).run();
      summary.failed += 1;
      summary.ok = false;
      summary.results.push({ id:row.id, status:"failed", reason:sendResult?.reason || sendResult?.error || "send_failed" });
      continue;
    }

    const sentAt = new Date().toISOString();
    rec.notify.guidebookSentAt = sentAt;
    rec.notify.guidebookDepartureDate = rec.depart;
    delete rec.notify.guidebookClaimedAt;
    delete rec.notify.guidebookClaimDepartureDate;
    rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
    rec.activities.push({ at:sentAt, type:"guidebook_notification_sent", detail:"출발 7일 전 투어 가이드북 알림톡 발송" });
    rec.activities = rec.activities.slice(-100);
    const saveResult = await env.DB.prepare("UPDATE requests SET data = ? WHERE id = ? AND data = ?")
      .bind(JSON.stringify(rec), row.id, claimedData).run();
    if (changes(saveResult) !== 1) {
      summary.failed += 1;
      summary.ok = false;
      summary.results.push({ id:row.id, status:"failed", reason:"sent_but_marker_not_saved" });
      continue;
    }
    summary.sent += 1;
    summary.results.push({ id:row.id, status:"sent", daysUntil:eligibility.daysUntil });
  }

  return json(summary, summary.ok ? 200 : 207);
}
