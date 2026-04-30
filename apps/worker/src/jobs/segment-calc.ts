import { calculateTenantTags } from '@ssas/cdp';

/**
 * Device segment calculation job.
 * Recalculates computed tags for all devices in a tenant.
 */
export async function runSegmentCalculation(tenantId: string): Promise<{ calculated: number }> {
  console.log('[job] segment calculation started for tenant:', tenantId);

  const results = await calculateTenantTags(tenantId);

  console.log(`[job] calculated tags for ${results.length} devices`);

  return { calculated: results.length };
}
