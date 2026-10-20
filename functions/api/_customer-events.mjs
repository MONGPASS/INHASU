// Internal bridge for legacy Pages handlers. Business records are always saved
// before calling it; notification failures cannot turn that save into an error.
import { dispatchCustomerNotification } from '../lib/customerNotifications.ts';
import { recordTravelNoticeSent, travelNoticeState } from './_travel-notice.mjs';

export async function customerEvent(context, input) {
  try { return await dispatchCustomerNotification(context.env, input); }
  catch { return { ok:false, state:'failed', error:'알림 발송 이력을 준비하지 못해 발송하지 않았습니다.' }; }
}

export async function backgroundCustomerEvent(context, input, after) {
  const task = Promise.resolve().then(() => customerEvent(context, input)).then(async result => {
    if (after) await after(result);
    return result;
  }).catch(() => ({ ok:false, state:'unknown', error:'알림 처리 결과를 확인해 주세요.' }));
  if (typeof context.waitUntil === 'function') {
    try { context.waitUntil(task); return; } catch { /* Runtime without a usable background context. */ }
  }
  return await task;
}

/** Keep the old notify/activity contract without overwriting a concurrent
 * signature, traveler submission, payment edit, or token rotation. */
export async function recordTravelNoticeOutcome(env, id, result, trigger) {
  if (result.duplicate) return { marked:false };
  for (let retry = 0; retry < 3; retry++) {
    const row = await env.DB.prepare('SELECT data FROM requests WHERE id = ?').bind(id).first();
    if (!row) return { marked:false };
    const rec = JSON.parse(row.data || '{}');
    if (result.ok && result.state === 'accepted') {
      recordTravelNoticeSent(rec, { at:new Date().toISOString(), trigger });
    } else {
      rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
      rec.activities.push({ at:new Date().toISOString(), type:'travel_notice_failed', detail:result.state === 'unknown'
        ? '여행 주의사항 발송 결과 확인 필요 · 재발송 전 발송 이력을 확인하세요.'
        : `여행 주의사항 발송 실패 (${String(result.error || '발송 설정을 확인해 주세요.').slice(0, 300)})` });
      rec.activities = rec.activities.slice(-100);
    }
    const saved = await env.DB.prepare('UPDATE requests SET data = ? WHERE id = ? AND data = ?').bind(JSON.stringify(rec), id, row.data).run();
    if (Number(saved?.meta?.changes ?? saved?.changes ?? 0) === 1) return { marked:true, rec, state:travelNoticeState(rec) };
  }
  return { marked:false };
}
