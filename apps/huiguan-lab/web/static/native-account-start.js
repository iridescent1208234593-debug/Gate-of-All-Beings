"use strict";
(() => {
    const status = document.getElementById("status"), button = document.getElementById("continue");
    const fields = new URLSearchParams(location.search);
    const native = {state: fields.get("state"), challenge: fields.get("challenge")};
    if (fields.get("method") === "android_app_link") {
        native.method = "android_app_link";
    } else {
        native.port = Number(fields.get("port"));
    }
    history.replaceState(null, "", location.pathname);
    button.addEventListener("click", async () => {
        button.disabled = true;
        try {
            const r = await fetch("/api/account/direct/start", {
                method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({intent:"login", native})
            });
            if (!r.ok) throw new Error();
            const out = await r.json();
            const url = new URL(out.authorization_url);
            if (url.protocol !== "https:" || url.pathname !== "/api/lab-auth/direct/approve") throw new Error();
            location.replace(url.href);
        } catch (_) {
            status.textContent = "Unable to start this login. Please try again in the game.";
            button.disabled = false;
        }
    });
})();
