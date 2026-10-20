import { get, set } from "../../../shared/shared-session/save.js";
import { refreshSession } from "../../../shared/shared-session/session.js";

const PREFERENCE_NAMESPACE = "homepage.appearance.v1";
const ANONYMOUS_KEY = `${PREFERENCE_NAMESPACE}:anonymous`;
const MIGRATION_KEY = `${PREFERENCE_NAMESPACE}:legacy-migration`;
const LEGACY_KEYS = [
  ["iridescently.homepage.appearance.v2", 2],
  ["iridescently.homepage.appearance.v1", 1],
];
const DEFAULTS = {
  transition: 0,
  pause: 100,
  size: 50,
  motion: 50,
  atmosphere: 50,
  grain: 50,
  autoplaySeconds: 4.5,
};

function normalizeValues(source) {
  const values = {};
  let validCount = 0;

  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    const raw = source?.[key];
    const value =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim()
          ? Number(raw)
          : Number.NaN;
    if (Number.isFinite(value)) {
      const minimum = key === "autoplaySeconds" ? 1 : 0;
      const maximum = key === "autoplaySeconds" ? 10 : 100;
      const clamped = Math.max(minimum, Math.min(maximum, value));
      values[key] =
        key === "autoplaySeconds" ? Math.round(clamped * 2) / 2 : clamped;
      validCount += 1;
    } else {
      values[key] = fallback;
    }
  }

  return { values, validCount };
}

function readPreference(key) {
  try {
    const record = get(key);
    if (
      record?.schemaVersion !== 1 ||
      !record.values ||
      typeof record.values !== "object"
    )
      return null;
    return {
      ...normalizeValues(record.values).values,
      autoplayEnabled: record.values.autoplayEnabled === true,
    };
  } catch {
    return null;
  }
}

function readLegacyPreference() {
  for (const [key, version] of LEGACY_KEYS) {
    try {
      const raw = JSON.parse(localStorage.getItem(key));
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      if (raw.schemaVersion != null && raw.schemaVersion !== version) continue;
      const { values, validCount } = normalizeValues(raw.values ?? raw);
      if (validCount > 0) return values;
    } catch {
      // Try the older known key; malformed values never block the defaults.
    }
  }
  return null;
}

function migrationComplete() {
  try {
    const record = get(MIGRATION_KEY);
    return record?.schemaVersion === 1 && record.completed === true;
  } catch {
    return false;
  }
}

function finishLegacyMigration() {
  try {
    set(MIGRATION_KEY, { schemaVersion: 1, completed: true });
    for (const [key] of LEGACY_KEYS) localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function accountPreferenceKey(session) {
  if (!session?.logged_in || session.uid == null || !session.kind) return null;
  return `${PREFERENCE_NAMESPACE}:account:${encodeURIComponent(session.kind)}:${encodeURIComponent(String(session.uid))}`;
}

function readAnonymousPreference() {
  const saved = readPreference(ANONYMOUS_KEY);
  if (saved) return saved;
  return migrationComplete() ? null : readLegacyPreference();
}

function setControlsOpen(toggle, panel, open, restoreFocus = false) {
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "关闭自定义设置" : "打开自定义设置");
  if (restoreFocus) toggle.focus({ preventScroll: true });
}

export function createAppearanceControls({
  gallery,
  background,
  scroll,
  trailController,
  reducedMotion,
}) {
  const panel = document.querySelector("[data-gallery-settings]");
  const toggle = document.querySelector("[data-gallery-settings-toggle]");
  if (!panel || !toggle) return { dispose() {}, pauseDurationMs: 0 };

  const inputs = [...panel.querySelectorAll("[data-gallery-setting]")];
  let activePreferenceKey = ANONYMOUS_KEY;
  let activeAccountKey = null;
  const values = readAnonymousPreference() ?? {
    ...DEFAULTS,
    autoplayEnabled: false,
  };
  let refreshInFlight = null;

  const apply = () => {
    const transition = values.transition / 100;
    const size = 0.65 + (values.size / 100) * 0.7;
    const motion = values.motion / 50;
    const atmosphere = 0.65 + (values.atmosphere / 100) * 0.7;

    scroll.scrollSmoothing = reducedMotion.matches
      ? 1
      : transition <= 0.5
        ? 0.025 + transition * 0.11
        : 0.08 + (transition - 0.5) * 0.28;
    gallery.desktopPlaneScale = 1.08 * size;
    gallery.mobilePlaneScale = 0.5 * size;
    gallery.parallaxEnabled = !reducedMotion.matches && motion > 0;
    gallery.breathEnabled = !reducedMotion.matches && motion > 0;
    gallery.gestureParallaxEnabled = !reducedMotion.matches && motion > 0;
    gallery.parallaxAmountX = 0.16 * motion;
    gallery.parallaxAmountY = 0.08 * motion;
    gallery.breathTiltAmount = 0.045 * motion;
    gallery.breathScaleAmount = 0.03 * motion;
    gallery.gestureParallaxAmountY = 0.05 * motion;
    background.baseBlobStrength = 0.9 * atmosphere;
    background.applyMotionToBlob();
    background.noiseStrength = (values.grain / 100) * 0.08;
    trailController.configuration.specialEffectsSettings.showHeadParticles =
      !reducedMotion.matches && motion > 0;

    if (gallery.isInitialized) gallery.updatePlaneScale();
    background.update(reducedMotion.matches ? 0 : performance.now());

    for (const input of inputs) {
      const value = values[input.dataset.gallerySetting];
      input.value = String(value);
      if (input.dataset.gallerySetting === "autoplaySeconds")
        input.setAttribute("aria-valuetext", `${value} 秒/张`);
    }
    const autoplayOutput = panel.querySelector(
      '[data-gallery-setting-value="autoplaySeconds"]',
    );
    if (autoplayOutput)
      autoplayOutput.textContent = `${values.autoplaySeconds} 秒/张`;
  };

  const persist = () => {
    try {
      set(activePreferenceKey, {
        schemaVersion: 1,
        values: { ...values },
      });
    } catch {
      // The live preview remains available when browser storage is unavailable.
    }
  };

  const readAccountValues = (key) => {
    const saved = readPreference(key);
    if (saved) {
      if (!migrationComplete()) finishLegacyMigration();
      return saved;
    }

    if (migrationComplete()) return { ...DEFAULTS, autoplayEnabled: false };

    const legacy = readLegacyPreference();
    if (legacy) {
      try {
        set(key, {
          schemaVersion: 1,
          values: { ...legacy, autoplayEnabled: false },
        });
        finishLegacyMigration();
        return { ...legacy, autoplayEnabled: false };
      } catch {
        // Keep the legacy key for a later attempt if the new save cannot be written.
      }
    } else {
      finishLegacyMigration();
    }

    return { ...DEFAULTS, autoplayEnabled: false };
  };

  const activateSession = (session) => {
    const nextAccountKey = accountPreferenceKey(session);
    const nextKey = nextAccountKey ?? ANONYMOUS_KEY;
    if (nextKey === activePreferenceKey) return;

    activeAccountKey = nextAccountKey;
    activePreferenceKey = nextKey;
    const loadedValues = nextAccountKey
      ? readAccountValues(nextAccountKey)
      : (readAnonymousPreference() ?? {
          ...DEFAULTS,
          autoplayEnabled: false,
        });
    const nextValues = {
      ...loadedValues,
      autoplayEnabled: loadedValues.autoplayEnabled === true,
    };
    Object.assign(values, nextValues);
    apply();
    window.dispatchEvent(
      new CustomEvent("gallery-appearance-preferencechange", {
        detail: { autoplayEnabled: values.autoplayEnabled === true },
      }),
    );
  };

  const syncSession = () => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = refreshSession()
      .then(activateSession)
      .catch(() => activateSession({ logged_in: false }))
      .finally(() => {
        refreshInFlight = null;
      });
    return refreshInFlight;
  };

  const onInput = (event) => {
    const input = event.currentTarget;
    values[input.dataset.gallerySetting] = Number(input.value);
    apply();
    if (input.dataset.gallerySetting === "autoplaySeconds")
      window.dispatchEvent(new Event("gallery-autoplay-speedchange"));
  };
  const onChange = () => persist();
  const onReset = () => {
    Object.assign(values, DEFAULTS);
    values.autoplayEnabled = false;
    apply();
    persist();
    window.dispatchEvent(
      new CustomEvent("gallery-appearance-preferencechange", {
        detail: { autoplayEnabled: false },
      }),
    );
    if (!activeAccountKey && !migrationComplete()) finishLegacyMigration();
  };
  const onToggle = () => setControlsOpen(toggle, panel, panel.hidden, false);
  const onKeyDown = (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      setControlsOpen(toggle, panel, false, true);
    }
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") void syncSession();
  };
  // The first pageshow fires on load, right after the initial syncSession; only bfcache restores need a refresh.
  const onPageShow = (event) => {
    if (event.persisted) void syncSession();
  };

  inputs.forEach((input) => {
    input.addEventListener("input", onInput);
    input.addEventListener("change", onChange);
    input.addEventListener("pointerup", onChange);
  });
  toggle.addEventListener("click", onToggle);
  document.addEventListener("keydown", onKeyDown);
  panel
    .querySelector("[data-appearance-reset]")
    ?.addEventListener("click", onReset);
  reducedMotion.addEventListener("change", apply);
  window.addEventListener("focus", syncSession);
  window.addEventListener("pageshow", onPageShow);
  document.addEventListener("visibilitychange", onVisibilityChange);
  apply();
  void syncSession();

  return {
    dispose() {
      inputs.forEach((input) => {
        input.removeEventListener("input", onInput);
        input.removeEventListener("change", onChange);
        input.removeEventListener("pointerup", onChange);
      });
      toggle.removeEventListener("click", onToggle);
      document.removeEventListener("keydown", onKeyDown);
      panel
        .querySelector("[data-appearance-reset]")
        ?.removeEventListener("click", onReset);
      reducedMotion.removeEventListener("change", apply);
      window.removeEventListener("focus", syncSession);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
    get pauseDurationMs() {
      return values.pause === 0 ? 0 : 30 + values.pause * 4.7;
    },
    get autoplayIntervalMs() {
      return values.autoplaySeconds * 1000;
    },
    get autoplayEnabled() {
      return values.autoplayEnabled === true;
    },
    setAutoplayEnabled(enabled) {
      values.autoplayEnabled = enabled === true;
      persist();
    },
  };
}
