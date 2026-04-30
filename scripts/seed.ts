import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Organization',
      plan: 'enterprise',
    },
  });
  console.log(`  ✅ Tenant: ${tenant.name}`);

  // 2. Create admin user
  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {
      password: hashedAdminPassword,
      role: 'admin',
      status: 'active',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: tenant.id,
      email: 'admin@ssas.local',
      name: 'Admin',
      password: hashedAdminPassword,
      role: 'admin',
      status: 'active',
    },
  });
  console.log(`  ✅ User: ${user.email} (password: admin123)`);

  // 3. Create device group
  const group = await prisma.deviceGroup.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      tenantId: tenant.id,
      name: 'Factory Floor A',
      description: 'Main production line sensors',
    },
  });
  console.log(`  ✅ DeviceGroup: ${group.name}`);

  // 4. Create demo devices
  const devices = [
    { id: '00000000-0000-0000-0000-000000000100', name: 'Temperature Sensor T-01', type: 'temperature' },
    { id: '00000000-0000-0000-0000-000000000101', name: 'Humidity Sensor H-01', type: 'humidity' },
    { id: '00000000-0000-0000-0000-000000000102', name: 'Pressure Sensor P-01', type: 'pressure' },
  ];

  for (const dev of devices) {
    await prisma.device.upsert({
      where: { id: dev.id },
      update: {},
      create: {
        id: dev.id,
        tenantId: tenant.id,
        name: dev.name,
        deviceKey: dev.id.replace(/-/g, '').slice(0, 16),
        type: dev.type,
        status: 'offline',
        groupId: group.id,
        location: { name: 'Building A, Floor 1' },
        metadata: { vendor: 'Demo Inc.', firmware: 'v1.0.0' },
      },
    });
    console.log(`  ✅ Device: ${dev.name}`);
  }

  // 5. Create sensors for the temperature device
  const sensors = [
    { id: '00000000-0000-0000-0000-000000000200', deviceId: devices[0].id, name: 'Thermocouple A1', type: 'thermocouple', unit: '°C' },
    { id: '00000000-0000-0000-0000-000000000201', deviceId: devices[0].id, name: 'Thermocouple A2', type: 'thermocouple', unit: '°C' },
  ];

  for (const sen of sensors) {
    await prisma.sensor.upsert({
      where: { id: sen.id },
      update: {},
      create: sen,
    });
    console.log(`  ✅ Sensor: ${sen.name}`);
  }

  // 6. Insert sample data points (for verification)
  const now = Date.now();
  const samplePoints = [];
  for (let i = 0; i < 100; i++) {
    samplePoints.push({
      time: new Date(now - i * 60000), // every minute for 100 minutes
      deviceId: devices[0].id,
      metricName: 'temperature',
      value: 20 + Math.sin(i * 0.1) * 5 + (Math.random() - 0.5),
      sensorId: sensors[0].id,
      quality: 100,
    });
  }
  for (const point of samplePoints) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO timescale.data_points (time, device_id, metric_name, value, sensor_id, quality)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (time, device_id, metric_name) DO NOTHING`,
      point.time,
      point.deviceId,
      point.metricName,
      point.value,
      point.sensorId,
      point.quality,
    );
  }
  console.log(`  ✅ ${samplePoints.length} sample data points inserted`);

  console.log('\nSeed complete!');
  console.log('\n📋 Verification data:');
  console.log('   Tenant:      Demo Organization');
  console.log('   User:        admin@ssas.local / admin123');
  console.log('   Device:      Temperature Sensor T-01');
  console.log('   Sensors:     Thermocouple A1, Thermocouple A2');
  console.log('   Data points: 100 sample records');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
