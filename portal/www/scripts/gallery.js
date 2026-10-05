import "../../../New project/gallery/codrops-depth-gallery/src/css/base.css";
import "../../../New project/gallery/codrops-depth-gallery/src/css/canvas.css";
import { Engine } from "../../../New project/gallery/codrops-depth-gallery/src/Experience/Engine.js";
import { createAppearanceControls } from "./appearance-controls.js";

const loading = document.querySelector("#gallery-status");
const loadingMessage = loading.querySelector(".gallery-loading__message");
const retry = loading.querySelector(".gallery-loading__retry");
const count = document.querySelector("[data-gallery-count]");
const canvas = document.querySelector(".webgl");
const root = document.body;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const prefersReducedMotionNow = () =>
  reducedMotion.matches ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const autoplayButton = document.querySelector("[data-gallery-autoplay]");
const AUTOPLAY_DELAY_MS = 8000;
const AUTOPLAY_RETRY_MS = 300;

const showReady = () => {
  if (root.dataset.galleryState === "ready") return;
  root.dataset.galleryState = "ready";
  loading.classList.add("is-hidden");
  window.setTimeout(() => loading.setAttribute("hidden", ""), 400);
};

const showError = (message) => {
  root.dataset.galleryState = "error";
  loading.classList.remove("is-hidden");
  loadingMessage.textContent = message;
  retry.hidden = false;
};

retry.addEventListener("click", () => window.location.reload());

let engine;

try {
  engine = new Engine(canvas);

  const { gallery, background, trailController } = engine.experience;
  const updateBackground = background.update.bind(background);
  background.update = (time) =>
    updateBackground(reducedMotion.matches ? 0 : time);
  const appearance = createAppearanceControls({
    gallery,
    background,
    scroll: engine.scroll,
    trailController,
    reducedMotion,
  });
  let autoplayEnabled = appearance.autoplayEnabled && !prefersReducedMotionNow();
  let autoplayDirection = 1;
  const resources = gallery.resources;
  const compactViewport = window.matchMedia("(max-width: 620px)");
  const scroll = engine.scroll;
  const updateMobilePlaneFit = () => {
    if (window.innerWidth > gallery.mobileBreakpoint) return;
    for (const plane of gallery.planes) {
      const aspectRatio = plane.userData.aspectRatio || 1;
      const fit = Math.min(1, 0.82 / aspectRatio);
      plane.scale.x *= fit;
      plane.scale.y *= fit;
    }
  };
  const updatePlaneScale = gallery.updatePlaneScale.bind(gallery);
  gallery.updatePlaneScale = () => {
    updatePlaneScale();
    updateMobilePlaneFit();
  };
  const updatePlaneMotion = gallery.updatePlaneMotion.bind(gallery);
  gallery.updatePlaneMotion = (...args) => {
    updatePlaneMotion(...args);
    updateMobilePlaneFit();
  };
  const onTexture = resources.onTexture;
  const onPalette = resources.onPalette;
  const getCurrentIndex = () => {
    const blend = gallery.getPlaneBlendData(engine.camera.position.z);
    if (!blend) return -1;
    return blend.blend >= 0.5 ? blend.nextPlaneIndex : blend.currentPlaneIndex;
  };
  let hasImage = false;
  let pendingScroll = 0;
  let scrollInputTimer = 0;
  let detentLocked = false;
  let releaseDetentTimer = 0;
  let settleFrame = 0;
  let autoplayTimer = 0;
  let autoplayTargetIndex = null;

  const clearDetent = () => {
    if (!detentLocked) return;
    detentLocked = false;
    window.clearTimeout(releaseDetentTimer);
    window.cancelAnimationFrame(settleFrame);
  };

  const syncAutoplayButton = () => {
    const label = autoplayEnabled ? "暂停自动播放" : "开启自动播放";
    autoplayButton.setAttribute("aria-pressed", String(autoplayEnabled));
    autoplayButton.setAttribute("aria-label", label);
    autoplayButton.title = label;
  };

  const clearAutoplay = () => {
    window.clearTimeout(autoplayTimer);
    autoplayTimer = 0;
  };

  const galleryIsMoving = () =>
    detentLocked || Math.abs(scroll.scrollTarget - scroll.scrollCurrent) > 1;

  const scheduleAutoplay = (delay = AUTOPLAY_DELAY_MS) => {
    clearAutoplay();
    if (prefersReducedMotionNow()) {
      if (autoplayEnabled) onReducedMotionChange();
      return;
    }
    if (!autoplayEnabled || !engine.isInitialized || gallery.planes.length < 2)
      return;

    const deadline = performance.now() + delay;
    const waitForTurn = () => {
      if (prefersReducedMotionNow()) {
        onReducedMotionChange();
        return;
      }
      if (!autoplayEnabled) return;
      const remaining = deadline - performance.now();
      if (remaining > 0 || galleryIsMoving()) {
        autoplayTimer = window.setTimeout(
          waitForTurn,
          remaining > 0
            ? Math.min(remaining, AUTOPLAY_RETRY_MS)
            : AUTOPLAY_RETRY_MS,
        );
        return;
      }

      const currentIndex = getCurrentIndex();
      if (currentIndex < 0) {
        autoplayTimer = window.setTimeout(waitForTurn, AUTOPLAY_RETRY_MS);
        return;
      }

      autoplayTargetIndex = null;
      if (currentIndex >= gallery.planes.length - 1) autoplayDirection = -1;
      else if (currentIndex <= 0) autoplayDirection = 1;
      moveToIndex(currentIndex + autoplayDirection, true);
      scheduleAutoplayAfterArrival();
    };

    autoplayTimer = window.setTimeout(waitForTurn, delay);
  };

  const scheduleAutoplayAfterArrival = () => {
    clearAutoplay();
    if (!autoplayEnabled || !engine.isInitialized || gallery.planes.length < 2)
      return;

    const waitForArrival = () => {
      if (prefersReducedMotionNow()) {
        onReducedMotionChange();
        return;
      }
      if (!autoplayEnabled) return;
      if (galleryIsMoving()) {
        autoplayTimer = window.setTimeout(waitForArrival, AUTOPLAY_RETRY_MS);
        return;
      }
      scheduleAutoplay();
    };

    autoplayTimer = window.setTimeout(waitForArrival, AUTOPLAY_RETRY_MS);
  };

  const noteManualInteraction = () => {
    clearDetent();
    scheduleAutoplay();
  };

  const onAutoplayClick = () => {
    autoplayEnabled = !autoplayEnabled;
    appearance.setAutoplayEnabled(autoplayEnabled);
    syncAutoplayButton();
    if (autoplayEnabled) scheduleAutoplay();
    else {
      clearAutoplay();
      autoplayTargetIndex = null;
    }
  };

  const onAppearancePreferenceChange = (event) => {
    const enabled = event.detail?.autoplayEnabled === true;
    autoplayEnabled = enabled && !prefersReducedMotionNow();
    syncAutoplayButton();
    if (autoplayEnabled) scheduleAutoplay();
    else clearAutoplay();
  };

  const onReducedMotionChange = () => {
    if (prefersReducedMotionNow()) {
      if (autoplayEnabled) appearance.setAutoplayEnabled(false);
      autoplayEnabled = false;
      clearAutoplay();
    } else {
      autoplayEnabled = appearance.autoplayEnabled;
      if (autoplayEnabled) scheduleAutoplay();
    }
    syncAutoplayButton();
  };

  const customizer = document.querySelector(".gallery-customizer");
  const siteChrome = document.querySelector(".site-chrome");
  syncAutoplayButton();

  resources.onTexture = (index, texture) => {
    onTexture(index, texture);
    if (texture && !hasImage) {
      hasImage = true;
      showReady();
    }
  };

  resources.onPalette = (index, palette) => {
    onPalette(index, palette);
    const startupCount = Math.min(4, resources.files.length);
    if (
      !hasImage &&
      startupCount > 0 &&
      resources.failed.size >= startupCount
    ) {
      showError("图库暂时无法连接，请稍后重试。");
    }
  };

  // Keep the Gallery's original transition and rendering core; adapt only homepage presentation.
  gallery.desktopPlaneScale = 1.08;
  gallery.mobilePlaneScale = 0.5;
  gallery.mobileXSpreadFactor = compactViewport.matches ? 0.1 : 0.25;
  const originalPlaneX = new WeakMap();
  const layoutGalleryPlanes = gallery.layoutPlanes.bind(gallery);
  gallery.layoutPlanes = () => {
    if (gallery.planes.length === 0) {
      layoutGalleryPlanes();
      return;
    }

    const firstPlane = gallery.planes[0];
    const firstBasePosition = firstPlane.userData.basePosition;
    if (!originalPlaneX.has(firstPlane))
      originalPlaneX.set(firstPlane, firstBasePosition.x);
    const centerOffset = -originalPlaneX.get(firstPlane);
    gallery.planes.forEach((plane) => {
      const basePosition = plane.userData.basePosition;
      if (!originalPlaneX.has(plane)) originalPlaneX.set(plane, basePosition.x);
      basePosition.x = originalPlaneX.get(plane) + centerOffset;
    });
    layoutGalleryPlanes();
  };
  const onCompactViewportChange = () => {
    gallery.mobileXSpreadFactor = compactViewport.matches ? 0.1 : 0.25;
    if (engine.isInitialized) engine.resize();
  };
  compactViewport.addEventListener("change", onCompactViewportChange);

  const moveToIndex = (index, isAutoplay = false) => {
    const lastIndex = gallery.planes.length - 1;
    if (!engine.isInitialized || lastIndex < 0 || detentLocked) return;

    const currentIndex = getCurrentIndex();
    const targetIndex = Math.max(0, Math.min(index, lastIndex));
    const interruptingAutoplay = autoplayTargetIndex !== null && !isAutoplay;
    if (targetIndex === currentIndex && !interruptingAutoplay) {
      if (!isAutoplay) autoplayTargetIndex = null;
      return;
    }

    const targetCameraZ =
      gallery.planes[targetIndex].position.z + scroll.firstPlaneViewOffset;
    const targetScroll = scroll.scrollFromCameraZ(targetCameraZ);
    scroll.scrollTarget = targetScroll;
    autoplayTargetIndex = isAutoplay ? targetIndex : null;
    const pauseDuration = appearance.pauseDurationMs;
    if (pauseDuration === 0) return;

    detentLocked = true;

    const waitForDetent = () => {
      if (Math.abs(scroll.scrollCurrent - targetScroll) <= 0.6) {
        scroll.scrollCurrent = targetScroll;
        scroll.previousScrollCurrent = targetScroll;
        scroll.rawVelocity = 0;
        scroll.velocity = 0;
        engine.camera.position.z = targetCameraZ;
        releaseDetentTimer = window.setTimeout(() => {
          detentLocked = false;
        }, pauseDuration);
        return;
      }

      settleFrame = window.requestAnimationFrame(waitForDetent);
    };

    settleFrame = window.requestAnimationFrame(waitForDetent);
  };

  const moveBy = (direction) => {
    const currentIndex = autoplayTargetIndex ?? getCurrentIndex();
    if (currentIndex >= 0) moveToIndex(currentIndex + direction);
  };

  const captureScrollGesture = (delta) => {
    if (detentLocked || !Number.isFinite(delta)) return;
    pendingScroll += delta;
    window.clearTimeout(scrollInputTimer);
    scrollInputTimer = window.setTimeout(() => {
      const direction =
        Math.sign(pendingScroll) * (scroll.invertScroll ? -1 : 1);
      pendingScroll = 0;
      if (direction) moveBy(direction);
    }, 110);
  };

  const addScrollInput = scroll.addScrollInput.bind(scroll);
  scroll.addScrollInput = (delta) => {
    if (Number.isFinite(delta) && delta !== 0) noteManualInteraction();
    if (appearance.pauseDurationMs > 0) {
      captureScrollGesture(delta);
      return;
    }

    autoplayTargetIndex = null;
    addScrollInput(delta);
  };

  document.querySelectorAll("[data-gallery-step]").forEach((button) => {
    button.addEventListener("click", () => {
      noteManualInteraction();
      const direction = button.dataset.galleryStep === "next" ? 1 : -1;
      moveBy(direction);
    });
  });

  const onGalleryKey = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    if (
      event.target instanceof Element &&
      event.target.closest(
        ".site-chrome, .gallery-customizer, .gallery-settings, input, textarea, select",
      )
    )
      return;

    const direction = ["ArrowDown", "ArrowRight", "PageDown"].includes(
      event.key,
    )
      ? 1
      : ["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)
        ? -1
        : 0;

    if (direction) {
      event.preventDefault();
      noteManualInteraction();
      moveBy(direction);
    } else if (event.key === "Home") {
      event.preventDefault();
      noteManualInteraction();
      moveToIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      noteManualInteraction();
      moveToIndex(gallery.planes.length - 1);
    }
  };

  const allowChromeScrolling = (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest(
        ".site-chrome, .gallery-customizer, .gallery-settings",
      )
    ) {
      event.stopImmediatePropagation();
    }
  };

  window.addEventListener("keydown", onGalleryKey);
  autoplayButton.addEventListener("click", onAutoplayClick);
  window.addEventListener(
    "gallery-appearance-preferencechange",
    onAppearancePreferenceChange,
  );
  reducedMotion.addEventListener("change", onReducedMotionChange);
  customizer.addEventListener("pointerdown", noteManualInteraction);
  customizer.addEventListener("keydown", noteManualInteraction);
  siteChrome.addEventListener("pointerdown", noteManualInteraction);
  document.addEventListener("wheel", allowChromeScrolling, {
    capture: true,
    passive: true,
  });
  document.addEventListener("touchmove", allowChromeScrolling, {
    capture: true,
    passive: true,
  });

  const handleStepClick = (event) => {
    if (event.key === "Escape") {
      document.querySelector(".site-menu[open]")?.removeAttribute("open");
    }
  };
  document.addEventListener("keydown", handleStepClick);

  const closeMenuOnOutsideClick = (event) => {
    const menu = document.querySelector(".site-menu[open]");
    if (menu && event.target instanceof Node && !menu.contains(event.target))
      menu.open = false;
  };
  document.addEventListener("pointerdown", closeMenuOnOutsideClick);

  engine
    .init()
    .then(() => {
      count.textContent = `${new Intl.NumberFormat("zh-CN").format(gallery.planes.length)} 张贺图`;
      if (gallery.planes.length === 0) showError("这里还没有可展示的图片。");
      else if (resources.textures.size > 0) showReady();
      else loadingMessage.textContent = "正在解析第一张贺图";
      autoplayButton.disabled = gallery.planes.length < 2;
      scheduleAutoplay();
    })
    .catch((error) => {
      console.error("Homepage Gallery failed to start", error);
      showError("图库暂时无法启动，请稍后重试。");
    });

  if (new URLSearchParams(window.location.search).has("inspect")) {
    window.homepageGallery = engine;
  }

  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    appearance.dispose();
    clearAutoplay();
    window.clearTimeout(scrollInputTimer);
    window.clearTimeout(releaseDetentTimer);
    window.cancelAnimationFrame(settleFrame);
    compactViewport.removeEventListener("change", onCompactViewportChange);
    window.removeEventListener("keydown", onGalleryKey);
    autoplayButton.removeEventListener("click", onAutoplayClick);
    window.removeEventListener(
      "gallery-appearance-preferencechange",
      onAppearancePreferenceChange,
    );
    reducedMotion.removeEventListener("change", onReducedMotionChange);
    customizer.removeEventListener("pointerdown", noteManualInteraction);
    customizer.removeEventListener("keydown", noteManualInteraction);
    siteChrome.removeEventListener("pointerdown", noteManualInteraction);
    document.removeEventListener("wheel", allowChromeScrolling, {
      capture: true,
    });
    document.removeEventListener("touchmove", allowChromeScrolling, {
      capture: true,
    });
    document.removeEventListener("keydown", handleStepClick);
    document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
    engine.dispose();
  });
} catch (error) {
  console.error("Homepage Gallery failed to initialize", error);
  showError("图库暂时无法启动，请稍后重试。");
}
