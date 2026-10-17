// AI 协作精灵：陪着项目时间线一起长大的三只小家伙。
// Each sprite is a tiny inline SVG; motion lives in connections.css and stops under prefers-reduced-motion.
// Hover / focus shows its card and lights its timeline nodes; click plays its little action.

const PETS = [
  {
    id: "qwen",
    name: "Qwen Max",
    kind: "水豚",
    since: "8/18",
    until: "8/30",
    work: "和 Codex 搭档，从聚灵小游戏起步，陪到重生之门肉鸽卡牌；8/30 把接力棒交给 Codex。",
    action: "蹦一下",
    svg: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <g class="pet__body">
        <circle class="pet-qwen__ear" cx="9.5" cy="10.5" r="2.4" fill="#9a6d47"/>
        <circle class="pet-qwen__ear pet-qwen__ear--r" cx="22.5" cy="10.5" r="2.4" fill="#9a6d47"/>
        <ellipse cx="16" cy="19" rx="11.5" ry="9.5" fill="#b8875c"/>
        <clipPath id="pet-qwen-shirt"><ellipse cx="16" cy="19" rx="11.5" ry="9.5"/></clipPath>
        <rect x="3" y="22.5" width="26" height="8" fill="#fbf8f1" clip-path="url(#pet-qwen-shirt)"/>
        <circle cx="16" cy="25.6" r="1.7" fill="none" stroke="var(--pet-color)" stroke-width="1.1"/>
        <path d="M16.9 26.5l1.1 1.1" stroke="var(--pet-color)" stroke-width="1.1" stroke-linecap="round"/>
        <ellipse cx="16" cy="18.6" rx="5.2" ry="3.4" fill="#9a6d47"/>
        <path d="M14.4 18.2h.01M17.6 18.2h.01" stroke="#3a2618" stroke-width="1.3" stroke-linecap="round"/>
        <g class="pet__eyes"><circle cx="11" cy="15" r="1.1" fill="#2b1d12"/><circle cx="21" cy="15" r="1.1" fill="#2b1d12"/></g>
      </g>
      <path class="pet__spark" d="M27 5l.8 1.8L29.6 7.6l-1.8.8L27 10.2l-.8-1.8L24.4 7.6l1.8-.8z" fill="var(--pet-color)"/>
    </svg>`,
  },
  {
    id: "codex",
    name: "Codex",
    kind: "终端小机器人 · GPT astra / sol / luna",
    since: "8/18",
    until: "",
    work: "8/18 和 Qwen 同行，8/30 起挑起主力：灵境会馆、项目整理、灵体联机、画廊与众生之门，一直写到现在。",
    action: "敲一行命令",
    svg: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <g class="pet__body">
        <path d="M16 6V3.4" stroke="var(--pet-color)" stroke-width="1.4" stroke-linecap="round"/>
        <circle class="pet-codex__bulb" cx="16" cy="2.8" r="1.5" fill="var(--pet-color)"/>
        <rect x="5.5" y="6" width="21" height="16" rx="5" fill="var(--pet-color)"/>
        <rect x="8.5" y="9" width="15" height="10" rx="2.4" fill="#10203a"/>
        <path class="pet-codex__prompt" d="M11 11.6l2.6 2.2-2.6 2.2" fill="none" stroke="#a9d4ff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        <rect class="pet-codex__cursor" x="15.2" y="15.4" width="4.2" height="1.5" rx=".5" fill="#a9d4ff"/>
        <rect x="11" y="22.5" width="10" height="5" rx="2" fill="var(--pet-color)" opacity=".8"/>
        <path d="M13 27.5v2M19 27.5v2" stroke="var(--pet-color)" stroke-width="1.6" stroke-linecap="round"/>
      </g>
    </svg>`,
  },
  {
    id: "claude",
    name: "Claude · Opus",
    kind: "像素小橙",
    since: "10/17",
    until: "",
    work: "10/17 加入，和 Codex 并行：先把项目梳理清楚、写好交接，再一起做账号与安全、发布修缮和这些页面细节。",
    action: "噼里啪啦敲键盘",
    svg: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
      <g class="pet__body">
        <rect class="pet-claude__arm" x="3" y="13" width="3" height="4" fill="var(--pet-color)"/>
        <rect class="pet-claude__arm pet-claude__arm--r" x="26" y="13" width="3" height="4" fill="var(--pet-color)"/>
        <rect x="6" y="8" width="20" height="13" fill="var(--pet-color)"/>
        <g class="pet__eyes"><rect x="11" y="11" width="2" height="3" fill="#1d1410"/><rect x="19" y="11" width="2" height="3" fill="#1d1410"/></g>
        <rect x="8" y="21" width="2" height="4" fill="var(--pet-color)"/><rect x="12" y="21" width="2" height="4" fill="var(--pet-color)"/>
        <rect x="18" y="21" width="2" height="4" fill="var(--pet-color)"/><rect x="22" y="21" width="2" height="4" fill="var(--pet-color)"/>
      </g>
      <g class="pet-claude__keyboard">
        <rect x="2" y="25" width="28" height="6" rx="1" fill="#efe6d6" stroke="#cbbba3" stroke-width=".8"/>
        <rect class="pet-claude__key" x="5" y="27" width="3" height="2" fill="#bba98f"/>
        <rect class="pet-claude__key pet-claude__key--2" x="10" y="27" width="3" height="2" fill="#bba98f"/>
        <rect class="pet-claude__key pet-claude__key--3" x="15" y="27" width="6" height="2" fill="#bba98f"/>
        <rect class="pet-claude__key pet-claude__key--4" x="23" y="27" width="3" height="2" fill="#bba98f"/>
      </g>
    </svg>`,
  },
];

const host = document.querySelector("[data-companions]");
const track = document.querySelector(".history-track");

if (host && track) {
  const items = [...track.querySelectorAll("li[data-crew]")];
  const byId = Object.fromEntries(PETS.map((pet) => [pet.id, pet]));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const row = document.createElement("div");
  row.className = "companions__row";
  const card = document.createElement("p");
  card.className = "companions__card";
  card.setAttribute("aria-live", "polite");
  const hint = "点点它们：会馆的 AI 协作精灵，从各自加入的那天起陪着项目长大。";
  card.textContent = hint;

  function showCard(pet) {
    if (!pet) {
      card.textContent = hint;
      card.removeAttribute("data-pet");
      return;
    }
    card.dataset.pet = pet.id;
    const status = pet.until ? `${pet.since} – ${pet.until} · 已接力` : `${pet.since} 起 · ongoing`;
    card.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = pet.name;
    const meta = document.createElement("span");
    meta.className = "companions__meta";
    meta.textContent = `${pet.kind} · ${status}`;
    const work = document.createElement("span");
    work.className = "companions__work";
    work.textContent = pet.work;
    card.append(title, meta, work);
  }

  function light(id) {
    track.dataset.focusPet = id || "";
    if (!id) delete track.dataset.focusPet;
  }

  for (const pet of PETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pet pet--${pet.id}`;
    button.dataset.pet = pet.id;
    if (!pet.until) button.dataset.ongoing = "";
    button.setAttribute("aria-label", `${pet.name}，${pet.since} 起参与${pet.until ? `，至 ${pet.until}` : "，仍在继续"}。点一下：${pet.action}`);
    button.innerHTML = `${pet.svg}<span class="pet__name">${pet.id === "claude" ? "Claude" : pet.name.split(" ")[0]}</span>`;
    const enter = () => { showCard(pet); light(pet.id); };
    const leave = () => { if (!button.classList.contains("is-acting")) { showCard(null); light(null); } };
    button.addEventListener("pointerenter", enter);
    button.addEventListener("focus", enter);
    button.addEventListener("pointerleave", leave);
    button.addEventListener("blur", () => { showCard(null); light(null); });
    button.addEventListener("click", () => {
      enter();
      button.classList.remove("is-acting");
      void button.offsetWidth; // restart the action animation on repeated clicks
      button.classList.add("is-acting");
      window.clearTimeout(button._acting);
      button._acting = window.setTimeout(() => button.classList.remove("is-acting"), 1600);
      // Walk the track to the first node this companion joined.
      const first = items.find((item) => item.dataset.crew.split(" ").includes(pet.id));
      if (first) {
        track.scrollTo({ left: first.offsetLeft - track.offsetLeft - 8, behavior: reduceMotion.matches ? "auto" : "smooth" });
      }
    });
    row.append(button);
  }

  // Tiny crew marks on each node: who walked with this stage, and where the baton changed hands.
  for (const item of items) {
    const crew = document.createElement("span");
    crew.className = "history-crew";
    crew.setAttribute("aria-hidden", "true");
    const ids = item.dataset.crew.split(" ").filter((id) => byId[id]);
    if (item.dataset.relay && byId[item.dataset.relay]) {
      crew.classList.add("history-crew--relay");
      crew.append(dot(item.dataset.relay), Object.assign(document.createElement("i"), { textContent: "→" }));
    } else if (ids.length > 1) {
      crew.classList.add("history-crew--together");
    }
    for (const id of ids) crew.append(dot(id));
    item.prepend(crew);
    const names = ids.map((id) => byId[id].name).join(" × ");
    item.title = item.dataset.relay ? `${byId[item.dataset.relay].name} 把接力棒交给 ${names}` : `同行：${names}`;
    item.addEventListener("pointerenter", () => {
      for (const id of [...ids, item.dataset.relay].filter(Boolean)) row.querySelector(`[data-pet="${id}"]`)?.classList.add("is-near");
    });
    item.addEventListener("pointerleave", () => row.querySelectorAll(".is-near").forEach((pet) => pet.classList.remove("is-near")));
  }

  function dot(id) {
    const mark = document.createElement("b");
    mark.className = `history-crew__dot history-crew__dot--${id}`;
    return mark;
  }

  host.append(row, card);
}
