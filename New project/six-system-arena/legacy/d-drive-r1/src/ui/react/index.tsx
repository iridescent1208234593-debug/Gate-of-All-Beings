/**
 * React 子路径出口（新增于第 1 轮）
 *
 * 为什么新增这个文件：package.json 的 exports 里 `./ui/react` 指向
 *   `./src/ui/react/index.tsx`，但本目录此前只有 SystemIcon.tsx，
 *   于是 `import { SystemIcon } from '@lxh/six-systems/ui/react'` 必然解析失败。
 * 本轮按「只新增、不覆盖」原则，仅补齐这个 barrel 文件，未改动任何既有文件。
 *
 * ⚠️ 既有缺陷（本轮未修，见 README「未决项」#1）：
 *   SystemIcon.tsx 从 '../system-icons.js' 导入 `decorateIcon`，而 system-icons.js
 *   实际并未导出该符号（已实测 typeof decorateIcon === 'undefined'），
 *   因此本路径当前在构建期会报 "does not provide an export named 'decorateIcon'"。
 *   修法二选一（需用户确认后再动既有文件）：
 *     A) 在 system-icons.js 中补 `export function decorateIcon(...)`，与 systemIcon() 共用同一套
 *        size/title/attrs 装饰逻辑；
 *     B) 让 SystemIcon.tsx 改用已存在的 `systemIcon(id, {size,title})` + 原生 span 包裹。
 */

export { CardIcon, SystemIcon, ElementIcon } from './SystemIcon.js';
export type { CardIcon as CardIconComponent, IconProps, SystemIconProps, ElementIconProps, SystemId, ElementId } from './SystemIcon.js';
