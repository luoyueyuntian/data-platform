import { eventAnalysis } from '../aggregation/event-analysis.js';
import { trendAnalysis } from '../timeseries/trend.js';
import { distributionAnalysis } from '../aggregation/distribution.js';
import { funnelAnalysis } from '../aggregation/funnel.js';
import { retentionAnalysis } from '../aggregation/retention.js';
import { attributionAnalysis } from '../aggregation/attribution.js';
import type { EventAnalysisQuery, TrendQuery, DistributionQuery, FunnelQuery, RetentionQuery, AttributionQuery, TimeRange } from '@ssas/core';

export interface EngineResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type TenantScoped<T> = T & { tenantId?: string };

export const AnalyticsEngine = {
  async event(query: TenantScoped<EventAnalysisQuery>): Promise<EngineResult<Awaited<ReturnType<typeof eventAnalysis>>>> {
    try {
      const result = await eventAnalysis(query);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async trend(query: TenantScoped<TrendQuery>): Promise<EngineResult<Awaited<ReturnType<typeof trendAnalysis>>>> {
    try {
      const result = await trendAnalysis(query);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async distribution(query: TenantScoped<DistributionQuery>): Promise<EngineResult<Awaited<ReturnType<typeof distributionAnalysis>>>> {
    try {
      const result = await distributionAnalysis(query);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async funnel(query: TenantScoped<FunnelQuery>): Promise<EngineResult<Awaited<ReturnType<typeof funnelAnalysis>>>> {
    try {
      const result = await funnelAnalysis(query);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async retention(query: TenantScoped<RetentionQuery>): Promise<EngineResult<Awaited<ReturnType<typeof retentionAnalysis>>>> {
    try {
      const result = await retentionAnalysis(query);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async attribution(query: TenantScoped<AttributionQuery>): Promise<EngineResult<Awaited<ReturnType<typeof attributionAnalysis>>>> {
    try {
      const result = await attributionAnalysis(query);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  parseTimeRange(spec: string): TimeRange {
    const end = new Date();
    const start = new Date(end);
    switch (spec) {
      case 'last_1h':   start.setHours(start.getHours() - 1); break;
      case 'last_6h':   start.setHours(start.getHours() - 6); break;
      case 'last_24h':  start.setHours(start.getHours() - 24); break;
      case 'last_7d':   start.setDate(start.getDate() - 7); break;
      case 'last_30d':  start.setDate(start.getDate() - 30); break;
      default:          start.setHours(start.getHours() - 24); break;
    }
    return { start, end };
  },
};
