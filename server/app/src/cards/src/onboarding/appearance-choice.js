/** 头像方案：已选种族框与用户头像分开保存、预览和恢复。 */
import { RACES, getRace } from './races.js';
import { createPlayerAvatar, resolvePlayerAvatar } from './player-avatar.js';

/** One center-cover crop for both pointer and touch file selection. No base64 JSON. */
export function fileAsSquareBlob(file, signal) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('请选择图片文件'));
    const source = URL.createObjectURL(file);
    const image = new Image();
    const cancel = () => { image.src = ''; URL.revokeObjectURL(source); reject(new Error('图片处理已取消')); };
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener('abort', cancel, { once: true });
    image.onerror = () => { signal?.removeEventListener('abort', cancel); URL.revokeObjectURL(source); reject(new Error('无法识别这张图片')); };
    image.onload = () => {
      signal?.removeEventListener('abort', cancel);
      URL.revokeObjectURL(source);
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      if (!side) return reject(new Error('图片尺寸无效'));
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('当前浏览器无法处理图片'));
      context.drawImage(image, (image.naturalWidth-side)/2, (image.naturalHeight-side)/2, side, side, 0, 0, 512, 512);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片处理失败')), 'image/webp', 0.88);
    };
    image.src = source;
  });
}

export function createAppearanceChoice({ root, onChoose, onBack, getAvatarFrame, profile }) {
  const events = new AbortController();
  const listen = (target, type, listener) => target.addEventListener(type, listener, { signal: events.signal });
  const { getPlayerProfile, updatePlayerProfile } = profile;
  const backButton = root.querySelector('[data-back]');
  const choices = [...root.querySelectorAll('[data-choice]')];
  const upload = root.querySelector('#avatar-upload');
  const continueButton = root.querySelector('#avatar-continue');
  const caption = root.querySelector('.appearance-choice-caption');
  const frames = new Map([...root.querySelectorAll('[data-frame]')].map((frame) => [frame.dataset.frame, frame]));
  let selected = null;
  let avatarImage = getPlayerProfile().avatar_mode !== 'default' ? resolvePlayerAvatar(getPlayerProfile()) : '';
  let appliedFrameId = getPlayerProfile().avatar_mode === 'default' ? getPlayerProfile().avatar_frame_id : null;
  let pendingFile = false;
  let status = '';
  let saving = false;

  if (!backButton || choices.length !== 2 || !upload || !continueButton || !caption || !frames.has('frame') || !frames.has('upload')) {
    throw new Error('头像设置页缺少必要控件');
  }
  const avatarViews = new Map([...frames].map(([mode, frame]) => [mode,
    createPlayerAvatar(frame.querySelector('.appearance-frame__art'), { mirror: mode === 'upload' })]));

  function currentFrame() {
    const id = getAvatarFrame?.() || getPlayerProfile().avatar_frame_id;
    return RACES.some((race) => race.id === id) ? id : RACES[0].id;
  }

  function renderPreview() {
    const frameId = currentFrame();
    const race = getRace(frameId);
    const defaultImage = resolvePlayerAvatar({ avatar_mode: 'default', avatar_frame_id: frameId });
    const isApplied = appliedFrameId === frameId;
    for (const [mode, frame] of frames) {
      const src = mode === 'frame' ? (isApplied ? defaultImage : null) : avatarImage;
      avatarViews.get(mode).render(src, { reference: mode === 'frame' });
      frame.classList.toggle('has-avatar', Boolean(src));
      frame.dataset.frameRace = frameId;
      frame.setAttribute('aria-label', mode === 'frame'
        ? (isApplied ? `已设置：${race?.name || '已选头像'}` : '尚未设置已选头像')
        : (src ? '已上传的个人头像' : '尚未上传自己的头像'));
    }
    for (const button of choices) {
      button.closest('.appearance-mode').classList.toggle('is-selected', button.dataset.choice === selected);
      button.setAttribute('aria-pressed', String(button.dataset.choice === selected));
    }
    continueButton.disabled = saving || pendingFile || !selected || (selected === 'frame' ? !isApplied : !avatarImage);
    caption.textContent = saving ? '正在保存玩家形象…' : pendingFile ? '正在处理头像图片…' : status;
    for (const button of choices) button.disabled = pendingFile || saving;
    backButton.disabled = saving;
  }

  function selectMode(mode, image = avatarImage) {
    updatePlayerProfile({ avatar_frame_id: currentFrame(), avatar_mode: mode === 'frame' ? 'default' : 'upload', avatar_asset_id: mode === 'upload' ? image : '' });
    selected = mode;
    if (mode === 'frame') appliedFrameId = currentFrame();
    else avatarImage = image;
    status = '';
    renderPreview();
  }

  listen(choices[0], 'click', () => {
    try { selectMode('frame'); }
    catch { status = '本地存档未能保存，请释放浏览器空间后重试。'; renderPreview(); }
  });
  listen(choices[1], 'click', () => upload.click());
  listen(upload, 'change', async () => {
    const file = upload.files?.[0];
    if (!file) return;
    pendingFile = true;
    renderPreview();
    try {
      const blob = await fileAsSquareBlob(file, events.signal);
      if (events.signal.aborted) return;
      const image = profile.setAvatarBlob(blob);
      selectMode('upload', image);
    } catch (error) {
      status = error.message || '图片处理失败，请换一张图片';
    } finally {
      if (events.signal.aborted) return;
      pendingFile = false;
      upload.value = '';
      renderPreview();
    }
  });
  listen(continueButton, 'click', async () => {
    if (continueButton.disabled) return;
    saving = true; status = ''; renderPreview();
    try { await onChoose?.(getPlayerProfile(), profile.getAvatarBlob()); }
    catch (error) { status = error.message || '保存失败，请重试。'; }
    finally { if (!events.signal.aborted) { saving = false; renderPreview(); } }
  });
  listen(backButton, 'click', () => onBack?.());

  return {
    dispose() { events.abort(); },
    setStatus(message) { status = message; renderPreview(); },
    show() {
      const profile = getPlayerProfile();
      selected = profile.avatar_frame_id ? (profile.avatar_mode === 'default' ? 'frame' : 'upload') : null;
      avatarImage = profile.avatar_mode !== 'default' ? resolvePlayerAvatar(profile) || avatarImage : avatarImage;
      if (profile.avatar_mode === 'default') appliedFrameId = profile.avatar_frame_id;
      // A newly chosen frame remains a draft until either setup button applies it.
      if (profile.avatar_frame_id !== currentFrame() || (selected === 'upload' && !avatarImage)) selected = null;
      status = '';
      renderPreview();
      root.classList.add('is-active');
      root.setAttribute('aria-hidden', 'false');
    },
    hide() {
      root.classList.remove('is-active');
      root.setAttribute('aria-hidden', 'true');
    },
    get selected() { return selected; },
    get avatarImage() { return avatarImage; },
    get avatarFrame() { return currentFrame(); },
    get element() { return root; },
  };
}

export default createAppearanceChoice;
