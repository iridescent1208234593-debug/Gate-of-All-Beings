import siteDomains from '../../../../../../packages/site-domains/index.mjs';
import { useEffect, useRef } from 'react';
import './account-link-reminder.css';

/** Shown only after onboarding saved and the existing SSO endpoint still says guest. */
export function AccountLinkReminder({ onContinue }: { onContinue: () => void }) {
  const login = useRef<HTMLAnchorElement>(null);
  useEffect(() => { login.current?.focus(); }, []);
  const returnTo = new URL(window.location.href);
  returnTo.hash = '';
  const loginUrl = `${siteDomains.url('huiguan')}/?openauth=1&next=${encodeURIComponent(returnTo.toString())}`;
  return <div className="gate-account-mask">
    <section className="gate-account-dialog" role="dialog" aria-modal="true" aria-labelledby="gate-account-title" aria-describedby="gate-account-copy">
      <span className="gate-account-kicker">众生之门 · 建档完成</span>
      <h2 id="gate-account-title">为这段旅程找到账号</h2>
      <p id="gate-account-copy">众生之门建档已完成，但你还没有登录西木会馆账号。登录账号后，角色、进度及需要服务器保存的数据才能更可靠地与你的身份关联。</p>
      <p className="gate-account-detail">不登录也能继续，但游客建档主要留在当前浏览器。登录不会自动把这份游客建档并入账号；登录后请核对账号内的角色。</p>
      <div className="gate-account-actions">
        <a ref={login} href={loginUrl}>注册 / 登录账号</a>
        <button type="button" onClick={onContinue}>暂时继续</button>
      </div>
    </section>
  </div>;
}
