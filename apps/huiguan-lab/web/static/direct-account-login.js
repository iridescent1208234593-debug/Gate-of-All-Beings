"use strict";
(async () => {
    const entry = document.getElementById("direct-account-entry");
    if (!entry) return;
    const start = document.getElementById("direct-account-start");
    const restore = document.getElementById("direct-account-restore");
    const status = document.getElementById("direct-account-status");
    try {
        const available = await fetch("/api/account/direct/available", {
            credentials: "same-origin", cache: "no-store", redirect: "error"
        });
        if (!available.ok) return;
        const {issuer, can_restore: canRestore} = await available.json();
        const exactIssuer = new URL(issuer);
        if (exactIssuer.origin !== issuer || exactIssuer.protocol !== "https:") return;
        const begin = async (intent) => {
            start.disabled = restore.disabled = true;
            status.textContent = "正在打开会馆授权…";
            try {
                const result = await fetch("/api/account/direct/start", {
                    method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
                    headers: {"Content-Type": "application/json"}, body: JSON.stringify({intent})
                });
                if (!result.ok) throw new Error("start_failed");
                const next = new URL((await result.json()).authorization_url);
                if (next.origin !== exactIssuer.origin || next.username || next.password || next.hash ||
                        next.pathname !== "/api/lab-auth/direct/approve") throw new Error("invalid_origin");
                location.assign(next.href);
            } catch (_) {
                status.textContent = "暂时无法开始验证，请重试。";
                start.disabled = restore.disabled = false;
            }
        };
        start.addEventListener("click", () => begin("login"));
        restore.addEventListener("click", () => begin("restore"));
        restore.hidden = canRestore !== true;
        entry.hidden = false;
    } catch (_) { /* Keep existing entry when the opt-in feature is unavailable. */ }
})();
