/**
 * SSAS 测试数据生成脚本
 *
 * 生成模拟 IoT 传感器数据并直接导入数据库。
 * 支持两种模式:
 *   1. 直接数据库模式 (默认) — 快速，无需启动 API
 *   2. API 模式 — 通过 HTTP API 导入，需要 API 运行且提供认证
 *
 * 用法:
 *   # 直接数据库模式 (推荐)
 *   tsx scripts/generate-data.ts
 *
 *   # 自定义参数
 *   tsx scripts/generate-data.ts --days 30 --interval 1m --devices 7
 *
 *   # API 模式 (需要 API 运行)
 *   tsx scripts/generate-data.ts --mode api --token <jwt-token>
 *
 *   # 只生成基础数据 (设备、告警规则等，不生成时序数据)
 *   tsx scripts/generate-data.ts --no-timeseries
 *
 *   # 清除已有测试数据后重新生成
 *   tsx scripts/generate-data.ts --clean
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

// ======================
// 工具函数
// ======================

/**
 * 从种子字符串生成确定性 UUID (v5 风格)
 * 相同的种子始终生成相同的 UUID
 */
function deterministicUUID(seed: string): string {
  const hash = createHash('sha1').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`, // version 5
    `${((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

// ======================
// 配置
// ======================

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000010';
const API_BASE = process.env.API_URL || 'http://localhost:4000/api/v1';

// ======================
// 类型定义
// ======================

interface SimDevice {
  name: string;
  deviceKey: string;
  type: string;
  groupName: string;
  location: { name: string; lat: number; lng: number; address: string };
  metrics: SimMetric[];
  tags: Record<string, string>;
  phase: string;
  status: string;
}

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

interface AlertRuleDef {
  name: string;
  description: string;
  conditions: Array<{
    metricName: string;
    operator: string;
    threshold: number;
    window?: string;
  }>;
  severity: 'info' | 'warn' | 'critical';
}

// ======================
// 模拟设备定义
// ======================

const DEVICE_GROUP_NAMES = ['生产车间 A', '生产车间 B', '仓库区域', '办公区域'];

const DEVICES: SimDevice[] = [
  {
    name: '反应釜温度监测 T-01',
    deviceKey: 'reactor-temp-t01',
    type: 'temperature',
    groupName: '生产车间 A',
    location: { name: '1号反应釜', lat: 31.2304, lng: 121.4737, address: '上海市浦东新区张江高科技园区' },
    metrics: [
      { name: 'temperature', baseValue: 75, amplitude: 10, periodHours: 4, noise: 1.5, unit: '°C', spikeFrequency: 0.02, spikeMultiplier: 1.8, rangeMin: 40, rangeMax: 120 },
      { name: 'temperature_inner', baseValue: 82, amplitude: 8, periodHours: 3, noise: 1.0, unit: '°C', spikeFrequency: 0.01, spikeMultiplier: 1.5, rangeMin: 50, rangeMax: 130 },
    ],
    tags: { zone: 'reactor', criticality: 'high', vendor: 'SensTech' },
    phase: 'running',
    status: 'online',
  },
  {
    name: '洁净车间温湿度 H-01',
    deviceKey: 'cleanroom-humidity-h01',
    type: 'humidity',
    groupName: '生产车间 A',
    location: { name: '洁净车间 A-101', lat: 31.2310, lng: 121.4740, address: '上海市浦东新区张江高科技园区' },
    metrics: [
      { name: 'temperature', baseValue: 24, amplitude: 2, periodHours: 6, noise: 0.5, unit: '°C', spikeFrequency: 0, spikeMultiplier: 1, rangeMin: 18, rangeMax: 30 },
      { name: 'humidity', baseValue: 55, amplitude: 10, periodHours: 8, noise: 2, unit: '%RH', spikeFrequency: 0.005, spikeMultiplier: 1.3, rangeMin: 30, rangeMax: 80 },
    ],
    tags: { zone: 'cleanroom', criticality: 'medium', vendor: 'HygroTech' },
    phase: 'running',
    status: 'online',
  },
  {
    name: '管道压力监测 P-01',
    deviceKey: 'pipeline-pressure-p01',
    type: 'pressure',
    groupName: '生产车间 B',
    location: { name: '主管道节点 3', lat: 31.2320, lng: 121.4750, address: '上海市浦东新区张江高科技园区' },
    metrics: [
      { name: 'pressure', baseValue: 400, amplitude: 30, periodHours: 2, noise: 8, unit: 'kPa', spikeFrequency: 0.03, spikeMultiplier: 2.0, rangeMin: 200, rangeMax: 600 },
      { name: 'flow_rate', baseValue: 120, amplitude: 20, periodHours: 3, noise: 5, unit: 'L/min', spikeFrequency: 0.01, spikeMultiplier: 1.6, rangeMin: 50, rangeMax: 200 },
    ],
    tags: { zone: 'pipeline', criticality: 'high', vendor: 'PressCo' },
    phase: 'running',
    status: 'online',
  },
  {
    name: '压缩机振动监测 V-01',
    deviceKey: 'compressor-vibe-v01',
    type: 'vibration',
    groupName: '生产车间 B',
    location: { name: '2号压缩机', lat: 31.2325, lng: 121.4755, address: '上海市浦东新区张江高科技园区' },
    metrics: [
      { name: 'vibration_x', baseValue: 2.5, amplitude: 1.0, periodHours: 1, noise: 0.3, unit: 'mm/s', spikeFrequency: 0.04, spikeMultiplier: 3.0, rangeMin: 0, rangeMax: 15 },
      { name: 'vibration_y', baseValue: 2.2, amplitude: 0.8, periodHours: 1, noise: 0.25, unit: 'mm/s', spikeFrequency: 0.03, spikeMultiplier: 2.8, rangeMin: 0, rangeMax: 15 },
      { name: 'temperature', baseValue: 55, amplitude: 5, periodHours: 6, noise: 1, unit: '°C', spikeFrequency: 0.01, spikeMultiplier: 1.4, rangeMin: 20, rangeMax: 90 },
    ],
    tags: { zone: 'compressor', criticality: 'high', vendor: 'VibraSense' },
    phase: 'running',
    status: 'online',
  },
  {
    name: '冷却塔液位监测 L-01',
    deviceKey: 'cooling-tower-level-l01',
    type: 'level',
    groupName: '仓库区域',
    location: { name: '冷却塔 A', lat: 31.2330, lng: 121.4760, address: '上海市浦东新区张江高科技园区' },
    metrics: [
      { name: 'level', baseValue: 3.2, amplitude: 0.3, periodHours: 12, noise: 0.05, unit: 'm', spikeFrequency: 0, spikeMultiplier: 1, rangeMin: 0, rangeMax: 5 },
      { name: 'temperature', baseValue: 32, amplitude: 4, periodHours: 8, noise: 0.8, unit: '°C', spikeFrequency: 0, spikeMultiplier: 1, rangeMin: 15, rangeMax: 50 },
    ],
    tags: { zone: 'cooling', criticality: 'medium', vendor: 'LevelTech' },
    phase: 'active',
    status: 'online',
  },
  {
    name: '气体检测仪 G-01',
    deviceKey: 'gas-detector-g01',
    type: 'gas',
    groupName: '生产车间 A',
    location: { name: '气体监测点 1', lat: 31.2315, lng: 121.4745, address: '上海市浦东新区张江高科技园区' },
    metrics: [
      { name: 'co2', baseValue: 420, amplitude: 80, periodHours: 6, noise: 15, unit: 'ppm', spikeFrequency: 0.01, spikeMultiplier: 2.5, rangeMin: 300, rangeMax: 2000 },
      { name: 'voc', baseValue: 50, amplitude: 20, periodHours: 4, noise: 5, unit: 'ppm', spikeFrequency: 0.02, spikeMultiplier: 3.0, rangeMin: 0, rangeMax: 500 },
      { name: 'pm25', baseValue: 35, amplitude: 15, periodHours: 8, noise: 8, unit: 'μg/m³', spikeFrequency: 0.01, spikeMultiplier: 2.0, rangeMin: 0, rangeMax: 200 },
    ],
    tags: { zone: 'air_quality', criticality: 'high', vendor: 'GasDetect' },
    phase: 'running',
    status: 'online',
  },
  {
    name: '发电机组功率监测 E-01',
    deviceKey: 'generator-power-e01',
    type: 'custom',
    groupName: '仓库区域',
    location: { name: '备用发电机房', lat: 31.2335, lng: 121.4765, address: '上海市浦东新区张江高科技园区' },
    metrics: [
      { name: 'power', baseValue: 500, amplitude: 100, periodHours: 6, noise: 20, unit: 'kW', spikeFrequency: 0.005, spikeMultiplier: 1.5, rangeMin: 0, rangeMax: 1000 },
      { name: 'current', baseValue: 720, amplitude: 80, periodHours: 6, noise: 15, unit: 'A', spikeFrequency: 0.005, spikeMultiplier: 1.4, rangeMin: 0, rangeMax: 1500 },
      { name: 'voltage', baseValue: 380, amplitude: 5, periodHours: 24, noise: 2, unit: 'V', spikeFrequency: 0.001, spikeMultiplier: 1.1, rangeMin: 350, rangeMax: 420 },
      { name: 'frequency', baseValue: 50, amplitude: 0.5, periodHours: 24, noise: 0.1, unit: 'Hz', spikeFrequency: 0.001, spikeMultiplier: 2.0, rangeMin: 48, rangeMax: 52 },
    ],
    tags: { zone: 'power', criticality: 'critical', vendor: 'PowerGen' },
    phase: 'running',
    status: 'online',
  },
];

// ======================
// 告警规则定义
// ======================

const ALERT_RULES: AlertRuleDef[] = [
  {
    name: '反应釜温度过高',
    description: '反应釜温度超过 95°C 时触发告警',
    conditions: [{ metricName: 'temperature', operator: '>', threshold: 95, window: '5m' }],
    severity: 'critical',
  },
  {
    name: '管道压力异常',
    description: '管道压力超过 500kPa 或低于 250kPa 时触发',
    conditions: [
      { metricName: 'pressure', operator: '>', threshold: 500, window: '3m' },
      { metricName: 'pressure', operator: '<', threshold: 250, window: '3m' },
    ],
    severity: 'warn',
  },
  {
    name: '压缩机振动超标',
    description: '振动值超过 8mm/s 表示设备可能故障',
    conditions: [{ metricName: 'vibration_x', operator: '>', threshold: 8, window: '2m' }],
    severity: 'critical',
  },
  {
    name: '洁净车间湿度异常',
    description: '洁净车间湿度超过 70% 或低于 40%',
    conditions: [
      { metricName: 'humidity', operator: '>', threshold: 70, window: '10m' },
      { metricName: 'humidity', operator: '<', threshold: 40, window: '10m' },
    ],
    severity: 'warn',
  },
  {
    name: 'CO2 浓度超标',
    description: 'CO2 浓度超过 800ppm 时触发',
    conditions: [{ metricName: 'co2', operator: '>', threshold: 800, window: '5m' }],
    severity: 'warn',
  },
  {
    name: '冷却塔液位过低',
    description: '冷却塔液位低于 2m 时触发',
    conditions: [{ metricName: 'level', operator: '<', threshold: 2, window: '15m' }],
    severity: 'info',
  },
];

// ======================
// 数据生成函数
// ======================

function generateMetricValue(
  metric: SimMetric,
  timestamp: number,
  startTime: number,
): { value: number; quality: number } {
  const hoursSinceStart = (timestamp - startTime) / 3600000;

  // 周期性波动 (sin)
  const cyclic = Math.sin((hoursSinceStart / metric.periodHours) * Math.PI * 2) * metric.amplitude;

  // 随机噪声 (高斯分布近似)
  const u1 = Math.random();
  const u2 = Math.random();
  const gaussianNoise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * metric.noise;

  // 长期漂移 (一周周期)
  const drift = Math.sin(hoursSinceStart / 168 * Math.PI) * metric.amplitude * 0.2;

  // 日夜模式 (白天值略高)
  const hourOfDay = (hoursSinceStart % 24);
  const dayNightCycle = Math.sin((hourOfDay - 6) / 24 * Math.PI * 2) * metric.amplitude * 0.1;

  let value = metric.baseValue + cyclic + gaussianNoise + drift + dayNightCycle;

  // 偶发异常尖峰
  let quality = 100;
  if (metric.spikeFrequency > 0 && Math.random() < metric.spikeFrequency) {
    const spikeDirection = Math.random() > 0.3 ? 1 : -1;
    value = value + spikeDirection * metric.amplitude * metric.spikeMultiplier;
    quality = Math.floor(Math.random() * 30) + 50; // 50-80
  }

  // 偶尔的数据质量问题
  if (Math.random() < 0.002) {
    quality = Math.floor(Math.random() * 40) + 10; // 10-50
  }

  // 非常偶尔的数据丢失
  if (Math.random() < 0.001) {
    quality = 0;
  }

  // 限制在合理范围内
  if (metric.rangeMin !== undefined) value = Math.max(metric.rangeMin, value);
  if (metric.rangeMax !== undefined) value = Math.min(metric.rangeMax, value);

  return { value: Math.round(value * 100) / 100, quality };
}

// ======================
// CLI 参数解析
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
  return {
    mode: (opts.mode || 'db') as 'db' | 'api',
    days: parseInt(opts.days) || 7,
    interval: opts.interval || '5m',
    devices: parseInt(opts.devices) || DEVICES.length,
    token: opts.token || '',
    api: opts.api || API_BASE,
    noImport: opts['no-import'] === 'true',
    noTimeseries: opts['no-timeseries'] === 'true',
    clean: opts.clean === 'true',
    batch: parseInt(opts.batch) || 500,
  };
}

function parseInterval(s: string): number {
  const m = s.match(/^(\d+)([mhd])$/);
  if (!m) return 300000; // default 5m
  const v = parseInt(m[1]);
  switch (m[2]) {
    case 'm': return v * 60000;
    case 'h': return v * 3600000;
    case 'd': return v * 86400000;
    default: return 300000;
  }
}

// ======================
// 直接数据库模式
// ======================

async function cleanTestData(prisma: PrismaClient) {
  console.log('\n🧹 清除已有测试数据...');

  // 删除时序数据
  await prisma.$executeRawUnsafe(`DELETE FROM timescale.events WHERE entity_id IN (SELECT id FROM public.entities WHERE tenant_id = $1::uuid)`, TENANT_ID);

  // 删除关联数据
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

async function seedBaseData(prisma: PrismaClient) {
  console.log('\n📋 生成基础数据...');

  // 1. Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, name: 'Demo Organization', plan: 'enterprise' },
  });
  console.log(`  ✅ 租户: ${tenant.name}`);

  // 2. Admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { id: USER_ID },
    update: { password: hashedPassword, role: 'admin', status: 'active' },
    create: {
      id: USER_ID,
      tenantId: tenant.id,
      email: 'admin@ssas.local',
      name: 'Admin',
      password: hashedPassword,
      role: 'admin',
      status: 'active',
    },
  });
  console.log(`  ✅ 用户: ${user.email} (密码: admin123)`);

  // 3. Entity groups
  const groups: Record<string, string> = {};
  for (const groupName of DEVICE_GROUP_NAMES) {
    const group = await prisma.entityGroup.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: groupName } },
      update: {},
      create: { tenantId: tenant.id, name: groupName, description: `${groupName}的设备组` },
    });
    groups[groupName] = group.id;
  }
  console.log(`  ✅ 设备组: ${Object.keys(groups).join(', ')}`);

  // 4. Entities + Tags
  const deviceIds: Record<string, string> = {};
  const selectedDevices = DEVICES.slice(0, parseArgs().devices || DEVICES.length);

  for (const dev of selectedDevices) {
    const entity = await prisma.entity.upsert({
      where: { entityKey: dev.deviceKey },
      update: {
        name: dev.name,
        type: dev.type,
        status: dev.status === 'online' ? 'active' : dev.status,
        phase: dev.phase,
        groupId: groups[dev.groupName],
        location: dev.location as any,
        metadata: { simulator: true, generatedAt: new Date().toISOString(), metrics: dev.metrics.map(m => m.name) },
        lastSeenAt: new Date(),
      },
      create: {
        tenantId: tenant.id,
        name: dev.name,
        entityKey: dev.deviceKey,
        type: dev.type,
        status: dev.status === 'online' ? 'active' : dev.status,
        phase: dev.phase,
        groupId: groups[dev.groupName],
        location: dev.location as any,
        metadata: { simulator: true, generatedAt: new Date().toISOString(), metrics: dev.metrics.map(m => m.name) },
        lastSeenAt: new Date(),
      },
    });
    deviceIds[dev.deviceKey] = entity.id;

    // Tags
    for (const [key, value] of Object.entries(dev.tags)) {
      const tagId = deterministicUUID(`tag-${entity.id}-${key}`);
      await prisma.entityTag.upsert({
        where: { id: tagId },
        update: { value },
        create: {
          id: tagId,
          entityId: entity.id,
          key,
          value,
          source: 'import',
        },
      });
    }

    console.log(`  ✅ 实体: ${dev.name} (${dev.metrics.length} 个指标, ${Object.keys(dev.tags).length} 个标签)`);
  }

  // 5. Alert rules
  for (const ruleDef of ALERT_RULES) {
    // 找到对应设备
    const targetDevice = selectedDevices.find(d =>
      d.metrics.some(m => ruleDef.conditions.some(c => c.metricName === m.name))
    );
    if (!targetDevice) continue;

    const deviceId = deviceIds[targetDevice.deviceKey];
    if (!deviceId) continue;

    await prisma.alertRule.upsert({
      where: { id: deterministicUUID(`alert-${ruleDef.name}`) },
      update: {},
      create: {
        id: deterministicUUID(`alert-${ruleDef.name}`),
        tenantId: tenant.id,
        name: ruleDef.name,
        description: ruleDef.description,
        conditions: ruleDef.conditions as any,
        conditionLogic: 'any',
        channels: [{ type: 'webhook', config: { url: 'http://localhost:3000/webhook' } }],
        silenceSeconds: 300,
        enabled: true,
      },
    });
  }
  console.log(`  ✅ 告警规则: ${ALERT_RULES.length} 条`);

  // 6. Dashboard
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

  // Panels
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
    const panelId = deterministicUUID(`panel-${i}`);
    await prisma.panel.upsert({
      where: { id: panelId },
      update: {},
      create: {
        id: panelId,
        dashboardId: dashboard.id,
        title: p.title,
        type: p.type,
        query: { metricNames: p.metrics, aggregation: 'avg', granularity: '5m', timeRange: '24h' },
        position: { x: p.x, y: p.y, w: p.w, h: p.h },
      },
    });
  }
  console.log(`  ✅ 仪表盘: ${dashboard.name} (${panelDefs.length} 个面板)`);

  return { tenant, user, deviceIds, selectedDevices };
}

async function generateTimeseriesData(
  prisma: PrismaClient,
  devices: SimDevice[],
  deviceIds: Record<string, string>,
  days: number,
  intervalMs: number,
  batchSize: number,
) {
  const endTime = Date.now();
  const startTime = endTime - days * 86400000;
  const totalPointsPerDevice = Math.floor((endTime - startTime) / intervalMs);

  console.log(`\n📊 生成时序数据...`);
  console.log(`   时间范围: ${days} 天`);
  console.log(`   采样间隔: ${intervalMs / 1000}s`);
  console.log(`   每设备数据点: ~${totalPointsPerDevice}`);
  console.log(`   批次大小: ${batchSize}`);

  let totalInserted = 0;

  for (const dev of devices) {
    const deviceId = deviceIds[dev.deviceKey];
    if (!deviceId) continue;

    console.log(`\n   📡 ${dev.name}...`);

    const sensorIdMap: Record<string, string> = {};
    for (const metric of dev.metrics) {
      sensorIdMap[metric.name] = deterministicUUID(`sensor-${deviceId}-${metric.name}`);
    }

    let batch: Array<{
      time: Date;
      entityId: string;
      eventName: string;
      value: number;
      properties: string;
      tags: string;
      quality: number;
    }> = [];

    let batchCount = 0;

    for (let i = 0; i < totalPointsPerDevice; i++) {
      const timestamp = new Date(endTime - i * intervalMs);

      for (const metric of dev.metrics) {
        const { value, quality } = generateMetricValue(metric, timestamp.getTime(), startTime);
        if (quality === 0) continue;

        batch.push({
          time: timestamp,
          entityId: deviceId,
          eventName: metric.name,
          value,
          properties: JSON.stringify({ unit: metric.unit }),
          tags: JSON.stringify({ unit: metric.unit, zone: dev.tags.zone || '' }),
          quality,
        });
      }

      if (batch.length >= batchSize) {
        await insertBatch(prisma, batch);
        totalInserted += batch.length;
        batchCount++;
        if (batchCount % 10 === 0) {
          process.stdout.write(`     已写入 ${totalInserted} 条...\r`);
        }
        batch = [];
      }
    }

    // 最后一批
    if (batch.length > 0) {
      await insertBatch(prisma, batch);
      totalInserted += batch.length;
    }

    console.log(`     ✅ 完成`);
  }

  return totalInserted;
}

async function insertBatch(
  prisma: PrismaClient,
  batch: Array<{
    time: Date;
    entityId: string;
    eventName: string;
    value: number;
    properties: string;
    tags: string;
    quality: number;
  }>,
) {
  const valueClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const p of batch) {
    valueClauses.push(
      `($${idx++}, $${idx++}::uuid, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}::jsonb, $${idx++})`,
    );
    params.push(p.time, p.entityId, p.eventName, p.value, p.properties, p.tags, p.quality);
  }

  const sql = `
    INSERT INTO timescale.events (time, entity_id, event_name, value, properties, tags, quality)
    VALUES ${valueClauses.join(', ')}
    ON CONFLICT (time, entity_id, event_name) DO NOTHING
  `;

  await prisma.$executeRawUnsafe(sql, ...params);
}

// ======================
// API 模式
// ======================

async function apiMode(config: ReturnType<typeof parseArgs>) {
  if (!config.token) {
    console.error('❌ API 模式需要提供 --token 参数 (JWT token)');
    console.log('   获取方式: POST /api/v1/auth/login { "email": "admin@ssas.local", "password": "admin123" }');
    process.exit(1);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.token}`,
  };

  const selectedDevices = DEVICES.slice(0, config.devices);
  const intervalMs = parseInterval(config.interval);
  const endTime = Date.now();
  const startTime = endTime - config.days * 86400000;

  console.log('\n📋 API 模式 - 生成设备...');

  const deviceIds: Record<string, string> = {};

  for (const dev of selectedDevices) {
    // 查找或创建实体
    const searchRes = await fetch(`${config.api}/entities?search=${dev.deviceKey}`, { headers });
    const searchData = await searchRes.json() as any;

    if (searchData.code === 0 && searchData.data?.data?.length > 0) {
      deviceIds[dev.deviceKey] = searchData.data.data[0].id;
      console.log(`  📡 实体已存在: ${dev.name}`);
    } else {
      const createRes = await fetch(`${config.api}/entities`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: dev.name,
          entityKey: dev.deviceKey,
          type: dev.type,
          metadata: { simulator: true },
          location: dev.location,
        }),
      });
      const createData = await createRes.json() as any;
      if (createData.code === 0) {
        deviceIds[dev.deviceKey] = createData.data.id;
        console.log(`  ✅ 创建实体: ${dev.name}`);
      } else {
        console.error(`  ❌ 创建失败: ${dev.name} - ${createData.message}`);
      }
    }
  }

  if (!config.noImport && !config.noTimeseries) {
    console.log('\n📊 通过 API 导入时序数据...');

    for (const dev of selectedDevices) {
      const deviceId = deviceIds[dev.deviceKey];
      if (!deviceId) continue;

      console.log(`\n   📡 ${dev.name}...`);
      const totalPoints = Math.floor((endTime - startTime) / intervalMs);
      let imported = 0;
      let batch: Array<{ eventName: string; value: number; time: string; quality: number }> = [];

      for (let i = 0; i < totalPoints; i++) {
        const timestamp = new Date(endTime - i * intervalMs);

        for (const metric of dev.metrics) {
          const { value, quality } = generateMetricValue(metric, timestamp.getTime(), startTime);
          if (quality === 0) continue;

          batch.push({
            eventName: metric.name,
            value,
            time: timestamp.toISOString(),
            quality,
          });
        }

        if (batch.length >= 100) {
          const res = await fetch(`${config.api}/events/batch`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ entityId: deviceId, events: batch }),
          });
          const data = await res.json() as any;
          if (data.code !== 0) {
            console.error(`     ❌ Batch 失败: ${data.message}`);
          }
          imported += batch.length;
          batch = [];
        }
      }

      if (batch.length > 0) {
        await fetch(`${config.api}/events/batch`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ entityId: deviceId, events: batch }),
        });
        imported += batch.length;
      }

      console.log(`     ✅ 导入 ${imported} 条`);
    }
  }
}

// ======================
// 主流程
// ======================

async function main() {
  const config = parseArgs();

  console.log('========================================');
  console.log('  SSAS 测试数据生成器');
  console.log('========================================');
  console.log('');
  console.log(`  模式:     ${config.mode === 'db' ? '直接数据库' : 'API'}`);
  console.log(`  设备数:   ${config.devices}`);
  console.log(`  时间范围: ${config.days} 天`);
  console.log(`  间隔:     ${config.interval}`);
  console.log(`  时序数据: ${config.noTimeseries ? '跳过' : '生成'}`);
  console.log('');

  if (config.mode === 'api') {
    await apiMode(config);
    return;
  }

  // 直接数据库模式
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    if (config.clean) {
      await cleanTestData(prisma);
    }

    // 基础数据
    const { deviceIds, selectedDevices } = await seedBaseData(prisma);

    // 时序数据
    if (!config.noTimeseries && !config.noImport) {
      const intervalMs = parseInterval(config.interval);
      const totalInserted = await generateTimeseriesData(
        prisma,
        selectedDevices,
        deviceIds,
        config.days,
        intervalMs,
        config.batch,
      );

      console.log('\n========================================');
      console.log(`  ✅ 完成! 共插入 ${totalInserted} 条时序数据点`);
    } else {
      console.log('\n========================================');
      console.log('  ✅ 基础数据生成完成 (跳过时序数据)');
    }

    console.log('========================================');
    console.log('');
    console.log('📋 验证信息:');
    console.log('   租户:     Demo Organization');
    console.log('   用户:     admin@ssas.local / admin123');
    console.log('   设备组:   ' + DEVICE_GROUP_NAMES.join(', '));
    console.log('   设备数:   ' + selectedDevices.length);
    console.log('   告警规则: ' + ALERT_RULES.length + ' 条');
    console.log('');
    console.log('🔗 验证命令:');
    console.log('   pnpm db:studio          # 打开 Prisma Studio 查看数据');
    console.log('   pnpm dev                # 启动服务后访问 Web 控制台');
    console.log('');

  } catch (err) {
    console.error('\n❌ 错误:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
