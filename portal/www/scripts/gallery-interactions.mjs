import { Raycaster, Vector2, Vector3 } from "three";
import "../../huiguan/reactions-fx.js";
import { bindGalleryGestures } from "./gallery-gestures.mjs";
import { placeGalleryControls } from "./gallery-placement.mjs";

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const noteKey = "iridescently.galleryCapacityNoteDismissed.v1";

export function createGalleryInteractions({ engine, gallery, canvas, getCurrentIndex, capacityNote }) {
  const noteText = capacityNote?.querySelector("[data-capacity-copy]");
  const dismiss = capacityNote?.querySelector("[data-capacity-dismiss]");
  const original = capacityNote?.querySelector("[data-gallery-original]");
  let noteDismissed = false;
  let isAdmin = false;
  try { noteDismissed = localStorage.getItem(noteKey) === "1"; } catch {}

  const panel = document.createElement("section");
  panel.className = "gallery-interaction-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "当前图片互动");
  panel.innerHTML = `
    <div class="gallery-interaction-panel__actions">
      <button type="button" data-gallery-like aria-label="点赞" title="点赞">${window.RFX.icons.like}<span data-like-count>0</span></button>
      <button type="button" data-gallery-love aria-label="喜欢" title="喜欢">${window.RFX.icons.love}<span data-love-count>0</span></button>
    </div>
    <div class="gallery-interaction-panel__traces">
      <button type="button" class="gallery-comment-trace" data-gallery-trace aria-label="看看图片旁留下的话" hidden><i></i><i></i><i></i></button>
      <button type="button" class="gallery-comment-wake" data-gallery-comment-open aria-label="留下评论" disabled><span aria-hidden="true">✧</span><span>写一句</span></button>
    </div>
    <div class="gallery-comment-peek" data-gallery-peek hidden>
      <div data-gallery-peek-rows></div>
      <button type="button" data-gallery-more hidden>还有几句</button>
    </div>
    <form class="gallery-comment-form" data-gallery-comment-form hidden>
      <p>只能选择一张图片留下评论，最多 25 个字。</p>
      <textarea maxlength="25" rows="2" aria-label="评论内容" placeholder="留下一句温柔的话" required></textarea>
      <div><button type="button" data-gallery-comment-cancel>收起</button><button type="submit" data-gallery-comment-submit>留下</button></div>
    </form>
    <p class="gallery-interaction-panel__message" data-gallery-message role="status" hidden></p>`;
  document.body.append(panel);

  const likeButton = panel.querySelector("[data-gallery-like]");
  const loveButton = panel.querySelector("[data-gallery-love]");
  const commentOpen = panel.querySelector("[data-gallery-comment-open]");
  const trace = panel.querySelector("[data-gallery-trace]");
  const peek = panel.querySelector("[data-gallery-peek]");
  const peekRows = panel.querySelector("[data-gallery-peek-rows]");
  const more = panel.querySelector("[data-gallery-more]");
  const commentForm = panel.querySelector("[data-gallery-comment-form]");
  const commentInput = commentForm.querySelector("textarea");
  const commentSubmit = panel.querySelector("[data-gallery-comment-submit]");
  const message = panel.querySelector("[data-gallery-message]");

  const safeProbe = document.createElement("div");
  safeProbe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.append(safeProbe);
  let safeInsets = {};
  const readSafeInsets = () => {
    const style = getComputedStyle(safeProbe);
    safeInsets = { safeTop: parseFloat(style.paddingTop) || 0,
      safeRight: parseFloat(style.paddingRight) || 0,
      safeBottom: parseFloat(style.paddingBottom) || 0,
      safeLeft: parseFloat(style.paddingLeft) || 0 };
  };
  readSafeInsets();
  window.addEventListener("resize", readSafeInsets);

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const corner = new Vector3();
  const pending = new Map();
  let currentIndex = -1;
  let state = null;
  let stateController = null;
  let actionQueue = Promise.resolve();
  let commentSaving = false;
  let commentCommitted = false;
  let signedIn = false;
  let commentOffset = 0;
  let comments = [];
  let closePeekTimer = 0;
  let messageTimer = 0;
  let projectedRect = null;
  let panelHeight = 56;

  const syncNote = () => {
    if (!capacityNote) return;
    capacityNote.hidden = noteDismissed && !isAdmin;
    capacityNote.classList.toggle("is-dismissed", noteDismissed);
    if (noteText) noteText.hidden = noteDismissed;
    if (dismiss) dismiss.hidden = noteDismissed;
    if (original) {
      original.hidden = !isAdmin || currentIndex < 0;
      original.href = isAdmin && currentIndex >= 0
        ? gallery.planeConfig[currentIndex]?.originalUrl || "#" : "#";
    }
  };
  syncNote();
  dismiss?.addEventListener("click", () => {
    noteDismissed = true;
    try { localStorage.setItem(noteKey, "1"); } catch {}
    syncNote();
  });
  fetch("/api/sso-user", { credentials: "same-origin" })
    .then((response) => response.ok ? response.json() : null)
    .then((user) => { isAdmin = user?.admin === true; syncNote(); })
    .catch(() => {});

  const showMessage = (text) => {
    message.textContent = text;
    message.hidden = false;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => { message.hidden = true; }, 3200);
  };
  const hitTest = (event) => {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return -1;
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (event.clientY - bounds.top) / bounds.height * 2);
    raycaster.setFromCamera(pointer, engine.camera);
    const hit = raycaster.intersectObjects(gallery.planes, false)[0];
    if (!hit || !hit.object.visible || !hit.object.userData.texture ||
        hit.object.material.opacity < 0.35) return -1;
    return gallery.planes.indexOf(hit.object);
  };

  const pendingFor = (image) => pending.get(image) || { like: 0, love: 0 };
  const renderComments = () => {
    peekRows.replaceChildren(...comments.map((item) => {
      const row = document.createElement("p");
      const name = document.createElement("b");
      name.textContent = `${item.name} · `;
      row.append(name, document.createTextNode(item.comment));
      return row;
    }));
    more.hidden = !state || state.comment_total <= 3;
    more.textContent = state && commentOffset + comments.length >= state.comment_total
      ? "再看前几句" : "还有几句";
  };
  const render = () => {
    if (!state || currentIndex < 0) return;
    const image = gallery.planeConfig[currentIndex].name;
    const queued = pendingFor(image);
    likeButton.querySelector("[data-like-count]").textContent = state.likes + queued.like;
    loveButton.querySelector("[data-love-count]").textContent = state.loves + queued.love;
    const interactionCount = state.interaction_count + queued.like + queued.love;
    panel.style.setProperty("--wake", clamp01(interactionCount / 66).toFixed(3));
    panel.style.setProperty("--trace-wake", clamp01((interactionCount - 30) / 36).toFixed(3));

    const canComment = state.logged_in && !state.comment_used && !commentCommitted &&
      state.interaction_count >= 66;
    commentOpen.disabled = !canComment;
    commentOpen.tabIndex = canComment ? 0 : -1;
    commentOpen.dataset.unlocked = String(canComment);
    if (!canComment) commentForm.hidden = true;
    trace.hidden = state.comment_total === 0;
    trace.querySelectorAll("i").forEach((dot, index) => {
      dot.hidden = index >= Math.min(3, Math.ceil(Math.sqrt(state.comment_total)));
    });
    if (state.comment_total === 0) peek.hidden = true;
    renderComments();
  };
  const loadState = async (index) => {
    stateController?.abort();
    const controller = new AbortController();
    stateController = controller;
    try {
      const image = gallery.planeConfig[index].name;
      const response = await fetch(`/api/gallery/state?image=${encodeURIComponent(image)}`, {
        credentials: "same-origin", signal: controller.signal,
      });
      if (!response.ok) throw new Error("互动暂时不可用");
      const result = await response.json();
      if (currentIndex !== index) return;
      state = result;
      signedIn = result.logged_in;
      commentCommitted ||= result.comment_used;
      comments = result.comments;
      commentOffset = 0;
      render();
    } catch (error) {
      if (error.name !== "AbortError" && currentIndex === index)
        showMessage(error.message || "互动暂时不可用");
    }
  };

  const submitAction = (index, action) => {
    if (index < 0 || !signedIn) {
      showMessage("登录后可以点赞和喜欢。");
      return;
    }
    const image = gallery.planeConfig[index].name;
    const button = action === "like" ? likeButton : loveButton;
    const queued = pendingFor(image);
    queued[action]++;
    pending.set(image, queued);
    if (currentIndex === index) {
      render();
      if (!panel.hidden) {
        const energy = 0.35 + 0.4 * clamp01((state?.interaction_count || 0) / 66);
        if (action === "like") window.RFX.fx.upOn(button, 0, energy);
        else window.RFX.fx.favOn(button, 0, energy);
      }
    }
    const requestId = crypto.randomUUID();
    const send = async () => {
      try {
        const response = await fetch("/api/gallery/action", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, action, request_id: requestId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "互动提交失败");
        if (currentIndex === index) state = result;
      } catch (error) {
        if (currentIndex === index) {
          showMessage(error.message || "互动提交失败");
          loadState(index);
        }
      } finally {
        queued[action]--;
        if (currentIndex === index) render();
      }
    };
    actionQueue = actionQueue.then(send, send);
  };
  const unbindGestures = bindGalleryGestures(canvas, hitTest,
    (index) => submitAction(index, "like"),
    (index) => submitAction(index, "love"));
  likeButton.addEventListener("click", () => submitAction(currentIndex, "like"));
  loveButton.addEventListener("click", () => submitAction(currentIndex, "love"));

  const openPeek = () => {
    clearTimeout(closePeekTimer);
    if (!state?.comment_total) return;
    peek.hidden = false;
  };
  const delayClosePeek = () => {
    clearTimeout(closePeekTimer);
    closePeekTimer = setTimeout(() => { peek.hidden = true; }, 900);
  };
  trace.addEventListener("pointerenter", openPeek);
  trace.addEventListener("focus", openPeek);
  trace.addEventListener("click", openPeek);
  panel.addEventListener("pointerenter", () => clearTimeout(closePeekTimer));
  panel.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "touch") delayClosePeek();
  });
  const onDocumentPointerDown = (event) => {
    if (event.pointerType === "touch" && !panel.contains(event.target)) peek.hidden = true;
  };
  document.addEventListener("pointerdown", onDocumentPointerDown);
  more.addEventListener("click", async () => {
    if (!state || more.disabled) return;
    const index = currentIndex;
    const nextOffset = commentOffset + comments.length >= state.comment_total
      ? 0 : commentOffset + comments.length;
    if (nextOffset === 0) {
      commentOffset = 0;
      comments = state.comments;
      renderComments();
      return;
    }
    more.disabled = true;
    try {
      const image = gallery.planeConfig[index].name;
      const response = await fetch(`/api/gallery/comments?image=${encodeURIComponent(image)}&offset=${nextOffset}`);
      if (!response.ok) throw new Error("留言暂时无法加载");
      const result = await response.json();
      if (currentIndex !== index) return;
      commentOffset = nextOffset;
      comments = result.comments;
      state.comment_total = result.total;
      renderComments();
    } catch (error) { showMessage(error.message || "留言暂时无法加载"); }
    finally { more.disabled = false; }
  });
  commentOpen.addEventListener("click", () => {
    if (commentOpen.disabled) return;
    peek.hidden = true;
    commentForm.hidden = false;
    commentInput.focus();
  });
  panel.querySelector("[data-gallery-comment-cancel]").addEventListener("click", () => {
    commentForm.hidden = true;
  });
  commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (commentSaving || !state || currentIndex < 0 || state.comment_used ||
        state.interaction_count < 66) return;
    const comment = commentInput.value.trim();
    if (!comment || [...comment].length > 25) {
      showMessage("评论最多 25 个字。");
      return;
    }
    const index = currentIndex;
    const image = gallery.planeConfig[index].name;
    commentSaving = true;
    commentSubmit.disabled = true;
    try {
      const response = await fetch("/api/gallery/comment", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, comment }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "评论未能提交");
      commentCommitted = true;
      commentInput.value = "";
      commentForm.hidden = true;
      if (currentIndex === index) {
        state = result;
        comments = result.comments;
        commentOffset = 0;
        render();
      } else if (currentIndex >= 0) loadState(currentIndex);
    } catch (error) { showMessage(error.message || "评论未能提交"); }
    finally { commentSaving = false; commentSubmit.disabled = false; }
  });

  const onPointerMove = (event) => {
    canvas.style.cursor = hitTest(event) >= 0 ? "pointer" : "";
    if (!projectedRect || !state?.comment_total || panel.hidden) return;
    const side = panel.dataset.side;
    const nearX = side === "right" ? Math.abs(event.clientX - projectedRect.right)
      : side === "left" ? Math.abs(event.clientX - projectedRect.left) : Infinity;
    if (nearX < 36 && event.clientY >= projectedRect.top && event.clientY <= projectedRect.bottom)
      openPeek();
    else delayClosePeek();
  };
  const onPointerLeave = () => { canvas.style.cursor = ""; delayClosePeek(); };
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  const resizeObserver = new ResizeObserver(([entry]) => {
    if (entry.contentRect.height) panelHeight = entry.contentRect.height;
  });
  resizeObserver.observe(panel);
  const projectedImage = (plane) => {
    plane.updateWorldMatrix(true, false);
    engine.camera.updateMatrixWorld();
    const xs = [], ys = [];
    for (const [x, y] of [[-1.5, -1.5], [-1.5, 1.5], [1.5, -1.5], [1.5, 1.5]]) {
      corner.set(x, y, 0);
      plane.localToWorld(corner);
      corner.project(engine.camera);
      xs.push((corner.x + 1) * innerWidth / 2);
      ys.push((1 - corner.y) * innerHeight / 2);
    }
    return { left: Math.min(...xs), right: Math.max(...xs),
      top: Math.min(...ys), bottom: Math.max(...ys) };
  };
  const update = () => {
    const index = getCurrentIndex();
    const plane = gallery.planes[index];
    if (!plane || !plane.visible || !plane.userData.texture) {
      panel.hidden = true;
      projectedRect = null;
      if (currentIndex !== -1) {
        currentIndex = -1;
        syncNote();
      }
      return;
    }
    if (currentIndex !== index) {
      currentIndex = index;
      state = null;
      comments = [];
      commentOffset = 0;
      likeButton.querySelector("[data-like-count]").textContent = "·";
      loveButton.querySelector("[data-love-count]").textContent = "·";
      commentOpen.disabled = true;
      commentOpen.dataset.unlocked = "false";
      trace.hidden = true;
      panel.style.setProperty("--wake", "0");
      panel.style.setProperty("--trace-wake", "0");
      commentForm.hidden = true;
      peek.hidden = true;
      message.hidden = true;
      loadState(index);
      syncNote();
    }
    const rect = projectedImage(plane);
    projectedRect = rect;
    const width = Math.min(innerWidth - 16, innerWidth <= 700 ? 140 : 190);
    const height = Math.max(panelHeight, !commentForm.hidden ? 180 : !peek.hidden ? 145 : 56);
    const position = placeGalleryControls(rect, { width: innerWidth, height: innerHeight, ...safeInsets },
      { width, height });
    panel.hidden = !position;
    if (!position) return;
    panel.dataset.side = position.side;
    panel.style.left = `${position.x}px`;
    panel.style.top = `${position.y}px`;
  };
  return {
    update,
    dispose() {
      unbindGestures();
      stateController?.abort();
      clearTimeout(closePeekTimer);
      clearTimeout(messageTimer);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      window.removeEventListener("resize", readSafeInsets);
      safeProbe.remove();
      panel.remove();
    },
  };
}
