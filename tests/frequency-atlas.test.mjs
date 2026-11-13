import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require = createRequire(import.meta.url);
const C = require("../public/frequency-atlas/calc.js");
test("Frequency Atlas: levels and exact thirds", () => {
  assert.equal(C.LEVELS.length, 8);
  assert.equal(C.PERIODS.length, 6);
  assert.equal(C.split(1, 1/3).activeHours, 8);
  assert.equal(C.split(30, 1/3).activeDays, 10);
  assert.ok(Math.abs(C.split(365, 1/3).activeDays - 121.6666667) < 1e-6);
});
test("Frequency Atlas: 5-hour interval and boundary rules", () => {
  assert.equal(C.averageOccurrences(24, 5), 4.8);
  assert.equal(C.occurrences(24, 5, true), 5);
  assert.equal(C.occurrences(24, 5, false), 4);
  assert.equal(C.occurrences(24, 24, false), 0);
  assert.equal(C.occurrences(7 * 24, 5, true), 34);
  assert.equal(C.fmtTime(56), "2 gg 8 h");
});
test("Frequency Atlas: active plus inactive equals total", () => {
  for (const lv of C.LEVELS) for (const pd of C.PERIODS) {
    const s=C.split(pd.days, lv.p);
    assert.ok(Math.abs(s.activeDays+s.inactiveDays-pd.days)<1e-9);
    assert.ok(Math.abs(s.activeHours+s.inactiveHours-pd.days*24)<1e-8);
  }
});