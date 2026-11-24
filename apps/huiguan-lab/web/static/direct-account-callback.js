"use strict";
(async () => {
    const status = document.getElementById("status");
    const args = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, "", location.pathname);
    if (args.size !== 2 || args.getAll("state").length !== 1 || args.getAll("code").length !== 1) {
        status.textContent = "登录验证未完成，请从游戏登录页重新开始。";
        return;
    }
    try {
        const response = await fetch("/api/account/direct/finish", {
            method: "POST", credentials: "same-origin",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({state: args.get("state"), code: args.get("code")}),
            cache: "no-store", redirect: "error"
        });
        if (!response.ok) {
            status.textContent = response.status === 409 ? "此账户已有其他存档，未自动合并。"
                : "登录验证未完成，请重新开始。";
            return;
        }
        const result = await response.json();
        if (!["/play/", "/admission"].includes(result.next)) throw new Error("unexpected_result");
        location.replace(result.next);
    } catch (_) {
        status.textContent = "暂时无法完成登录验证，请重新开始。";
    }
})();
