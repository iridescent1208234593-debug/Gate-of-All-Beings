/**
 * 用户名设置界面的交互逻辑。
 *
 * 结构（见 index.html）：
 *   .login-field   底 #FDF9E4 的输入框
 *     .login-badge 左侧圆角方块 #FFB649，内含白色 ID
 *     input        文字 #FFB649，手写体
 *   .login-submit  方形按钮 #FFB649 底 + #FDF9E4 回车图标
 *
 * 交互：回车提交 / 点击按钮提交；输入不合法时在输入框下方显示橙色提示文字。
 */
import { validateUsername, USERNAME_RULE } from './username-rules.js';

export function createLoginScreen({ root, onSubmit }) {
  const events = new AbortController();
  const listen = (target, type, listener) => target.addEventListener(type, listener, { signal: events.signal });
  const field = root.querySelector('.login-field');
  const input = root.querySelector('#username');
  const errorEl = root.querySelector('#login-error');
  const form = root.querySelector('#login-form');
  const counter = root.querySelector('#login-counter');

  if (!field || !input || !errorEl || !form || !counter) {
    throw new Error('登录界面缺少必要的 DOM 结构');
  }

  let submitted = false;

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.add('is-visible');
    field.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('is-visible');
    field.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  }

  // 数字显示当前字数，让「1~18 字」这条规则是可见的
  function updateCounter() {
    const { length } = validateUsername(input.value);
    counter.textContent = `${length}/${USERNAME_RULE.MAX_LEN}`;
    // 空输入时不显示，保持界面干净
    counter.classList.toggle('is-active', length > 0);
  }

  function handleSubmit(event) {
    if (event) event.preventDefault();
    if (submitted) return;

    const result = validateUsername(input.value);
    if (!result.ok) {
      showError(result.message);
      input.focus();
      return;
    }

    submitted = true;
    clearError();
    if (typeof onSubmit === 'function') onSubmit(result.value);
  }

  listen(form, 'submit', handleSubmit);

  listen(input, 'input', () => {
    // 重新编辑时解锁，否则从种族树返回后将永远无法再次提交
    submitted = false;
    updateCounter();
    // 用户重新输入时先撤掉错误红框，给他一个「正在改」的中性状态；
    // 提示文字保留到他下次提交，避免每敲一个字就闪一下。
    field.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  });

  // 失焦时如果内容本来就不合法，直接给出提示，不用等他点提交
  listen(input, 'blur', () => {
    if (input.value.length === 0) return;
    const result = validateUsername(input.value);
    if (!result.ok) showError(result.message);
  });

  updateCounter();

  return {
    dispose() { events.abort(); },
    focus() {
      input.focus();
    },
    clear() {
      input.value = '';
      clearError();
      updateCounter();
    },
    /** 复位为可提交状态（从种族树返回用户名界面时调用），保留已填的用户名 */
    reset() {
      submitted = false;
      clearError();
      field.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      updateCounter();
    },
    get element() {
      return root;
    },
  };
}

export default createLoginScreen;
