import { evaluateTenantLifecycles } from '@ssas/cdp';

/**
 * Lifecycle evaluation job.
 * Evaluates stage transitions for all devices in a tenant.
 */
export async function runLifecycleEvaluation(tenantId: string): Promise<{ transitions: number }> {
  console.log('[job] lifecycle evaluation started for tenant:', tenantId);

  const result = await evaluateTenantLifecycles(tenantId);

  console.log(`[job] ${result.transitions} lifecycle transition(s)`);

  return result;
}
