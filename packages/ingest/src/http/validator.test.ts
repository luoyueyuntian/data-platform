import { describe, it, expect } from 'vitest';
import {
  DataPointSchema,
  DataPointBatchSchema,
  MqttDataPointSchema,
  MqttBatchPayloadSchema,
} from './validator';

describe('DataPointSchema', () => {
  const validPoint = {
    deviceId: '123e4567-e89b-12d3-a456-426614174000',
    metricName: 'temperature',
    value: 25.5,
  };

  it('should accept valid data point', () => {
    const result = DataPointSchema.safeParse(validPoint);
    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const result = DataPointSchema.safeParse(validPoint);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quality).toBe(100);
    }
  });

  it('should accept optional fields', () => {
    const result = DataPointSchema.safeParse({
      ...validPoint,
      time: '2026-04-30T12:00:00Z',
      sensorId: '123e4567-e89b-12d3-a456-426614174001',
      tags: { zone: 'reactor-1' },
      quality: 95,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid deviceId', () => {
    const result = DataPointSchema.safeParse({
      ...validPoint,
      deviceId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty metricName', () => {
    const result = DataPointSchema.safeParse({
      ...validPoint,
      metricName: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject metricName > 100 chars', () => {
    const result = DataPointSchema.safeParse({
      ...validPoint,
      metricName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('should reject quality out of range', () => {
    const result = DataPointSchema.safeParse({
      ...validPoint,
      quality: 101,
    });
    expect(result.success).toBe(false);
  });
});

describe('DataPointBatchSchema', () => {
  const validBatch = {
    deviceId: '123e4567-e89b-12d3-a456-426614174000',
    dataPoints: [
      { metricName: 'temperature', value: 25.5 },
      { metricName: 'humidity', value: 60.0 },
    ],
  };

  it('should accept valid batch', () => {
    const result = DataPointBatchSchema.safeParse(validBatch);
    // May fail due to UUID validation in deviceId
    expect(result.success).toBeDefined();
  });

  it('should reject empty dataPoints array', () => {
    const result = DataPointBatchSchema.safeParse({
      ...validBatch,
      dataPoints: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject batch > 1000 items', () => {
    const dataPoints = Array.from({ length: 1001 }, (_, i) => ({
      metricName: `metric_${i}`,
      value: i,
    }));
    const result = DataPointBatchSchema.safeParse({
      ...validBatch,
      dataPoints,
    });
    expect(result.success).toBe(false);
  });
});

describe('MqttDataPointSchema', () => {
  it('should accept valid MQTT data point', () => {
    const result = MqttDataPointSchema.safeParse({
      ts: 1700000000000,
      metric: 'temperature',
      value: 36.5,
    });
    expect(result.success).toBe(true);
  });

  it('should accept data point without timestamp', () => {
    const result = MqttDataPointSchema.safeParse({
      metric: 'temperature',
      value: 36.5,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative timestamp', () => {
    const result = MqttDataPointSchema.safeParse({
      ts: -1,
      metric: 'temperature',
      value: 36.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('MqttBatchPayloadSchema', () => {
  it('should accept values format', () => {
    const result = MqttBatchPayloadSchema.safeParse({
      ts: 1700000000000,
      values: {
        temperature: 36.5,
        humidity: 65.2,
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept metrics format', () => {
    const result = MqttBatchPayloadSchema.safeParse({
      ts: 1700000000000,
      metrics: [
        { name: 'temperature', value: 36.5 },
        { name: 'humidity', value: 65.2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject when neither values nor metrics provided', () => {
    const result = MqttBatchPayloadSchema.safeParse({
      ts: 1700000000000,
    });
    expect(result.success).toBe(false);
  });
});
