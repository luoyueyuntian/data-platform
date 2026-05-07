import type { EventQuery } from '@ssas/core';

/**
 * Build an EventQuery from API request parameters.
 * Validates and normalizes input values.
 */
export function buildEventQuery(params: {
  entityIds: string[];
  eventNames?: string[];
  startTime: string;
  endTime: string;
  granularity?: string;
  aggregation?: string;
  filters?: Record<string, string>;
  limit?: number;
  offset?: number;
}): EventQuery {
  const startTime = new Date(params.startTime);
  const endTime = new Date(params.endTime);

  if (isNaN(startTime.getTime())) {
    throw new Error('Invalid startTime');
  }
  if (isNaN(endTime.getTime())) {
    throw new Error('Invalid endTime');
  }
  if (startTime >= endTime) {
    throw new Error('startTime must be before endTime');
  }

  const maxDays = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);
  if (maxDays > 365) {
    throw new Error('Query range cannot exceed 365 days');
  }

  return {
    entityIds: params.entityIds,
    eventNames: params.eventNames,
    startTime,
    endTime,
    granularity: params.granularity || '1h',
    aggregation: (params.aggregation as EventQuery['aggregation']) || 'avg',
    filters: params.filters,
    limit: Math.min(params.limit || 1000, 10000),
    offset: params.offset || 0,
  };
}

/**
 * Parse CSV export query parameters
 */
export function buildExportQuery(params: {
  entityIds: string[];
  eventNames?: string[];
  startTime: string;
  endTime: string;
}): EventQuery {
  return buildEventQuery({
    ...params,
    granularity: '1m',
    aggregation: 'avg',
    limit: 100000,
  });
}
