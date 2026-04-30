/** 校验设备标识符 */
export function validateDeviceKey(key: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(key);
}

/** 校验邮箱格式 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
