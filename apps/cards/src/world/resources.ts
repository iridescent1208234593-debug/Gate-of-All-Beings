import type { ResourceKey } from './types';

/** 与共享账本 RESOURCE_KEYS 相同的顺序；纯函数与测试不依赖浏览器存储模块。 */
export const RESOURCE_KEYS_LIST: readonly ResourceKey[] = ['spirit', 'herb', 'food', 'soul', 'shards'];
export const RESOURCE_NAMES: Record<ResourceKey, string> = { spirit: '灵质', herb: '草药', food: '食物', soul: '魂灵', shards: '残片' };

/**
 * 玩家看得到的资源。魂灵和修行残片已从界面撤下，但仍留在共享账本里：
 * 旧重生之门页面还会写这两项，账本校验也要求它们存在，已有余额也不能丢。
 */
export const SHOWN_RESOURCES: readonly ResourceKey[] = ['spirit', 'herb', 'food'];
export const isShownResource = (key: ResourceKey) => SHOWN_RESOURCES.includes(key);
