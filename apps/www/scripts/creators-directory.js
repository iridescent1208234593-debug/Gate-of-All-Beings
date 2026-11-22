const directory = document.querySelector("#creator-directory");
const cards = directory.querySelector("[data-creator-cards]");
const credits = directory.querySelector("[data-creator-credits]");
const filters = directory.querySelector("[data-creator-filters]");
const search = directory.querySelector("[data-creator-search]");
const kind = directory.querySelector("[data-creator-kind]");
const group = directory.querySelector("[data-creator-group]");
const status = directory.querySelector("[data-creator-status]");
const retry = directory.querySelector("[data-creator-retry]");
const profiles = new Map();
const identityLabels = { resident_creator: "驻馆共创者（编内）", guest_creator: "客席共创者（编外）" };
const endpoint = "/api/creators/directory";
const domains = window.IridescentlyDomains;
const hallOrigin = domains?.service(location.hostname)
  ? new URL(domains.url("huiguan", "/")).origin
  : location.origin;
let members = [];

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function link(value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !label) return null;
    const anchor = node("a", "", label);
    anchor.href = url.href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    return anchor;
  } catch {
    return null;
  }
}

function avatar(member, name) {
  const initial = Array.from(name)[0] || "创";
  const element = node("span", "creator-card__avatar", initial);
  element.setAttribute("aria-hidden", "true");
  if (text(member.avatar_url)) {
    try {
      if (!member.avatar_url.startsWith("/api/uploads/preview?")) return element;
      const url = new URL(member.avatar_url, hallOrigin);
      if (url.origin !== hallOrigin || url.pathname !== "/api/uploads/preview" || !url.search || url.hash) return element;
      const image = node("img");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => { element.textContent = initial; }, { once: true });
      image.src = url.href;
      element.replaceChildren(image);
    } catch { /* no avatar is a valid directory state */ }
  }
  return element;
}

function paragraph(container, label, value) {
  if (value) container.append(node("p", "", label + value));
}

function contributions(container, values, includeName = false) {
  const ul = node("ul");
  for (const value of list(values)) {
    const title = text(value.title);
    if (!title) continue;
    const line = node("li");
    const name = includeName ? text(value.display_name) : "";
    line.append(link(value.url, title) || document.createTextNode(title));
    const caption = [name, text(value.completed_on), text(value.summary)].filter(Boolean).join(" · ");
    if (caption) line.append(document.createTextNode(" · " + caption));
    ul.append(line);
  }
  if (ul.childElementCount) container.append(ul);
}

function profile(member) {
  const name = text(member.display_name);
  const item = node("article", "creator-card");
  const label = identityLabels[member.creator_kind] || "";
  const slug = text(member.profile_slug);
  if (/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(slug)) item.id = "creator-" + slug;
  const heading = node("div", "creator-card__head");
  const names = node("div");
  const title = node("h3", "creator-card__name");
  if (item.id) {
    const anchor = node("a", "", name);
    anchor.href = "#" + item.id;
    title.append(anchor);
  } else {
    title.textContent = name;
  }
  names.append(title);
  if (label) names.append(node("span", "creator-card__kind", label));
  heading.append(avatar(member, name), names);
  item.append(heading);

  const assignments = list(member.assignments).map((assignment) =>
    [text(assignment.group), text(assignment.duty)].filter(Boolean).join(" · "));
  paragraph(item, "", assignments.filter(Boolean).join("、"));
  paragraph(item, "目前在做：", text(member.current_work));
  const details = node("details");
  details.append(node("summary", "", "查看共创资料"));
  paragraph(details, "加入时间：", text(member.joined_on));
  paragraph(details, "", text(member.bio));
  const links = node("ul");
  for (const value of list(member.links)) {
    const anchor = link(value.url, text(value.label));
    if (!anchor) continue;
    const li = node("li");
    li.append(anchor);
    links.append(li);
  }
  if (links.childElementCount) details.append(links);
  contributions(details, member.contributions);
  if (details.childElementCount > 1) item.append(details);
  if (item.id) profiles.set(item.id, { item, details });
  return item;
}

function valueOptions(select, values, all) {
  select.replaceChildren(new Option(all, ""));
  for (const [value, label] of values) select.add(new Option(label, value));
}

function update() {
  const tokens = search.value.normalize("NFKC").toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = members.filter((member) => {
    const assignments = list(member.assignments);
    if (kind.value && member.creator_kind !== kind.value) return false;
    if (group.value && !assignments.some((assignment) => assignment.group === group.value)) return false;
    const searchable = [member.display_name, identityLabels[member.creator_kind], member.bio, member.current_work,
      ...assignments.flatMap((assignment) => [assignment.group, assignment.duty]),
      ...list(member.contributions).flatMap((entry) => [entry.title, entry.summary]),
    ].map(text).join(" ").normalize("NFKC").toLowerCase();
    return tokens.every((token) => searchable.includes(token));
  });
  profiles.clear();
  cards.replaceChildren(...visible.map(profile));
  status.textContent = visible.length ? `找到 ${visible.length} 份公开档案` :
    members.length ? "没有符合这些条件的档案。" : "暂时没有公开的共创档案。";
}

function followProfileHash() {
  const focused = profiles.get(location.hash.slice(1));
  if (!focused) return;
  focused.details.open = true;
  focused.item.scrollIntoView({ block: "start" });
}

async function load() {
  retry.hidden = true;
  status.textContent = "正在读取共创档案……";
  try {
    const options = { cache: "no-cache", credentials: "omit", redirect: "error", headers: { Accept: "application/json" } };
    let response = await fetch(endpoint, options);
    const localOnly = hallOrigin === location.origin;
    if (!localOnly && ([404, 405].includes(response.status) ||
      (response.ok && !response.headers.get("Content-Type")?.includes("application/json")))) {
      response = await fetch(hallOrigin + endpoint, options);
    }
    if ([404, 405].includes(response.status)) {
      directory.hidden = true;
      document.querySelector("[data-creator-nav]")?.setAttribute("hidden", "");
      return;
    }
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!Array.isArray(data.members)) throw new Error();
    directory.hidden = false;
    document.querySelector("[data-creator-nav]")?.removeAttribute("hidden");
    members = list(data.members).filter((member) => text(member.display_name));
    valueOptions(kind, new Map(members.flatMap((member) => {
      const value = text(member.creator_kind);
      const label = identityLabels[value];
      return value && label ? [[value, label]] : [];
    })), "全部身份");
    const groups = [...new Set(members.flatMap((member) => list(member.assignments)
      .map((assignment) => text(assignment.group)).filter(Boolean)))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    valueOptions(group, groups.map((value) => [value, value]), "全部分组");
    filters.hidden = !members.length;
    update();
    credits.replaceChildren(node("h3", "", "共创贡献"));
    contributions(credits, data.credits, true);
    credits.hidden = credits.childElementCount < 2;
    credits.className = "creator-directory__credits";
    followProfileHash();
  } catch {
    status.textContent = "暂时无法读取共创档案，本页联系与鸣谢仍可查看。";
    retry.hidden = false;
  }
}

search.addEventListener("input", update);
kind.addEventListener("change", update);
group.addEventListener("change", update);
retry.addEventListener("click", load);
window.addEventListener("hashchange", followProfileHash);
load();
