/* Existing validation owns the rules; this module only presents its results. */
(function () {
  const form = document.getElementById('charForm');
  const summary = document.getElementById('formFeedback');
  let reviewed = false;
  function errors() {
    const rows = [...form.querySelectorAll('.form-row.error')];
    const ability = document.getElementById('abilityErr');
    if (ability.textContent.trim()) rows.push(ability.closest('.ability-section'));
    return rows;
  }
  function locate(row) {
    for (let parent = row.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    row.closest('.form-chapter')?.classList.add('is-revealed');
    row.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    row.querySelector('input:not([disabled]), select, textarea')?.focus({ preventScroll: true });
  }
  window.renderFormFeedback = function () {
    form.querySelectorAll('[aria-invalid="true"]').forEach(el => {
      el.removeAttribute('aria-invalid');
      if (el.dataset.feedbackDescription) {
        el.setAttribute('aria-describedby', (el.getAttribute('aria-describedby') || '').split(' ').filter(id => id !== el.dataset.feedbackDescription).join(' '));
        delete el.dataset.feedbackDescription;
      }
    });
    const rows = errors();
    summary.replaceChildren();
    summary.hidden = !rows.length;
    if (!rows.length) { reviewed = false; return; }
    reviewed = true;
    const heading = document.createElement('strong');
    heading.textContent = '还差 ' + rows.length + ' 项，请完成后再登记';
    summary.append(heading);
    const list = document.createElement('ul');
    rows.forEach((row, index) => {
      const reason = row.querySelector('.err').textContent.trim();
      const err = row.querySelector('.err');
      if (!err.id) err.id = row.id + '-feedback';
      row.querySelectorAll('input, select, textarea').forEach(el => {
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute('aria-describedby', ((el.getAttribute('aria-describedby') || '') + ' ' + err.id).trim());
        el.dataset.feedbackDescription = err.id;
      });
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = reason;
      button.addEventListener('click', () => locate(row));
      item.append(button); list.append(item);
    });
    summary.append(list);
  };
  window.focusFirstFormError = () => { const row = errors()[0]; if (row) locate(row); };
  window.showSubmissionProblem = message => {
    summary.hidden = false; summary.textContent = message;
    summary.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  form.addEventListener('input', () => { if (reviewed) validate(); });
  form.addEventListener('change', () => { if (reviewed) validate(); });
})();
