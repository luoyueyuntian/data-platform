export { addManualTag, removeTag, evaluateTagRule } from './tag-manager.js';
export type { TagDefinition, TagRule, TagCondition } from './tag-manager.js';
export { calculateEntityTags, calculateTenantTags } from './tag-calculator.js';

// Backward compatibility aliases
export { calculateDeviceTags, calculateTenantDeviceTags } from './tag-calculator.js';
