/** 默认分页大小 */
export const DEFAULT_PAGE_SIZE = 20;

/** 最大分页大小 */
export const MAX_PAGE_SIZE = 100;

/** 系统限制常量 */
export const LIMITS = {
  /** 单次批量最大事件数 */
  MAX_BATCH_SIZE: 1000,
  /** 实体名最大长度 */
  MAX_ENTITY_NAME_LENGTH: 255,
  /** 最多标签数 */
  MAX_TAGS_PER_ENTITY: 50,
  /** 查询最大时间范围 (天) */
  MAX_QUERY_DAYS: 365,
  /** 告警规则名最大长度 */
  MAX_RULE_NAME_LENGTH: 128,
} as const;

/** 默认告警静默期 (秒) */
export const DEFAULT_SILENCE_SECONDS = 300;

/** 时间粒度(秒)映射 */
export const GRANULARITY_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '6h': 21600,
  '12h': 43200,
  '1d': 86400,
} as const;
