/* Images travel as files; character/poster JSON keeps only same-origin URLs. */
(function () {
  'use strict';
  const LIMIT = 8 * 1024 * 1024;
  const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const ASSET_URL = /^\/assets\/uploads\/[a-f0-9]{32,64}\.(png|jpg|webp|gif)$/;
  const FRESH_AVATAR_URL = /^\/assets\/uploads\/[a-f0-9]{64}\.(png|jpg)$/;
  const PREVIEW_URL = /^\/api\/uploads\/preview\?name=([a-f0-9]{32,64}\.(?:png|jpg|webp|gif))$/;
  // gifLimit：动图上限默认 5MB；同人图投稿传 8MB（与服务端 gif_limit 一致）
  function check(file, gifLimit = 5 * 1024 * 1024) {
    if (!file || !TYPES.includes(file.type)) throw new Error('仅支持 JPG / PNG / WebP / GIF 图片');
    const limit = file.type === 'image/gif' ? gifLimit : LIMIT;
    if (!file.size || file.size > limit) throw new Error(file.type === 'image/gif' ? `动图需≤${Math.round(gifLimit / 1048576)}MB` : '图片需≤8MB');
  }
  // AbortSignal.timeout is missing on iOS < 16, where it used to throw before the upload even started.
  function timeoutSignal(ms) {
    if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }
  async function request(url, metadata, file, opts = {}) {
    check(file, opts.gifLimit);
    const form = new FormData();
    const text = JSON.stringify(metadata);
    if (new Blob([text]).size > 256 * 1024) throw new Error('编辑内容过大，请减少文字后重试');
    form.set('metadata', text);
    form.set('image', file, file.name || 'image.' + (file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]));
    const response = await fetch(url, { method: 'POST', body: form, signal: timeoutSignal(60000) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.error || '图片保存失败，请重试');
      error.status = response.status;
      throw error;
    }
    return result;
  }
  // Large camera/screenshot files crawl through the tunnel on save; downscale before upload.
  const SHRINK_OVER = 700 * 1024, MAX_SIDE = 1800;
  async function shrink(file) {
    if (!(file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp') || file.size <= SHRINK_OVER) return file;
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * ratio)), h = Math.max(1, Math.round(bitmap.height * ratio));
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      let alpha = false;
      if (file.type !== 'image/jpeg') {
        const probe = document.createElement('canvas'); probe.width = probe.height = 128;
        const pctx = probe.getContext('2d'); pctx.drawImage(bitmap, 0, 0, 128, 128);
        const px = pctx.getImageData(0, 0, 128, 128).data;
        for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { alpha = true; break; }
      }
      if (!alpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(bitmap, 0, 0, w, h); bitmap.close && bitmap.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, alpha ? 'image/webp' : 'image/jpeg', 0.9));
      if (!blob || blob.size >= file.size || (alpha && blob.type !== 'image/webp')) return file;
      return blob;
    } catch (error) { return file; }
  }
  async function upload(source) {
    let file = source instanceof Blob ? source : null;
    if (!file && /^data:image\//.test(source || '')) file = await (await fetch(source)).blob();
    if (!file) return source;
    const result = await request('/api/images/upload', {}, await shrink(file));
    const savedUrl = durable(result.url);
    if (!ASSET_URL.test(savedUrl || '')) throw new Error('图片保存地址无效');
    return savedUrl;
  }
  // The server shows stored uploads as /api/uploads/preview?name=…; saving needs the durable path back.
  function durable(value) {
    const match = typeof value === 'string' && PREVIEW_URL.exec(value);
    return match ? '/assets/uploads/' + match[1] : value;
  }
  async function character(data) {
    data = { ...data, image: durable(data.image), avatar_asset_id: durable(data.avatar_asset_id) };
    if (Array.isArray(data.images)) data.images = data.images.map(durable);
    const next = { ...data };
    const cache = new Map();
    const resolve = async value => {
      if (!cache.has(value)) cache.set(value, upload(value));
      return cache.get(value);
    };
    // Warm the cache concurrently so several pictures do not upload one after another.
    const sources = [...new Set([next.image, ...(Array.isArray(data.images) ? data.images : [])].filter(Boolean))];
    await Promise.all(sources.map(resolve));
    if (next.image) next.image = await resolve(next.image);
    if (next.avatar_asset_id) {
      const avatar = next.avatar_asset_id;
      if (avatar instanceof Blob || /^data:image\//.test(avatar || '')) {
        const file = avatar instanceof Blob ? avatar : await (await fetch(avatar)).blob();
        const result = await request('/api/avatars/upload', {}, file);
        const savedAvatar = durable(result.avatar_asset_id);
        if (!FRESH_AVATAR_URL.test(savedAvatar || '')) throw new Error('头像保存地址无效');
        next.avatar_asset_id = savedAvatar;
      }
    }
    if (next.avatar_asset_id && !ASSET_URL.test(next.avatar_asset_id)) throw new Error('OC 头像资源地址无效');
    if (next.avatar_display_shape && !['square', 'circle'].includes(next.avatar_display_shape)) throw new Error('OC 头像显示形状无效');
    if (Array.isArray(next.images)) {
      next.images = [];
      for (const image of data.images) next.images.push(await resolve(image));
    }
    return next;
  }
  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片生成失败，请重试')), 'image/png'));
  }
  // iPhone Safari files <a download> under Files, not Photos, and WeChat/QQ ignore it entirely:
  // there, offer the system share sheet (存储到照片) and fall back to a long-press preview.
  // Android browsers keep the plain download, which shows up in the gallery.
  const IN_APP = /MicroMessenger|QQ\/|MQQBrowser|Weibo|DingTalk|Lark|Feishu|AlipayClient/i;
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function dataUrl(blob) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
  }
  async function preview(blob) {
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', '保存图片');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));background:rgba(12,16,14,.88);color:#fbf8f2;font:14px/1.6 system-ui,sans-serif;text-align:center';
    const image = document.createElement('img');
    image.alt = '生成的图片'; image.style.cssText = 'max-width:100%;max-height:calc(100dvh - 140px);object-fit:contain;border-radius:8px;box-shadow:0 8px 30px #0008;-webkit-touch-callout:default;user-select:auto';
    const tip = document.createElement('p'); tip.style.margin = '0'; tip.textContent = '长按图片，选择「保存图片」或「存储到照片」';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '完成';
    close.style.cssText = 'min-height:40px;padding:8px 28px;border:1px solid #fbf8f280;border-radius:999px;background:transparent;color:inherit;font:inherit';
    const dismiss = () => overlay.remove();
    close.addEventListener('click', dismiss);
    overlay.addEventListener('click', event => { if (event.target === overlay) dismiss(); });
    overlay.append(image, tip, close); document.body.appendChild(overlay);
    // In-app browsers only offer “save” on long-press for real image URLs, not blob: ones.
    image.src = await dataUrl(blob);
    close.focus();
  }
  async function download(blob, name) {
    if (IOS || IN_APP.test(navigator.userAgent)) {
      const file = typeof File === 'function' ? new File([blob], name, { type: blob.type || 'image/png' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); return; }
        catch (error) { if (error && error.name === 'AbortError') return; /* activation expired: preview instead */ }
      }
      return preview(blob);
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    // Mobile browsers may consume the download asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  window.HuiguanImages = { request, upload, character, canvasBlob, download, shrink, limit: LIMIT };
})();
