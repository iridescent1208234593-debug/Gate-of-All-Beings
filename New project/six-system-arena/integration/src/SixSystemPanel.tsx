/* ============================================================================
   SixSystemPanel.tsx — 六系数值面板接入层（R3）
   ----------------------------------------------------------------------------
   复用 arena 侧 ui/SixSystemPanel.js（window.SixSystemPanel）渲染六系雷达 +
   五行星图 + 图标 + 属性条；该 API 缺失时回落为本地轻量渲染，保证不白屏。

   零侵入：不修改 zszm 任何既有组件，只读取 /sixsys/data/character_stats.json。
   ============================================================================ */

import { useEffect, useRef, useState } from 'react';
import { loadSixSystemData, systemValuesOf, type SixSystemDataBridge } from './sixsys-data';
import { SIX_SYSTEM_ORDER, type SixSystemCharacter, type SixSystemKey } from './sixsys-types';

export interface SixSystemPanelProps {
  /** 角色 id（488 选 1） */
  characterId?: number;
  /** 也可直接传记录，优先级高于 characterId */
  character?: SixSystemCharacter;
  /** 覆盖六维（金 木 水 火 土 空间），0~100 */
  values?: number[];
  tier?: string;
  subtitle?: string;
  source?: string;
  className?: string;
}

function fallbackRender(host: HTMLElement, name: string, systems: SixSystemKey[], values: number[]): void {
  const icons = window.SixSystemIcons;
  const wrap = document.createElement('div');
  wrap.className = 'sixsys-panel-fallback';
  const head = document.createElement('div');
  head.className = 'sixsys-panel-name';
  head.textContent = name;
  wrap.appendChild(head);
  const list = document.createElement('ul');
  list.className = 'sixsys-panel-bars';
  SIX_SYSTEM_ORDER.forEach((key, i) => {
    const li = document.createElement('li');
    const label = icons ? icons.label(key) : key;
    const icon = icons ? icons.create(key, 18) : null;
    if (icon) li.appendChild(icon);
    const span = document.createElement('span');
    span.textContent = `${label} ${values[i]}`;
    li.appendChild(span);
    const bar = document.createElement('i');
    bar.style.width = `${Math.max(0, Math.min(100, values[i]))}%`;
    bar.style.background = icons ? icons.color(key) : '#888';
    li.appendChild(bar);
    list.appendChild(li);
  });
  wrap.appendChild(list);
  if (systems.length) {
    const tag = document.createElement('p');
    tag.className = 'sixsys-panel-tag';
    tag.textContent = `归属：${systems.join(' / ')}`;
    wrap.appendChild(tag);
  }
  host.appendChild(wrap);
}

export function SixSystemPanel(props: SixSystemPanelProps) {
  const { characterId, character, values, tier, subtitle, source, className } = props;
  const host = useRef<HTMLDivElement>(null);
  const [bridge, setBridge] = useState<SixSystemDataBridge | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (character) return;
    let alive = true;
    loadSixSystemData()
      .then((b) => {
        if (alive) setBridge(b);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [character]);

  const rec = character || (bridge && characterId !== undefined ? bridge.byId(characterId) : undefined);
  const recId = rec?.id;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (!rec) {
      el.innerHTML = '';
      return;
    }

    const vals = values && values.length === 6 ? values : systemValuesOf(rec);
    const stats = { hp: rec.hp, attack: rec.attack, defense: rec.defense };
    const tierText = tier || (rec.tier ? `${rec.tier} ${rec.tier_name || ''}`.trim() : undefined);
    const api = window.SixSystemPanel;

    el.innerHTML = '';
    let node: HTMLElement | null = null;
    if (api) {
      try {
        node = api.render({
          name: rec.name,
          subtitle,
          tier: tierText,
          systems: rec.systems,
          values: vals,
          stats,
          source: source || `character_stats.json · id=${rec.id}`,
        });
      } catch {
        node = null;
      }
    }
    if (node) el.appendChild(node);
    else fallbackRender(el, rec.name, rec.systems || [], vals);

    return () => {
      el.innerHTML = '';
    };
  }, [recId, values, tier, subtitle, source, rec]);

  return (
    <div className={className ? `sixsys-panel-host ${className}` : 'sixsys-panel-host'} ref={host}>
      {!rec && !error && <p className="sixsys-loading" role="status">正在载入六系数值…</p>}
      {!rec && error && <p className="sixsys-error" role="alert">{error}</p>}
    </div>
  );
}

export default SixSystemPanel;
