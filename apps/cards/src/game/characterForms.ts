/**
 * 共同旅途里角色的显示名。有些角色在游戏里只收录了某个形态，属性与数值也只对应这个形态；
 * 显示名写明形态，免得玩家误以为是完整形态、完整强度。所有显示这类角色名字的地方都从这里取。
 */
export const CHARACTER_FORMS: Readonly<Record<number, string>> = Object.freeze({
  4: '老君（节能模式）',
});

export const characterDisplayName = (c: { id: number; name: string }) => CHARACTER_FORMS[c.id] ?? c.name;
