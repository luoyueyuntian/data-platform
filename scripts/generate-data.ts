/**
 * SSAS 测试数据生成脚本
 *
 * 生成模拟数据并导入数据库，覆盖所有表：租户、用户、实体分组、实体、标签、
 * 告警规则/记录、仪表盘/面板、审计日志、时序事件。
 *
 * 用法:
 *   tsx scripts/generate-data.ts --preset small     # 7 实体, 3天, ~6万条
 *   tsx scripts/generate-data.ts --preset medium    # 20 实体, 7天, ~60万条
 *   tsx scripts/generate-data.ts --preset large     # 50 实体, 30天, ~1000万条
 *   tsx scripts/generate-data.ts --preset xlarge    # 100 实体, 90天, ~6000万条
 *   tsx scripts/generate-data.ts --clean --preset medium
 *   tsx scripts/generate-data.ts --days 30 --devices 50 --interval 1m
 */

import { prisma } from '../packages/database/dist/index.js';
import { createHash } from 'crypto';

// Pre-computed bcrypt hash of 'admin123'
const ADMIN_PASSWORD_HASH = '$2a$10$j1RlcZj87zedwxpqWFxOse91YNqJ2/qlvpJo6HzuBVApy5rmtIF5i';

// ======================
// 工具函数
// ======================

function deterministicUUID(seed: string): string {
  const hash = createHash('sha1').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ======================
// 配置
// ======================

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000010';

const PRESETS: Record<string, { devices: number; days: number; interval: string; batch: number }> = {
  small:  { devices: 7,   days: 3,  interval: '5m', batch: 500 },
  medium: { devices: 20,  days: 7,  interval: '5m', batch: 1000 },
  large:  { devices: 50,  days: 30, interval: '5m', batch: 2000 },
  xlarge: { devices: 100, days: 90, interval: '1m', batch: 5000 },
};

// ======================
// 类型
// ======================

interface SimMetric {
  name: string;
  baseValue: number;
  amplitude: number;
  periodHours: number;
  noise: number;
  unit: string;
  spikeFrequency: number;
  spikeMultiplier: number;
  rangeMin?: number;
  rangeMax?: number;
}

interface SimEntity {
  name: string;
  entityKey: string;
  type: string;
  groupName: string;
  location: { name: string; lat: number; lng: number; address: string };
  metrics: SimMetric[];
  tags: Record<string, string>;
  phase: string;
  status: string;
}

// ======================
// 设备模板
// ======================

const DEVICE_GROUP_NAMES = ['生产车间 A', '生产车间 B', '仓库区域', '办公区域', '环保监测', '能源管理'];

const LOCATIONS = [
  { name: '1号厂房', lat: 31.2304, lng: 121.4737, address: '上海市浦东新区张江高科技园区' },
  { name: '2号厂房', lat: 31.2310, lng: 121.4740, address: '上海市浦东新区张江高科技园区' },
  { name: '3号厂房', lat: 31.2320, lng: 121.4750, address: '上海市浦东新区张江高科技园区' },
  { name: '仓库A', lat: 31.2330, lng: 121.4760, address: '上海市浦东新区金桥开发区' },
  { name: '仓库B', lat: 31.2335, lng: 121.4765, address: '上海市浦东新区金桥开发区' },
  { name: '办公楼', lat: 31.2340, lng: 121.4770, address: '上海市浦东新区世纪大道' },
  { name: '配电房', lat: 31.2315, lng: 121.4745, address: '上海市浦东新区张江高科技园区' },
  { name: '污水处理站', lat: 31.2325, lng: 121.4755, address: '上海市浦东新区金桥开发区' },
  { name: '冷却塔区', lat: 31.2345, lng: 121.4775, address: '上海市浦东新区张江高科技园区' },
  { name: '原料仓库', lat: 31.2350, lng: 121.4780, address: '上海市浦东新区金桥开发区' },
];

const VENDORS = ['SensTech', 'HygroTech', 'PressCo', 'VibraSense', 'LevelTech', 'GasDetect', 'PowerGen', 'AquaSense', 'EnergyMeter', 'EnviroSense'];

interface DeviceTemplate {
  type: string;
  groupName: string;
  metrics: SimMetric[];
  tags: Record<string, string>;
  phase: string;
  status: string;
}

const TEMPLATES: DeviceTemplate[] = [
  {
    type: 'temperature', groupName: '生产车间 A',
    metrics: [
      { name: 'temperature', baseValue: 75, amplitude: 10, periodHours: 4, noise: 1.5, unit: '°C', spikeFrequency: 0.02, spikeMultiplier: 1.8, rangeMin: 40, rangeMax: 120 },
      { name: 'temperature_inner', baseValue: 82, amplitude: 8, periodHours: 3, noise: 1.0, unit: '°C', spikeFrequency: 0.01, spikeMultiplier: 1.5, rangeMin: 50, rangeMax: 130 },
    ],
    tags: { zone: 'reactor', criticality: 'high' }, phase: 'running', status: 'active',
  },
  {
    type: 'humidity', groupName: '生产车间 A',
    metrics: [
      { name: 'temperature', baseValue: 24, amplitude: 2, periodHours: 6, noise: 0.5, unit: '°C', spikeFrequency: 0, spikeMultiplier: 1, rangeMin: 18, rangeMax: 30 },
      { name: 'humidity', baseValue: 55, amplitude: 10, periodHours: 8, noise: 2, unit: '%RH', spikeFrequency: 0.005, spikeMultiplier: 1.3, rangeMin: 30, rangeMax: 80 },
    ],
    tags: { zone: 'cleanroom', criticality: 'medium' }, phase: 'running', status: 'active',
  },
  {
    type: 'pressure', groupName: '生产车间 B',
    metrics: [
      { name: 'pressure', baseValue: 400, amplitude: 30, periodHours: 2, noise: 8, unit: 'kPa', spikeFrequency: 0.03, spikeMultiplier: 2.0, rangeMin: 200, rangeMax: 600 },
      { name: 'flow_rate', baseValue: 120, amplitude: 20, periodHours: 3, noise: 5, unit: 'L/min', spikeFrequency: 0.01, spikeMultiplier: 1.6, rangeMin: 50, rangeMax: 200 },
    ],
    tags: { zone: 'pipeline', criticality: 'high' }, phase: 'running', status: 'active',
  },
  {
    type: 'vibration', groupName: '生产车间 B',
    metrics: [
      { name: 'vibration_x', baseValue: 2.5, amplitude: 1.0, periodHours: 1, noise: 0.3, unit: 'mm/s', spikeFrequency: 0.04, spikeMultiplier: 3.0, rangeMin: 0, rangeMax: 15 },
      { name: 'vibration_y', baseValue: 2.2, amplitude: 0.8, periodHours: 1, noise: 0.25, unit: 'mm/s', spikeFrequency: 0.03, spikeMultiplier: 2.8, rangeMin: 0, rangeMax: 15 },
      { name: 'temperature', baseValue: 55, amplitude: 5, periodHours: 6, noise: 1, unit: '°C', spikeFrequency: 0.01, spikeMultiplier: 1.4, rangeMin: 20, rangeMax: 90 },
    ],
    tags: { zone: 'compressor', criticality: 'high' }, phase: 'running', status: 'active',
  },
  {
    type: 'level', groupName: '仓库区域',
    metrics: [
      { name: 'level', baseValue: 3.2, amplitude: 0.3, periodHours: 12, noise: 0.05, unit: 'm', spikeFrequency: 0, spikeMultiplier: 1, rangeMin: 0, rangeMax: 5 },
      { name: 'temperature', baseValue: 32, amplitude: 4, periodHours: 8, noise: 0.8, unit: '°C', spikeFrequency: 0, spikeMultiplier: 1, rangeMin: 15, rangeMax: 50 },
    ],
    tags: { zone: 'cooling', criticality: 'medium' }, phase: 'active', status: 'active',
  },
  {
    type: 'gas', groupName: '生产车间 A',
    metrics: [
      { name: 'co2', baseValue: 420, amplitude: 80, periodHours: 6, noise: 15, unit: 'ppm', spikeFrequency: 0.01, spikeMultiplier: 2.5, rangeMin: 300, rangeMax: 2000 },
      { name: 'voc', baseValue: 50, amplitude: 20, periodHours: 4, noise: 5, unit: 'ppm', spikeFrequency: 0.02, spikeMultiplier: 3.0, rangeMin: 0, rangeMax: 500 },
      { name: 'pm25', baseValue: 35, amplitude: 15, periodHours: 8, noise: 8, unit: 'μg/m³', spikeFrequency: 0.01, spikeMultiplier: 2.0, rangeMin: 0, rangeMax: 200 },
    ],
    tags: { zone: 'air_quality', criticality: 'high' }, phase: 'running', status: 'active',
  },
  {
    type: 'power', groupName: '能源管理',
    metrics: [
      { name: 'power', baseValue: 500, amplitude: 100, periodHours: 6, noise: 20, unit: 'kW', spikeFrequency: 0.005, spikeMultiplier: 1.5, rangeMin: 0, rangeMax: 1000 },
      { name: 'current', baseValue: 720, amplitude: 80, periodHours: 6, noise: 15, unit: 'A', spikeFrequency: 0.005, spikeMultiplier: 1.4, rangeMin: 0, rangeMax: 1500 },
      { name: 'voltage', baseValue: 380, amplitude: 5, periodHours: 24, noise: 2, unit: 'V', spikeFrequency: 0.001, spikeMultiplier: 1.1, rangeMin: 350, rangeMax: 420 },
    ],
    tags: { zone: 'power', criticality: 'critical' }, phase: 'running', status: 'active',
  },
  {
    type: 'water_quality', groupName: '环保监测',
    metrics: [
      { name: 'ph', baseValue: 7.2, amplitude: 0.5, periodHours: 12, noise: 0.1, unit: '', spikeFrequency: 0.005, spikeMultiplier: 1.5, rangeMin: 6, rangeMax: 9 },
      { name: 'dissolved_oxygen', baseValue: 8.5, amplitude: 1.5, periodHours: 8, noise: 0.3, unit: 'mg/L', spikeFrequency: 0.01, spikeMultiplier: 1.4, rangeMin: 4, rangeMax: 14 },
      { name: 'turbidity', baseValue: 15, amplitude: 5, periodHours: 6, noise: 2, unit: 'NTU', spikeFrequency: 0.02, spikeMultiplier: 2.5, rangeMin: 0, rangeMax: 100 },
    ],
    tags: { zone: 'water', criticality: 'medium' }, phase: 'running', status: 'active',
  },
  {
    type: 'energy', groupName: '能源管理',
    metrics: [
      { name: 'active_power', baseValue: 120, amplitude: 30, periodHours: 6, noise: 5, unit: 'kW', spikeFrequency: 0.01, spikeMultiplier: 1.5, rangeMin: 0, rangeMax: 300 },
      { name: 'reactive_power', baseValue: 40, amplitude: 15, periodHours: 6, noise: 3, unit: 'kVAR', spikeFrequency: 0.005, spikeMultiplier: 1.3, rangeMin: 0, rangeMax: 100 },
      { name: 'power_factor', baseValue: 0.92, amplitude: 0.05, periodHours: 12, noise: 0.01, unit: '', spikeFrequency: 0, spikeMultiplier: 1, rangeMin: 0.7, rangeMax: 1.0 },
    ],
    tags: { zone: 'energy', criticality: 'medium' }, phase: 'running', status: 'active',
  },
  {
    type: 'environment', groupName: '办公区域',
    metrics: [
      { name: 'temperature', baseValue: 23, amplitude: 2, periodHours: 24, noise: 0.3, unit: '°C', spikeFrequency: 0, spikeMultiplier: 1, rangeMin: 16, rangeMax: 30 },
      { name: 'humidity', baseValue: 50, amplitude: 8, periodHours: 12, noise: 1.5, unit: '%RH', spikeFrequency: 0, spikeMultiplier: 1, rangeMin: 30, rangeMax: 70 },
      { name: 'co2', baseValue: 600, amplitude: 200, periodHours: 8, noise: 30, unit: 'ppm', spikeFrequency: 0.005, spikeMultiplier: 1.5, rangeMin: 300, rangeMax: 2000 },
    ],
    tags: { zone: 'office', criticality: 'low' }, phase: 'running', status: 'active',
  },
];

// ======================
// 批量生成实体
// ======================

function generateEntities(count: number): SimEntity[] {
  const entities: SimEntity[] = [];

  // 前 7 个经典实体
  const classics: SimEntity[] = [
    { name: '反应釜温度监测 T-01', entityKey: 'reactor-temp-t01', type: 'temperature', groupName: '生产车间 A', location: LOCATIONS[0], metrics: TEMPLATES[0].metrics, tags: { ...TEMPLATES[0].tags, vendor: 'SensTech' }, phase: 'running', status: 'active' },
    { name: '洁净车间温湿度 H-01', entityKey: 'cleanroom-humidity-h01', type: 'humidity', groupName: '生产车间 A', location: LOCATIONS[1], metrics: TEMPLATES[1].metrics, tags: { ...TEMPLATES[1].tags, vendor: 'HygroTech' }, phase: 'running', status: 'active' },
    { name: '管道压力监测 P-01', entityKey: 'pipeline-pressure-p01', type: 'pressure', groupName: '生产车间 B', location: LOCATIONS[2], metrics: TEMPLATES[2].metrics, tags: { ...TEMPLATES[2].tags, vendor: 'PressCo' }, phase: 'running', status: 'active' },
    { name: '压缩机振动监测 V-01', entityKey: 'compressor-vibe-v01', type: 'vibration', groupName: '生产车间 B', location: LOCATIONS[2], metrics: TEMPLATES[3].metrics, tags: { ...TEMPLATES[3].tags, vendor: 'VibraSense' }, phase: 'running', status: 'active' },
    { name: '冷却塔液位监测 L-01', entityKey: 'cooling-tower-level-l01', type: 'level', groupName: '仓库区域', location: LOCATIONS[8], metrics: TEMPLATES[4].metrics, tags: { ...TEMPLATES[4].tags, vendor: 'LevelTech' }, phase: 'active', status: 'active' },
    { name: '气体检测仪 G-01', entityKey: 'gas-detector-g01', type: 'gas', groupName: '生产车间 A', location: LOCATIONS[0], metrics: TEMPLATES[5].metrics, tags: { ...TEMPLATES[5].tags, vendor: 'GasDetect' }, phase: 'running', status: 'active' },
    { name: '发电机组功率监测 E-01', entityKey: 'generator-power-e01', type: 'power', groupName: '能源管理', location: LOCATIONS[6], metrics: TEMPLATES[6].metrics, tags: { ...TEMPLATES[6].tags, vendor: 'PowerGen' }, phase: 'running', status: 'active' },
  ];

  for (const e of classics) {
    if (entities.length >= count) break;
    entities.push(e);
  }

  // 剩余从模板批量生成
  const typeLabels: Record<string, string> = {
    temperature: '温度', humidity: '温湿度', pressure: '压力', vibration: '振动',
    level: '液位', gas: '气体', power: '功率', water_quality: '水质',
    energy: '能耗', environment: '环境',
  };

  let seq = 2;
  while (entities.length < count) {
    for (const tpl of TEMPLATES) {
      if (entities.length >= count) break;
      const label = typeLabels[tpl.type] || tpl.type;
      const pad = String(seq).padStart(2, '0');
      const loc = LOCATIONS[entities.length % LOCATIONS.length];
      entities.push({
        name: `${loc.name}${label}监测 ${tpl.type.toUpperCase().slice(0, 1)}-${pad}`,
        entityKey: `${tpl.type}-${loc.name.replace(/\s+/g, '').toLowerCase()}-${pad}`,
        type: tpl.type,
        groupName: tpl.groupName,
        location: loc,
        metrics: tpl.metrics.map((m) => ({ ...m })),
        tags: { ...tpl.tags, vendor: VENDORS[entities.length % VENDORS.length] },
        phase: tpl.phase,
        status: tpl.status,
      });
    }
    seq++;
  }

  return entities;
}

// ======================
// 告警规则
// ======================

const ALERT_RULES = [
  { name: '反应釜温度过高', description: '反应釜温度超过 95°C 时触发告警', conditions: [{ eventName: 'temperature', operator: '>', threshold: 95, window: '5m' }], severity: 'critical' as const },
  { name: '管道压力异常', description: '管道压力超过 500kPa 或低于 250kPa', conditions: [{ eventName: 'pressure', operator: '>', threshold: 500, window: '3m' }], severity: 'warn' as const },
  { name: '压缩机振动超标', description: '振动值超过 8mm/s', conditions: [{ eventName: 'vibration_x', operator: '>', threshold: 8, window: '2m' }], severity: 'critical' as const },
  { name: '洁净车间湿度异常', description: '湿度超过 70% 或低于 40%', conditions: [{ eventName: 'humidity', operator: '>', threshold: 70, window: '10m' }], severity: 'warn' as const },
  { name: 'CO2 浓度超标', description: 'CO2 浓度超过 800ppm', conditions: [{ eventName: 'co2', operator: '>', threshold: 800, window: '5m' }], severity: 'warn' as const },
  { name: '冷却塔液位过低', description: '液位低于 2m', conditions: [{ eventName: 'level', operator: '<', threshold: 2, window: '15m' }], severity: 'info' as const },
  { name: '水质 pH 异常', description: 'pH 低于 6.5 或高于 8.5', conditions: [{ eventName: 'ph', operator: '<', threshold: 6.5, window: '10m' }], severity: 'warn' as const },
  { name: '功率因数过低', description: '功率因数低于 0.85', conditions: [{ eventName: 'power_factor', operator: '<', threshold: 0.85, window: '30m' }], severity: 'info' as const },
];

// ======================
// 数据生成
// ======================

function generateMetricValue(metric: SimMetric, timestamp: number, startTime: number): { value: number; quality: number } {
  const hours = (timestamp - startTime) / 3600000;
  const cyclic = Math.sin((hours / metric.periodHours) * Math.PI * 2) * metric.amplitude;
  const u1 = Math.random() || 0.0001;
  const u2 = Math.random();
  const noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * metric.noise;
  const drift = Math.sin((hours / 168) * Math.PI) * metric.amplitude * 0.2;
  const hourOfDay = hours % 24;
  const dayNight = Math.sin(((hourOfDay - 6) / 24) * Math.PI * 2) * metric.amplitude * 0.1;

  let value = metric.baseValue + cyclic + noise + drift + dayNight;
  let quality = 100;

  if (metric.spikeFrequency > 0 && Math.random() < metric.spikeFrequency) {
    value += (Math.random() > 0.3 ? 1 : -1) * metric.amplitude * metric.spikeMultiplier;
    quality = randomInt(50, 80);
  }
  if (Math.random() < 0.002) quality = randomInt(10, 50);
  if (Math.random() < 0.001) quality = 0;

  if (metric.rangeMin !== undefined) value = Math.max(metric.rangeMin, value);
  if (metric.rangeMax !== undefined) value = Math.min(metric.rangeMax, value);

  return { value: Math.round(value * 100) / 100, quality };
}

// ======================
// CLI
// ======================

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      opts[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      if (opts[key] !== 'true') i++;
    }
  }
  const preset = PRESETS[opts.preset || 'small'] || PRESETS.small;
  return {
    days: parseInt(opts.days) || preset.days,
    interval: opts.interval || preset.interval,
    devices: parseInt(opts.devices) || preset.devices,
    noTimeseries: opts['no-timeseries'] === 'true',
    clean: opts.clean === 'true',
    batch: parseInt(opts.batch) || preset.batch,
    preset: opts.preset || 'small',
  };
}

function parseIntervalMs(s: string): number {
  const m = s.match(/^(\d+)([mhd])$/);
  if (!m) return 300000;
  const v = parseInt(m[1]);
  return v * { m: 60000, h: 3600000, d: 86400000 }[m[2] as 'm' | 'h' | 'd']!;
}

// ======================
// 数据库操作
// ======================

async function cleanTestData() {
  console.log('\n🧹 清除已有测试数据...');
  await prisma.$executeRawUnsafe(
    `DELETE FROM timescale.events WHERE entity_id IN (SELECT id FROM public.entities WHERE tenant_id = $1::uuid)`,
    TENANT_ID,
  );
  await prisma.panel.deleteMany({ where: { dashboard: { tenantId: TENANT_ID } } });
  await prisma.dashboard.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.alertRecord.deleteMany({ where: { rule: { tenantId: TENANT_ID } } });
  await prisma.alertRule.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.entityTag.deleteMany({ where: { entity: { tenantId: TENANT_ID } } });
  await prisma.entity.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.entityGroup.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.apiKey.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.auditLog.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
  console.log('  ✅ 清除完成');
}

async function seedBaseData(deviceCount: number) {
  console.log('\n📋 生成基础数据...');

  // 1. 租户
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, name: 'Demo Organization', plan: 'enterprise' },
  });
  console.log(`  ✅ 租户: ${tenant.name}`);

  // 2. 用户 (admin + operator + viewer)
  const hashedPw = ADMIN_PASSWORD_HASH;
  await prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    update: { password: hashedPw },
    create: { id: ADMIN_USER_ID, tenantId: tenant.id, email: 'admin@ssas.local', name: 'Admin', password: hashedPw, role: 'admin', status: 'active' },
  });
  const operatorId = deterministicUUID('user-operator');
  await prisma.user.upsert({
    where: { id: operatorId },
    update: {},
    create: { id: operatorId, tenantId: tenant.id, email: 'operator@ssas.local', name: 'Operator Zhang', password: hashedPw, role: 'operator', status: 'active' },
  });
  const viewerId = deterministicUUID('user-viewer');
  await prisma.user.upsert({
    where: { id: viewerId },
    update: {},
    create: { id: viewerId, tenantId: tenant.id, email: 'viewer@ssas.local', name: 'Viewer Li', password: hashedPw, role: 'viewer', status: 'active' },
  });
  console.log('  ✅ 用户: admin@ssas.local, operator@ssas.local, viewer@ssas.local (密码: admin123)');

  // 3. 实体分组
  const groups: Record<string, string> = {};
  for (const name of DEVICE_GROUP_NAMES) {
    const g = await prisma.entityGroup.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name, description: `${name}的设备组` },
    });
    groups[name] = g.id;
  }
  console.log(`  ✅ 实体分组: ${DEVICE_GROUP_NAMES.join(', ')}`);

  // 4. 实体 + 标签
  const entities = generateEntities(deviceCount);
  const entityIds: Record<string, string> = {};

  for (const e of entities) {
    const entity = await prisma.entity.upsert({
      where: { entityKey: e.entityKey },
      update: {
        name: e.name, type: e.type, status: e.status, phase: e.phase,
        groupId: groups[e.groupName],
        location: e.location as any,
        metadata: { simulator: true, metrics: e.metrics.map((m) => m.name) },
        lastSeenAt: new Date(),
      },
      create: {
        tenantId: tenant.id, name: e.name, entityKey: e.entityKey, type: e.type,
        status: e.status, phase: e.phase, groupId: groups[e.groupName],
        location: e.location as any,
        metadata: { simulator: true, metrics: e.metrics.map((m) => m.name) },
        lastSeenAt: new Date(),
      },
    });
    entityIds[e.entityKey] = entity.id;

    for (const [key, value] of Object.entries(e.tags)) {
      await prisma.entityTag.upsert({
        where: { id: deterministicUUID(`tag-${entity.id}-${key}`) },
        update: { value },
        create: { id: deterministicUUID(`tag-${entity.id}-${key}`), entityId: entity.id, key, value, source: 'import' },
      });
    }
  }
  console.log(`  ✅ 实体: ${entities.length} 个`);

  // 5. 告警规则
  for (const rule of ALERT_RULES) {
    await prisma.alertRule.upsert({
      where: { id: deterministicUUID(`alert-${rule.name}`) },
      update: {},
      create: {
        id: deterministicUUID(`alert-${rule.name}`),
        tenantId: tenant.id,
        name: rule.name,
        description: rule.description,
        conditions: rule.conditions as any,
        conditionLogic: 'any',
        channels: [{ type: 'webhook', config: { url: 'http://localhost:3000/webhook' } }],
        silenceSeconds: 300,
        enabled: true,
      },
    });
  }
  console.log(`  ✅ 告警规则: ${ALERT_RULES.length} 条`);

  // 6. 告警记录 (每条规则 5-20 条历史记录)
  const severities = ['info', 'warn', 'critical'];
  const statuses = ['firing', 'resolved', 'acknowledged'];
  let alertRecordCount = 0;
  for (const rule of ALERT_RULES) {
    const ruleId = deterministicUUID(`alert-${rule.name}`);
    const count = randomInt(5, 20);
    for (let i = 0; i < count; i++) {
      const triggeredAt = new Date(Date.now() - randomInt(1, 30) * 86400000 - randomInt(0, 86400000));
      const status = randomPick(statuses);
      await prisma.alertRecord.create({
        data: {
          ruleId,
          ruleName: rule.name,
          entityId: randomPick(Object.values(entityIds)),
          triggeredValue: rule.conditions[0].threshold + (Math.random() - 0.3) * 20,
          severity: rule.severity,
          message: `${rule.name}: 触发值 ${rule.conditions[0].threshold}`,
          status,
          triggeredAt,
          resolvedAt: status === 'resolved' ? new Date(triggeredAt.getTime() + randomInt(60000, 3600000)) : null,
          resolvedBy: status === 'resolved' ? 'system' : null,
        },
      });
      alertRecordCount++;
    }
  }
  console.log(`  ✅ 告警记录: ${alertRecordCount} 条`);

  // 7. 仪表盘 + 面板
  const dashboard = await prisma.dashboard.upsert({
    where: { id: deterministicUUID('dashboard-main') },
    update: {},
    create: {
      id: deterministicUUID('dashboard-main'),
      tenantId: tenant.id,
      name: '生产监控大屏',
      description: '实时监控所有生产设备的关键指标',
      layout: { columns: 12, rowHeight: 80 },
      isPublic: false,
    },
  });

  const panelDefs = [
    { title: '反应釜温度趋势', type: 'line', x: 0, y: 0, w: 6, h: 4, metrics: ['temperature'] },
    { title: '管道压力监控', type: 'gauge', x: 6, y: 0, w: 3, h: 4, metrics: ['pressure'] },
    { title: '压缩机振动', type: 'line', x: 9, y: 0, w: 3, h: 4, metrics: ['vibration_x', 'vibration_y'] },
    { title: '环境温湿度', type: 'line', x: 0, y: 4, w: 6, h: 4, metrics: ['temperature', 'humidity'] },
    { title: '气体浓度', type: 'bar', x: 6, y: 4, w: 6, h: 4, metrics: ['co2', 'voc', 'pm25'] },
    { title: '发电功率', type: 'stat', x: 0, y: 8, w: 4, h: 3, metrics: ['power'] },
    { title: '冷却塔液位', type: 'area', x: 4, y: 8, w: 4, h: 3, metrics: ['level'] },
    { title: '设备在线状态', type: 'table', x: 8, y: 8, w: 4, h: 3, metrics: [] },
  ];

  for (let i = 0; i < panelDefs.length; i++) {
    const p = panelDefs[i];
    await prisma.panel.upsert({
      where: { id: deterministicUUID(`panel-${i}`) },
      update: {},
      create: {
        id: deterministicUUID(`panel-${i}`),
        dashboardId: dashboard.id,
        title: p.title,
        type: p.type,
        query: { metricNames: p.metrics, aggregation: 'avg', granularity: '5m', timeRange: '24h' },
        position: { x: p.x, y: p.y, w: p.w, h: p.h },
      },
    });
  }
  console.log(`  ✅ 仪表盘: ${dashboard.name} (${panelDefs.length} 个面板)`);

  // 8. 审计日志
  const actions = ['entity.create', 'entity.update', 'entity.delete', 'alert.create', 'alert.update', 'alert.acknowledge', 'dashboard.create', 'user.login', 'user.logout', 'apikey.create'];
  const resources = ['entity', 'alert_rule', 'dashboard', 'user', 'api_key'];
  const userIds = [ADMIN_USER_ID, operatorId, viewerId];
  const auditCount = randomInt(100, 300);
  for (let i = 0; i < auditCount; i++) {
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: randomPick(userIds),
        action: randomPick(actions),
        resource: randomPick(resources),
        resourceId: randomPick(Object.values(entityIds)),
        detail: { source: 'demo', index: i },
        ip: `192.168.1.${randomInt(1, 254)}`,
        createdAt: new Date(Date.now() - randomInt(0, 30) * 86400000),
      },
    });
  }
  console.log(`  ✅ 审计日志: ${auditCount} 条`);

  return { tenant, entities, entityIds };
}

async function generateTimeseriesData(
  entities: SimEntity[],
  entityIds: Record<string, string>,
  days: number,
  intervalMs: number,
  batchSize: number,
) {
  const endTime = Date.now();
  const startTime = endTime - days * 86400000;
  const pointsPerEntity = Math.floor((endTime - startTime) / intervalMs);
  const totalMetrics = entities.reduce((s, e) => s + e.metrics.length, 0);
  const estimated = pointsPerEntity * totalMetrics;

  console.log(`\n📊 生成时序事件...`);
  console.log(`   时间范围:    ${days} 天`);
  console.log(`   采样间隔:    ${intervalMs / 1000}s`);
  console.log(`   实体数:      ${entities.length}`);
  console.log(`   指标数:      ${totalMetrics}`);
  console.log(`   预计数据量:  ${formatNumber(estimated)}`);
  console.log('');

  let totalInserted = 0;
  const startTs = Date.now();

  for (let di = 0; di < entities.length; di++) {
    const ent = entities[di];
    const entityId = entityIds[ent.entityKey];
    if (!entityId) continue;

    let batch: Array<{ time: Date; entityId: string; eventName: string; value: number; properties: string; tags: string; quality: number }> = [];
    let entityInserted = 0;

    for (let i = 0; i < pointsPerEntity; i++) {
      const ts = new Date(endTime - i * intervalMs);

      for (const metric of ent.metrics) {
        const { value, quality } = generateMetricValue(metric, ts.getTime(), startTime);
        if (quality === 0) continue;

        batch.push({
          time: ts,
          entityId,
          eventName: metric.name,
          value,
          properties: JSON.stringify({ unit: metric.unit }),
          tags: JSON.stringify({ unit: metric.unit, zone: ent.tags.zone || '' }),
          quality,
        });
      }

      if (batch.length >= batchSize) {
        await insertEventBatch(batch);
        totalInserted += batch.length;
        entityInserted += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      await insertEventBatch(batch);
      totalInserted += batch.length;
      entityInserted += batch.length;
    }

    const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
    const rate = totalInserted > 0 ? formatNumber(Math.round((totalInserted / (Date.now() - startTs)) * 1000)) : '0';
    process.stdout.write(
      `\r   [${di + 1}/${entities.length}] ${ent.name} → ${formatNumber(entityInserted)} | 总计: ${formatNumber(totalInserted)} | ${elapsed}s | ${rate}/s   `,
    );
  }

  console.log('');
  return totalInserted;
}

async function insertEventBatch(
  batch: Array<{ time: Date; entityId: string; eventName: string; value: number; properties: string; tags: string; quality: number }>,
) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const r of batch) {
    clauses.push(`($${idx++}, $${idx++}::uuid, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}::jsonb, $${idx++})`);
    params.push(r.time, r.entityId, r.eventName, r.value, r.properties, r.tags, r.quality);
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO timescale.events (time, entity_id, event_name, value, properties, tags, quality)
     VALUES ${clauses.join(', ')}
     ON CONFLICT (time, entity_id, event_name) DO NOTHING`,
    ...params,
  );
}

// ======================
// 主流程
// ======================

async function main() {
  const config = parseArgs();
  const entities = generateEntities(config.devices);
  const totalMetrics = entities.reduce((s, e) => s + e.metrics.length, 0);
  const intervalMs = parseIntervalMs(config.interval);
  const estimated = Math.floor((config.days * 86400000) / intervalMs) * totalMetrics;

  console.log('========================================');
  console.log('  SSAS 测试数据生成器');
  console.log('========================================');
  console.log(`  预设:       ${config.preset}`);
  console.log(`  实体数:     ${config.devices}`);
  console.log(`  指标数:     ${totalMetrics}`);
  console.log(`  时间范围:   ${config.days} 天`);
  console.log(`  采样间隔:   ${config.interval}`);
  console.log(`  预计数据量: ${formatNumber(estimated)} 条`);
  console.log(`  时序数据:   ${config.noTimeseries ? '跳过' : '生成'}`);
  console.log('');

  try {
    console.log('✅ 数据库连接成功');

    if (config.clean) await cleanTestData();

    const { entities: seeded, entityIds } = await seedBaseData(config.devices);

    if (!config.noTimeseries) {
      const total = await generateTimeseriesData(seeded, entityIds, config.days, intervalMs, config.batch);
      console.log('\n========================================');
      console.log(`  ✅ 完成! 共插入 ${formatNumber(total)} 条时序事件`);
    } else {
      console.log('\n========================================');
      console.log('  ✅ 基础数据生成完成 (跳过时序数据)');
    }

    console.log('========================================');
    console.log('');
    console.log('📋 验证信息:');
    console.log('   租户:     Demo Organization');
    console.log('   用户:     admin@ssas.local / admin123');
    console.log('   实体数:   ' + seeded.length);
    console.log('   告警规则: ' + ALERT_RULES.length + ' 条');
    console.log('');
    console.log('🔗 验证命令:');
    console.log('   pnpm db:studio          # Prisma Studio');
    console.log('   pnpm dev                # 启动服务');
  } catch (err) {
    console.error('\n❌ 错误:', err);
    process.exit(1);
  }
}

main();
