import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Import, LoaderCircle, Save, UserRound, X } from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar';
import { usePlayerProfile, identityAssetUrl, type Account, type GateIdentity } from './PlayerProfile';

type OC = { id: string; name: string; species_type: string; species_detail: string; avatar_asset_id: string; avatar_url?: string; images: string[] };
type Identity = GateIdentity;
declare global { interface Window { HuiguanAvatarCropper?: { open(source: Blob|string): Promise<Blob|null> } } }
const apiAsset = identityAssetUrl;

export function PlayerIdentity({ account, onClose }: { account: Account; onClose: () => void }) {
  const profile = usePlayerProfile();
  const [identity, setIdentity] = useState<Identity>(profile.identity);
  const [ocs, setOcs] = useState<OC[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [avatarDraft, setAvatarDraft] = useState<Blob|null>(null);
  const [previewDraftUrl, setPreviewDraftUrl] = useState('');
  const [selectedOC, setSelectedOC] = useState('');
  const avatarUrl = useMemo(() => previewDraftUrl || apiAsset(identity.avatar_asset_id), [identity.avatar_asset_id, previewDraftUrl]);

  useEffect(() => {
    let active = true;
    setOcs([]); setLoaded(false); setSelectedOC(''); setSaved(''); setError('');
    (account.logged_in ? fetch('/api/gate/ocs', { credentials: 'same-origin', cache: 'no-store' }).then(r => r.ok ? r.json() : { ocs: [] }).catch(() => ({ ocs: [] })) : Promise.resolve({ ocs: [] })).then(list => {
      if (!active) return;
      setOcs(Array.isArray(list?.ocs) ? list.ocs : []);
      setLoaded(true);
    });
    return () => { active = false; };
  }, [account.logged_in, account.kind, account.user_id]);

  useEffect(() => () => { if (previewDraftUrl) URL.revokeObjectURL(previewDraftUrl); }, [previewDraftUrl]);

  function importOC(oc: OC) {
    setSelectedOC(oc.id);
    setIdentity(current => ({ ...current, display_name: oc.name, species_name: `${oc.species_type}${oc.species_type === '妖精' && oc.species_detail ? `（${oc.species_detail}）` : ''}`, source_oc_id: oc.id, avatar_asset_id: oc.avatar_asset_id || current.avatar_asset_id, avatar_mode: oc.avatar_asset_id ? 'oc' : current.avatar_mode }));
    if (oc.avatar_asset_id) { setAvatarDraft(null); setPreviewDraftUrl(''); }
    setSaved('');
  }

  async function crop(source: Blob|string) {
    setError('');
    if (!window.HuiguanAvatarCropper) { setError('头像裁切器暂不可用，请刷新后重试。'); return; }
    try {
      const result = await window.HuiguanAvatarCropper.open(source);
      if (!result) return;
      setAvatarDraft(result); setPreviewDraftUrl(URL.createObjectURL(result));
      setIdentity(current => ({ ...current, avatar_asset_id: '', avatar_mode: 'upload' }));
      setSaved('');
    } catch (reason) { setError((reason as Error).message || '图片处理失败'); }
  }

  async function save() {
    if (!identity.display_name.trim()) { setError('请填写显示名称。'); return; }
    if (!identity.species_name.trim()) { setError('请填写种族名称；可输入人类或自定义设定。'); return; }
    setBusy(true); setError(''); setSaved('');
    try {
      const payload = { ...identity, schema_version: 1 as const, display_name: identity.display_name.trim(), species_name: identity.species_name.trim() };
      await profile.saveIdentity(payload, avatarDraft);
      setAvatarDraft(null); setPreviewDraftUrl('');
      setSaved('形象资料已保存；这是众生之门自己的资料，不会改动原 OC。');
    } catch (reason) { setError((reason as Error).message || '保存失败'); }
    finally { setBusy(false); }
  }

  const input = (key: 'display_name'|'species_name') => (event: React.ChangeEvent<HTMLInputElement>) => { setIdentity(current => ({ ...current, [key]: event.target.value })); setSaved(''); };
  return <div className="identity-shade" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="identity-panel" role="dialog" aria-modal="true" aria-labelledby="identity-title">
      <header><div><span className="eyebrow">YOUR GATE IDENTITY</span><h2 id="identity-title">众生之门形象</h2><p>这是你进入众生之门时使用的形象，可独立修改。</p></div><button type="button" className="identity-close" onClick={onClose} aria-label="关闭"><X size={19}/></button></header>
      {!loaded ? <div className="identity-loading"><LoaderCircle size={18}/>正在读取形象…</div> : <>
        {ocs.length > 0 && <section className="identity-import"><div><strong>从自己的 OC 导入初始资料</strong><small>只复制名称、物种和你选定的头像；后续修改不会同步回 OC。</small></div>
          {ocs.length === 1 ? <button type="button" className="secondary" onClick={() => importOC(ocs[0])}><Import size={15}/>导入「{ocs[0].name}」</button> : <div className="identity-oc-picker"><select aria-label="选择要导入的 OC" value={selectedOC} onChange={event => setSelectedOC(event.target.value)}><option value="">选择一个 OC…</option>{ocs.map(oc => <option key={oc.id} value={oc.id}>{oc.name} · {oc.species_type}{oc.species_detail ? `（${oc.species_detail}）` : ''}</option>)}</select><button type="button" className="secondary" disabled={!selectedOC} onClick={() => { const oc=ocs.find(item=>item.id===selectedOC); if(oc)importOC(oc); }}><Import size={15}/>导入所选 OC</button></div>}
          {identity.source_oc_id === selectedOC && selectedOC && ocs.find(oc => oc.id === selectedOC)?.images.length ? <div className="identity-candidates"><span>从该 OC 的已有图片中选择头像</span>{ocs.find(oc => oc.id === selectedOC)!.images.map((src,index) => <button type="button" key={`${src}-${index}`} onClick={() => void crop(src)} aria-label={`裁切已有图片 ${index+1}`}><img src={src} alt=""/></button>)}</div> : null}
        </section>}
        <div className="identity-fields"><div className="identity-avatar"><div className="identity-avatar__preview">{<PlayerAvatar identity={{ ...identity, avatar_asset_id: avatarUrl }}/> }</div><button type="button" className="secondary" onClick={() => document.getElementById('gateAvatarFile')?.click()}><ImagePlus size={15}/>上传并裁切头像</button><input id="gateAvatarFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={event => { const file=event.target.files?.[0];event.target.value='';if(file)void crop(file); }}/>
          {account.account_avatar_url && <button type="button" className="text-button" onClick={() => { const url=new URL(account.account_avatar_url!);setIdentity(current=>({...current,avatar_asset_id:url.pathname,avatar_mode:'account'}));setAvatarDraft(null);setPreviewDraftUrl('');setSaved(''); }}>使用账户头像</button>}
          <label>头像框编号（可留空）<input maxLength={80} value={identity.avatar_frame_id} onChange={event=>setIdentity(current=>({...current,avatar_frame_id:event.target.value}))}/></label>
        </div><div className="identity-text"><label>显示名称<input required maxLength={60} value={identity.display_name} onChange={input('display_name')} placeholder="例如：小苔"/></label><label>种族名称<input required maxLength={100} value={identity.species_name} onChange={input('species_name')} placeholder="人类、猫妖、乌鸦妖精或自定义名称"/></label><small>不再显示 r01–r23 占位种族。种族名称是自由文本；OC 的人类 / 妖精分类不会被改写。</small></div></div>
        <footer><span role="status" className={error?'identity-error':'identity-saved'}>{error||saved|| (account.logged_in?'登录账户后会跨设备保存。':'未登录时只保存在当前浏览器会话。')}</span><button type="button" className="primary" disabled={busy} onClick={() => void save()}><Save size={15}/>{busy?'保存中…':'保存形象'}</button></footer>
      </>}
    </section>
  </div>;
}
