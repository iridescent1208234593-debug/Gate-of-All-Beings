import noMoreWandering from "../assets/music/不再流浪.m4a?url";
import goodMorning from "../assets/music/早安喵.mp3?url";
import giessenLutum from "../assets/music/Giessen-Lutum.mgg0.flac?url";

const root = document.querySelector("[data-music-player]");
if (root) {
  const toggle = root.querySelector("[data-music-toggle]");
  const panel = root.querySelector("[data-music-panel]");
  const audio = root.querySelector("[data-music-audio]");
  const title = root.querySelector("[data-music-title]");
  const status = root.querySelector("[data-music-status]");
  const playButton = root.querySelector("[data-music-play]");
  const seek = root.querySelector("[data-music-seek]");
  const currentTime = root.querySelector("[data-music-current]");
  const duration = root.querySelector("[data-music-duration]");
  const tracks = [
    { title: "早安喵", src: goodMorning },
    { title: "不再流浪", src: noMoreWandering },
    { title: "Giessen - Lutum", src: giessenLutum },
  ];
  let trackIndex = 0;
  let seeking = false;
  let toggleClickTimer = 0;
  let playbackBeforeToggle = false;

  audio.volume = 0.38;

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };

  const syncPlayback = () => {
    const playing = !audio.paused && !audio.ended;
    toggle.setAttribute("aria-pressed", String(playing));
    toggle.setAttribute("aria-label", playing ? "暂停音乐" : "播放音乐");
    toggle.title = playing
      ? "单击暂停，双击打开音乐控制"
      : "单击播放，双击打开音乐控制";
    playButton.setAttribute("aria-pressed", String(playing));
    playButton.setAttribute("aria-label", playing ? "暂停音乐" : "播放音乐");
    playButton.title = playing ? "暂停音乐" : "播放音乐";
  };

  const play = () => {
    status.textContent = "";
    const attempt = audio.play();
    if (attempt?.then) {
      attempt.then(syncPlayback).catch((error) => {
        syncPlayback();
        if (error?.name === "NotAllowedError")
          status.textContent = "点按播放音乐";
      });
    }
  };

  const loadTrack = (index, shouldPlay = true) => {
    trackIndex = (index + tracks.length) % tracks.length;
    const track = tracks[trackIndex];
    title.textContent = track.title;
    status.textContent = "";
    audio.src = track.src;
    audio.load();
    seek.value = "0";
    currentTime.value = "0:00";
    duration.value = "0:00";
    if (shouldPlay) play();
    else syncPlayback();
  };

  const setPanelOpen = (open, restoreFocus = false) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (restoreFocus) toggle.focus({ preventScroll: true });
  };

  const onToggle = () => {
    if (toggleClickTimer) {
      window.clearTimeout(toggleClickTimer);
      toggleClickTimer = 0;
      if (playbackBeforeToggle && audio.paused) play();
      else if (!playbackBeforeToggle && !audio.paused) audio.pause();
      setPanelOpen(panel.hidden);
      return;
    }
    playbackBeforeToggle = !audio.paused && !audio.ended;
    if (playbackBeforeToggle) audio.pause();
    else play();
    toggleClickTimer = window.setTimeout(() => (toggleClickTimer = 0), 280);
  };
  const onPlay = () => {
    if (audio.paused || audio.ended) play();
    else audio.pause();
  };
  const onPrevious = () => {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    loadTrack(trackIndex - 1);
  };
  const onNext = () => loadTrack(trackIndex + 1);
  const onTimeUpdate = () => {
    if (!seeking && Number.isFinite(audio.duration) && audio.duration > 0)
      seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    currentTime.value = formatTime(audio.currentTime);
  };
  const onMetadata = () => {
    duration.value = formatTime(audio.duration);
    onTimeUpdate();
  };
  const onSeekInput = () => {
    seeking = true;
    if (Number.isFinite(audio.duration) && audio.duration > 0)
      currentTime.value = formatTime((Number(seek.value) / 1000) * audio.duration);
  };
  const onSeekChange = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0)
      audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
    seeking = false;
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      setPanelOpen(false, true);
    }
  };
  const retryAfterGesture = (event) => {
    document.removeEventListener("pointerdown", retryAfterGesture);
    document.removeEventListener("keydown", retryAfterGesture);
    if (
      event.target instanceof Element &&
      event.target.closest("[data-music-player]")
    )
      return;
    if (audio.paused && !audio.error) play();
  };
  const onError = () => {
    syncPlayback();
    status.textContent = "此音频格式无法在浏览器播放";
  };

  toggle.addEventListener("click", onToggle);
  playButton.addEventListener("click", onPlay);
  root.querySelector("[data-music-previous]").addEventListener("click", onPrevious);
  root.querySelector("[data-music-next]").addEventListener("click", onNext);
  seek.addEventListener("input", onSeekInput);
  seek.addEventListener("change", onSeekChange);
  audio.addEventListener("play", syncPlayback);
  audio.addEventListener("pause", syncPlayback);
  audio.addEventListener("timeupdate", onTimeUpdate);
  audio.addEventListener("loadedmetadata", onMetadata);
  audio.addEventListener("ended", syncPlayback);
  audio.addEventListener("error", onError);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("pointerdown", retryAfterGesture, { once: true });
  document.addEventListener("keydown", retryAfterGesture, { once: true });

  loadTrack(0);

  window.addEventListener(
    "pagehide",
    () => {
      audio.pause();
      window.clearTimeout(toggleClickTimer);
      document.removeEventListener("pointerdown", retryAfterGesture);
      document.removeEventListener("keydown", retryAfterGesture);
    },
    { once: true },
  );
}
