async function runGuidebookReminder(env) {
  if (!env.GUIDEBOOK_CRON_SECRET) throw new Error("GUIDEBOOK_CRON_SECRET is not set");
  const base = String(env.CUSTOMER_BASE_URL || "https://mongolia-milkyway.com").replace(/\/+$/, "");
  const response = await fetch(`${base}/api/guidebook-reminders`, {
    method:"POST",
    headers:{ "x-cron-secret":env.GUIDEBOOK_CRON_SECRET, "Content-Type":"application/json" },
  });
  const body = await response.json().catch(() => ({ ok:false, error:"invalid response" }));
  if (!response.ok || !body.ok) {
    throw new Error(`Guidebook reminder failed (${response.status}): ${JSON.stringify(body)}`);
  }
  console.log(JSON.stringify({ event:"guidebook_reminder_complete", ...body }));
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runGuidebookReminder(env));
  },
};

export { runGuidebookReminder };
