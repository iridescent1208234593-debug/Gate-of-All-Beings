(() => {
  "use strict";
  const panel = document.getElementById("fanHistory");
  const form = document.getElementById("fanHistoryForm");
  const input = document.getElementById("fanHistoryInput");
  const mode = document.getElementById("fanHistoryMode");
  const inputLabel = document.getElementById("fanHistoryInputLabel");
  const status = document.getElementById("fanHistoryStatus");
  const output = document.getElementById("fanHistoryOutput");
  let activeRequest;
  let enabled = false;
  let reopenPending = false;

  const fields = {
    name: "角色名", type: "分类", species: "物种", gender: "性别", faction: "阵营",
    ability: "能力", appearance: "外貌", story: "故事",
  };
  const art = { human: "手绘 / 约稿", ai: "AI 立绘", "": "未声明" };
  const actions = {
    review_approve: "审核通过", review_reject: "审核退回", moderation_reopen: "管理员送回复审",
    owner_submit: "提交公开审核", owner_publish: "提交公开",
    owner_unpublish: "作者取消公开", owner_edit: "作者修改设表",
    owner_revision_submitted: "作者修改设表并送回复审",
    owner_link_removed: "作者移除设表关联", admin_link_removed: "管理员移除设表关联",
  };
  const roles = { author: "作者", owner: "作者", admin: "管理员", elder: "长老", reviewer: "审核员", system: "系统" };
  const states = { approved: "已通过", pending: "待审核", rejected: "已退回" };

  function node(tag, label, className) {
    const element = document.createElement(tag);
    if (label != null) element.textContent = label;
    if (className) element.className = className;
    return element;
  }

  function field(container, label, value) {
    if (typeof value === "string" && value) container.append(node("dt", label), node("dd", value));
  }

  function displayDate(value) {
    if (typeof value !== "string" || !value) return "时间未记录";
    return value;
  }

  function actorLabel(entry) {
    const role = Object.hasOwn(roles, entry.actor_role) ? roles[entry.actor_role] : "";
    return [role, entry.actor_name, entry.actor_tag].filter(Boolean).join(" · ");
  }

  const hasApprovalActor = (approval) => Boolean(approval?.actor_name || approval?.actor_tag);

  function approvalFields(container, approval, snapshotId) {
    const verified = hasApprovalActor(approval);
    field(container, "批准公开的审核人", verified ? actorLabel(approval) : "未记录，无法确认");
    if (verified) field(container, "批准时间", displayDate(approval.approved_at));
    const revision = galleryId(approval?.snapshot_id ?? snapshotId);
    if (revision) field(container, "公开版本记录", "#" + revision);
  }

  function currentApproval(payload) {
    const review = payload.current_review_status;
    const visibility = payload.current_is_public;
    if (typeof review !== "string" || typeof visibility !== "boolean") return null;
    const section = node("section", null, "fan-history-block");
    section.append(node("h3", "当前公开审批"));
    if (!visibility || review !== "approved") {
      const state = !visibility ? "当前未公开（可能尚未申请或已撤回）"
        : review === "pending" ? "当前待审核，尚未公开"
        : review === "rejected" ? "当前已退回，未公开" : "当前无已确认的公开审批";
      section.append(node("p", state + "。以下留存版本不代表当前版本已公开。"));
    } else {
      const values = node("dl");
      approvalFields(values, payload.current_approval);
      section.append(values);
    }
    return section;
  }

  function snapshot(entry, idx) {
    const box = node("details", null, "fan-history-block");
    const content = entry.content || {};
    const version = `公开版本 ${idx + 1}${idx === 0 ? "（最近）" : ""}`;
    const title = entry.legacy_observed
      ? `历史基线（通过时间未知） · 记录于 ${displayDate(entry.recorded_at)}`
      : hasApprovalActor(entry.approval)
        ? `${version} · 通过于 ${displayDate(entry.approval.approved_at)}`
        : `${version} · 公开记录时间：${displayDate(entry.approved_at || entry.recorded_at)}`;
    box.append(node("summary", title));
    const values = node("dl");
    if (Object.hasOwn(entry, "approval")) approvalFields(values, entry.approval, entry.id);
    for (const [key, label] of Object.entries(fields)) field(values, label, content[key]);
    if (Object.hasOwn(art, content.art_source ?? "")) field(values, "立绘来源", art[content.art_source ?? ""]);
    if (content.image_data) field(values, "立绘", "此版本附有图片，历史面板不加载图片。");
    box.append(values);
    const abbreviated = Array.isArray(entry.truncated_fields)
      ? entry.truncated_fields.filter((key) => Object.hasOwn(fields, key)).map((key) => fields[key]) : [];
    if (abbreviated.length) box.append(node("p", "超长内容仅保留部分：" + abbreviated.join("、") + "。"));
    return box;
  }

  function visibility(value) {
    if (value === true || value === 1) return "已申请公开";
    if (value === false || value === 0) return "不公开";
    return "未记录";
  }

  function moderationState(value) {
    return Object.hasOwn(states, value) ? states[value] : value || "未记录";
  }

  function eventItem(entry) {
    const item = node("li", null, "fan-history-block");
    const action = Object.hasOwn(actions, entry.action) ? actions[entry.action] : "审核操作";
    const actorRole = Object.hasOwn(roles, entry.actor_role) ? roles[entry.actor_role] : (entry.actor_role || "");
    const actor = [actorRole, entry.actor_name, entry.actor_tag].filter(Boolean).join(" · ");
    item.append(node("strong", action), node("p", [displayDate(entry.created_at), actor || "操作人未记录"].join(" · ")));
    const details = node("dl");
    if (entry.previous_status != null || entry.new_status != null) {
      field(details, "审核状态", `${moderationState(entry.previous_status)} → ${moderationState(entry.new_status)}`);
    }
    if (entry.previous_public != null || entry.new_public != null) {
      field(details, "公开开关", `${visibility(entry.previous_public)} → ${visibility(entry.new_public)}`);
    }
    const approvedSnapshot = galleryId(entry.approval_snapshot_id);
    if (entry.action === "review_approve" && approvedSnapshot) {
      field(details, "通过的公开版本记录", "#" + approvedSnapshot);
    }
    field(details, "理由", entry.reason);
    if (details.childElementCount) item.append(details);
    return item;
  }

  const history = "/api/admin/fan/history";
  const galleryId = (value) => /^[1-9][0-9]{0,18}$/.test(String(value)) ? String(value) : "";

  function cursorValue(raw) {
    return typeof raw === "string" || Number.isSafeInteger(raw) ? galleryId(raw) : "";
  }

  function errorFor(statusCode) {
    if (statusCode === 401 || statusCode === 403) return "管理员会话已失效或没有查看权限。请重新登录。";
    if (statusCode === 404) return "没有找到这个设表或相关记录。";
    if (statusCode === 400) return "查找条件无效，请核对后重试。";
    return "审核历史暂不可用，请稍后再试。";
  }

  async function request(url, options = {}) {
    activeRequest?.abort();
    const current = new AbortController();
    activeRequest = current;
    const timeout = setTimeout(() => current.abort(), 15000);
    try {
      let response;
      try {
        response = await fetch(url, {
          cache: "no-store", credentials: "same-origin", signal: current.signal, ...options,
        });
      } catch {
        if (activeRequest !== current) return null;
        throw new Error(errorFor(0));
      }
      if (activeRequest !== current || current.signal.aborted) return null;
      if (!response.ok) throw new Error(errorFor(response.status));
      let data;
      try { data = await response.json(); }
      catch { throw new Error(errorFor(0)); }
      return activeRequest === current && !current.signal.aborted ? data : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  function reopenForm(eligible, id) {
    if (!eligible || typeof eligible.review_version !== "string" || !eligible.review_version) return null;
    const cardId = Number(id);
    if (!Number.isSafeInteger(cardId) || cardId <= 0) return null;
    const box = node("section", null, "fan-history-block");
    box.append(node("h3", "已退回设表 · 送回复审"));
    const details = node("dl");
    field(details, "当前退回理由", eligible.rejection_reason || "未记录");
    box.append(details, node("p", "将这份原设表交回复审队列，记录为管理员操作。不会代作者提交、修改设表或直接公开。"));

    const controls = node("form");
    const label = node("label", "本次复审理由（必填）");
    const reason = node("textarea", null, "modal-input");
    reason.required = true;
    reason.minLength = 2;
    reason.maxLength = 200;
    reason.rows = 2;
    label.append(reason);
    const submit = node("button", "送回复审", "pb-btn ghost");
    submit.type = "submit";
    controls.append(label, submit);
    const note = node("p");
    note.setAttribute("role", "status");
    box.append(controls, note);

    controls.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!enabled || reopenPending || submit.disabled || !box.isConnected) return;
      const text = reason.value.trim();
      if (text.length < reason.minLength || text.length > reason.maxLength) {
        note.textContent = "请填写符合长度要求的复审理由。";
        reason.focus();
        return;
      }
      if (!window.confirm(`确定将画廊 #${id} 的当前退回版本送回复审？这不会直接公开设表。`)) return;

      reopenPending = true;
      submit.disabled = true;
      reason.disabled = true;
      note.textContent = "正在提交复审请求…";
      let result = "";
      const request = new AbortController();
      const timeout = setTimeout(() => request.abort(), 15000);
      try {
        const response = await fetch(history + "/reopen", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          signal: request.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cardId, review_version: eligible.review_version, reason: text }),
        });
        if (response.status === 409) {
          result = "设表状态或版本已变化，没有提交复审。";
        } else if (response.status === 401 || response.status === 403) {
          result = "管理员会话已失效或没有复审权限。";
        } else if (response.status === 404) {
          result = "找不到原设表，没有提交复审。";
        } else if (response.status === 400) {
          note.textContent = "复审理由或请求不符合要求，未提交复审。";
          submit.disabled = false;
          reason.disabled = false;
          return;
        } else {
          const data = response.ok ? await response.json() : null;
          if (!data?.ok || String(data.id) !== id || data.review_status !== "pending") throw new Error();
          result = "已送回复审，尚未公开。";
          void window.loadQueue?.();
        }
      } catch {
        result = "未能确认是否已送回复审，请核对当前状态后再操作。";
      } finally {
        clearTimeout(timeout);
        reopenPending = false;
      }

      await load(id, false, result);
    });
    return box;
  }

  function render(payload, id) {
    const snapshots = payload.snapshots.slice(0, 3);
    const events = payload.events;
    let next = cursorValue(payload.next_before);
    const action = reopenForm(payload.reopen, id);
    if (action) output.append(action);
    const current = currentApproval(payload);
    if (current) output.append(current);
    output.append(node("h3", "最近 3 个正式公开版本"));
    if (snapshots.length) output.append(...snapshots.map(snapshot));
    else output.append(node("p", "没有已记录的公开版本。启用记录前的版本不会自动补齐。"));

    output.append(node("h3", "审核与公开状态变更"));
    const items = node("ol");
    items.append(...events.map(eventItem));
    if (events.length) output.append(items);
    else output.append(node("p", "暂时没有审核或公开状态变更记录。"));
    const button = node("button", "加载更早记录", "mini-btn");
    button.type = "button";
    const note = node("p");
    note.setAttribute("role", "status");
    if (next) output.append(button, note);
    button.addEventListener("click", async () => {
      if (!next || button.disabled || reopenPending) return;
      button.disabled = true;
      note.textContent = "正在读取更早记录…";
      try {
        const remaining = await request(history + "?" + new URLSearchParams({ id, before: next }));
        if (!remaining || !button.isConnected) return;
        if (!Array.isArray(remaining.events)) throw new Error(errorFor(0));
        items.append(...remaining.events.map(eventItem));
        const following = cursorValue(remaining.next_before);
        next = following === next ? "" : following;
        button.hidden = !next;
        note.textContent = remaining.events.length ? `已加载 ${remaining.events.length} 条更早记录。` : "没有更早记录。";
      } catch (error) {
        note.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
    status.textContent = `画廊 #${id}：${snapshots.length} 个留存版本、${events.length} 条变更记录。`;
  }

  function renderMatches(data) {
    if (!Array.isArray(data.matches)) throw new Error(errorFor(0));
    const items = node("ul");
    for (const match of data.matches) {
      const id = galleryId(match.id);
      if (!id || typeof match.name !== "string") continue;
      const item = node("li");
      const button = node("button", `${match.name} · 画廊 #${id}`, "mini-btn");
      button.type = "button";
      button.dataset.fanHistoryId = id;
      item.append(button);
      items.append(item);
    }
    if (items.childElementCount) {
      status.textContent = data.truncated ? "有较多同名设表。请按画廊编号进一步定位。" : "请选择要查看的设表。";
      output.append(items);
    } else status.textContent = "没有找到完全同名的设表。";
  }

  async function load(rawValue, byName = false, notice = "") {
    if (!enabled || reopenPending) return;
    activeRequest?.abort();
    activeRequest = null;
    const value = String(rawValue || "").trim();
    output.replaceChildren();
    if (!value || (!byName && !galleryId(value))) {
      status.textContent = byName ? "请输入完整角色名。" : "请输入有效的画廊数字编号。";
      input.focus();
      return;
    }

    status.textContent = "正在读取审核记录…";
    try {
      if (byName) {
        const matches = await request(history + "/find", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: value }),
        });
        if (matches) renderMatches(matches);
      } else {
        const data = await request(history + "?" + new URLSearchParams({ id: value }));
        if (!data) return;
        if (!Array.isArray(data.snapshots) || !Array.isArray(data.events)) throw new Error(errorFor(0));
        render(data, value);
        if (notice) status.textContent = notice + " " + status.textContent;
      }
    } catch (error) {
      status.textContent = (notice ? notice + " " : "") + error.message;
    }
  }

  function configureSearch() {
    const byName = mode.value === "name";
    inputLabel.textContent = byName ? "完整角色名" : "画廊编号";
    input.inputMode = byName ? "text" : "numeric";
    input.maxLength = byName ? 256 : 19;
    input.placeholder = byName ? "输入设表的完整公开名称" : "画廊数字编号";
  }
  mode.addEventListener("change", configureSearch);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void load(input.value, mode.value === "name");
  });
  document.addEventListener("click", (event) => {
    if (!enabled || reopenPending) return;
    const button = event.target.closest("[data-fan-history-id]");
    if (!button) return;
    panel.closest("#reviewDesk").open = true;
    panel.open = true;
    mode.value = "id";
    configureSearch();
    input.value = button.dataset.fanHistoryId;
    panel.scrollIntoView({ block: "start" });
    panel.querySelector("summary").focus({ preventScroll: true });
    void load(input.value);
  });
  window.HuiguanFanHistory = {
    enable() {
      enabled = true;
      panel.hidden = false;
    },
  };
})();
