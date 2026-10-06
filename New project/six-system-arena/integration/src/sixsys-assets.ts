/* ============================================================================
   sixsys-assets.ts — 官方素材清单与路径映射（R3）
   ----------------------------------------------------------------------------
   红线（docs/05）：仅《罗小黑战记》官方图；严禁 AI 生图；严禁同人图；严禁外链。
   本轮未联网采集任何素材。

   作用：settlement.js 返回的是 Windows 绝对路径（浏览器不可直接加载），
        本模块负责 绝对路径 → 站点 URL 的确定性映射，并提供缺失兜底。
   ============================================================================ */

import type { SixSystemKey } from './sixsys-types';

/** 站点素材根目录（install_assets.ps1 的落点） */
export const OFFICIAL_ASSET_BASE = '/sixsys/official/';

export type OfficialAssetId =
  | 'luoxiaohei_full'
  | 'luoxiaohei_face_01'
  | 'luoxiaohei_face_02'
  | 'bidiu'
  | 'bidiu_anim';

export interface OfficialAssetRef {
  id: OfficialAssetId;
  /** 站点文件名 */
  file: string;
  /** 官方原文件（只读源，相对 E:\Projects\assets\） */
  origin: string;
  kind: 'jpg' | 'png' | 'gif';
  /** 用途 */
  role: string;
}

/** 结算素材白名单（与 integration/manifest.json 的 assets.whitelist 一致） */
export const OFFICIAL_ASSETS: readonly OfficialAssetRef[] = [
  {
    id: 'luoxiaohei_full',
    file: 'luoxiaohei_full.jpg',
    origin: '罗小黑战记数据库\\images\\罗小黑\\罗小黑_全身_085.jpg',
    kind: 'jpg',
    role: '胜利结算：罗小黑登场（官方全身立绘）',
  },
  {
    id: 'luoxiaohei_face_01',
    file: 'luoxiaohei_face_01.jpg',
    origin: '罗小黑战记数据库\\images\\罗小黑\\罗小黑_表情_087.jpg',
    kind: 'jpg',
    role: '失败结算：小黑安慰表情（官方表情图）',
  },
  {
    id: 'luoxiaohei_face_02',
    file: 'luoxiaohei_face_02.jpg',
    origin: '罗小黑战记数据库\\images\\罗小黑\\罗小黑_表情_088.jpg',
    kind: 'jpg',
    role: '失败结算：小黑安慰表情（官方表情图）',
  },
  {
    id: 'bidiu',
    file: 'bidiu.png',
    origin: '罗小黑战记数据库\\images\\比丢\\比丢.png',
    kind: 'png',
    role: '胜利结算：比丢登场（官方立绘）',
  },
  {
    id: 'bidiu_anim',
    file: 'bidiu.gif',
    origin: '罗小黑战记数据库\\images\\比丢\\比丢.gif',
    kind: 'gif',
    role: '胜利结算：比丢登场动图（可选，jpg/png 缺失时兜底）',
  },
] as const;

const BY_FILE: Record<string, OfficialAssetId> = OFFICIAL_ASSETS.reduce((acc, a) => {
  // 官方原文件名（相对路径的 basename）→ 逻辑 id
  const base = a.origin.split('\\').pop() as string;
  acc[base] = a.id;
  acc[a.file] = a.id;
  return acc;
}, {} as Record<string, OfficialAssetId>);

const BY_ID: Record<string, OfficialAssetRef> = OFFICIAL_ASSETS.reduce((acc, a) => {
  acc[a.id] = a;
  return acc;
}, {} as Record<string, OfficialAssetRef>);

/** 逻辑 id → 站点 URL */
export function assetUrl(id: OfficialAssetId): string {
  const ref = BY_ID[id];
  return ref ? OFFICIAL_ASSET_BASE + ref.file : '';
}

/**
 * 把 settlement.js 给出的绝对路径（或裸文件名）映射为站点 URL。
 * 无法识别时返回 ''（由调用方走兜底渲染）。
 */
export function toSiteUrl(absPathOrName: string | null | undefined): string {
  if (!absPathOrName) return '';
  if (/^https?:\/\//i.test(absPathOrName)) return ''; // 外链一律不采用（红线）
  const base = absPathOrName.split(/[\\/]/).pop() || '';
  const id = BY_FILE[base];
  return id ? assetUrl(id) : '';
}

/** 结算角色 → 素材映射（供 UI 直接取用） */
export const SETTLEMENT_ASSETS = {
  win: {
    hero: 'luoxiaohei_full' as OfficialAssetId,
    companion: 'bidiu' as OfficialAssetId,
    companionAlt: 'bidiu_anim' as OfficialAssetId,
  },
  lose: {
    comfort: ['luoxiaohei_face_01', 'luoxiaohei_face_02'] as OfficialAssetId[],
  },
} as const;

/**
 * 探测素材是否已安装（Image 预加载）。
 * 未安装时组件回落为六系图标 + 文案，不白屏。
 */
export function probeAssets(timeoutMs = 4000): Promise<Record<string, boolean>> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve({});
  }
  const jobs = OFFICIAL_ASSETS.map(
    (a) =>
      new Promise<[string, boolean]>((resolve) => {
        const img = new Image();
        const done = (ok: boolean) => resolve([a.id, ok]);
        const timer = window.setTimeout(() => done(false), timeoutMs);
        img.onload = () => {
          window.clearTimeout(timer);
          done(true);
        };
        img.onerror = () => {
          window.clearTimeout(timer);
          done(false);
        };
        img.src = assetUrl(a.id);
      }),
  );
  return Promise.all(jobs).then((pairs) =>
    pairs.reduce((acc, [id, ok]) => {
      acc[id] = ok;
      return acc;
    }, {} as Record<string, boolean>),
  );
}

/** 六系图标兜底：素材缺失时以图标占位（不引入任何非官方图像） */
export function fallbackIconFor(system: SixSystemKey | null | undefined): string {
  const key = system || 'jin';
  const icons = typeof window !== 'undefined' ? window.LXHUI?.ICONS : undefined;
  if (icons) return icons[key] || icons.star || '';
  return '';
}
