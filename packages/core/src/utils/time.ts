/** Sleep for ms milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 获取时间窗口的起止时间 */
export function getTimeRange(granularity: string, count: number): { start: Date; end: Date } {
  const end = new Date();
  const unit = granularity.slice(-1);
  const value = parseInt(granularity.slice(0, -1), 10) * count;

  const start = new Date(end);
  switch (unit) {
    case 'm':
      start.setMinutes(start.getMinutes() - value);
      break;
    case 'h':
      start.setHours(start.getHours() - value);
      break;
    case 'd':
      start.setDate(start.getDate() - value);
      break;
    default:
      start.setHours(start.getHours() - 24);
  }
  return { start, end };
}

/** 格式化时间到 ISO 字符串 */
export function toISO(date: Date): string {
  return date.toISOString();
}
