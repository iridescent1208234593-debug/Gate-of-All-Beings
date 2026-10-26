import { useEffect, useMemo, useState } from 'react';
import { Check, Clapperboard, ImagePlus, Import, LoaderCircle, PenLine, Plus, Save, Trash2, X } from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar';
import { usePlayerProfile, identityAssetUrl, IDENTITY_LIMIT, type Account, type GateIdentity } from './PlayerProfile';
import { assetIdFromUrl } from './core/identityAssets';
import { FAMILY_SUGGESTIONS, HUMAN, composeSpecies, SUB_SUGGESTIONS, YAOJING, speciesFields, speciesFromOC, speciesParts, type SpeciesParts } from './species';

type OC = { id: string; name: string; species_type: string; species_detail: string; avatar_asset_id: string; avatar_url?: string; images: string[] };
type Identity = GateIdentity;
declare global { interface Window { HuiguanAvatarCropper?: { open(source: Blob|string): Promise<Blob|null> } } }
const apiAsset = identityAssetUrl;
const KINDS = [{ value: HUMAN, label: '人类' }, { value: YAOJING, label: '妖精' }, { value: '', label: '其他' }];
const kindChoice = (kind: string) => !kind || kind === HUMAN || kind === YAOJING ? kind || HUMAN : '';
// Phones may discard the page while the system photo picker is open; this marks a pick in flight
// so the reloaded page reopens the editor instead of silently dropping the player back in the hall.
const AVATAR_PICK_KEY = 'zszm.avatarPickAt';
const AVATAR_PICK_MS = 10 * 60 * 1000;
export function avatarPickInterrupted() {
  try { return Date.now() - Number(sessionStorage.getItem(AVATAR_PICK_KEY) || 0) < AVATAR_PICK_MS; } catch { return false; }
}
function markAvatarPick(active: boolean) {
  try { if (active) sessionStorage.setItem(AVATAR_PICK_KEY, String(Date.now())); else sessionStorage.removeItem(AVATAR_PICK_KEY); } catch { /* private mode: nothing to resume */ }
}

export function PlayerIdentity({ account, onClose, onCreateWithOpening }: { account: Account; onClose: () => void; onCreateWithOpening?: () => void }) {
  const profile = usePlayerProfile();
  const [identity, setIdentity] = useState<Identity>(profile.identity);
  const [species, setSpecies] = useState<SpeciesParts>(() => speciesParts(profile.identity));
  const [choice, setChoice] = useState(() => kindChoice(speciesParts(profile.identity).kind));
  const [ocs, setOcs] = useState<OC[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [choosingNew, setChoosingNew] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<Blob|null>(null);
  const [previewDraftUrl, setPreviewDraftUrl] = useState('');
  const [selectedOC, setSelectedOC] = useState('');
  const [pickInterrupted] = useState(avatarPickInterrupted);
  const avatarUrl = useMemo(() => previewDraftUrl || apiAsset(identity.avatar_asset_id), [identity.avatar_asset_id, previewDraftUrl]);
  const creating = !identity.id;

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
  useEffect(() => { markAvatarPick(false); return () => markAvatarPick(false); }, []);

  function edit(next: Identity) {
    setIdentity(next); const parts = speciesParts(next); setSpecies(parts); setChoice(kindChoice(parts.kind));
    setAvatarDraft(null); setPreviewDraftUrl(''); setSelectedOC(''); setSaved(''); setError(''); setConfirmDelete(false);
  }
  function startNew() {
    // Keep the current frame so the new draft is immediately usable; everything else starts blank.
    edit({ ...profile.identity, id: '', display_name: '', species_name: '', species_kind: '', species_family: '', species_sub: '', species_note: '', source_oc_id: '' });
  }
  async function switchTo(id: string) {
    if (busy) return;
    setBusy(true); setError('');
    try { await profile.selectIdentity(id); const next = profile.identities.find(item => item.id === id); if (next) edit(next); }
    catch (reason) { setError((reason as Error).message || '切换失败'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!identity.id) { edit(profile.identity); return; }
    setBusy(true); setError('');
    try {
      const rest = profile.identities.filter(item => item.id !== identity.id);
      await profile.deleteIdentity(identity.id);
      if (!rest.length) { onClose(); return; }
      edit(rest.find(item => item.id === profile.identity.id) || rest[0]);
      setSaved('形象已删除。');
    } catch (reason) { setError((reason as Error).message || '删除失败'); }
    finally { setBusy(false); }
  }

  function updateSpecies(patch: Partial<SpeciesParts>) { setSpecies(current => ({ ...current, ...patch })); setSaved(''); }
  function pickKind(value: string) { setChoice(value); updateSpecies({ kind: value }); }

  function importOC(oc: OC) {
    setSelectedOC(oc.id);
    const parts = speciesFromOC(oc.species_type, oc.species_detail);
    setSpecies(parts); setChoice(kindChoice(parts.kind));
    setIdentity(current => ({ ...current, display_name: oc.name, source_oc_id: oc.id, avatar_asset_id: oc.avatar_asset_id || current.avatar_asset_id, avatar_mode: oc.avatar_asset_id ? 'oc' : current.avatar_mode }));
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
    const fields = speciesFields(species);
    if (!identity.display_name.trim()) { setError('请填写显示名称。'); return; }
    if (!fields.species_kind) { setError('请选择或填写族类。'); return; }
    if (fields.species_kind !== HUMAN && !fields.species_family) { setError('请填写种族，例如：鸦科。'); return; }
    if (!identity.avatar_asset_id && !identity.avatar_frame_id && !avatarDraft) { setError('请先选择一个头像。'); return; }
    setBusy(true); setError(''); setSaved('');
    try {
      const payload = { ...identity, ...fields, schema_version: 1 as const, display_name: identity.display_name.trim() };
      const next = await profile.saveIdentity(payload, avatarDraft);
      setAvatarDraft(null); setPreviewDraftUrl('');
      setIdentity(next);
      setSaved(creating ? '新形象已创建，并设为当前形象。' : '形象资料已保存；这是众生之门自己的资料，不会改动原 OC。');
    } catch (reason) { setError((reason as Error).message || '保存失败'); }
    finally { setBusy(false); }
  }

  const preview = speciesFields(species).species_name;
  const subOptions = SUB_SUGGESTIONS[species.family.trim()] || [];
  return <div className="identity-shade" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="identity-panel" role="dialog" aria-modal="true" aria-labelledby="identity-title">
      <header><div><span className="eyebrow">YOUR GATE IDENTITY</span><h2 id="identity-title">众生之门形象</h2><p>可以保存多个形象，随时切换；每个形象独立于你的 OC。</p></div><button type="button" className="identity-close" onClick={onClose} aria-label="关闭"><X size={19}/></button></header>
      <nav className="identity-roster" aria-label="已保存的形象">
        {profile.identities.map(item => <button type="button" key={item.id} className={`identity-roster__item${item.id === identity.id ? ' is-editing' : ''}`} aria-pressed={item.id === identity.id} disabled={busy} onClick={() => item.id === profile.identity.id ? edit(item) : void switchTo(item.id!)}>
          <PlayerAvatar identity={item}/><span><strong>{item.display_name || '未命名'}</strong><small>{composeSpecies(speciesParts(item)) || '种族未填写'}</small></span>{item.id === profile.identity.id && <em><Check size={11}/>当前</em>}
        </button>)}
        {creating && <span className="identity-roster__item is-editing is-draft"><span className="identity-roster__plus"><Plus size={18}/></span><span><strong>{identity.display_name || '新形象'}</strong><small>尚未保存</small></span></span>}
        {!creating && profile.identities.length < IDENTITY_LIMIT && <button type="button" className="identity-roster__add" aria-expanded={choosingNew} onClick={() => onCreateWithOpening ? setChoosingNew(open => !open) : startNew()} disabled={busy}><Plus size={16}/>新形象</button>}
      </nav>
      {choosingNew && !creating && <div className="identity-new-choice" role="group" aria-label="怎样创建新形象">
        <button type="button" onClick={() => { setChoosingNew(false); onCreateWithOpening?.(); }}><Clapperboard size={18}/><span><strong>从开场走一遍</strong><small>像第一次进门那样：开场 → 取名 → 选种族 → 选形象</small></span></button>
        <button type="button" onClick={() => { setChoosingNew(false); startNew(); }}><PenLine size={18}/><span><strong>直接填写</strong><small>跳过剧情，在这里改名字、种族和头像</small></span></button>
      </div>}
      {!loaded ? <div className="identity-loading"><LoaderCircle size={18}/>正在读取形象…</div> : <>
        {ocs.length > 0 && <section className="identity-import"><div><strong>从自己的 OC 导入初始资料</strong><small>只复制名称、种族和你选定的头像；后续修改不会同步回 OC。</small></div>
          {ocs.length === 1 ? <button type="button" className="secondary" onClick={() => importOC(ocs[0])}><Import size={15}/>导入「{ocs[0].name}」</button> : <div className="identity-oc-picker"><select aria-label="选择要导入的 OC" value={selectedOC} onChange={event => setSelectedOC(event.target.value)}><option value="">选择一个 OC…</option>{ocs.map(oc => <option key={oc.id} value={oc.id}>{oc.name} · {oc.species_type}{oc.species_detail ? ` · ${oc.species_detail}` : ''}</option>)}</select><button type="button" className="secondary" disabled={!selectedOC} onClick={() => { const oc=ocs.find(item=>item.id===selectedOC); if(oc)importOC(oc); }}><Import size={15}/>导入所选 OC</button></div>}
          {identity.source_oc_id === selectedOC && selectedOC && ocs.find(oc => oc.id === selectedOC)?.images.length ? <div className="identity-candidates"><span>从该 OC 的已有图片中选择头像</span>{ocs.find(oc => oc.id === selectedOC)!.images.map((src,index) => <button type="button" key={`${src}-${index}`} onClick={() => void crop(src)} aria-label={`裁切已有图片 ${index+1}`}><img src={src} alt=""/></button>)}</div> : null}
        </section>}
        <div className="identity-fields"><div className="identity-avatar"><div className="identity-avatar__preview">{<PlayerAvatar identity={{ ...identity, avatar_asset_id: avatarUrl }}/> }</div><button type="button" className="secondary" onClick={() => { markAvatarPick(true); document.getElementById('gateAvatarFile')?.click(); }}><ImagePlus size={15}/>上传并裁切头像</button><input id="gateAvatarFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={event => { markAvatarPick(false); const file=event.target.files?.[0];event.target.value='';if(file)void crop(file); }}/>
          {account.account_avatar_url && <button type="button" className="text-button" onClick={() => { setIdentity(current=>({...current,avatar_asset_id:assetIdFromUrl(account.account_avatar_url!,window.location.href),avatar_mode:'account'}));setAvatarDraft(null);setPreviewDraftUrl('');setSaved(''); }}>使用账户头像</button>}
        </div><div className="identity-text">
          <label>显示名称<input required maxLength={60} value={identity.display_name} onChange={event => { setIdentity(current => ({ ...current, display_name: event.target.value })); setSaved(''); }} placeholder="例如：小苔"/></label>
          <fieldset className="identity-species"><legend>种族</legend>
            <div className="identity-kinds" role="radiogroup" aria-label="族类">{KINDS.map(kind => <button type="button" role="radio" key={kind.label} aria-checked={choice === kind.value} onClick={() => pickKind(kind.value)}>{kind.label}</button>)}</div>
            {choice === '' && <label>族类名称<input maxLength={20} value={species.kind} onChange={event => updateSpecies({ kind: event.target.value })} placeholder="例如：仙、灵、神"/></label>}
            {choice !== HUMAN && <div className="identity-species__row">
              <label>种族<input maxLength={40} list="identity-family-options" value={species.family} onChange={event => updateSpecies({ family: event.target.value })} placeholder="例如：鸦科、龙族"/></label>
              <label>细分（可选）<input maxLength={40} list="identity-sub-options" value={species.sub} onChange={event => updateSpecies({ sub: event.target.value })} placeholder="例如：三足乌"/></label>
            </div>}
            <label>备注（可选）<input maxLength={120} value={species.note} onChange={event => updateSpecies({ note: event.target.value })} placeholder="例如：上古鸦科神鸟后裔"/></label>
            <datalist id="identity-family-options">{FAMILY_SUGGESTIONS.flatMap(group => group.items.map(item => <option key={item} value={item} label={group.label}/>))}</datalist>
            <datalist id="identity-sub-options">{subOptions.map(item => <option key={item} value={item}/>)}</datalist>
            {preview && <p className="identity-species__preview">显示为 <b>{preview}</b>{species.note.trim() && <span>{species.note.trim()}</span>}</p>}
          </fieldset>
        </div></div>
        <footer><span role="status" className={error?'identity-error':'identity-saved'}>{error||saved|| (pickInterrupted?'刚才选图时页面被手机系统重新加载，图片没有带回来，请再选一次。':account.logged_in?'登录账户后会跨设备保存。':'未登录时只保存在当前浏览器会话。')}</span>
          <div className="identity-actions">
            {(creating || profile.identities.length > 0) && (confirmDelete ? <span className="identity-confirm">{creating ? '放弃这个新形象？' : profile.identities.length === 1 ? '删除后会回到初始化。确定？' : '确定删除这个形象？'}<button type="button" className="danger" disabled={busy} onClick={() => void remove()}>{creating ? '放弃' : '删除'}</button><button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>取消</button></span>
              : <button type="button" className="text-button identity-delete" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14}/>{creating ? '放弃' : '删除形象'}</button>)}
            <button type="button" className="primary" disabled={busy} onClick={() => void save()}><Save size={15}/>{busy?'保存中…':creating?'创建形象':'保存形象'}</button>
          </div></footer>
      </>}
    </section>
  </div>;
}
