import { prisma } from '@ssas/database';

/**
 * Device lifecycle stages (fully reversible — user confirmed).
 *
 * registered → active → running → maintenance → retired
 *                 ↑         ↓           ↑
 *                 └─────────┴───────────┘
 *                 (完全可逆，任意阶段间可双向转换)
 */

export const LIFECYCLE_STAGES = ['registered', 'active', 'running', 'maintenance', 'retired'] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export interface StageTransition {
  from: LifecycleStage;
  to: LifecycleStage;
  reason: string;
  triggeredBy: 'auto' | 'manual';
  timestamp: Date;
}

// 30 minutes no data = fault (config constant)
const FAULT_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Evaluate and transition device lifecycle based on current state.
 * Called periodically or on data arrival.
 */
export async function evaluateLifecycleTransition(deviceId: string): Promise<{
  from: string;
  to: string;
  transitioned: boolean;
}> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error(`Device ${deviceId} not found`);

  const currentStage = device.phase as LifecycleStage;
  const lastSeen = device.lastSeenAt;
  const status = device.status;
  const now = new Date();
  let nextStage = currentStage;

  // Transition rules (fully reversible)
  switch (currentStage) {
    case 'registered':
      // registered → active: device sends first data
      if (status !== 'disabled' && lastSeen) {
        nextStage = 'active';
      }
      break;

    case 'active':
      // active → running: stable for 24 hours
      if (status === 'online' && lastSeen && isOnlineSince(device, 24)) {
        nextStage = 'running';
      }
      // active → maintenance: manual only
      // active → retired: manual only
      break;

    case 'running':
      // running → maintenance: device marked as maintenance or fault detected
      if (status === 'maintenance') {
        nextStage = 'maintenance';
      }
      // running → active: degraded (frequent errors)
      if (status === 'error') {
        nextStage = 'active';
      }
      if (lastSeen && (now.getTime() - lastSeen.getTime()) > FAULT_TIMEOUT_MS) {
        // 30 min no data → fault → move to active for investigation
        nextStage = 'active';
      }
      break;

    case 'maintenance':
      // maintenance → running: restored
      if (status === 'online' && lastSeen && isOnlineSince(device, 1)) {
        nextStage = 'running';
      }
      break;

    case 'retired':
      // retired is terminal (but fully reversible — can go back)
      break;
  }

  if (nextStage !== currentStage) {
    await prisma.device.update({
      where: { id: deviceId },
      data: { phase: nextStage },
    });

    console.log(`[lifecycle] ${deviceId}: ${currentStage} → ${nextStage}`);
    return { from: currentStage, to: nextStage, transitioned: true };
  }

  return { from: currentStage, to: nextStage, transitioned: false };
}

/**
 * Evaluate lifecycle for all devices in a tenant.
 */
export async function evaluateTenantLifecycles(tenantId: string): Promise<{
  transitions: number;
}> {
  const devices = await prisma.device.findMany({
    where: { tenantId },
    select: { id: true },
  });

  let transitions = 0;

  for (const device of devices) {
    const result = await evaluateLifecycleTransition(device.id);
    if (result.transitioned) transitions++;
  }

  return { transitions };
}

/**
 * Check if device has been online consistently for N hours.
 */
function isOnlineSince(device: { lastSeenAt: Date | null; status: string }, hours: number): boolean {
  if (!device.lastSeenAt || device.status !== 'online') return false;
  return (Date.now() - device.lastSeenAt.getTime()) < hours * 3600000;
}
