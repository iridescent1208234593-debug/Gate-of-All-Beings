(async () => {
  const box = document.getElementById("account-entry");
  const button = document.getElementById("account-start");
  const hint = document.getElementById("account-hint");
  const approve = document.getElementById("account-approve");
  const mode = location.pathname === "/account-link" ? "link" : "login";
  let issuerOrigin;
  try {
    const response = await fetch("/api/account/available", {cache: "no-store", redirect: "error"});
    if (!response.ok) return;
    const availability = await response.json();
    const issuer = new URL(availability.issuer);
    const fixture = location.protocol === "http:" && location.hostname === "127.0.0.1" &&
      issuer.protocol === "http:" && issuer.hostname === "127.0.0.1";
    if (!availability.enabled || availability.issuer !== issuer.origin ||
        (issuer.protocol !== "https:" && !fixture)) return;
    issuerOrigin = issuer.origin;
  } catch { return; }
  box.hidden = false;
  if (mode === "link") {
    document.getElementById("f").hidden = true;
    button.textContent = "将当前测试码进度绑定到会馆账号";
    hint.textContent = "绑定后会保留原角色、进度和灵质空间权限。启用绑定期间，该旧档改用会馆账号登录；两个已有存档不会自动合并。";
  }
  const post = (path, payload) => fetch("/api/account/" + path, {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: {"Content-Type": "application/json"}, body: JSON.stringify({mode, ...payload})
  });
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const start = await post("start", {});
      if (!start.ok) throw Error();
      const m = await start.json();
      const url = new URL(m.approval_url);
      if (url.origin !== issuerOrigin || url.username || url.password ||
          !/^\?request_id=[A-Za-z0-9_-]{12,200}$/.test(url.search) || url.hash ||
          url.pathname !== "/api/lab-auth/approve" || !/^[0-9]{6}$/.test(m.match_code)) throw Error();
      approve.href = url.href;
      approve.hidden = false;
      hint.textContent = "到 " + url.hostname + " 确认，并输入这组匹配码：" + m.match_code;
      const until = Date.now() + Math.min(m.expires_in, 600) * 1000;
      while (Date.now() < until) {
        await new Promise(ok => setTimeout(ok, 2500));
        const r = await post("poll", {poll_key: m.poll_key});
        if (!r.ok) throw Error();
        const result = await r.json();
        if (result.status === "ok") { location.replace("/play/"); return; }
        if (result.status !== "pending") throw Error();
      }
      throw Error();
    } catch {
      hint.textContent = "未完成会馆授权。请核对测试资格或重试；未绑定的有效测试码仍可使用。";
    } finally {
      approve.hidden = true;
      approve.removeAttribute("href");
      button.disabled = false;
    }
  });
})();
