(() => {
  "use strict";

  const root = document.getElementById("creator-admin");
  const search = root.querySelector("[data-creator-admin-search]");
  const ownerSelect = root.querySelector("[data-creator-admin-owner]");
  const unlinked = root.querySelector("[data-creator-admin-unlinked]");
  const output = root.querySelector("[data-creator-admin-output]");
  const base = "/api/admin/creators/";
  const labels = { resident_creator: "驻馆共创者（编内）", guest_creator: "客席共创者（编外）" };
  let users = [];
  let selection = "";
  let requestVersion = 0;
  let enabled;

  function node(tag, text, className) {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (className) e.className = className;
    return e;
  }

  function input(value, limit, type = "text") {
    const e = node("input");
    e.type = type;
    e.maxLength = limit;
    e.value = value || "";
    return e;
  }

  function field(label, control, isCheckbox = false) {
    const wrapper = node("label");
    const title = document.createTextNode(label);
    wrapper.append(...(isCheckbox ? [control, title] : [title, control]));
    return wrapper;
  }

  function check(value) {
    const e = node("input");
    e.type = "checkbox";
    e.checked = value === true;
    return e;
  }

  function button(text) {
    const control = node("button", text, "btn primary");
    control.type = "submit";
    return control;
  }

  function textarea(value, limit) {
    const control = node("textarea");
    control.value = value || "";
    control.maxLength = limit;
    control.rows = 3;
    return control;
  }

  async function request(path, data, csrf) {
    const response = await fetch(base + path, {
      cache: "no-store",
      ...(data ? {
        method: "POST", headers: { "Content-Type": "application/json", "X-Creator-CSRF": csrf },
        body: JSON.stringify(data),
      } : {}),
    });
    if (!response.ok) {
      const messages = {
        400: "资料格式不正确，未保存。请核对字段与链接。",
        401: "登录已失效，未保存。",
        403: "没有操作权限，或会话授权已变化。请刷新后再试。",
        404: "所选账户或记录不存在。",
        409: "记录已变化。请重新选择账户并核对。",
      };
      throw new Error(messages[response.status] || "暂时无法读取或写入共创档案。");
    }
    return response.json();
  }

  function setupForm(form, submit, action, status) {
    form.append(submit, status);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      status.textContent = "正在保存…";
      try {
        await action();
        status.textContent = "已保存。";
      } catch (error) {
        status.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
  }

  function statusLine() {
    const el = node("p");
    el.setAttribute("role", "status");
    return el;
  }

  function membershipForm(owner, membership, csrf) {
    const form = node("form", null, "creator-admin__form");
    const kind = node("select");
    kind.append(new Option("未登记共创身份", ""));
    for (const [value, label] of Object.entries(labels)) kind.add(new Option(label, value));
    kind.value = membership?.creator_kind || "";
    const assignments = textarea(Array.isArray(membership?.assignments) ? membership.assignments
      .map(({ group, duty }) => [group, duty].filter(Boolean).join("｜")).join("\n") : "", 2500);
    const joined = input(membership?.joined_on, 10, "date");
    const work = textarea(membership?.current_work, 400);
    form.append(node("h3", "身份与分工"), field("共创身份", kind),
      field("分组与职责（每行一组：分组｜职责）", assignments),
      field("加入日期", joined), field("目前在做", work));
    setupForm(form, button("保存身份与分工"), () => {
      const rows = assignments.value.split("\n").map((row) => row.trim()).filter(Boolean).map((row) => {
        const [group, ...duty] = row.split("｜");
        return { group: group.trim(), duty: duty.join("｜").trim() };
      });
      if (kind.value && (rows.length > 24 || rows.some((row) => !row.group || !row.duty || row.group.length > 40 || row.duty.length > 60))) {
        throw new Error("最多 24 项分工，每行须填写分组（40 字以内）与职责（60 字以内）。");
      }
      if (!kind.value && membership && !window.confirm("清除该账户的共创身份与分工？这不会改变账户或 LAB 权限。")) {
        throw new Error("已取消，未保存。");
      }
      return request("account", {
        ...owner, creator_kind: kind.value || null,
        assignments: kind.value ? rows : [], joined_on: kind.value ? joined.value : "",
        current_work: kind.value ? work.value.trim() : "",
      }, csrf).then((result) => { membership = result.membership; });
    }, statusLine());
    return form;
  }

  function labForm(owner, labAccess, csrf) {
    const form = node("form", null, "creator-admin__form");
    const enabled = check(typeof labAccess === "boolean" ? labAccess : labAccess?.enabled);
    form.append(node("h3", "LAB 测试资格"), field("允许进入 LAB 测试世界", enabled, true),
      node("p", "这里仅管理测试资格，不会修改公开档案或会馆角色。"));
    setupForm(form, button("保存 LAB 资格"), () => request("lab-access", {
      ...owner, enabled: enabled.checked,
    }, csrf), statusLine());
    return form;
  }

  function contributionForm(owner, item, csrf, reload, heading) {
    const form = node("form", null, "creator-admin__form");
    const title = input(item?.title, 120);
    title.required = true;
    const summary = textarea(item?.summary, 600);
    const url = input(item?.url, 512, "url");
    url.placeholder = "https://...";
    const completed = input(item?.completed_on, 10, "date");
    const approved = check(item?.approved);
    const displayName = input(item?.display_name, 60);
    const consent = check(false);
    if (!owner) {
      displayName.required = true;
      form.append(field("公开署名", displayName));
      if (item?.public_consent) {
        form.append(node("p", "已有公开确认。如要保留公开，请核对此次内容并重新勾选；不勾选保存会撤下该署名。"));
      }
      form.append(field("已确认本人同意此版本的署名及贡献内容公开", consent, true));
    }
    form.append(field("贡献标题", title), field("贡献说明", summary), field("作品链接（HTTPS，可留空）", url),
      field("完成日期（可留空）", completed), field("审核通过", approved, true));
    setupForm(form, button(item ? "保存贡献记录" : "添加贡献记录"), async () => {
      const href = url.value.trim();
      if (href) {
        try {
          const parsed = new URL(href);
          if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
              parsed.port || /[\s\\]/.test(href)) throw new Error();
        } catch {
          throw new Error("作品链接必须是有效的 HTTPS 地址。");
        }
      }
      if (!owner && approved.checked && !consent.checked && !item?.approved) {
        throw new Error("无账户署名须先确认本人同意公开。");
      }
      if (!owner && item?.approved && item.public_consent && !consent.checked &&
          !window.confirm("未重新确认本人同意。保存后将撤下这条公开署名，继续吗？")) {
        throw new Error("已取消，未保存。");
      }
      await request("contribution", {
        ...(owner || { kind: null, uid: null, display_name: displayName.value.trim(), public_consent: consent.checked }),
        ...(item?.id != null ? { id: item.id } : {}),
        title: title.value.trim(), summary: summary.value.trim(), url: href,
        completed_on: completed.value, approved: approved.checked,
      }, csrf);
      if (!item) await reload();
      else {
        item.approved = approved.checked;
        item.public_consent = consent.checked;
        if (heading) heading.textContent = `${title.value.trim()} · ${approved.checked ? "已审核" : "未审核"}`;
      }
    }, statusLine());
    return form;
  }

  function showAccount(query, notice = "") {
    const version = ++requestVersion;
    output.textContent = "正在读取共创资料…";
    return request("account" + query).then(({ membership, csrf, contributions, lab_access: labAccess, lab_available: labAvailable }) => {
      if (version !== requestVersion) return;
      if (typeof csrf !== "string" || !csrf) throw new Error("没有取得本次管理授权。");
      const params = new URLSearchParams(query);
      const owner = params.has("uid") ? { kind: params.get("kind"), uid: params.get("uid") } : null;
      const controls = node("div");
      controls.append(node("h3", owner ? "该账户的共创资料" : "未绑定账户的共创署名"));
      if (notice) controls.append(node("p", notice));
      if (owner) {
        controls.append(membershipForm(owner, membership, csrf));
        if (labAvailable === true && (typeof labAccess === "boolean" || typeof labAccess?.enabled === "boolean")) {
          controls.append(labForm(owner, labAccess, csrf));
        } else {
          controls.append(node("p", "当前环境未启用 LAB 账户授权服务。"));
        }
      } else {
        controls.append(node("p", "这类贡献只做公开鸣谢。不会创建账户身份，也不会获得 LAB 测试资格。"));
      }
      const reload = () => version === requestVersion ? showAccount(query, "贡献记录已添加。") : undefined;
      for (const item of Array.isArray(contributions) ? contributions : []) {
        const details = node("details");
        const heading = node("summary", `${item.title || "无标题"} · ${item.approved ? "已审核" : "未审核"}`);
        details.append(heading, contributionForm(owner, item, csrf, reload, heading));
        controls.append(details);
      }
      const more = node("details");
      more.append(node("summary", "登记贡献"), contributionForm(owner, null, csrf, reload));
      controls.append(more);
      output.replaceChildren(controls);
    }).catch((error) => {
      if (version === requestVersion) output.textContent = error.message;
    });
  }

  function updateOptions() {
    const term = search.value.trim().toLowerCase();
    ownerSelect.replaceChildren(new Option("请选择账户", ""));
    const fitting = users.filter(({ title, query }) => !term || `${title} ${query}`.toLowerCase().includes(term));
    for (const user of fitting.slice(0, 60)) ownerSelect.add(new Option(user.title, user.query));
    if (fitting.length > 60) ownerSelect.add(new Option("还有其他结果，请继续输入搜索词", "", false, false));
    ownerSelect.value = selection;
  }

  search.addEventListener("input", updateOptions);
  ownerSelect.addEventListener("change", () => {
    selection = ownerSelect.value;
    if (selection) showAccount(selection);
    else {
      requestVersion++;
      output.textContent = "";
    }
  });
  unlinked.addEventListener("click", () => {
    selection = "";
    ownerSelect.value = "";
    showAccount("");
  });

  window.HuiguanCreatorAdmin = {
    setUsers(rows) {
      users = rows.filter((user) => ["local", "usso"].includes(user.kind) && user.uid != null)
        .map((user) => ({
          title: `${user.nickname || user.name || user.username || "未命名"} · ${user.kind === "local" ? "站内" : "USSO"} · ${user.uid}`,
          query: "?" + new URLSearchParams({ kind: user.kind, uid: String(user.uid) }),
        }));
      updateOptions();
      enabled ??= fetch("/api/creators/me", { cache: "no-store", credentials: "same-origin",
        headers: { Accept: "application/json" },
      }).then((response) => response.ok && response.headers.get("Content-Type")?.includes("application/json"))
        .catch(() => false);
      void enabled.then((available) => { root.hidden = !available; });
    },
  };
})();
