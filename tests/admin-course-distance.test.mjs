import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const presets = read("public/presets.js");
const desktop = read("public/코스관리.html");
const mobile = read("public/견적관리-모바일.html");
const chunk = (source, start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from);
  return source.slice(from, to);
};

const window = {};
runInNewContext(chunk(presets, "window.CourseDistanceKm = ", "/* ═"), { window });
const CourseDistanceKm = window.CourseDistanceKm;
const valid = [[null, null], ["", null], ["  ", null], [0, 0], [" 720.50 ", 720.5], [1020, 1020]];
const invalid = ["-1", "2km", "1e2", "1,000", "0.123", Infinity, {}, "999999999999999999999"];
const copy = value => JSON.parse(JSON.stringify(value));
const original = { name: "테스트 코스", destination: "테를지", totalDistanceKm: 500, days: [{ d: 1, dest: "테를지", move: "2시간", dist: "(60 km)" }] };

test("optional km has explicit blank, zero, decimal and invalid states", () => {
  for (const [input, expected] of valid) assert.equal(CourseDistanceKm.parse(input), expected);
  for (const input of invalid) assert.ok(Number.isNaN(CourseDistanceKm.parse(input)));
  assert.equal(CourseDistanceKm.label(undefined), "거리 미입력");
  assert.equal(CourseDistanceKm.label(0), "0 km");
  assert.equal(CourseDistanceKm.label(1250.5), "1,250.5 km");
});

test("both course editors and their lists use the saved course-level value", () => {
  assert.match(desktop, /id="f_totalDistanceKm"[^\n]*c\.totalDistanceKm/);
  assert.match(mobile, /data-ce="totalDistanceKm"[^\n]*d\.totalDistanceKm/);
  for (const page of [desktop, mobile]) {
    assert.match(page, /CourseDistanceKm\.label\(c\.totalDistanceKm\)/);
    assert.match(page, /총 이동거리 \(km\)/);
  }
});

async function desktopSave(value) {
  let saved, focused = false;
  const fields = {
    saveBtn: {}, f_name: { value: original.name }, f_totalDistanceKm: { value, focus: () => { focused = true; } },
    f_dest: { value: original.destination }, f_nights: { value: "0박1일" }, f_vehicle: { value: "스타렉스" },
    f_price_deposit: { value: "50000" }, f_intensity: { value: "3" },
  };
  const COURSES = { [original.name]: copy(original) };
  const fn = runInNewContext(chunk(desktop, '$("saveBtn").onclick = ', '\n  const delEl').replace(/^.*?= /, "").trim().slice(0, -1), {
    $: id => fields[id], CourseDistanceKm, toast() {}, draftPrice: { balances: [], options: [] },
    draftSpots: [], draftDays: copy(original.days), c: copy(original), isNew: false, key: original.name, COURSES,
    persist: async () => { saved = copy(COURSES[original.name]); return { ok: true }; },
    populateFilters() {}, renderList() {}, closeDrawer() {}, saveMsg() {},
  });
  await fn();
  return { saved, focused };
}

async function mobileSave(value) {
  let saved, focused = false;
  const PGS = { courseEdit: { orig: original.name, draft: { ...copy(original), totalDistanceKm: value } } };
  const App = {};
  runInNewContext(chunk(mobile, "App.courseSave = ", "App.ceSpotToggle = "), {
    App, PGS, CourseDistanceKm, clone: copy, toast() {}, renderOverlays() {},
    $: () => ({ focus: () => { focused = true; } }),
    getCourses: () => ({ [original.name]: copy(original) }),
    saveCourses: async courses => { saved = copy(courses[original.name]); return { ok: true }; },
  });
  await App.courseSave();
  return { saved, focused };
}

for (const [platform, save] of [["desktop", desktopSave], ["mobile", mobileSave]]) {
  test(platform + " saves numeric km, can clear it, and preserves daily distance", async () => {
    for (const [input, expected] of [["720.5", 720.5], ["0", 0], ["", undefined]]) {
      const { saved, focused } = await save(input);
      assert.equal(focused, false);
      assert.equal(saved.totalDistanceKm, expected);
      assert.equal(Object.hasOwn(saved, "totalDistanceKm"), expected !== undefined);
      assert.equal(saved.days[0].dist, "(60 km)");
    }
  });
  test(platform + " rejects invalid km without writing", async () => {
    const { saved, focused } = await save("-12");
    assert.equal(saved, undefined);
    assert.equal(focused, true);
  });
}
