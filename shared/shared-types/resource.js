/**
 * @file 资源域常量与查询工具。按「域」隔离同名资源，避免跨系统一符多义（如 food）。
 * 纯 JS ES Modules + JSDoc，零依赖。
 * 约束：常量内部只存 ASCII key，中文只作为 `label` 展示值存在。
 */

/**
 * 资源域 id 联合类型。
 * @typedef {'eco'|'management'|'card'} ResourceDomainId
 */

/**
 * 资源域 →（资源 id → 中文 label）冻结映射，三个域均已冻结。
 * - `eco`：生态模拟（ecoplanet3d-js）
 * - `management`：经营模拟（lingjing-huiguan）
 * - `card`：修仙卡牌独占
 * @type {Readonly<Record<ResourceDomainId, Readonly<Record<string,string>>>>}
 */
export const RESOURCE_DOMAINS = Object.freeze({
  eco: Object.freeze({ water: '水', food: '食物', mineral: '矿物' }),
  management: Object.freeze({
    spirit: '灵质',
    food: '食物',
    faqi: '法器',
    wood: '木材',
    herb: '药草',
    stone: '石头',
    ore: '矿石',
  }),
  card: Object.freeze({
    spiritStone: '灵石',
    lifespan: '寿元',
    pills: '丹药',
    treasures: '法宝',
    companions: '同伴',
  }),
});

/**
 * 资源域顺序表（冻结）。
 * @type {readonly ResourceDomainId[]}
 */
export const RESOURCE_DOMAIN_IDS = Object.freeze(
  /** @type {any} */ (Object.keys(RESOURCE_DOMAINS)),
);

/**
 * 判断是否为合法资源域 id。
 * @param {*} domain 待判断的值
 * @returns {boolean} 是否为合法域 id
 */
function hasDomain(domain) {
  return typeof domain === 'string' && Object.prototype.hasOwnProperty.call(RESOURCE_DOMAINS, domain);
}

/**
 * 列出某个域下的全部资源 id。
 * @param {*} domain 域 id：`'eco'` / `'management'` / `'card'`
 * @returns {readonly string[]} 资源 id 列表（冻结，保持声明顺序）；非法域返回空数组
 * @example
 * resourcesOf('eco'); // ['water','food','mineral']
 */
export function resourcesOf(domain) {
  if (!hasDomain(domain)) return Object.freeze([]);
  return Object.freeze(Object.keys(RESOURCE_DOMAINS[/** @type {any} */ (domain)]));
}

/**
 * 查询指定域下资源的展示名。
 * @param {*} domain 域 id
 * @param {*} id 资源 id（ASCII，精确匹配，域内隔离）
 * @returns {string|null} 中文 label；域或资源非法返回 null
 * @example
 * resourceLabel('management', 'spirit'); // '灵质'
 */
export function resourceLabel(domain, id) {
  if (!hasDomain(domain) || typeof id !== 'string') return null;
  const table = RESOURCE_DOMAINS[/** @type {any} */ (domain)];
  return Object.prototype.hasOwnProperty.call(table, id) ? table[id] : null;
}

/**
 * 判断某 id 是否为指定域下的合法资源 id（**含域隔离**）。
 * @param {*} domain 域 id
 * @param {*} id 资源 id
 * @returns {boolean} 该域下存在该资源则 true
 * @example
 * isResourceId('eco', 'spirit');        // false（spirit 属 management 域）
 * isResourceId('management', 'spirit'); // true
 */
export function isResourceId(domain, id) {
  return resourceLabel(domain, id) !== null;
}

/**
 * 跨域查找某资源 id 出现在哪些域中（体现 `food` 一类的一符多义）。
 * @param {*} id 资源 id
 * @returns {readonly ResourceDomainId[]} 命中的域 id 列表（冻结，按 RESOURCE_DOMAIN_IDS 顺序）；无命中返回空数组
 * @example
 * findResourceDomains('food');   // ['eco','management']
 * findResourceDomains('spirit'); // ['management']
 */
export function findResourceDomains(id) {
  if (typeof id !== 'string' || id === '') return Object.freeze([]);
  const hits = RESOURCE_DOMAIN_IDS.filter((domain) =>
    Object.prototype.hasOwnProperty.call(RESOURCE_DOMAINS[domain], id),
  );
  return Object.freeze(/** @type {any} */ (hits));
}
