/**
 * 六大系图标 React 组件（官方 card SVG 内联渲染）
 *
 * 用途：zszm（TypeScript / React）侧直接引用，无需把 SVG 塞进 public 目录，
 *       也不引入任何三方图标库；图标标记与官方 card 集逐字节一致。
 *
 * 引用方式：
 *   import { SystemIcon, ElementIcon } from '@lxh/six-systems/ui/react';
 *   <SystemIcon systemId="kongjian" size={48} title="空间系" />
 *   <ElementIcon elementId="mu" size={24} />
 *
 * 实现说明：官方标记是静态可信字符串（构建期由生成器内联，非用户输入），
 *           因此这里用 dangerouslySetInnerHTML 注入，避免把 128×128 的
 *           path/circle 手写成 JSX 造成标记漂移。
 */
import * as React from 'react';
import type { CSSProperties, FC } from 'react';

import {
  CARD_ICONS,
  SYSTEM_ICON_KEYS,
  ELEMENT_ICON_KEYS,
  decorateIcon,
} from '../system-icons.js';

export type SystemId = keyof typeof SYSTEM_ICON_KEYS;
export type ElementId = keyof typeof ELEMENT_ICON_KEYS;

export interface IconProps {
  /** 像素尺寸（宽高相同），默认 32 */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** 无障碍标签；不传则视为纯装饰（aria-hidden） */
  title?: string;
  /** 额外的 aria/data 属性透传 */
  [dataAttr: `data-${string}`]: string | number | undefined;
}

interface BaseIconProps extends IconProps {
  /** CARD_ICONS 中的图标 key */
  iconKey: string;
}

/** 通用图标：直接指定官方 card 图标 key */
export const CardIcon: FC<BaseIconProps> = ({ iconKey, size = 32, className, style, title, ...rest }) => {
  const svg = CARD_ICONS[iconKey as keyof typeof CARD_ICONS];
  if (!svg) {
    if (typeof console !== 'undefined') console.warn(`[six-systems] 未知图标 key: ${iconKey}`);
    return null;
  }
  const { dangerouslySetInnerHTML, ...attrs } = decorateIcon(svg, {
    size,
    className,
    title,
    attrs: rest as Record<string, string | number | undefined>,
  });
  return <span {...attrs} style={style} dangerouslySetInnerHTML={dangerouslySetInnerHTML} />;
};

export interface SystemIconProps extends IconProps {
  /** 六大系 id，与 shared-types/world.js#ABILITY_SYSTEMS 一致 */
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
