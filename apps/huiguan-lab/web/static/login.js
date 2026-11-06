(function () {
  const form = document.getElementById("f");
  const input = document.getElementById("code");
  const msg = document.getElementById("msg");
  const btn = document.getElementById("go");
  const text = {
    invalid: "测试码无效或已停用。",
    locked: "尝试次数过多，请稍后再试。",
    bad_origin: "请从 LAB 正式入口打开本页。",
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    btn.disabled = true;
    msg.textContent = "正在验证…";
    try {
      const r = await fetch("/api/login", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: input.value.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) { location.replace(data.next || "/play/"); return; }
      let t = text[data.error] || "暂时无法登录，请稍后再试。";
      if (data.retry_after) t += `（约 ${Math.ceil(data.retry_after / 60)} 分钟后）`;
      msg.textContent = t;
    } catch (e) {
      msg.textContent = "网络连接失败，LAB 主机可能已经关机。";
    }
    btn.disabled = false;
  });
})();
