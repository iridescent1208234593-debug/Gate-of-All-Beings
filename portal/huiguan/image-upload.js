/* Images travel as files; character/poster JSON keeps only same-origin URLs. */
(function () {
  'use strict';
  const LIMIT = 8 * 1024 * 1024;
  const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  function check(file) {
    if (!file || !TYPES.includes(file.type)) throw new Error('仅支持 JPG / PNG / WebP / GIF 图片');
    const limit = file.type === 'image/gif' ? 5 * 1024 * 1024 : LIMIT;
    if (!file.size || file.size > limit) throw new Error(file.type === 'image/gif' ? '动图需≤5MB' : '图片需≤8MB');
  }
  async function request(url, metadata, file) {
    check(file);
    const form = new FormData();
    const text = JSON.stringify(metadata);
    if (new Blob([text]).size > 256 * 1024) throw new Error('编辑内容过大，请减少文字后重试');
    form.set('metadata', text);
    form.set('image', file, file.name || 'image.' + (file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]));
    const response = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
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
    if (!/^\/assets\/uploads\/[a-f0-9]+\.(png|jpg|webp|gif)$/.test(result.url || '')) throw new Error('图片保存地址无效');
    return result.url;
  }
  async function character(data) {
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
        if (!/^\/assets\/uploads\/[a-f0-9]{64}\.(png|jpg)$/.test(result.avatar_asset_id || '')) throw new Error('头像保存地址无效');
        next.avatar_asset_id = result.avatar_asset_id;
      }
    }
    if (next.avatar_asset_id && !/^\/assets\/uploads\/[a-f0-9]{32,64}\.(png|jpg|webp|gif)$/.test(next.avatar_asset_id)) throw new Error('OC 头像资源地址无效');
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
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    // Mobile browsers may consume the download asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  window.HuiguanImages = { request, upload, character, canvasBlob, download, shrink, limit: LIMIT };
})();
