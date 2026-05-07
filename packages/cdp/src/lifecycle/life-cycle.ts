import { prisma } from '@ssas/database';

/**
 * Entity lifecycle stages (fully reversible).
 *
 * registered → active → running → maintenance → retired
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

const FAULT_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Evaluate and transition entity lifecycle based on current state.
 */
export async function evaluateLifecycleTransition(entityId: string): Promise<{
  from: string;
  to: string;
  transitioned: boolean;
}> {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) throw new Error(`Entity ${entityId} not found`);

  const currentStage = entity.phase as LifecycleStage;
  const lastSeen = entity.lastSeenAt;
  const status = entity.status;
  const now = new Date();
  let nextStage = currentStage;

  switch (currentStage) {
    case 'registered':
      if (status !== 'disabled' && lastSeen) {
        nextStage = 'active';
      }
      break;

    case 'active':
      if (status === 'active' && lastSeen && isOnlineSince(entity, 24)) {
        nextStage = 'running';
      }
      break;

    case 'running':
      if (status === 'maintenance') {
        nextStage = 'maintenance';
      }
      if (status === 'error') {
        nextStage = 'active';
      }
      if (lastSeen && (now.getTime() - lastSeen.getTime()) > FAULT_TIMEOUT_MS) {
        nextStage = 'active';
      }
      break;

    case 'maintenance':
      if (status === 'active' && lastSeen && isOnlineSince(entity, 1)) {
        nextStage = 'running';
      }
      break;

    case 'retired':
      break;
  }

  if (nextStage !== currentStage) {
    await prisma.entity.update({
      where: { id: entityId },
      data: { phase: nextStage },
    });

    console.log(`[lifecycle] ${entityId}: ${currentStage} → ${nextStage}`);
    return { from: currentStage, to: nextStage, transitioned: true };
  }

  return { from: currentStage, to: nextStage, transitioned: false };
}

/**
 * Evaluate lifecycle for all entities in a tenant.
 */
export async function evaluateTenantLifecycles(tenantId: string): Promise<{
  transitions: number;
}> {
  const entities = await prisma.entity.findMany({
    where: { tenantId },
    select: { id: true },
  });

  let transitions = 0;

  for (const entity of entities) {
    const result = await evaluateLifecycleTransition(entity.id);
    if (result.transitioned) transitions++;
  }

  return { transitions };
}

function isOnlineSince(entity: { lastSeenAt: Date | null; status: string }, hours: number): boolean {
  if (!entity.lastSeenAt || entity.status !== 'active') return false;
  return (Date.now() - entity.lastSeenAt.getTime()) < hours * 3600000;
}
