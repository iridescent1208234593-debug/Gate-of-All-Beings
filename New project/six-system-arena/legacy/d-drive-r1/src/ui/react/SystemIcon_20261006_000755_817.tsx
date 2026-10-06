/**
 * 六大系图标 React 组件（官方 card SVG 内联渲染）
 *
 * 用途：zszm（TypeScript / React）侧直接引用，无需把 SVG 复制进 public 目录，
 *       也不引入任何三方图标库；渲染出的标记与官方 card 集逐字节一致。
 *
 * 引用方式：
 *   import { SystemIcon, ElementIcon, CardIcon } from '@lxh/six-systems/ui/react';
 *   <SystemIcon systemId="kongjian" size={48} title="空间系" />
 *   <ElementIcon elementId="mu" size={24} />
 *
 * 实现说明：图标标记是构建期由生成器内联的静态可信字符串（非用户输入），
 *   因此用 dangerouslySetInnerHTML 注入，避免把 128×128 的 path/circle
 *   手写重排成 JSX 造成标记漂移（任务要求：优先复用现有 asset，不重绘）。
 *   size 同时写入 svg 的 width/height，外层 span 为 inline-flex，便于与文字对齐。
 */
import * as React from 'react';
import type { FC, HTMLAttributes } from 'react';

import {
  CARD_ICONS,
  SYSTEM_ICON_KEYS,
  ELEMENT_ICON_KEYS,
  cardIcon,
} from '../system-icons.js';

export type SystemId = keyof typeof SYSTEM_ICON_KEYS;
export type ElementId = keyof typeof ELEMENT_ICON_KEYS;

/** title 语义为 aria-label（无障碍名称），与 system-icons.js 的 cardIcon 保持一致 */
export interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'title'> {
  /** 像素尺寸（宽高相同），默认 32 */
  size?: number;
  /** 无障碍名称；不传则按装饰图处理（aria-hidden） */
  title?: string;
}

export interface CardIconProps extends IconProps {
  /** CARD_ICONS 中的图标 key，如 'domain' / 'lock' */
  iconKey: string;
}

/** 通用图标：按 key 取官方 card 图标 */
export const CardIcon: FC<CardIconProps> = ({ iconKey, size = 32, title, style, ...rest }) => {
  if (!CARD_ICONS[iconKey as keyof typeof CARD_ICONS]) {
    if (typeof console !== 'undefined') console.warn(`[six-systems] 未知图标 key：${iconKey}`);
    return null;
  }
  return (
    <span
      {...rest}
      style={{ display: 'inline-flex', lineHeight: 0, verticalAlign: 'middle', ...style }}
      dangerouslySetInnerHTML={{ __html: cardIcon(iconKey, { size, title }) }}
    />
  );
};

export interface SystemIconProps extends IconProps {
  /** 六大系 id，与 shared-types/world.js#ABILITY_SYSTEMS 完全一致 */
  systemId: SystemId;
}

/** 六大系图标 */
export const SystemIcon: FC<SystemIconProps> = ({ systemId, ...rest }) => (
  <CardIcon iconKey={SYSTEM_ICON_KEYS[systemId]} {...rest} />
);

export interface ElementIconProps extends IconProps {
  /** 五行 id：jin / mu / shui / huo / tu */
  elementId: ElementId;
}

/** 五行图标（御灵系五分支） */
export const ElementIcon: FC<ElementIconProps> = ({ elementId, ...rest }) => (
  <CardIcon iconKey={ELEMENT_ICON_KEYS[elementId]} {...rest} />
);
