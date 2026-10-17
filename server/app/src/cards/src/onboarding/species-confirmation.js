
export function createSpeciesConfirmation({ root, onConfirm, profile }) {
  const events = new AbortController();
  const listen = (target, type, listener) => target.addEventListener(type, listener, { signal: events.signal });
  const { getPlayerProfile, updatePlayerProfile } = profile;
  const dialog = document.createElement('dialog');
  dialog.className = 'species-dialog';
  dialog.setAttribute('aria-labelledby', 'species-dialog-title');
  dialog.innerHTML = `<form novalidate>
    <button class="species-close" type="button" aria-label="取消种族确认">×</button>
    <h2 id="species-dialog-title">确认您的种族</h2>
    <button class="species-human" type="button">人类</button>
    <label for="confirmed-species">其他种族</label>
    <input id="confirmed-species" name="species" maxlength="100" autocomplete="off" placeholder="填写您的种族名称" />
    <p class="species-error" role="alert"></p>
    <button class="species-submit" type="submit">确认并继续</button>
  </form>`;
  root.appendChild(dialog);
  const input = dialog.querySelector('input');
  const error = dialog.querySelector('.species-error');
  let pendingFrame = null;
  function confirm(value) {
    const species = value.trim();
    if (!species) {
      error.textContent = '请填写种族名称，或直接选择人类。';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    try { updatePlayerProfile({ species_name: species }); }
    catch { error.textContent = '本地存档未能保存，请释放浏览器空间后重试。'; return; }
    dialog.close();
    onConfirm(pendingFrame);
  }
  listen(dialog.querySelector('form'), 'submit', event => { event.preventDefault(); confirm(input.value); });
  listen(dialog.querySelector('.species-human'), 'click', () => confirm('人类'));
  listen(dialog.querySelector('.species-close'), 'click', () => dialog.close());
  listen(input, 'input', () => { input.removeAttribute('aria-invalid'); error.textContent = ''; });
  return {
    dispose() { events.abort(); if (dialog.open) dialog.close(); dialog.remove(); },
    open(frameId) {
      pendingFrame = frameId;
      input.value = getPlayerProfile().species_name;
      input.removeAttribute('aria-invalid');
      error.textContent = '';
      if (!dialog.open) dialog.showModal();
    },
  };
}
