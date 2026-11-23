/* Existing validation owns the rules; this module only presents its results. */
(function () {
  const form = document.getElementById('charForm');
  const summary = document.getElementById('formFeedback');
  if (!form || !summary) return;
  let reviewed = false;
  let submission = null;
  const rowByField = {
    code: 'code', previous_code: 'code', name: 'name', age: 'age',
    species_type: 'species', species_detail: 'species', gender: 'gender',
    background: 'bg', org: 'org', appearance: 'appearance',
    image: 'images', images: 'images', avatar_asset_id: 'images', avatar_display_shape: 'images',
  };
  const statusMessages = {
    409: '这份人设已在别处更新。请先复制本页改动，再重新打开服务器版本。',
    428: '请先复制本页改动，再重新打开服务器上的原设表后编辑。',
    401: '登录已过期。请重新登录会馆后再提交。',
    403: '当前账户无法登记，请确认账号和同意状态；仍有问题可联系馆长。',
    413: '提交内容过大。请压缩或减少图片，或缩短过长的文字，再试一次。',
    429: '提交太频繁，请稍等一会儿再试。',
  };
  window.ocSaveProblem = (result, status) => {
    // Old servers may still send human-readable Chinese in the legacy error key.
    const legacy = status < 500 && typeof result.error === 'string' && /[\u3400-\u9fff]/.test(result.error) ? result.error : '';
    const message = (typeof result.message === 'string' && result.message) || legacy ||
      statusMessages[status] || (status >= 500 ? '会馆保存服务暂时不可用，请稍后重试。' : '这次没有保存成功，请重试；仍有问题可联系馆长。');
    return Object.assign(new Error(message), { field: typeof result.field === 'string' ? result.field : '' });
  };
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
    (row.querySelector('#uploadZone') || row.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])'))?.focus({ preventScroll: true });
  }
  window.renderFormFeedback = function () {
    form.querySelectorAll('[aria-invalid="true"]').forEach(el => {
      el.removeAttribute('aria-invalid');
      if (el.dataset.feedbackDescription) {
        el.setAttribute('aria-describedby', (el.getAttribute('aria-describedby') || '').split(' ').filter(id => id !== el.dataset.feedbackDescription).join(' '));
        delete el.dataset.feedbackDescription;
      }
    });
    if (submission?.row && !submission.row.classList.contains('error')) {
      submission.row.classList.add('error');
      submission.row.querySelector('.err').textContent = submission.reason;
    }
    const rows = errors();
    summary.replaceChildren();
    summary.hidden = !rows.length && !submission;
    reviewed = !!rows.length;
    if (summary.hidden) return;
    const heading = document.createElement('strong');
    heading.textContent = submission ? '这次没有保存成功' : '还差 ' + rows.length + ' 项，请完成后再登记';
    summary.append(heading);
    if (submission) {
      const explanation = document.createElement('p');
      explanation.textContent = submission.message;
      summary.append(explanation);
    }
    const list = document.createElement('ul');
    rows.forEach(row => {
      const reason = row.querySelector('.err').textContent.trim();
      const err = row.querySelector('.err');
      if (!err.id) err.id = row.id + '-feedback';
      row.querySelectorAll('#uploadZone, input, select, textarea').forEach(el => {
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
  window.clearSubmissionProblem = () => {
    if (!submission) return;
    if (submission.row) {
      submission.row.classList.remove('error');
      submission.row.querySelector('.err').textContent = '';
    }
    submission = null;
    window.renderFormFeedback();
  };
  window.showSubmissionProblem = (message, field, reason = message) => {
    window.clearSubmissionProblem();
    const rowId = Object.prototype.hasOwnProperty.call(rowByField, field) && rowByField[field];
    const row = rowId ? document.getElementById('row-' + rowId) : null;
    submission = { message, row, reason };
    window.renderFormFeedback();
    if (row) locate(row);
    else summary.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const onEdit = ({ target }) => {
    if (submission?.row?.contains(target)) window.clearSubmissionProblem();
    if (reviewed) validate();
  };
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);
})();
