import { FAMILY_SUGGESTIONS, HUMAN, SUB_SUGGESTIONS, YAOJING, speciesFields, speciesParts } from '../game/species';

const escape = value => String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

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
    <div class="species-kinds" role="radiogroup" aria-label="族类">
      <button type="button" role="radio" data-kind="${HUMAN}">人类</button>
      <button type="button" role="radio" data-kind="${YAOJING}">妖精</button>
      <button type="button" role="radio" data-kind="">其他</button>
    </div>
    <div class="species-detail">
      <label class="species-custom-kind">族类名称<input name="kind" maxlength="20" autocomplete="off" placeholder="例如：仙、灵、神" /></label>
      <label>种族<input name="family" maxlength="40" autocomplete="off" list="species-family-options" placeholder="例如：鸦科、龙族" /></label>
      <label>细分（可选）<input name="sub" maxlength="40" autocomplete="off" list="species-sub-options" placeholder="例如：三足乌" /></label>
    </div>
    <label>备注（可选）<input name="note" maxlength="120" autocomplete="off" placeholder="例如：上古鸦科神鸟后裔" /></label>
    <datalist id="species-family-options">${FAMILY_SUGGESTIONS.flatMap(group => group.items).map(item => `<option value="${escape(item)}"></option>`).join('')}</datalist>
    <datalist id="species-sub-options"></datalist>
    <p class="species-preview" aria-live="polite"></p>
    <p class="species-error" role="alert"></p>
    <button class="species-submit" type="submit">确认并继续</button>
  </form>`;
  root.appendChild(dialog);
  const form = dialog.querySelector('form');
  const fields = name => form.elements.namedItem(name);
  const error = dialog.querySelector('.species-error');
  const preview = dialog.querySelector('.species-preview');
  const subOptions = dialog.querySelector('#species-sub-options');
  let kindChoice = HUMAN;
  let pendingFrame = null;

  const parts = () => ({
    kind: kindChoice === '' ? fields('kind').value : kindChoice,
    family: fields('family').value, sub: fields('sub').value, note: fields('note').value,
  });
  function render() {
    for (const button of dialog.querySelectorAll('[data-kind]')) button.setAttribute('aria-checked', String(button.dataset.kind === kindChoice));
    dialog.dataset.kind = kindChoice === HUMAN ? 'human' : kindChoice === YAOJING ? 'yaojing' : 'other';
    subOptions.innerHTML = (SUB_SUGGESTIONS[fields('family').value.trim()] || []).map(item => `<option value="${escape(item)}"></option>`).join('');
    const { species_name: name } = speciesFields(parts());
    preview.textContent = name ? `将显示为：${name}${fields('note').value.trim() ? `（${fields('note').value.trim()}）` : ''}` : '';
    error.textContent = '';
  }
  function confirm() {
    const next = speciesFields(parts());
    if (!next.species_kind || (next.species_kind !== HUMAN && !next.species_family)) {
      error.textContent = kindChoice === '' && !next.species_kind ? '请填写族类名称。' : '请填写种族，例如：鸦科。';
      (kindChoice === '' && !next.species_kind ? fields('kind') : fields('family')).focus();
      return;
    }
    try { updatePlayerProfile(next); }
    catch { error.textContent = '本地存档未能保存，请释放浏览器空间后重试。'; return; }
    dialog.close();
    onConfirm(pendingFrame);
  }
  listen(form, 'submit', event => { event.preventDefault(); confirm(); });
  listen(form, 'input', render);
  for (const button of dialog.querySelectorAll('[data-kind]')) listen(button, 'click', () => { kindChoice = button.dataset.kind; render(); if (kindChoice !== HUMAN) (kindChoice === '' ? fields('kind') : fields('family')).focus(); });
  listen(dialog.querySelector('.species-close'), 'click', () => dialog.close());
  return {
    dispose() { events.abort(); if (dialog.open) dialog.close(); dialog.remove(); },
    open(frameId) {
      pendingFrame = frameId;
      const current = speciesParts(getPlayerProfile());
      kindChoice = !current.kind || current.kind === HUMAN || current.kind === YAOJING ? current.kind || HUMAN : '';
      fields('kind').value = kindChoice === '' ? current.kind : '';
      fields('family').value = current.family;
      fields('sub').value = current.sub;
      fields('note').value = current.note;
      render();
      if (!dialog.open) dialog.showModal();
    },
  };
}
