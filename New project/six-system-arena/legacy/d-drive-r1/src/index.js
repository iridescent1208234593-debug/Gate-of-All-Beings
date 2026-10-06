/**
 * @lxh/six-systems —— 罗小黑·六大系数值可视化与对战扩展
 *
 * 对外入口（纯 JS，无框架依赖）。
 * 需要 React 组件时用子路径 `@lxh/six-systems/ui/react`
 * 或以相对路径引用 `src/ui/react/index.tsx`。
 */

export * from './world/index.js';
export * from './ui/index.js';
export { default as sampleCharacters } from './data/characters.json' with { type: 'json' };
export { default as dataProvenance } from './data/_provenance.json' with { type: 'json' };
