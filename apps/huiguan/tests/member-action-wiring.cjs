"use strict";
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const html = fs.readFileSync(require("node:path").join(__dirname, "..", "member.html"), "utf8");
const start = html.indexOf("const memberContent = document.getElementById('content');");
const end = html.indexOf("function resetPwd(", start);
assert(start > 0 && end > start);
const listeners = {};
const calls = [];
const record = action => (...args) => calls.push([action, ...args]);
const content = { addEventListener(type, cb) { listeners[type] = cb; } };
vm.runInNewContext(html.slice(start, end), {
  document: { getElementById: id => id === "content" && content },
  toggleSheets: record("toggle"), resetPwd: record("reset"), upd: record("update"),
  delPoster: record("poster"), delSheet: record("sheet")
});
function event(type, dataset, value = "") {
  listeners[type]({ target: { closest: () => dataset ? { dataset, value } : null } });
}
event("click", { memberAction: "delete-poster", id: "12", title: "sample poster" });
event("click", { memberAction: "delete-sheet", key: "local:34", code: "A123", name: "sample sheet", version: "4" });
event("click", { memberAction: "sheets", key: "local:34" });
event("click", { memberAction: "reset", kind: "local", uid: "34", name: "sample" });
event("click", { kind: "local", uid: "34", memberField: "status" }, "banned");
event("change", { kind: "local", uid: "34", memberField: "is_fan_reviewer" }, "1");
event("click", { memberAction: "unknown" });
event("click", null);
assert.deepEqual(calls, [
  ["poster","12","sample poster"],["sheet","local:34","A123","sample sheet","4"],
  ["toggle","local:34"],["reset","local","34","sample"],["update","local","34","status","banned"],
  ["update","local","34","is_fan_reviewer",true]
]);
assert.equal((html.match(/data-member-action="delete-poster"/g)||[]).length, 1);
assert.equal((html.match(/data-member-action="delete-sheet"/g)||[]).length, 1);
assert.doesNotMatch(html, /onclick="del(?:Poster|Sheet)\(/);
console.log("Member UI wiring PASS: six expected action paths, two no-ops, handlers delegated");