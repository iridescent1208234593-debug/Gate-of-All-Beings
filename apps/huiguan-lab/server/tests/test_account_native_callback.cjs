const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync(require("node:path").join(__dirname, "../../web/static/direct-account-callback.js"), "utf8");
const domain = "https://pc-lab.iridescently.cn";
const route = "/account/native/android/callback";
const code = "A".repeat(43);
const fields = `code=${code}&state=${code}`;
async function run(native_callback, origin=domain) {
    const anchors = [], redirects = [];
    const status = {textContent:"", after: a => anchors.push(a)};
    const context = {
        URL, URLSearchParams,
        location:{origin, hash:"#"+fields, pathname:"/account/direct/callback", replace:v=>redirects.push(v)},
        history:{replaceState:()=>{}},
        document:{getElementById:()=>status, createElement:tag=>({tag})},
        fetch:async()=>({ok:true,json:async()=>({native_callback})})
    };
    await new vm.Script(source).runInNewContext(context);
    return {anchors, redirects};
}
(async () => {
    const correct = domain+route+"#"+fields;
    const valid = await run(correct);
    assert.equal(valid.anchors.length,1);
    assert.equal(valid.anchors[0].tag,"a");
    assert.equal(valid.anchors[0].href,correct);
    assert.equal(valid.anchors[0].referrerPolicy,"no-referrer");
    assert.deepEqual(valid.redirects,[]);
    for (const invalid of [
        domain+route+"?"+fields, domain+"/other#"+fields, "https://example.invalid"+route+"#"+fields,
        domain+route+"#"+fields+"&dup=1", domain+route+"#code=notvalid&state="+code
    ]) {
        const r=await run(invalid);
        assert.deepEqual(r.anchors,[]);
        assert.deepEqual(r.redirects,[]);
    }
    const badOrigin=await run(correct,"https://example.invalid");
    assert.deepEqual(badOrigin.anchors,[]);
    const windows="http://127.0.0.1:53001/lab-account/callback?"+fields;
    const win=await run(windows);
    assert.deepEqual(win.anchors,[]);
    assert.deepEqual(win.redirects,[windows]);
    console.log("Android explicit-tap and fixed fragment; Windows loopback behavior preserved");
})().catch(error=>{console.error(error); process.exitCode=1;});
