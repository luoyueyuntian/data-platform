import { evaluateAllRules } from '@ssas/alerting';

/**
 * Alert evaluation job — called by the worker scheduler.
 * Evaluates all enabled rules and persists triggered alerts.
 */
export async function runAlertEvaluation(): Promise<{ triggered: number }> {
  console.log('[job] alert evaluation started');

  const results = await evaluateAllRules();

  // Results are already persisted by the evaluator
  if (results.length > 0) {
    console.log(`[job] ${results.length} alert(s) triggered`);
    for (const r of results) {
      console.log(`  - [${r.severity}] ${r.ruleName}: ${r.message}`);
    }
  }

  return { triggered: results.length };
}
