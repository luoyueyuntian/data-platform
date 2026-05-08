import { prisma } from '../packages/database/dist/index.js';

const ADMIN_PASSWORD_HASH = '$2a$10$j1RlcZj87zedwxpqWFxOse91YNqJ2/qlvpJo6HzuBVApy5rmtIF5i';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000010';

async function main() {
  console.log('Seeding database...');

  // 1. Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, name: 'Demo Organization', plan: 'enterprise' },
  });
  console.log(`  ✅ Tenant: ${tenant.name}`);

  // 2. Admin user
  const user = await prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    update: { password: ADMIN_PASSWORD_HASH, role: 'admin', status: 'active' },
    create: {
      id: ADMIN_USER_ID, tenantId: tenant.id,
      email: 'admin@ssas.local', name: 'Admin',
      password: ADMIN_PASSWORD_HASH, role: 'admin', status: 'active',
    },
  });
  console.log(`  ✅ User: ${user.email} (password: admin123)`);

  // 3. Entity group
  const group = await prisma.entityGroup.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      tenantId: tenant.id, name: 'Factory Floor A',
      description: 'Main production line sensors',
    },
  });
  console.log(`  ✅ EntityGroup: ${group.name}`);

  // 4. Entities
  const entities = [
    { id: '00000000-0000-0000-0000-000000000100', name: 'Temperature Sensor T-01', type: 'temperature', key: 'sensor-t01' },
    { id: '00000000-0000-0000-0000-000000000101', name: 'Humidity Sensor H-01', type: 'humidity', key: 'sensor-h01' },
    { id: '00000000-0000-0000-0000-000000000102', name: 'Pressure Sensor P-01', type: 'pressure', key: 'sensor-p01' },
  ];

  for (const ent of entities) {
    await prisma.entity.upsert({
      where: { id: ent.id },
      update: { name: ent.name, entityKey: ent.key },
      create: {
        id: ent.id, tenantId: tenant.id, name: ent.name,
        entityKey: ent.key, type: ent.type, status: 'active', phase: 'running',
        groupId: group.id,
        location: { name: 'Building A, Floor 1' },
        metadata: { vendor: 'Demo Inc.', firmware: 'v1.0.0' },
        lastSeenAt: new Date(),
      },
    });
    console.log(`  ✅ Entity: ${ent.name}`);
  }

  // 5. Events (100 per entity, 3 metrics each)
  const now = Date.now();
  const metrics = [
    { entityId: entities[0].id, eventName: 'temperature', base: 22, amp: 5 },
    { entityId: entities[1].id, eventName: 'humidity', base: 55, amp: 10 },
    { entityId: entities[2].id, eventName: 'pressure', base: 400, amp: 30 },
  ];

  let eventCount = 0;
  for (const m of metrics) {
    for (let i = 0; i < 100; i++) {
      const time = new Date(now - i * 60000);
      const value = m.base + Math.sin(i * 0.1) * m.amp + (Math.random() - 0.5) * 2;
      await prisma.$executeRawUnsafe(
        `INSERT INTO timescale.events (time, entity_id, event_name, value, properties, tags, quality)
         VALUES ($1, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7)
         ON CONFLICT (time, entity_id, event_name) DO NOTHING`,
        time, m.entityId, m.eventName, Math.round(value * 100) / 100,
        JSON.stringify({ unit: m.eventName === 'temperature' ? '°C' : m.eventName === 'humidity' ? '%RH' : 'kPa' }),
        JSON.stringify({ zone: 'reactor' }), 100,
      );
      eventCount++;
    }
  }
  console.log(`  ✅ Events: ${eventCount} inserted`);

  // 6. Alert rules
  const alertRules = [
    {
      name: 'Temperature Over 95°C',
      description: 'Triggers when temperature exceeds 95°C',
      conditions: [{ eventName: 'temperature', operator: '>', threshold: 95, window: '5m' }],
      severity: 'critical',
    },
    {
      name: 'Pressure Over 500kPa',
      description: 'Triggers when pressure exceeds 500kPa',
      conditions: [{ eventName: 'pressure', operator: '>', threshold: 500, window: '3m' }],
      severity: 'warn',
    },
    {
      name: 'Humidity Below 40%',
      description: 'Triggers when humidity drops below 40%',
      conditions: [{ eventName: 'humidity', operator: '<', threshold: 40, window: '10m' }],
      severity: 'info',
    },
  ];

  const ruleIds: string[] = [];
  for (let i = 0; i < alertRules.length; i++) {
    const ruleDef = alertRules[i];
    const ruleId = `00000000-0000-0000-0000-00000000030${i}`;
    await prisma.alertRule.upsert({
      where: { id: ruleId },
      update: {},
      create: {
        id: ruleId, tenantId: tenant.id,
        name: ruleDef.name, description: ruleDef.description,
        conditions: ruleDef.conditions as any,
        conditionLogic: 'any',
        channels: [{ type: 'webhook', config: { url: 'http://localhost:3000/webhook' } }],
        silenceSeconds: 300, enabled: true,
      },
    });
    ruleIds.push(ruleId);
  }
  console.log(`  ✅ Alert Rules: ${alertRules.length}`);

  // 7. Alert records
  const statuses = ['firing', 'resolved', 'acknowledged'];
  let recordCount = 0;
  for (let ri = 0; ri < ruleIds.length; ri++) {
    for (let j = 0; j < 5; j++) {
      const triggeredAt = new Date(now - (j * 86400000 + ri * 3600000));
      const status = statuses[j % statuses.length];
      await prisma.alertRecord.create({
        data: {
          ruleId: ruleIds[ri],
          ruleName: alertRules[ri].name,
          entityId: entities[ri % entities.length].id,
          triggeredValue: alertRules[ri].conditions[0].threshold + (Math.random() - 0.3) * 10,
          severity: alertRules[ri].severity as string,
          message: `${alertRules[ri].name} triggered`,
          status,
          triggeredAt,
          resolvedAt: status === 'resolved' ? new Date(triggeredAt.getTime() + 600000) : null,
          resolvedBy: status === 'resolved' ? 'system' : null,
        },
      });
      recordCount++;
    }
  }
  console.log(`  ✅ Alert Records: ${recordCount}`);

  // 8. Dashboard + Panels
  const dashboard = await prisma.dashboard.upsert({
    where: { id: '00000000-0000-0000-0000-000000000400' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000400',
      tenantId: tenant.id,
      name: 'Production Monitor',
      description: 'Real-time monitoring of all production sensors',
      layout: { columns: 12, rowHeight: 80 },
      isPublic: false,
    },
  });

  const panelDefs = [
    { title: 'Temperature Trend', type: 'line', x: 0, y: 0, w: 6, h: 4, metrics: ['temperature'] },
    { title: 'Pressure Gauge', type: 'gauge', x: 6, y: 0, w: 3, h: 4, metrics: ['pressure'] },
    { title: 'Humidity', type: 'line', x: 9, y: 0, w: 3, h: 4, metrics: ['humidity'] },
    { title: 'All Metrics', type: 'bar', x: 0, y: 4, w: 6, h: 4, metrics: ['temperature', 'humidity', 'pressure'] },
    { title: 'Temperature Stat', type: 'stat', x: 6, y: 4, w: 3, h: 4, metrics: ['temperature'] },
    { title: 'Status Table', type: 'table', x: 9, y: 4, w: 3, h: 4, metrics: [] },
  ];

  for (let i = 0; i < panelDefs.length; i++) {
    const p = panelDefs[i];
    const panelId = `00000000-0000-0000-0000-00000000050${i}`;
    await prisma.panel.upsert({
      where: { id: panelId },
      update: {},
      create: {
        id: panelId, dashboardId: dashboard.id,
        title: p.title, type: p.type,
        query: { eventNames: p.metrics, aggregation: 'avg', granularity: '5m', timeRange: '24h' },
        position: { x: p.x, y: p.y, w: p.w, h: p.h },
      },
    });
  }
  console.log(`  ✅ Dashboard: ${dashboard.name} (${panelDefs.length} panels)`);

  // 9. Audit logs
  const actions = ['entity.create', 'entity.update', 'alert.create', 'user.login', 'dashboard.create'];
  for (let i = 0; i < 50; i++) {
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: ADMIN_USER_ID,
        action: actions[i % actions.length],
        resource: 'entity',
        resourceId: entities[i % entities.length].id,
        detail: { source: 'demo', index: i },
        ip: `192.168.1.${(i % 254) + 1}`,
        createdAt: new Date(now - i * 3600000),
      },
    });
  }
  console.log(`  ✅ Audit Logs: 50`);

  console.log('\nSeed complete!');
  console.log('\n📋 Verification:');
  console.log('   Tenant:       Demo Organization');
  console.log('   User:         admin@ssas.local / admin123');
  console.log(`   Entities:     ${entities.length}`);
  console.log(`   Events:       ${eventCount}`);
  console.log(`   Alert Rules:  ${alertRules.length}`);
  console.log(`   Alert Records: ${recordCount}`);
  console.log(`   Dashboards:   1`);
  console.log(`   Audit Logs:   50`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
