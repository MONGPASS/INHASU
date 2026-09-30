import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../admin-mobile.html", import.meta.url), "utf8");
const source = html.slice(html.indexOf("function inquirySheet(r)"), html.indexOf("App.setStatus ="));
function screen(record, options = {}) {
  const calls = [];
  const ctx = vm.createContext({
    App: {}, STATUSES: [], recById: () => record,
    customerTimeline: () => [], nextAction: () => null, paxTotal: () => 1,
    rowDays: () => "일정 미정", esc: v => String(v ?? ""), dotDate: v => v,
    icon: () => "", isAccepted: r => r.decision?.status === "accepted",
    appConfirm: async () => options.confirm !== false,
    seedBookingFromQuote: () => ({ contractInfo: { depositAmount: options.deposit ?? 50000 } }),
    apiPatch: async (id, patch) => {
      calls.push({ id, patch });
      if (options.fail) throw new Error("저장 실패");
      return {};
    },
    applyPatchLocal: (r, patch) => Object.assign(r, patch),
    toast: () => {}, render: () => {},
  });
  vm.runInContext(source, ctx);
  return { ctx, calls, render: () => ctx.inquirySheet(record) };
}

test("mobile inquiry offers booking acceptance only for an unaccepted quote", () => {
  for (const [record, visible] of [
    [{ id: "1", quote: {} }, true],
    [{ id: "1" }, false],
    [{ id: "1", quote: {}, decision: { status: "accepted" } }, false],
    [{ id: "1", quote: {}, status: "예약확정" }, false],
  ]) {
    assert.equal(screen(record).render().includes("✅ 예약 진행 기록"), visible);
  }
});

test("mobile acceptance saves the decision and deposit guidance together", async () => {
  const record = { id: "1", quote: {} };
  const { ctx, calls } = screen(record);
  await ctx.App.inqRecordAccept("1");
  assert.equal(calls.length, 1);
  assert.equal(record.decision.status, "accepted");
  assert.equal(record.decision.source, "admin");
  assert.equal(record.booking.depositRequest.status, "requested");
  assert.equal(record.booking.depositRequest.source, "admin_accept");
  assert.equal(record.booking.depositRequest.requestedAt, record.decision.acceptedAt);
});

test("acceptance preserves existing booking and skips zero-deposit booking creation", async () => {
  const booking = { contractInfo: { depositAmount: 123 }, note: "보존" };
  for (const record of [{ id: "1", quote: {}, booking }, { id: "2", quote: {} }]) {
    const { ctx, calls } = screen(record, { deposit: 0 });
    await ctx.App.inqRecordAccept(record.id);
    assert.equal(calls[0].patch.booking, undefined);
    assert.equal(record.booking, record.id === "1" ? booking : undefined);
  }
});

test("cancel and failed save do not change the customer's local state", async () => {
  for (const options of [{ confirm: false }, { fail: true }]) {
    const record = { id: "1", quote: {} };
    const { ctx, calls } = screen(record, options);
    await ctx.App.inqRecordAccept("1");
    assert.equal(record.decision, undefined);
    assert.equal(record.booking, undefined);
    assert.equal(calls.length, options.fail ? 1 : 0);
  }
});

test("all mobile inline scripts parse", () => {
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    assert.doesNotThrow(() => new vm.Script(match[1]));
  }
});
