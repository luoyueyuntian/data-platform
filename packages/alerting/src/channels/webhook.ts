import type { EvaluationResult } from '../rules/rule-evaluator';

/**
 * Send alert notification via webhook.
 * Supports generic HTTP webhooks (Slack, Discord, custom).
 */
export async function sendWebhook(url: string, result: EvaluationResult): Promise<boolean> {
  const body = {
    type: 'alert',
    severity: result.severity,
    title: result.ruleName,
    message: result.message,
    value: result.triggeredValue,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn(`[webhook] ${url} returned ${response.status}`);
      return false;
    }

    console.log(`[webhook] alert sent to ${url}`);
    return true;
  } catch (err) {
    console.error(`[webhook] failed to send to ${url}:`, err);
    return false;
  }
}
