/**
 * 六大系能力图标（官方 card SVG 内联组件库）
 *
 * 来源：D:\Projects\huiguan\design-system\ui\AI image\cards\*.svg
 *       （官方 card 图标集，共 23 枚，本文件**逐字节内联**导入，未重绘、未改配色）
 * 本文件由生成器一次性产出；如需增删图标，重新运行生成器而非手改，保证与源目录一致。
 *
 * 使用方式：
 *   import { systemIcon, elementIcon, cardIcon, SYSTEM_ICON_META } from '@lxh/six-systems/ui/system-icons';
 *   el.innerHTML = systemIcon('kongjian', { size: 48, title: '空间系' });   // 原生
 *   <span dangerouslySetInnerHTML={{__html: systemIcon('yuling')}} />        // React
 *
 * 约定：
 *   - 所有图标 viewBox="0 0 128 128"，内部梯度 id 已按图标名命名空间化（id="bg--metal"），
 *     同页渲染多枚互不干扰。
 *   - 六系 → 图标的映射见 SYSTEM_ICON_MAP，`note` 字段写明映射理由，可被 UI 直接展示。
 *   - 六大系 id 与 D:\Projects\shared-types\world.js#ABILITY_SYSTEMS 完全一致。
 */

/** 源目录（只读引用，不参与打包） */
export const CARD_ICON_SOURCE = 'D:\\Projects\\huiguan\\design-system\\ui\\AI image\\cards';

/** 官方 card 图标全量内联（key = 文件名去掉扩展名） */
export const CARD_ICONS = Object.freeze({
  "artifact": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--artifact" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--artifact)" stroke="#4a9a9a" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#4a9a9a" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#4a9a9a" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">造</text>
<path d="M52 96 L76 96" stroke="#4a9a9a" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "black-cat": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--black-cat" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--black-cat)" stroke="#c9c9cf" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#c9c9cf" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>
<g fill="#c9c9cf" opacity="0.9"><ellipse cx="64" cy="92" rx="16" ry="11"/><path d="M50 84 q-12 -2 -16 -14 q4 6 12 6 q2 -6 -4 -10 q10 2 10 10 Z"/><path d="M78 84 q12 -2 16 -14 q-4 6 -12 6 q-2 -6 4 -10 q-10 2 -10 10 Z"/><path d="M64 80 q2 -8 -4 -14 l6 -2 q8 8 2 18 Z"/></g>
<text x="64" y="84" font-size="46" text-anchor="middle" fill="#c9c9cf" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">咻</text>
<path d="M52 96 L76 96" stroke="#c9c9cf" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "common": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--common" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--common)" stroke="#c8b890" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#c8b890" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#c8b890" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">通</text>
<path d="M52 96 L76 96" stroke="#c8b890" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "devour": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--devour" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--devour)" stroke="#5a5a68" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#5a5a68" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#5a5a68" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">噬</text>
<path d="M52 96 L76 96" stroke="#5a5a68" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "domain": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--domain" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--domain)" stroke="#4a9a9a" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#4a9a9a" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#4a9a9a" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">界</text>
<path d="M52 96 L76 96" stroke="#4a9a9a" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "earth": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--earth" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--earth)" stroke="#9a7642" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#9a7642" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#9a7642" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">土</text>
<path d="M52 96 L76 96" stroke="#9a7642" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "fire-spear": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--fire-spear" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--fire-spear)" stroke="#c8452f" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#c8452f" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#c8452f" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">枪</text>
<path d="M52 96 L76 96" stroke="#c8452f" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "fire": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--fire" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--fire)" stroke="#c8452f" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#c8452f" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#c8452f" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">火</text>
<path d="M52 96 L76 96" stroke="#c8452f" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "ice-fire": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--ice-fire" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--ice-fire)" stroke="#7a5ac8" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#7a5ac8" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#7a5ac8" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">域</text>
<path d="M52 96 L76 96" stroke="#7a5ac8" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "jade-disk": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--jade-disk" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--jade-disk)" stroke="#4a9a7a" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#4a9a7a" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#4a9a7a" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">盘</text>
<path d="M52 96 L76 96" stroke="#4a9a7a" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "lock": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--lock" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--lock)" stroke="#9a9a9a" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#9a9a9a" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#9a9a9a" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">锁</text>
<path d="M52 96 L76 96" stroke="#9a9a9a" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "metal": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--metal" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--metal)" stroke="#c9a227" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#c9a227" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#c9a227" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">金</text>
<path d="M52 96 L76 96" stroke="#c9a227" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "mind": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--mind" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--mind)" stroke="#a86a8a" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#a86a8a" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#a86a8a" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">心</text>
<path d="M52 96 L76 96" stroke="#a86a8a" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "mirror": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--mirror" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--mirror)" stroke="#7a9ac8" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#7a9ac8" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#7a9ac8" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">镜</text>
<path d="M52 96 L76 96" stroke="#7a9ac8" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "purple-flame": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--purple-flame" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--purple-flame)" stroke="#9a5ab8" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#9a5ab8" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>
<g fill="#9a5ab8" opacity="0.85"><path d="M64 28 C80 44 84 56 82 70 C80 86 72 96 64 96 C56 96 48 86 46 70 C44 56 48 44 64 28 Z"/><path d="M64 44 C72 54 74 62 72 72 C70 80 66 86 64 86 C60 86 56 80 56 72 C54 62 58 54 64 44 Z" fill="#1c1c20"/></g>
<text x="64" y="84" font-size="46" text-anchor="middle" fill="#9a5ab8" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">焰</text>
<path d="M52 96 L76 96" stroke="#9a5ab8" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "seven-star": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--seven-star" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--seven-star)" stroke="#9a7642" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#9a7642" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#9a7642" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">星</text>
<path d="M52 96 L76 96" stroke="#9a7642" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "space": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--space" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--space)" stroke="#7a6aa8" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#7a6aa8" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#7a6aa8" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">域</text>
<path d="M52 96 L76 96" stroke="#7a6aa8" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "spirit": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--spirit" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--spirit)" stroke="#5f9e4a" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#5f9e4a" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#5f9e4a" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">灵</text>
<path d="M52 96 L76 96" stroke="#5f9e4a" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "sword": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--sword" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--sword)" stroke="#c9a227" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#c9a227" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>
<g fill="none" stroke="#c9a227" stroke-width="3" stroke-linecap="round"><path d="M64 34 L64 74 M58 64 L64 74 L70 64"/><path d="M50 90 L64 74 L78 90" opacity="0.7"/></g>
<text x="64" y="84" font-size="46" text-anchor="middle" fill="#c9a227" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">剑</text>
<path d="M52 96 L76 96" stroke="#c9a227" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "teleport": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--teleport" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--teleport)" stroke="#7a6aa8" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#7a6aa8" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#7a6aa8" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">移</text>
<path d="M52 96 L76 96" stroke="#7a6aa8" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "water": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--water" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--water)" stroke="#3f7f9e" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#3f7f9e" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#3f7f9e" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">水</text>
<path d="M52 96 L76 96" stroke="#3f7f9e" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "white-tiger": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--white-tiger" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--white-tiger)" stroke="#d8d8dc" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#d8d8dc" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>
<g stroke="#d8d8dc" fill="none" stroke-width="2.5" stroke-linecap="round"><path d="M44 74 Q34 64 38 50 Q42 42 50 44 L54 50 Q60 38 70 38 Q84 40 86 54 Q88 66 78 76 L70 86 Q64 82 58 86 Z"/><path d="M38 50 Q30 46 30 38 M42 44 L36 34 M48 44 L46 34" /><path d="M86 54 Q94 50 94 42" /><path d="M48 66 L80 66 M52 72 L76 72" opacity="0.6"/></g>
<text x="64" y="84" font-size="46" text-anchor="middle" fill="#d8d8dc" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">虎</text>
<path d="M52 96 L76 96" stroke="#d8d8dc" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  "wood": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<radialGradient id="bg--wood" cx="50%" cy="36%" r="72%">
<stop offset="0%" stop-color="#2b2b30"/>
<stop offset="100%" stop-color="#0d0d10"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="60" fill="url(#bg--wood)" stroke="#4a8a5a" stroke-width="3.5"/>
<circle cx="64" cy="64" r="51" fill="none" stroke="#4a8a5a" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>

<text x="64" y="84" font-size="46" text-anchor="middle" fill="#4a8a5a" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">木</text>
<path d="M52 96 L76 96" stroke="#4a8a5a" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
</svg>`,
});

/** 图标元信息：字形 / 主色 / 源文件 / viewBox */
export const CARD_ICON_META = Object.freeze({
  "artifact": {
    "key": "artifact",
    "file": "artifact.svg",
    "glyph": "造",
    "color": "#4a9a9a",
    "viewBox": "0 0 128 128"
  },
  "black-cat": {
    "key": "black-cat",
    "file": "black-cat.svg",
    "glyph": "咻",
    "color": "#c9c9cf",
    "viewBox": "0 0 128 128"
  },
  "common": {
    "key": "common",
    "file": "common.svg",
    "glyph": "通",
    "color": "#c8b890",
    "viewBox": "0 0 128 128"
  },
  "devour": {
    "key": "devour",
    "file": "devour.svg",
    "glyph": "噬",
    "color": "#5a5a68",
    "viewBox": "0 0 128 128"
  },
  "domain": {
    "key": "domain",
    "file": "domain.svg",
    "glyph": "界",
    "color": "#4a9a9a",
    "viewBox": "0 0 128 128"
  },
  "earth": {
    "key": "earth",
    "file": "earth.svg",
    "glyph": "土",
    "color": "#9a7642",
    "viewBox": "0 0 128 128"
  },
  "fire-spear": {
    "key": "fire-spear",
    "file": "fire-spear.svg",
    "glyph": "枪",
    "color": "#c8452f",
    "viewBox": "0 0 128 128"
  },
  "fire": {
    "key": "fire",
    "file": "fire.svg",
    "glyph": "火",
    "color": "#c8452f",
    "viewBox": "0 0 128 128"
  },
  "ice-fire": {
    "key": "ice-fire",
    "file": "ice-fire.svg",
    "glyph": "域",
    "color": "#7a5ac8",
    "viewBox": "0 0 128 128"
  },
  "jade-disk": {
    "key": "jade-disk",
    "file": "jade-disk.svg",
    "glyph": "盘",
    "color": "#4a9a7a",
    "viewBox": "0 0 128 128"
  },
  "lock": {
    "key": "lock",
    "file": "lock.svg",
    "glyph": "锁",
    "color": "#9a9a9a",
    "viewBox": "0 0 128 128"
  },
  "metal": {
    "key": "metal",
    "file": "metal.svg",
    "glyph": "金",
    "color": "#c9a227",
    "viewBox": "0 0 128 128"
  },
  "mind": {
    "key": "mind",
    "file": "mind.svg",
    "glyph": "心",
    "color": "#a86a8a",
    "viewBox": "0 0 128 128"
  },
  "mirror": {
    "key": "mirror",
    "file": "mirror.svg",
    "glyph": "镜",
    "color": "#7a9ac8",
    "viewBox": "0 0 128 128"
  },
  "purple-flame": {
    "key": "purple-flame",
    "file": "purple-flame.svg",
    "glyph": "焰",
    "color": "#9a5ab8",
    "viewBox": "0 0 128 128"
  },
  "seven-star": {
    "key": "seven-star",
    "file": "seven-star.svg",
    "glyph": "星",
    "color": "#9a7642",
    "viewBox": "0 0 128 128"
  },
  "space": {
    "key": "space",
    "file": "space.svg",
    "glyph": "域",
    "color": "#7a6aa8",
    "viewBox": "0 0 128 128"
  },
  "spirit": {
    "key": "spirit",
    "file": "spirit.svg",
    "glyph": "灵",
    "color": "#5f9e4a",
    "viewBox": "0 0 128 128"
  },
  "sword": {
    "key": "sword",
    "file": "sword.svg",
    "glyph": "剑",
    "color": "#c9a227",
    "viewBox": "0 0 128 128"
  },
  "teleport": {
    "key": "teleport",
    "file": "teleport.svg",
    "glyph": "移",
    "color": "#7a6aa8",
    "viewBox": "0 0 128 128"
  },
  "water": {
    "key": "water",
    "file": "water.svg",
    "glyph": "水",
    "color": "#3f7f9e",
    "viewBox": "0 0 128 128"
  },
  "white-tiger": {
    "key": "white-tiger",
    "file": "white-tiger.svg",
    "glyph": "虎",
    "color": "#d8d8dc",
    "viewBox": "0 0 128 128"
  },
  "wood": {
    "key": "wood",
    "file": "wood.svg",
    "glyph": "木",
    "color": "#4a8a5a",
    "viewBox": "0 0 128 128"
  }
});

/** 六系 → 图标映射（含映射理由） */
export const SYSTEM_ICON_MAP = Object.freeze({
  "yuling": {
    "key": "metal",
    "note": "官方 card 集未提供「御」字形图标；御灵系取五行根本「金」为其系徽（罗小黑/无限的御灵同为金），五行五枚另作独立图标导出。"
  },
  "suoyu": {
    "key": "lock",
    "note": "锁御系取「锁」，对应灵御 / 制灵 / 法宝品阶。"
  },
  "zaowu": {
    "key": "artifact",
    "note": "造物系取「造」，对应重构 / 改变性质 / 无中生有。"
  },
  "xinling": {
    "key": "mind",
    "note": "心灵系取「心」，对应读心 / 傀儡 / 传音。"
  },
  "shengling": {
    "key": "spirit",
    "note": "生灵系取「灵」，对应洞察 / 观灵 / 豪夺 / 治愈。"
  },
  "kongjian": {
    "key": "space",
    "note": "空间系取「域」，对应官方表述「特殊形态为领域」；传送/吞噬另以 teleport「移」、devour「噬」导出。"
  }
});

/** 五行 → 图标映射 */
export const ELEMENT_ICON_MAP = Object.freeze({
  "jin": "metal",
  "mu": "wood",
  "shui": "water",
  "huo": "fire",
  "tu": "earth"
});


/** 全部可用图标 key */
export const ALL_CARD_ICON_KEYS = Object.freeze(Object.keys(CARD_ICONS));

/** 六系图标 key（展示顺序与 SIX_SYSTEM_IDS 一致） */
export const SYSTEM_ICON_KEYS = Object.freeze({ yuling: 'metal', suoyu: 'lock', zaowu: 'artifact', xinling: 'mind', shengling: 'spirit', kongjian: 'space' });

/** 五行图标 key */
export const ELEMENT_ICON_KEYS = Object.freeze({ ...ELEMENT_ICON_MAP });

/** 分支 / 道具字形池（供卡组、法宝、对战 UI 复用同一套官方字形） */
export const EXTRA_ICON_KEYS = Object.freeze(
  ALL_CARD_ICON_KEYS.filter((k) => !Object.values(SYSTEM_ICON_KEYS).includes(k) && !Object.values(ELEMENT_ICON_KEYS).includes(k)),
);

/** 把宽高 / class / 无障碍属性注入到内联 <svg> 根标签 */
function decorate(svg, { size, className, title, extraAttrs = '' } = {}) {
  const s = size == null ? null : String(size);
  const attrs = [
    s ? `width="${s}" height="${s}"` : '',
    className ? `class="${className}"` : '',
    'role="img"',
    title ? `aria-label="${title}"` : 'aria-hidden="true"',
    extraAttrs,
  ]
    .filter(Boolean)
    .join(' ');
  return svg.replace('<svg ', `<svg ${attrs} `);
}

/**
 * 取任意图标（原生字符串）
 * @param {string} key CARD_ICONS 的 key
 * @param {{size?:number|string,className?:string,title?:string}} [opts]
 */
export function cardIcon(key, opts = {}) {
  const svg = CARD_ICONS[key];
  if (!svg) throw new Error(`未知图标：${key}（可用：${ALL_CARD_ICON_KEYS.join(', ')}）`);
  return decorate(svg, { title: CARD_ICON_META[key]?.glyph ?? key, ...opts });
}

/** 取六大系图标：systemIcon('kongjian', {size:48}) */
export function systemIcon(systemId, opts = {}) {
  const key = SYSTEM_ICON_KEYS[systemId];
  if (!key) throw new Error(`未知系 id：${systemId}`);
  return cardIcon(key, opts);
}

/** 取五行图标：elementIcon('jin', {size:32}) */
export function elementIcon(elementId, opts = {}) {
  const key = ELEMENT_ICON_KEYS[elementId];
  if (!key) throw new Error(`未知五行 id：${elementId}`);
  return cardIcon(key, opts);
}

/** 六系 + 五行的统一入口（UI 侧拿到 id 后无需关心属于哪一类） */
export function iconById(id, opts = {}) {
  return SYSTEM_ICON_KEYS[id] ? systemIcon(id, opts) : elementIcon(id, opts);
}

/** 纯数据版：给需要自己拼 DOM 的场景用 */
export const ICON_SVG = CARD_ICONS;
