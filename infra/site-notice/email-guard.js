/* 西木会馆 · 强制邮箱绑定守卫
 *
 * 规则：
 *   - 未登录：不打扰
 *   - 已登录且邮箱已验证：不打扰
 *   - 已登录但邮箱未验证：弹出不可绕过的弹窗，要求绑定并验证邮箱
 *
 * 依赖：/api/account/email (status) 、/api/account/email/send 、/api/sso-user
 * 配色：设计系统 --qc-*
 */
(function () {
  "use strict";
  if (window.self !== window.top) return;          // iframe 内不弹

  var STATE_KEY = "__lxh_email_guard";
  if (window[STATE_KEY]) return;                    // 防重复注入
  window[STATE_KEY] = true;

  var POLL_MS = 20000;      // 每 20 秒查一次验证状态
  var COOLDOWN = 60;        // 与服务端一致：60 秒

  var CSS = [
    "#__lh_guard{position:fixed;inset:0;z-index:2147483100;display:none;align-items:center;justify-content:center;",
    "padding:16px;background:rgba(30,42,36,.62);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif}",
    "#__lh_guard.on{display:flex}",
    "#__lh_guard .lg-card{width:min(92vw,420px);max-height:calc(100vh - 32px);overflow:auto;border-radius:16px;",
    "background:#fbf8f2;border:1px solid #d4cfbe;box-shadow:0 26px 70px rgba(20,28,24,.42);padding:20px 20px 16px;box-sizing:border-box}",
    "#__lh_guard h2{margin:0 0 4px;font-family:'Noto Serif SC','Songti SC',serif;font-size:18px;color:#3a4a3e;letter-spacing:.04em}",
    "#__lh_guard .lg-sub{font-size:11.5px;letter-spacing:.14em;color:#7a8a7e;margin-bottom:12px}",
    "#__lh_guard p{font-size:13px;line-height:1.75;color:#3a4a3e;margin:0 0 12px}",
    "#__lh_guard .lg-warn{font-size:12px;line-height:1.7;color:#b3543f;background:rgba(179,84,63,.08);",
    "border:1px solid rgba(179,84,63,.28);border-radius:8px;padding:8px 10px;margin-bottom:12px}",
    "#__lh_guard label{display:block;font-size:12px;color:#7a8a7e;margin-bottom:5px}",
    "#__lh_guard input{width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1px solid #d4cfbe;",
    "border-radius:9px;background:#fff;font-size:14px;color:#3a4a3e;outline:none}",
    "#__lh_guard input:focus{border-color:#5a9e8f}",
    "#__lh_guard .lg-row{display:flex;gap:8px;margin-top:12px}",
    "#__lh_guard button{flex:1;height:42px;border-radius:10px;border:1px solid #d4cfbe;background:#fbf8f2;",
    "color:#3a4a3e;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}",
    "#__lh_guard button.primary{background:#5a9e8f;border-color:#5a9e8f;color:#fff}",
    "#__lh_guard button:disabled{opacity:.55;cursor:not-allowed}",
    "#__lh_guard .lg-msg{min-height:18px;margin-top:10px;font-size:12.5px;line-height:1.6;color:#7a8a7e}",
    "#__lh_guard .lg-msg.err{color:#b3543f}",
    "#__lh_guard .lg-msg.ok{color:#5a9e8f}",
    "#__lh_guard .lg-tip{margin-top:12px;font-size:11px;line-height:1.7;color:#7a8a7e;border-top:1px solid #e8e3d6;padding-top:10px}",
    "@media(max-width:480px){#__lh_guard .lg-card{padding:16px 15px 13px}#__lh_guard h2{font-size:16.5px}}"
  ].join("");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var guard, card, input, sendBtn, checkBtn, msg, mailHint;
  var cooldownLeft = 0, cooldownTimer = null, pollTimer = null;

  function api(path, body) {
    var opt = body === undefined ? { credentials: "same-origin" }
      : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, data: d }; });
    });
  }

  function say(text, kind) {
    msg.textContent = text || "";
    msg.className = "lg-msg" + (kind ? " " + kind : "");
  }

  function startCooldown() {
    cooldownLeft = COOLDOWN;
    sendBtn.disabled = true;
    clearInterval(cooldownTimer);
    tick();
    cooldownTimer = setInterval(tick, 1000);
  }

  function tick() {
    if (cooldownLeft <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      sendBtn.disabled = false;
      sendBtn.textContent = "发送验证邮件";
      return;
    }
    sendBtn.textContent = "请等待 " + cooldownLeft + " 秒";
    cooldownLeft--;
  }

  function show() {
    if (!document.body) return;
    if (guard) { guard.classList.add("on"); return; }

    guard = el("div"); guard.id = "__lh_guard";
    card = el("div", "lg-card");

    card.appendChild(el("h2", null, "请先绑定邮箱"));
    card.appendChild(el("div", "lg-sub", "西木会馆 · 账号安全"));
    card.appendChild(el("p", null,
      "为了能在忘记密码或账号异常时找回你的资料，需要先验证一个邮箱。验证完成后即可正常使用全部功能。"));
    card.appendChild(el("div", "lg-warn",
      "未验证邮箱期间，部分功能会被限制。验证一次即可，之后不会再打扰你。"));

    var lab = el("label", null, "邮箱地址");
    input = el("input");
    input.type = "email";
    input.placeholder = "you@example.com";
    input.autocomplete = "email";
    input.maxLength = 254;

    var row = el("div", "lg-row");
    sendBtn = el("button", "primary", "发送验证邮件");
    checkBtn = el("button", null, "我已完成验证");
    row.appendChild(sendBtn);
    row.appendChild(checkBtn);

    msg = el("div", "lg-msg");
    mailHint = el("div", "lg-tip",
      "点击邮件中的链接后回到本页，本页会自动检测验证状态。邮件 30 分钟内有效，同一邮箱 60 秒内只能发送一次。");

    card.appendChild(lab);
    card.appendChild(input);
    card.appendChild(row);
    card.appendChild(msg);
    card.appendChild(mailHint);
    guard.appendChild(card);
    document.body.appendChild(guard);
    guard.classList.add("on");

    sendBtn.onclick = function () {
      var email = (input.value || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("请输入有效的邮箱地址", "err"); return; }
      sendBtn.disabled = true;
      say("正在发送…");
      api("/api/account/email/send", { email: email }).then(function (res) {
        if (res.status === 200 && res.data && res.data.ok) {
          say("验证邮件已发送，请打开邮件中的链接完成验证", "ok");
          startCooldown();
        } else if (res.status === 429) {
          // 服务端拒绝：以服务端为准，本地也进入冷却
          say(res.data.error || "操作过于频繁，请稍后再试", "err");
          startCooldown();
        } else {
          say((res.data && res.data.error) || "发送失败，请稍后再试", "err");
          sendBtn.disabled = false;
        }
      }).catch(function () { say("网络错误，请稍后再试", "err"); sendBtn.disabled = false; });
    };

    checkBtn.onclick = function () { refresh(true); };

    refresh(false);
    pollTimer = setInterval(function () { refresh(false); }, POLL_MS);
  }

  function hide() {
    if (guard) guard.classList.remove("on");
    clearInterval(pollTimer); pollTimer = null;
    clearInterval(cooldownTimer); cooldownTimer = null;
  }

  function refresh(manual) {
    api("/api/account/email").then(function (res) {
      if (res.status !== 200 || !res.data) { if (manual) say("检测失败，请稍后再试", "err"); return; }
      var d = res.data;
      if (d.verified) {
        say("邮箱已验证，谢谢配合", "ok");
        hide();
        setTimeout(function () { if (guard && guard.parentNode) guard.parentNode.removeChild(guard); }, 400);
        return;
      }
      if (manual) say(d.pending ? "邮件已发出，请点击邮件里的链接" : "还没有完成验证", d.pending ? "ok" : "");
      if (d.email) input.value = d.email;
    }).catch(function () {});
  }

  function boot() {
    api("/api/sso-user").then(function (res) {
      var d = res.data || {};
      if (!d.logged_in) return;                        // 未登录：不打扰
      api("/api/account/email").then(function (r2) {
        if (r2.status === 401) return;                 // 会话失效
        if (r2.status !== 200) return;
        if (!r2.data || !r2.data.verified) {
          if (!document.getElementById("__lh_guard_css")) {
            var st = el("style"); st.id = "__lh_guard_css"; st.textContent = CSS;
            document.head.appendChild(st);
          }
          show();
        }
      });
    }).catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
