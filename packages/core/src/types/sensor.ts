/**
 * Sensor — 对应神策 Item
 * 传感器是设备的部件，负责采集具体指标
 */

export interface Sensor {
  id: string;
  deviceId: string;
  name: string;
  type: SensorType;
  /** 计量单位 (如 °C, %, Pa) */
  unit: string;
  /** 量程下限 */
  rangeMin?: number;
  /** 量程上限 */
  rangeMax?: number;
  /** 精度 */
  precision?: number;
  /** 校准参数 */
  calibration?: {
    offset: number;
    scale: number;
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export enum SensorType {
  THERMOCOUPLE = 'thermocouple',
  RTD = 'rtd',
  CAPACITIVE = 'capacitive',
  PIEZOELECTRIC = 'piezoelectric',
  STRAIN_GAUGE = 'strain_gauge',
  ELECTROCHEMICAL = 'electrochemical',
  INFRARED = 'infrared',
  ULTRASONIC = 'ultrasonic',
  OPTICAL = 'optical',
  OTHER = 'other',
}

/** 计量单位枚举 */
export enum MetricUnit {
  CELSIUS = '°C',
  FAHRENHEIT = '°F',
  PERCENT = '%',
  PASCAL = 'Pa',
  KPA = 'kPa',
  MPA = 'MPa',
  MMHG = 'mmHg',
  METER = 'm',
  CM = 'cm',
  MM = 'mm',
  MS = 'ms',
  HZ = 'Hz',
  RPM = 'rpm',
  L_MIN = 'L/min',
  M3_H = 'm³/h',
  PPM = 'ppm',
  VOLT = 'V',
  AMP = 'A',
  WATT = 'W',
  CUSTOM = '',
}
