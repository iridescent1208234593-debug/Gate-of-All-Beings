import type { ResourceKey } from './types';

/** 与共享账本 RESOURCE_KEYS 相同的顺序；纯函数与测试不依赖浏览器存储模块。 */
export const RESOURCE_KEYS_LIST: readonly ResourceKey[] = ['spirit', 'herb', 'food', 'soul', 'shards'];
export const RESOURCE_NAMES: Record<ResourceKey, string> = { spirit: '灵质', herb: '草药', food: '食物', soul: '魂灵', shards: '残片' };
