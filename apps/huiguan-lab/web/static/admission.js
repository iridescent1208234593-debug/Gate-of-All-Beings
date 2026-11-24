"use strict";
(() => {
    const q = (id) => document.getElementById(id);
    const entry = q("admission");
    if (!entry) return;
    const status = q("admission-status"), retry = q("admission-retry");
    const priority = q("admission-priority"), code = q("admission-code");
    const codeStatus = q("admission-code-status"), cancel = q("admission-cancel");
    const enter = q("admission-enter");
    let tick, busy = false, refreshAfterRequest = false, lastState = "", expired = false;
    const url = "/api/admission";
    const later = (fn, seconds) => {
        clearTimeout(tick);
        tick = setTimeout(fn, Math.max(1, Math.min(30, Number(seconds) || 3)) * 1000);
    };
    async function request(method, data) {
        const r = await fetch(url, {method, mode: "same-origin", credentials: "same-origin", cache: "no-store",
            redirect: "error", ...(data === undefined ? {} : {
                headers: {"Content-Type":"application/json"}, body:JSON.stringify(data)
            })});
        return {code:r.status, body:await r.json(), seconds:r.headers.get("Retry-After")};
    }
    function render(result, queueIfIdle=false) {
        const {body, seconds} = result;
        if (body.state === "idle" && ["queued","ready"].includes(lastState)) expired = true;
        else if (body.state !== "idle") expired = false;
        lastState = body.state;
        cancel.hidden = !["queued","ready"].includes(body.state);
        enter.hidden = body.state !== "ready";
        retry.hidden = !["idle","full"].includes(body.state);
        priority.hidden = entry.dataset.mode !== "hall" || !["idle","queued","ready","full"].includes(body.state);
        if (body.state === "queued") {
            status.textContent = Number.isInteger(body.position) ? `正在排队 · 第 ${body.position} 位` : "正在排队…";
            later(poll, seconds || body.retry_after);
        } else if (body.state === "ready") {
            status.textContent = "已经为你留出位置，请尽快进入游戏。";
            later(poll, 3);
        } else if (body.state === "full") {
            status.textContent = "当前等候人数已满，稍后自动重试。";
            later(() => join(), seconds || body.retry_after);
        } else if (body.state === "idle") {
            status.textContent = expired ? "排队位置或入场名额已过期，请重新排队。登录不受影响。" : "尚未排队。";
            if (queueIfIdle && !expired) later(() => join(), 1);
        } else if (body.state === "playing") {
            status.textContent = "此会话已开始游戏。请返回原游戏窗口。";
        } else if (body.state === "disabled") {
            location.replace("/play/");
        } else {
            status.textContent = "当前账号不能入场，请重新登录后重试。";
        }
    }
    async function perform(task, onError) {
        if (busy) {
            later(poll,1);
            return;
        }
        clearTimeout(tick); busy = true;
        try { await task(); }
        catch (_) { onError(); }
        finally {
            busy = false;
            if (refreshAfterRequest) {
                refreshAfterRequest = false;
                void poll();
            }
        }
    }
    const offline = () => {
        status.textContent = "暂时无法连接排队服务，稍后重试。";
        later(poll, 3);
    };
    const poll = (initial=false) => perform(async () => render(await request("GET"),initial), offline);
    const join = (proof) => perform(async () => {
        const result = await request("POST",proof ? {priority_code:proof} : {});
        if (proof && result.body.error === "priority_unavailable") {
            codeStatus.textContent = "该测试码暂不能用于优先入场；普通排队不受影响。";
            render(await request("GET"),true);
            return;
        }
        if (proof && result.code === 200) codeStatus.textContent = "已提交优先入场；请按显示的入场状态操作。";
        render(result);
    },offline);
    retry.addEventListener("click", () => join());
    priority.addEventListener("submit", (e) => {
        e.preventDefault();
        const proof = code.value;
        code.value = "";
        if (proof) join(proof);
    });
    cancel.addEventListener("click", () => perform(async () => {
        const result = await request("DELETE");
        if (result.body.state === "idle") {
            lastState = "";
            expired = false;
        }
        render(result);
    },offline));
    function resume() {
        if (busy) {
            refreshAfterRequest = true;
            return;
        }
        void poll();
    }
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") resume();
    });
    window.addEventListener("pageshow", (event) => {
        if (event.persisted && document.visibilityState === "visible") resume();
    });
    poll(true);
})();
