/**
 * 测试数据生成脚本
 *
 * 生成模拟 IoT 传感器数据并导入 SSAS 平台。
 *
 * 用法:
 *   # 先确保 API 服务在运行
 *   pnpm dev -F @ssas/app-api
 *
 *   # 生成过去 7 天数据，每 5 分钟一条
 *   tsx scripts/generate-data.ts
 *
 *   # 自定义参数
 *   tsx scripts/generate-data.ts --devices 10 --days 30 --interval 1m --api http://localhost:4000/api/v1
 */

const API_BASE = process.env.API_URL || 'http://localhost:4000/api/v1';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ======================
// 设备定义
// ======================

interface SimDevice {
  name: string;
  deviceKey: string;
  type: string;
  metrics: SimMetric[];
}

interface SimMetric {
  name: string;
  /** 基础值 */
  baseValue: number;
  /** 波动幅度 */
  amplitude: number;
  /** 波动周期 (小时) */
  periodHours: number;
  /** 噪声水平 */
  noise: number;
  /** 单位 */
  unit: string;
  /** 偶尔异常的频率 (0 = 从不, 1 = 每次) */
  spikeFrequency: number;
  /** 异常幅度倍数 */
  spikeMultiplier: number;
}

const DEVICES: SimDevice[] = [
  {
    name: '反应釜温度监测 A-01',
    deviceKey: 'reactor-temp-a01',
    type: 'temperature',
    metrics: [
      { name: 'temperature', baseValue: 75, amplitude: 10, periodHours: 4, noise: 1.5, unit: '°C', spikeFrequency: 0.02, spikeMultiplier: 1.8 },
      { name: 'temperature_inner', baseValue: 82, amplitude: 8, periodHours: 3, noise: 1.0, unit: '°C', spikeFrequency: 0.01, spikeMultiplier: 1.5 },
    ],
  },
  {
    name: '洁净车间温湿度 H-01',
    deviceKey: 'cleanroom-humidity-h01',
    type: 'humidity',
    metrics: [
      { name: 'temperature', baseValue: 24, amplitude: 2, periodHours: 6, noise: 0.5, unit: '°C', spikeFrequency: 0, spikeMultiplier: 1 },
      { name: 'humidity', baseValue: 55, amplitude: 10, periodHours: 8, noise: 2, unit: '%', spikeFrequency: 0.005, spikeMultiplier: 1.3 },
    ],
  },
  {
    name: '管道压力监测 P-01',
    deviceKey: 'pipeline-pressure-p01',
    type: 'pressure',
    metrics: [
      { name: 'pressure', baseValue: 400, amplitude: 30, periodHours: 2, noise: 8, unit: 'kPa', spikeFrequency: 0.03, spikeMultiplier: 2.0 },
      { name: 'flow_rate', baseValue: 120, amplitude: 20, periodHours: 3, noise: 5, unit: 'L/min', spikeFrequency: 0.01, spikeMultiplier: 1.6 },
    ],
  },
  {
    name: '压缩机振动监测 V-01',
    deviceKey: 'compressor-vibe-v01',
    type: 'vibration',
    metrics: [
      { name: 'vibration', baseValue: 2.5, amplitude: 1.0, periodHours: 1, noise: 0.3, unit: 'mm/s', spikeFrequency: 0.04, spikeMultiplier: 3.0 },
      { name: 'temperature', baseValue: 55, amplitude: 5, periodHours: 6, noise: 1, unit: '°C', spikeFrequency: 0.01, spikeMultiplier: 1.4 },
    ],
  },
  {
    name: '冷却塔液位监测 L-01',
    deviceKey: 'cooling-tower-level-l01',
    type: 'level',
    metrics: [
      { name: 'level', baseValue: 3.2, amplitude: 0.3, periodHours: 12, noise: 0.05, unit: 'm', spikeFrequency: 0, spikeMultiplier: 1 },
      { name: 'temperature', baseValue: 32, amplitude: 4, periodHours: 8, noise: 0.8, unit: '°C', spikeFrequency: 0, spikeMultiplier: 1 },
    ],
  },
  {
    name: '气体检测仪 G-01',
    deviceKey: 'gas-detector-g01',
    type: 'gas',
    metrics: [
      { name: 'co2', baseValue: 420, amplitude: 80, periodHours: 6, noise: 15, unit: 'ppm', spikeFrequency: 0.01, spikeMultiplier: 2.5 },
      { name: 'voc', baseValue: 50, amplitude: 20, periodHours: 4, noise: 5, unit: 'ppm', spikeFrequency: 0.02, spikeMultiplier: 3.0 },
    ],
  },
  {
    name: '发电机组功率监测 E-01',
    deviceKey: 'generator-power-e01',
    type: 'custom',
    metrics: [
      { name: 'power', baseValue: 500, amplitude: 100, periodHours: 6, noise: 20, unit: 'kW', spikeFrequency: 0.005, spikeMultiplier: 1.5 },
      { name: 'current', baseValue: 720, amplitude: 80, periodHours: 6, noise: 15, unit: 'A', spikeFrequency: 0.005, spikeMultiplier: 1.4 },
      { name: 'frequency', baseValue: 50, amplitude: 0.5, periodHours: 24, noise: 0.1, unit: 'Hz', spikeFrequency: 0.001, spikeMultiplier: 2.0 },
    ],
  },
];

// ======================
// 生成逻辑
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
  const noise = (Math.random() + Math.random() - 1) * metric.noise;

  // 长期漂移 (非常缓慢的变化)
  const drift = Math.sin(hoursSinceStart / 168 * Math.PI) * metric.amplitude * 0.2;

  let value = metric.baseValue + cyclic + noise + drift;

  // 偶发异常尖峰
  let quality = 100;
  if (metric.spikeFrequency > 0 && Math.random() < metric.spikeFrequency) {
    value = value * metric.spikeMultiplier;
    quality = Math.floor(Math.random() * 30) + 50; // 50-80
  }

  // 偶尔的数据丢失 (返回 quality=0)
  if (Math.random() < 0.001) {
    quality = 0;
  }

  return { value: Math.round(value * 100) / 100, quality };
}

function generateTimestamp(baseTime: number, intervalMs: number, index: number): Date {
  return new Date(baseTime - index * intervalMs);
}

// ======================
// 导入逻辑
// ======================

async function ensureDevice(device: SimDevice): Promise<string> {
  // 先查询是否已存在
  const res = await fetch(`${API_BASE}/devices?search=${device.deviceKey}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();

  if (data.code === 0 && data.data?.length > 0) {
    const existing = data.data[0];
    console.log(`  📡 设备已存在: ${device.name} (${existing.id})`);
    return existing.id;
  }

  // 不存在则创建
  const createRes = await fetch(`${API_BASE}/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: device.name,
      deviceKey: device.deviceKey,
      type: device.type,
      metadata: { simulator: true, generatedAt: new Date().toISOString() },
    }),
  });
  const createData = await createRes.json();

  if (createData.code === 0) {
    console.log(`  ✅ 创建设备: ${device.name} (${createData.data.id})`);
    return createData.data.id;
  }

  throw new Error(`Failed to create device ${device.name}: ${JSON.stringify(createData)}`);
}

async function importDataPoints(deviceId: string, device: SimDevice, startTime: number, endTime: number, intervalMs: number): Promise<number> {
  const totalPoints = Math.floor((endTime - startTime) / intervalMs);
  let imported = 0;
  let batch: Array<{ deviceId: string; metricName: string; value: number; time: string; quality: number }> = [];

  for (let i = 0; i < totalPoints; i++) {
    const timestamp = generateTimestamp(endTime, intervalMs, i);

    for (const metric of device.metrics) {
      const { value, quality } = generateMetricValue(metric, timestamp.getTime(), startTime);
      if (quality === 0) continue; // 跳过丢失的数据

      batch.push({
        deviceId,
        metricName: metric.name,
        value,
        time: timestamp.toISOString(),
        quality,
      });
    }

    // 每 100 条批量提交一次
    if (batch.length >= 100) {
      await sendBatch(deviceId, batch);
      imported += batch.length;
      batch = [];
    }
  }

  // 最后一批
  if (batch.length > 0) {
    await sendBatch(deviceId, batch);
    imported += batch.length;
  }

  return imported;
}

async function sendBatch(deviceId: string, batch: Array<{ deviceId: string; metricName: string; value: number; time: string; quality: number }>) {
  // 去掉 batch 中的 deviceId (API 的 batch 端点会在外层包含)
  const dataPoints = batch.map(({ deviceId: _, ...rest }) => rest);

  try {
    const res = await fetch(`${API_BASE}/data/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, dataPoints }),
    });
    const data = await res.json();
    if (data.code !== 0 && data.code !== 201) {
      console.error(`    ❌ Batch failed: ${data.message}`);
    }
  } catch (err) {
    console.error(`    ❌ Network error: ${err}`);
  }
}

// ======================
// CLI 入口
// ======================

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      opts[key] = args[i + 1]?.startsWith('--') ? '' : (args[i + 1] || '');
      if (opts[key] !== '') i++;
    }
  }
  return {
    devices: opts.devices ? parseInt(opts.devices) : DEVICES.length,
    days: opts.days ? parseInt(opts.days) : 7,
    interval: opts.interval || '5m',
    api: opts.api || API_BASE,
    noImport: opts['no-import'] === 'true',
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

async function main() {
  const config = parseArgs();
  const intervalMs = parseInterval(config.interval);
  const endTime = Date.now();
  const startTime = endTime - config.days * 86400000;

  console.log('========================================');
  console.log('  SSAS 测试数据生成器');
  console.log('========================================');
  console.log('');
  console.log(`  API:        ${config.api}`);
  console.log(`  设备数:     ${config.devices}`);
  console.log(`  时间范围:   ${config.days} 天`);
  console.log(`  间隔:       ${config.interval}`);
  console.log(`  每设备点数: ~${Math.floor((config.days * 86400000) / intervalMs)}`);
  console.log('');

  const selectedDevices = DEVICES.slice(0, config.devices);

  let totalImported = 0;

  for (const device of selectedDevices) {
    console.log(`\n📋 处理设备: ${device.name}`);
    console.log(`   指标: ${device.metrics.map((m) => `${m.name}(${m.unit})`).join(', ')}`);

    // 1. 确保设备存在
    let deviceId: string;
    try {
      deviceId = await ensureDevice(device);
    } catch (err) {
      console.error(`   ❌ ${err}`);
      continue;
    }

    // 2. 生成并导入数据
    if (!config.noImport) {
      const pointsPerMetric = Math.floor((endTime - startTime) / intervalMs);
      const totalPoints = pointsPerMetric * device.metrics.length;
      console.log(`   生成 ${totalPoints} 条数据点...`);

      const imported = await importDataPoints(deviceId, device, startTime, endTime, intervalMs);
      totalImported += imported;
      console.log(`   ✅ 导入 ${imported} 条`);
    }
  }

  console.log('\n========================================');
  console.log(`  ✅ 完成! 共导入 ${totalImported} 条数据点`);
  console.log('========================================');
  console.log('');
  console.log('验证数据:');
  console.log(`  curl "${API_BASE}/data/query?deviceIds=${DEVICES[0].deviceKey}&startTime=${new Date(startTime).toISOString()}&endTime=${new Date(endTime).toISOString()}"`);
  console.log(`  curl "${API_BASE}/devices/stats"`);
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
