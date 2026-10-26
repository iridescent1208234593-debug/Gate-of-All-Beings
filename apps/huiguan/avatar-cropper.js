/* Small dependency-free square cropper shared by account and OC avatars. */
(function () {
  'use strict';
  function open(source) {
    return new Promise((resolve, reject) => {
      const overlay = document.createElement('div');
      overlay.className = 'avatar-cropper';
      overlay.innerHTML = '<section class="avatar-cropper__panel" role="dialog" aria-modal="true" aria-labelledby="avatarCropTitle">' +
        '<h2 id="avatarCropTitle">调整头像</h2><p>拖动图片调整位置，使用滑条缩放。</p>' +
        '<canvas class="avatar-cropper__stage" aria-label="头像裁切区域"></canvas>' +
        '<label class="avatar-cropper__zoom">缩放<input type="range" min="1" max="3" value="1" step="0.01"></label>' +
        '<div class="avatar-cropper__previews"><figure><canvas class="avatar-cropper__square"></canvas><figcaption>方形预览</figcaption></figure>' +
        '<figure><canvas class="avatar-cropper__circle"></canvas><figcaption>圆形预览</figcaption></figure></div>' +
        '<div class="avatar-cropper__actions"><button type="button" data-action="cancel">取消</button><button type="button" data-action="confirm">使用此头像</button></div></section>';
      document.body.appendChild(overlay);
      const panel = overlay.querySelector('.avatar-cropper__panel');
      const stage = overlay.querySelector('.avatar-cropper__stage');
      const zoom = overlay.querySelector('input[type=range]');
      const square = overlay.querySelector('.avatar-cropper__square');
      const circle = overlay.querySelector('.avatar-cropper__circle');
      const ctx = stage.getContext('2d');
      const img = new Image();
      let scale = 1, x = 0, y = 0, base = 1, stageSize = 0, drag = null, active = true, objectUrl = null;
      let sourceBytes = 0;   // 原图字节数，用于把输出压到约 30%
      const pointerMap = new Map();
      let pinchDistance = 0, pinchZoom = 1;
      const cleanup = () => {
        active = false; overlay.remove(); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', draw);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
      const finish = value => { cleanup(); resolve(value); };
      const onKey = event => { if (event.key === 'Escape') finish(null); };
      const clamp = (value, max) => Math.max(-max, Math.min(max, value));
      function cropRect() {
        const w = img.naturalWidth * base * scale, h = img.naturalHeight * base * scale;
        x = clamp(x, Math.max(0, (w - stageSize) / 2));
        y = clamp(y, Math.max(0, (h - stageSize) / 2));
        return { w, h, left: (stageSize - w) / 2 + x, top: (stageSize - h) / 2 + y };
      }
      function draw() {
        if (!img.complete || !img.naturalWidth) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = stage.getBoundingClientRect();
        stageSize = Math.max(1, Math.floor(rect.width * dpr));
        if (stage.width !== stageSize) stage.width = stageSize;
        if (stage.height !== stageSize) stage.height = stageSize;
        base = stageSize / Math.min(img.naturalWidth, img.naturalHeight);
        const crop = cropRect();
        ctx.clearRect(0, 0, stageSize, stageSize);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, stageSize, stageSize); ctx.clip();
        ctx.drawImage(img, crop.left, crop.top, crop.w, crop.h); ctx.restore();
        for (const preview of [square, circle]) {
          if (preview.width !== 160) preview.width = preview.height = 160;
          const pctx = preview.getContext('2d');
          pctx.clearRect(0, 0, 160, 160); pctx.drawImage(stage, 0, 0, stageSize, stageSize, 0, 0, 160, 160);
        }
      }
      function applyZoom(next, centerX, centerY) {
        const old = scale; scale = Math.max(1, Math.min(3, next));
        if (centerX !== undefined && old !== scale) { x = centerX + (x - centerX) * scale / old; y = centerY + (y - centerY) * scale / old; }
        zoom.value = String(scale); draw();
      }
      stage.addEventListener('pointerdown', event => {
        stage.setPointerCapture(event.pointerId); pointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointerMap.size === 1) drag = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y };
        if (pointerMap.size === 2) { const points = [...pointerMap.values()]; pinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); pinchZoom = scale; drag = null; }
      });
      stage.addEventListener('pointermove', event => {
        if (!pointerMap.has(event.pointerId)) return;
        pointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointerMap.size === 2 && pinchDistance) {
          const points = [...pointerMap.values()];
          applyZoom(pinchZoom * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / pinchDistance);
        } else if (drag && drag.id === event.pointerId) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          x = drag.x + (event.clientX - drag.clientX) * dpr; y = drag.y + (event.clientY - drag.clientY) * dpr; draw();
        }
      });
      const endPointer = event => { pointerMap.delete(event.pointerId); if (pointerMap.size < 2) pinchDistance = 0; if (!pointerMap.size) drag = null; };
      stage.addEventListener('pointerup', endPointer); stage.addEventListener('pointercancel', endPointer);
      zoom.addEventListener('input', () => applyZoom(Number(zoom.value)));
      stage.addEventListener('wheel', event => { event.preventDefault(); applyZoom(scale * (event.deltaY < 0 ? 1.06 : 0.94)); }, { passive: false });
      overlay.addEventListener('click', event => { if (event.target === overlay) finish(null); });
      overlay.querySelector('[data-action=cancel]').addEventListener('click', () => finish(null));
      overlay.querySelector('[data-action=confirm]').addEventListener('click', () => {
        if (!active) return;
        const out = document.createElement('canvas'); out.width = out.height = 512;
        const crop = cropRect();
        out.getContext('2d').drawImage(img, (0 - crop.left) / (base * scale), (0 - crop.top) / (base * scale), stageSize / (base * scale), stageSize / (base * scale), 0, 0, out.width, out.height);
        // WebP keeps a 512px avatar small enough for guest session storage and slow mobile uploads;
        // browsers without a WebP encoder hand back PNG, which every avatar endpoint also accepts.
        //
        // 体积目标：相比原图压到约 30%。质量档位从高到低试，取「画质最高且体积不超过目标」的那一档；
        // 最低只降到 0.74——再低就能看出糊边，宁可不达标也不牺牲观感。
        const target = sourceBytes ? Math.max(16 * 1024, Math.round(sourceBytes * 0.3)) : 0;
        const qualities = [0.92, 0.88, 0.84, 0.80, 0.76, 0.74];
        const done = blob => blob ? finish(blob) : (cleanup(), reject(new Error('头像裁切失败')));
        const encode = quality => new Promise(resolve => out.toBlob(resolve, 'image/webp', quality));
        (async () => {
          let smallest = null;
          for (const quality of qualities) {
            const blob = await encode(quality);
            if (!blob) break;
            if (blob.type !== 'image/webp') { done(blob); return; }   // 无 WebP 编码器：退回 PNG
            if (!smallest || blob.size < smallest.size) smallest = blob;
            if (!target || blob.size <= target) { done(blob); return; }
          }
          if (smallest) done(smallest);
          else out.toBlob(done, 'image/png');
        })().catch(() => { cleanup(); reject(new Error('头像裁切失败')); });
      });
      window.addEventListener('keydown', onKey);
      const loadSource = async () => {
        if (source instanceof Blob) { sourceBytes = source.size || 0; objectUrl = URL.createObjectURL(source); }
        else {
          const response = await fetch(source, { mode: 'cors', credentials: 'omit' });
          if (!response.ok) throw new Error('图片无法读取');
          const blob = await response.blob();
          sourceBytes = blob.size || 0;
          objectUrl = URL.createObjectURL(blob);
        }
        if (active) img.src = objectUrl;
      };
      img.onload = () => { draw(); panel.querySelector('button').focus(); };
      img.onerror = () => { cleanup(); if (objectUrl) URL.revokeObjectURL(objectUrl); reject(new Error('无法读取此图片')); };
      loadSource().catch(error => { cleanup(); reject(error); });
      window.addEventListener('resize', draw);
    });
  }
  window.HuiguanAvatarCropper = { open };
})();
