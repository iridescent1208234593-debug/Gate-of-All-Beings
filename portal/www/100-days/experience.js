const scenes = [...document.querySelectorAll(".scene")];
const chapters = [...document.querySelectorAll("[data-chapter-track] i")];
const announcer = document.querySelector("[data-announcer]");
const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const progressFill = document.querySelector("[data-progress-fill]");
const toggleButton = document.querySelector("[data-toggle]");
const previousButton = document.querySelector("[data-previous]");
const nextButton = document.querySelector("[data-next]");
const sceneCount = document.querySelector("[data-scene-count]");

let current = 0;
let elapsed = 0;
let lastTick = 0;
let animationFrame = 0;
let playing = !prefersReducedMotion.matches;

const durationAt = (index) => Number(scenes[index].dataset.duration || 12000);

function syncBeat(scene) {
  const thresholds = (scene.dataset.beats || "").split(",").filter(Boolean).map(Number);
  const beat = thresholds.filter((threshold) => elapsed >= threshold).length;
  if (scene.dataset.beat === String(beat)) return;
  scene.dataset.beat = String(beat);
  scene.querySelectorAll("[data-beat-after]").forEach((element) => {
    element.classList.toggle("is-revealed", beat >= Number(element.dataset.beatAfter));
  });
  scene.querySelectorAll("[data-beat-show]").forEach((element) => {
    element.classList.toggle("is-current", beat === Number(element.dataset.beatShow));
  });
}

function renderProgress() {
  const duration = durationAt(current);
  const fraction = Math.min(1, elapsed / duration);
  syncBeat(scenes[current]);
  progressFill.style.width = `${((current + fraction) / scenes.length) * 100}%`;
  chapters.forEach((chapter, index) => {
    const amount = index < current ? 100 : index === current ? fraction * 100 : 0;
    chapter.style.setProperty("--chapter-progress", `${amount}%`);
  });
  sceneCount.innerHTML = `${String(current + 1).padStart(2, "0")} <i>/</i> ${String(scenes.length).padStart(2, "0")}`;
}

function renderScene(announce = true) {
  scenes.forEach((scene, index) => {
    const active = index === current;
    scene.classList.toggle("is-active", active);
    scene.setAttribute("aria-hidden", String(!active));
    scene.inert = !active;
    if (active) scene.scrollTop = 0;
  });
  document.body.dataset.scene = String(current);
  previousButton.disabled = current === 0;
  nextButton.disabled = current === scenes.length - 1;
  document.body.classList.toggle("is-ending", current === scenes.length - 1);
  if (announce) {
    const title = scenes[current].querySelector("h1, h2")?.textContent.replace(/\s+/g, " ").trim();
    announcer.textContent = `第 ${current + 1} 幕，共 ${scenes.length} 幕。${title || ""}`;
  }
  renderProgress();
}

function updateToggle() {
  document.body.classList.toggle("is-playing", playing);
  toggleButton.textContent = playing ? "Ⅱ" : "▶";
  toggleButton.setAttribute("aria-pressed", String(playing));
  toggleButton.setAttribute("aria-label", playing ? "暂停播放" : "继续播放");
}

function stop() {
  playing = false;
  cancelAnimationFrame(animationFrame);
  updateToggle();
}

function tick(now) {
  if (!playing) return;
  elapsed += now - lastTick;
  lastTick = now;
  if (elapsed >= durationAt(current)) {
    if (current === scenes.length - 1) {
      elapsed = durationAt(current);
      stop();
      renderProgress();
      return;
    }
    current += 1;
    elapsed = 0;
    renderScene();
  } else {
    renderProgress();
  }
  animationFrame = requestAnimationFrame(tick);
}

function play() {
  if (current === scenes.length - 1 && elapsed >= durationAt(current)) {
    current = 0;
    elapsed = 0;
    renderScene();
  }
  playing = true;
  lastTick = performance.now();
  updateToggle();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(tick);
}

function goTo(index, shouldContinue = playing) {
  current = Math.max(0, Math.min(scenes.length - 1, index));
  elapsed = 0;
  scenes[current].dataset.beat = "-1";
  renderScene();
  if (shouldContinue && current < scenes.length - 1) play();
  else stop();
}

document.querySelector("[data-toggle]").addEventListener("click", () => playing ? stop() : play());
document.querySelector("[data-previous]").addEventListener("click", () => goTo(current - 1));
document.querySelector("[data-next]").addEventListener("click", () => goTo(current + 1));
document.querySelectorAll("[data-skip]").forEach((button) => {
  button.addEventListener("click", () => goTo(scenes.length - 1, false));
});
document.querySelector("[data-replay]").addEventListener("click", () => goTo(0, true));

prefersReducedMotion.addEventListener("change", (event) => {
  if (event.matches) stop();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing) stop();
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest("a, button, input, textarea, select")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    goTo(scenes.length - 1, false);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    goTo(current + 1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    goTo(current - 1);
  } else if (event.code === "Space") {
    event.preventDefault();
    playing ? stop() : play();
  } else if (event.key.toLowerCase() === "r") {
    goTo(0, true);
  }
});

renderScene(false);
updateToggle();
if (playing) play();
