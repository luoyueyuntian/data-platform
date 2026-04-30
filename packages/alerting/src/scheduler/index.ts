import { evaluateAllRules, type EvaluationResult } from '../rules/rule-evaluator';
import { sendWebhook } from '../channels/webhook';
import { prisma } from '@ssas/database';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the alert evaluation scheduler.
 * Runs rule evaluation on a fixed interval.
 */
export function startAlertScheduler(intervalMs: number = 60000): void {
  if (intervalHandle) return;

  console.log(`[alert-scheduler] starting with interval ${intervalMs}ms`);

  intervalHandle = setInterval(async () => {
    try {
      const results = await evaluateAllRules();

      for (const result of results) {
        const rule = await prisma.alertRule.findUnique({
          where: { id: result.ruleId },
          select: { channels: true, silenceSeconds: true },
        });

        if (!rule) {
          continue;
        }

        const silenceWindowStart = new Date(Date.now() - rule.silenceSeconds * 1000);
        const recentRecord = await prisma.alertRecord.findFirst({
          where: {
            ruleId: result.ruleId,
            status: { not: 'resolved' },
            triggeredAt: { gte: silenceWindowStart },
          },
          orderBy: { triggeredAt: 'desc' },
          select: { id: true },
        });

        if (recentRecord) {
          continue;
        }

        // Persist alert record
        await prisma.alertRecord.create({
          data: {
            ruleId: result.ruleId,
            ruleName: result.ruleName,
            triggeredValue: result.triggeredValue,
            severity: result.severity,
            message: result.message,
            status: 'firing',
            triggeredAt: new Date(),
          },
        });

        // Send notifications via rule's channels
        const channels = rule.channels as unknown as Array<{ type: string; config: Record<string, string> }>;
        for (const channel of channels) {
          if (channel.type === 'webhook' && channel.config.url) {
            sendWebhook(channel.config.url, result).catch(console.error);
          }
        }
      }

      if (results.length > 0) {
        console.log(`[alert-scheduler] ${results.length} alert(s) triggered`);
      }
    } catch (err) {
      console.error('[alert-scheduler] evaluation error:', err);
    }
  }, intervalMs);
}

/**
 * Stop the alert evaluation scheduler.
 */
export function stopAlertScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[alert-scheduler] stopped');
  }
}
