/* Homepage account extras inside the shared site bar (shared/shared-ui/site-nav.js). */
(function () {
  'use strict';
  var nav = document.getElementById('qc-nav');
  if (!nav) return;
  document.body.classList.add('huiguan-homepage');
  // The first /api/user response can precede shared-chrome's replacement of the original bar.
  // Repaint from the existing session, then let the normal account flow continue updating it.
  if (typeof window.renderAuthBar === 'function') window.renderAuthBar(window.currentUser || null);
  var lastEmailCheck = '';
  function updateEmailReminder(event) {
    var user = event && event.detail;
    var bar = document.getElementById('authBar');
    if (!bar) return;
    var old = bar.querySelector('.email-reminder');
    if (!user || !user.logged_in) {
      if (old) old.remove();
      lastEmailCheck = '';
      return;
    }
    var identity = String(user.kind || '') + ':' + String(user.user_id || user.username || '');
    if (identity === lastEmailCheck) return;
    lastEmailCheck = identity;
    fetch('/api/account/email').then(function (response) {
      if (!response.ok) return null;
      return response.json();
    }).then(function (state) {
      var current = document.getElementById('authBar');
      if (!current || !window.currentUser || !window.currentUser.logged_in) return;
      var reminder = current.querySelector('.email-reminder');
      if (!state || state.verified) {
        if (reminder) reminder.remove();
        return;
      }
      if (reminder) return;
      reminder = document.createElement('a');
      reminder.className = 'btn-logout email-reminder';
      reminder.href = '/account.html#email-binding';
      reminder.textContent = '绑定邮箱';
      reminder.setAttribute('aria-label', '邮箱尚未验证，前往账户绑定邮箱');
      current.appendChild(reminder);
    }).catch(function () {});
  }
  document.addEventListener('huiguan:auth-change', updateEmailReminder);
  updateEmailReminder({ detail: window.currentUser || null });
})();
