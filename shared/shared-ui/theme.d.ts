/**
 * 全站主题内核（window.XTheme，普通 script）。
 * 偏好存 cookie `hx_theme`（light|dark|auto），在同一批准根域的子站间共享；
 * 生效主题写 <html data-theme>。变更时派发 document 事件 `xthemechange`。
 */
export interface ThemeChangeDetail {
  /** 用户偏好：'auto' 表示跟随系统 */
  stored: 'light' | 'dark' | 'auto';
  /** 当前生效主题（已解析系统偏好） */
  resolved: 'light' | 'dark';
  /** 系统当前偏好 */
  system: 'light' | 'dark';
}

interface XTheme {
  /** cookie 里的用户偏好；无记录时返回 'auto' */
  stored(): 'light' | 'dark' | 'auto';
  /** 当前生效主题（解析 auto 后的结果，与 <html data-theme> 一致） */
  resolved(): 'light' | 'dark';
  /** 系统当前是否偏好深色 */
  systemPrefersDark(): boolean;
  /** 写入偏好（'auto' = 跟随系统）；返回生效主题 */
  set(preference: 'light' | 'dark' | 'auto'): 'light' | 'dark';
  /** 两态按钮：翻转到另一态并脱离跟随系统；返回新的生效主题 */
  toggleTwoState(): 'light' | 'dark';
  /** 旧版 localStorage 二值偏好（如 'fantasy-map-theme'）迁入 cookie，仅首次生效 */
  migrateLegacy(key: string): void;
  /** head 内联防闪烁片段（渲染前设置 data-theme），构建脚本可直接取用 */
  HEAD_SNIPPET: string;
}

declare global {
  const XTheme: XTheme;
}

export {};
