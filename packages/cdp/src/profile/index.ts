export { buildEntityProfile, buildTenantEntityProfiles } from './entity-profile.js';
export type { EntityProfile } from './entity-profile.js';
export { scoreEntity, getTenantScoreDistribution } from './entity-scoring.js';
export type { EntityScoreResult } from './entity-scoring.js';

// Backward compatibility aliases
export { buildDeviceProfile, buildTenantDeviceProfiles } from './entity-profile.js';
export type { DeviceProfile } from './entity-profile.js';
export { scoreDevice } from './entity-scoring.js';
export type { DeviceScoreResult } from './entity-scoring.js';
