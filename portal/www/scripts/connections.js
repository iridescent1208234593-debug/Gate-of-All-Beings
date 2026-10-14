import "./brand-interaction.js";
import "./site-navigation.js";

const neighbors = document.querySelector("[data-connections-neighbors]");
const thanks = document.querySelector("[data-connections-thanks]");
const admin = document.querySelector("[data-connections-admin]");
const editToggle = document.querySelector("[data-connections-edit]");
const editor = document.querySelector("[data-connections-editor]");
const neighborEditor = document.querySelector("[data-neighbor-editor]");
const thanksEditor = document.querySelector("[data-thanks-editor]");
const status = document.querySelector("[data-connections-status]");

let neighborItems = [];
let thanksData = { sections: [] };

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text != null) item.textContent = text;
  return item;
}

function safeHttpUrl(value) {
  if (!String(value || "").trim()) return "";
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function renderNeighbors() {
  neighbors.replaceChildren();
  if (!neighborItems.length) {
    neighbors.append(node("p", "connections-empty", "友站名单正在生长中。"));
    return;
  }

  for (const item of neighborItems) {
    const href = safeHttpUrl(item.url);
    if (!href) continue;
    const card = node("a", "neighbor-card");
    card.href = href;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const avatar = node("img", "neighbor-card__avatar");
    avatar.alt = "";
    avatar.loading = "lazy";
    const imageUrl = safeHttpUrl(item.avatar);
    if (imageUrl) {
      avatar.src = imageUrl;
      avatar.addEventListener("error", () => { avatar.remove(); card.classList.add("neighbor-card--text-only"); }, { once: true });
    }

    const text = node("span", "neighbor-card__text");
    text.append(node("span", "neighbor-card__name", item.name));
    text.append(
      node("span", "neighbor-card__description", item.desc || item.url),
    );
    if (imageUrl) card.append(avatar);
    else card.classList.add("neighbor-card--text-only");
    card.append(text, node("span", "neighbor-card__arrow", "↗"));
    neighbors.append(card);
  }
}

function renderThanks() {
  thanks.replaceChildren();
  const sections = (thanksData.sections || []).filter((section) =>
    (section.items || []).some((item) => item.name || item.role),
  );
  if (!sections.length) {
    thanks.append(node("p", "connections-empty", "鸣谢名单正在生长中。"));
    return;
  }

  for (const section of sections) {
    const group = node("section", "thanks-group");
    group.append(node("h3", "", section.title));
    const list = node("ul");
    for (const item of section.items || []) {
      if (!item.name && !item.role) continue;
      const entry = node("li", "thanks-entry");
      entry.append(node("span", "thanks-entry__icon", item.icon || "✦"));
      const copy = node("span");
      if (item.name) copy.append(node("span", "thanks-entry__name", item.name));
      if (item.role) copy.append(node("span", "thanks-entry__role", item.role));
      entry.append(copy);
      list.append(entry);
    }
    group.append(list);
    thanks.append(group);
  }
}

function makeInput(value, label, attributes = {}) {
  const input = node("input");
  input.value = value || "";
  input.setAttribute("aria-label", label);
  for (const [name, attribute] of Object.entries(attributes))
    input.dataset[name] = String(attribute);
  return input;
}

function makeButton(label, action) {
  const button = node("button", "", label);
  button.type = "button";
  button.dataset[action] = "";
  return button;
}

function renderNeighborEditor() {
  neighborEditor.replaceChildren();
  neighborItems.forEach((item, index) => {
    const row = node("div", "connections-editor__row");
    row.dataset.index = String(index);
    row.append(
      makeInput(item.name, "站点名称", { neighborField: "name" }),
      makeInput(item.url, "网址", { neighborField: "url" }),
      makeInput(item.avatar, "头像链接（可留空）", { neighborField: "avatar" }),
      makeInput(item.desc, "一句话介绍", { neighborField: "desc" }),
      makeButton("删除", "neighborRemove"),
    );
    neighborEditor.append(row);
  });
}

function renderThanksEditor() {
  thanksEditor.replaceChildren();
  thanksData.sections.forEach((section, sectionIndex) => {
    const box = node("section", "connections-editor__section");
    box.dataset.section = String(sectionIndex);
    const title = node("div", "connections-editor__section-title");
    title.append(
      makeInput(section.title, "鸣谢分类", { thanksTitle: sectionIndex }),
      makeButton("删除分类", "thanksSectionRemove"),
    );
    box.append(title);

    (section.items || []).forEach((item, itemIndex) => {
      const row = node(
        "div",
        "connections-editor__row connections-editor__row--thanks",
      );
      row.dataset.item = String(itemIndex);
      row.append(
        makeInput(item.icon, "图标", {
          thanksField: "icon",
          section: sectionIndex,
          item: itemIndex,
        }),
        makeInput(item.name, "名称", {
          thanksField: "name",
          section: sectionIndex,
          item: itemIndex,
        }),
        makeInput(item.role, "感谢说明", {
          thanksField: "role",
          section: sectionIndex,
          item: itemIndex,
        }),
        makeButton("删除", "thanksItemRemove"),
      );
      box.append(row);
    });

    const actions = node("div", "connections-editor__actions");
    actions.append(makeButton("添加鸣谢", "thanksItemAdd"));
    box.append(actions);
    thanksEditor.append(box);
  });
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadContent() {
  const [linksResult, thanksResult] = await Promise.allSettled([
    loadJson("/links.json"),
    loadJson("/thanks.json"),
  ]);

  if (linksResult.status === "fulfilled" && Array.isArray(linksResult.value)) {
    neighborItems = linksResult.value;
    renderNeighbors();
  } else {
    neighbors.replaceChildren(
      node("p", "connections-empty", "友站暂时无法载入，请稍后再试。"),
    );
  }

  if (
    thanksResult.status === "fulfilled" &&
    Array.isArray(thanksResult.value.sections)
  ) {
    thanksData = thanksResult.value;
    renderThanks();
  } else {
    thanks.replaceChildren(
      node("p", "connections-empty", "鸣谢暂时无法载入，请稍后再试。"),
    );
  }
}

async function save(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function setStatus(message) {
  status.textContent = message;
}

function initializeEditor() {
  editToggle.addEventListener("click", () => {
    const open = editor.hidden;
    editor.hidden = !open;
    editToggle.setAttribute("aria-expanded", String(open));
    setStatus("");
    if (open) {
      renderNeighborEditor();
      renderThanksEditor();
    }
  });

  neighborEditor.addEventListener("input", (event) => {
    const input = event.target;
    const row = input.closest("[data-index]");
    const item = neighborItems[Number(row?.dataset.index)];
    if (item && input.dataset.neighborField)
      item[input.dataset.neighborField] = input.value;
  });

  neighborEditor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-neighbor-remove]");
    if (!button) return;
    const row = button.closest("[data-index]");
    neighborItems.splice(Number(row.dataset.index), 1);
    renderNeighborEditor();
  });

  thanksEditor.addEventListener("input", (event) => {
    const input = event.target;
    const sectionIndex = Number(input.dataset.section);
    const itemIndex = Number(input.dataset.item);
    if (input.dataset.thanksTitle != null) {
      thanksData.sections[Number(input.dataset.thanksTitle)].title =
        input.value;
    } else if (input.dataset.thanksField) {
      thanksData.sections[sectionIndex].items[itemIndex][
        input.dataset.thanksField
      ] = input.value;
    }
  });

  thanksEditor.addEventListener("click", (event) => {
    const button = event.target.closest(
      "button[data-thanks-section-remove], button[data-thanks-item-add], button[data-thanks-item-remove]",
    );
    if (!button) return;
    const sectionElement = button.closest("[data-section]");
    const sectionIndex = Number(sectionElement?.dataset.section);
    const section = thanksData.sections[sectionIndex];
    if (button.hasAttribute("data-thanks-section-remove")) {
      thanksData.sections.splice(sectionIndex, 1);
    } else if (button.hasAttribute("data-thanks-item-add") && section) {
      section.items.push({ icon: "", name: "", role: "" });
    } else if (button.hasAttribute("data-thanks-item-remove") && section) {
      const itemIndex = Number(button.closest("[data-item]")?.dataset.item);
      section.items.splice(itemIndex, 1);
    }
    renderThanksEditor();
  });

  editor.querySelector("[data-neighbor-add]").addEventListener("click", () => {
    neighborItems.push({ name: "", url: "", avatar: "", desc: "" });
    renderNeighborEditor();
  });

  editor
    .querySelector("[data-thanks-add-section]")
    .addEventListener("click", () => {
      thanksData.sections.push({ title: "新分类", items: [] });
      renderThanksEditor();
    });

  editor
    .querySelector("[data-neighbor-save]")
    .addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      setStatus("正在保存友站……");
      try {
        const items = neighborItems
          .map(({ name, url, avatar, desc }) => ({
            name: name.trim(),
            url: url.trim(),
            avatar: avatar.trim(),
            desc: desc.trim(),
          }))
          .filter((item) => item.name || item.url || item.avatar || item.desc);
        const result = await save("/api/admin/links", { items });
        neighborItems = items;
        renderNeighbors();
        renderNeighborEditor();
        setStatus(`友站已保存，共 ${result.count} 条。`);
      } catch (error) {
        setStatus(`友站保存失败：${error.message}`);
      } finally {
        button.disabled = false;
      }
    });

  editor
    .querySelector("[data-thanks-save]")
    .addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      setStatus("正在保存鸣谢……");
      try {
        const sections = thanksData.sections.map((section) => ({
          title: section.title.trim(),
          items: section.items
            .map(({ icon, name, role }) => ({
              icon: icon.trim(),
              name: name.trim(),
              role: role.trim(),
            }))
            .filter((item) => item.name || item.role || item.icon),
        }));
        const result = await save("/api/admin/thanks", { sections });
        thanksData = { sections };
        renderThanks();
        renderThanksEditor();
        setStatus(`鸣谢已保存，共 ${result.count} 个分类。`);
      } catch (error) {
        setStatus(`鸣谢保存失败：${error.message}`);
      } finally {
        button.disabled = false;
      }
    });
}

async function showAdminEditor() {
  try {
    const user = await loadJson("/api/sso-user");
    if (!user.admin) return;
    admin.hidden = false;
    initializeEditor();
  } catch {
    // Public credits remain available when the session endpoint is offline.
  }
}

void loadContent();
void showAdminEditor();

const siteMenu = document.querySelector(".site-menu");
function closeSiteMenu(event) {
  if (!siteMenu?.open) return;
  if (event.type === "keydown") { if (event.key !== "Escape") return; }
  else if (siteMenu.contains(event.target)) return;
  siteMenu.open = false;
  if (event.type === "keydown") siteMenu.querySelector("summary").focus();
}
document.addEventListener("pointerdown", closeSiteMenu);
document.addEventListener("keydown", closeSiteMenu);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  document.removeEventListener("pointerdown", closeSiteMenu);
  document.removeEventListener("keydown", closeSiteMenu);
}, { once: true });
