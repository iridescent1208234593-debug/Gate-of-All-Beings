const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function check() {
  const calls = [];
  const environment = {
    window: { prompt: (title, initial) => { calls.push([title, initial]); return "手机昵称"; } },
    navigator: { maxTouchPoints: 2 },
    matchMedia: () => ({ matches: true }),
    document: {
      fullscreenElement: null,
      documentElement: { requestFullscreen: async () => calls.push("fullscreen") },
    },
    screen: { orientation: { lock: async mode => calls.push(mode) } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../web/play/lab-bridge.js"), "utf8"), environment);
  const lab = environment.window.zszmLab;
  assert.equal(lab.isMobile(), true);
  environment.navigator.maxTouchPoints = 0;
  assert.equal(lab.isMobile(), false);
  assert.equal(lab.promptText("昵称", "已有名字"), "手机昵称");
  assert.deepEqual(calls.shift(), ["昵称", "已有名字"]);
  let result;
  await lab.landscape((ok, message) => { result = { ok, message }; });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["fullscreen", "landscape"]);
  environment.screen.orientation.lock = undefined;
  await lab.landscape((ok, message) => { result = { ok, message }; });
  assert.equal(result.ok, false);
  assert.match(result.message, /自动旋转/);
  environment.screen.orientation.lock = async () => { throw new Error("not allowed"); };
  await lab.landscape((ok, message) => { result = { ok, message }; });
  assert.equal(result.ok, false);
  console.log("PASS browser helpers: touch detection, native text entry, landscape and fallback");
}

check().catch(error => { console.error(error); process.exitCode = 1; });
