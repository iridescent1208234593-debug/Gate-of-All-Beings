(() => {
  "use strict";

  const endpoint = "/api/creators/me";
  const labels = { resident_creator: "驻馆共创者（编内）", guest_creator: "客席共创者（编外）" };
  const maxLinks = 8;

  function node(tag, text, className) {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (className) e.className = className;
    return e;
  }

  function field(label, control) {
    const wrapper = node("label", label);
    wrapper.append(control);
    return wrapper;
  }

  function input(value, limit, type = "text") {
    const control = node("input", null, "qc-input");
    control.type = type;
    control.maxLength = limit;
    control.value = value || "";
    return control;
  }

  function checkbox(label, checked) {
    const control = node("input");
    control.type = "checkbox";
    control.checked = checked === true;
    const wrapper = node("label");
    wrapper.append(control, document.createTextNode(label));
    return { control, wrapper };
  }

  function button(label, type = "button") {
    const control = node("button", label, "qc-btn");
    control.type = type;
    return control;
  }

  async function request(data, csrf) {
    const response = await fetch(endpoint, data ? {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Creator-CSRF": csrf },
      body: JSON.stringify(data),
      cache: "no-store",
    } : { cache: "no-store" });
    if (!response.ok) {
      const errors = {
        400: "没有保存。请检查公开署名和链接格式。",
        401: "登录已失效，请重新登录后再试。",
        403: "没有保存。会话或授权状态已变更，请刷新页面后重试。",
        409: "没有保存。共创资料已变化，请刷新后核对。",
      };
      const error = new Error(errors[response.status] || "共创档案暂时不可用，请稍后再试。");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function render(root, { profile, membership, csrf, contributions: approvedRecords, publication_version: publicationVersion }) {
    if (!profile || typeof csrf !== "string" || !csrf) throw new Error("暂时无法读取共创设置。");
    const preview = node("section", null, "creator-profile-preview");
    preview.append(node("h3", "当前档案 · 公开内容预览"));
    const currentKind = labels[membership?.creator_kind] || "未登记共创身份";
    preview.append(node("p", "共创身份：" + currentKind, "qc-hint"));
    if (membership) {
      const assignments = Array.isArray(membership.assignments) ? membership.assignments : [];
      const roles = node("ul");
      for (const { group, duty } of assignments) roles.append(node("li", group + " · " + duty));
      preview.append(node("p", "分组与职责：" + (roles.childElementCount ? "" : "未填写"), "qc-hint"));
      if (roles.childElementCount) preview.append(roles);
      preview.append(
        node("p", "加入日期：" + (membership.joined_on || "未填写"), "qc-hint"),
        node("p", "目前在做：" + (membership.current_work || "未填写"), "qc-hint"),
      );
    }
    const recordList = node("ul");
    for (const record of Array.isArray(approvedRecords) ? approvedRecords : []) {
      const entry = node("li");
      entry.append(node("strong", record.title), node("p", [record.completed_on, record.summary].filter(Boolean).join(" · "), "qc-hint"));
      if (record.url) {
        try {
          const parsed = new URL(record.url);
          if (parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port) {
            const link = node("a", "查看作品链接 ↗");
            link.href = parsed.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            entry.append(link);
          }
        } catch { /* invalid legacy link omitted */ }
      }
      recordList.append(entry);
    }
    preview.append(node("h4", "已审核贡献"));
    if (recordList.childElementCount) preview.append(recordList);
    else preview.append(node("p", "暂无已审核贡献。", "qc-hint"));
    preview.append(node("p", "身份与分工更新后，需要重新确认公开档案。新增或修改审核通过的贡献后，也需重新确认公开贡献；贡献里的作品链接只在同时勾选公开链接时展示。", "qc-hint"));
    const form = node("form", null, "creator-profile-form");
    const displayName = input(profile.display_name, 60);
    const bio = node("textarea", null, "qc-input");
    bio.maxLength = 400;
    bio.value = profile.bio || "";
    const main = checkbox("在「连接与鸣谢」公开我的共创档案", profile.public_profile);
    const avatar = checkbox("同时公开站内账户头像", profile.public_avatar);
    const publicLinks = checkbox("同时公开我填写的链接", profile.public_links);
    const contributions = checkbox("同时公开经审核的署名贡献", profile.public_contributions);
    const visibility = node("fieldset");
    visibility.append(node("legend", "公开范围"), main.wrapper, avatar.wrapper, publicLinks.wrapper, contributions.wrapper);
    function updateVisibility() {
      for (const { control } of [avatar, publicLinks, contributions]) control.disabled = !main.control.checked;
    }
    main.control.addEventListener("change", updateVisibility);
    updateVisibility();
    const controls = node("fieldset");
    const rows = node("div", null, "creator-profile-links");
    const add = button("添加链接");
    const linkFields = new Map();
    function addLink({ label = "", url = "" } = {}) {
      if (linkFields.size >= maxLinks) return;
      const row = node("div", null, "creator-profile-link");
      const labelInput = input(label, 60);
      const urlInput = input(url, 512, "url");
      urlInput.placeholder = "https://...";
      const remove = button("移除");
      remove.setAttribute("aria-label", "移除此链接");
      remove.addEventListener("click", () => {
        row.remove();
        linkFields.delete(row);
        add.disabled = false;
        add.focus();
      });
      row.append(field("链接名", labelInput), field("HTTPS 地址", urlInput), remove);
      rows.append(row);
      linkFields.set(row, { labelInput, urlInput });
      add.disabled = linkFields.size >= maxLinks;
      return labelInput;
    }
    if (Array.isArray(profile.links)) profile.links.forEach(addLink);
    add.addEventListener("click", () => addLink()?.focus());
    const status = node("p", "", "qc-hint");
    status.setAttribute("role", "status");
    const submit = button("保存共创档案", "submit");
    const review = button("重新读取公开内容");
    review.hidden = true;
    review.addEventListener("click", () => {
      if (!window.confirm("重新读取会舍弃当前未保存的更改，继续吗？")) return;
      delete root.dataset.ready;
      void load();
    });
    controls.append(node("legend", "作品与主页链接"), rows, add);
    form.append(
      field("公开署名", displayName), field("简短介绍", bio), controls, visibility,
      node("p", "账户头像可在本页上方调整。关闭公开档案会撤下已公开的资料；单独关闭一项会停止展示该项。请不要填写手机号、真实姓名等不想公开的信息。", "qc-hint"),
      ...(!membership ? [node("p", "还未登记共创身份时不会显示成员卡片。如果你公开已审核贡献，仍可单独出现在鸣谢名单。", "qc-hint")] : []),
      submit, status, review,
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      const links = [];
      for (const { labelInput, urlInput } of linkFields.values()) {
        const label = labelInput.value.trim();
        const url = urlInput.value.trim();
        if (!label && !url) continue;
        try {
          const parsed = new URL(url);
          if (!label || parsed.protocol !== "https:" || parsed.username || parsed.password ||
              parsed.port || /[\s\\]/.test(url)) throw new Error();
          links.push({ label, url });
        } catch {
          status.textContent = "每条链接都需填写名称和有效的 HTTPS 地址。";
          (label ? urlInput : labelInput).focus();
          return;
        }
      }
      const publicProfile = main.control.checked;
      if (publicProfile && !displayName.value.trim()) {
        status.textContent = "公开前请填写公开署名。";
        displayName.focus();
        return;
      }
      submit.disabled = true;
      status.textContent = "正在保存…";
      try {
        const saved = await request({
          display_name: displayName.value.trim(), bio: bio.value.trim(), links,
          ...(typeof publicationVersion === "string" ? { publication_version: publicationVersion } : {}),
          public_profile: publicProfile,
          public_avatar: publicProfile && avatar.control.checked,
          public_links: publicProfile && publicLinks.control.checked,
          public_contributions: publicProfile && contributions.control.checked,
        }, csrf);
        if (typeof saved.publication_version === "string") publicationVersion = saved.publication_version;
        review.hidden = true;
        if (!publicProfile) {
          for (const { control } of [avatar, publicLinks, contributions]) control.checked = false;
        }
        status.textContent = publicProfile ? "已保存公开设置。" : "已保存。共创档案不会公开。";
      } catch (error) {
        status.textContent = error.message;
        review.hidden = error.status !== 409;
      } finally {
        submit.disabled = false;
      }
    });
    root.replaceChildren(preview, form);
    if (location.hash === "#creator-profile") root.parentElement.scrollIntoView({ block: "start" });
  }

  async function load() {
    const root = document.querySelector("[data-creator-account]");
    if (!root || root.dataset.loading || root.dataset.ready) return;
    root.dataset.loading = "true";
    try {
      const data = await request();
      if (!root.isConnected) return;
      root.parentElement.hidden = false;
      render(root, data);
      root.dataset.ready = "true";
    } catch (error) {
      if (!root.isConnected || error.status === 404) return;
      const retry = button("重新读取");
      retry.addEventListener("click", load);
      root.replaceChildren(node("p", error.message, "qc-hint"), retry);
    } finally {
      delete root.dataset.loading;
    }
  }

  window.HuiguanCreatorProfile = { load };
})();
