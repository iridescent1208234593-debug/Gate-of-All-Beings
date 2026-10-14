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
  async function upload(source) {
    if (!/^data:image\//.test(source || '')) return source;
    const file = await (await fetch(source)).blob();
    const result = await request('/api/images/upload', {}, file);
    if (!/^\/assets\/uploads\/[a-f0-9]+\.(png|jpg|webp|gif)$/.test(result.url || '')) throw new Error('图片保存地址无效');
    return result.url;
  }
  async function character(data) {
    const next = { ...data };
    const cache = new Map();
    const resolve = async value => {
      if (!cache.has(value)) cache.set(value, await upload(value));
      return cache.get(value);
    };
    if (next.image) next.image = await resolve(next.image);
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
  window.HuiguanImages = { request, upload, character, canvasBlob, download, limit: LIMIT };
})();
