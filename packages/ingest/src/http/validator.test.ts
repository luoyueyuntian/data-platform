import { describe, it, expect } from 'vitest';
import {
  EventSchema,
  EventBatchSchema,
  MqttDataPointSchema,
  MqttBatchPayloadSchema,
} from './validator';

describe('EventSchema', () => {
  const validEvent = {
    entityId: '123e4567-e89b-12d3-a456-426614174000',
    eventName: 'temperature',
  };

  it('should accept valid event', () => {
    const result = EventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const result = EventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quality).toBe(100);
    }
  });

  it('should accept optional fields', () => {
    const result = EventSchema.safeParse({
      ...validEvent,
      value: 25.5,
      time: '2026-04-30T12:00:00Z',
      properties: { unit: '°C' },
      tags: { zone: 'reactor-1' },
      quality: 95,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid entityId', () => {
    const result = EventSchema.safeParse({
      ...validEvent,
      entityId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty eventName', () => {
    const result = EventSchema.safeParse({
      ...validEvent,
      eventName: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject eventName > 100 chars', () => {
    const result = EventSchema.safeParse({
      ...validEvent,
      eventName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('should reject quality out of range', () => {
    const result = EventSchema.safeParse({
      ...validEvent,
      quality: 101,
    });
    expect(result.success).toBe(false);
  });
});

describe('EventBatchSchema', () => {
  const validBatch = {
    entityId: '123e4567-e89b-12d3-a456-426614174000',
    events: [
      { eventName: 'temperature', value: 25.5 },
      { eventName: 'humidity', value: 60.0 },
    ],
  };

  it('should accept valid batch', () => {
    const result = EventBatchSchema.safeParse(validBatch);
    expect(result.success).toBeDefined();
  });

  it('should reject empty events array', () => {
    const result = EventBatchSchema.safeParse({
      ...validBatch,
      events: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject batch > 1000 items', () => {
    const events = Array.from({ length: 1001 }, (_, i) => ({
      eventName: `event_${i}`,
      value: i,
    }));
    const result = EventBatchSchema.safeParse({
      ...validBatch,
      events,
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
