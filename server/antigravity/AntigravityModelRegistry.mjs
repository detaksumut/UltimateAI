/**
 * AntigravityModelRegistry.mjs
 * Model Capability & Family Catalog for UltimateAI 9Router.
 */

export const ANTIGRAVITY_MODELS = {
  'gemini-3.6-flash-high': {
    id: 'gemini-3.6-flash-high',
    capability: 'FAST_CHAT',
    family: 'gemini',
    reasoning: 'standard',
    contextWindow: 1048576,
    defaultLimit: 1000
  },
  'gemini-3.6-flash-med': {
    id: 'gemini-3.6-flash-med',
    capability: 'FAST_CHAT',
    family: 'gemini',
    reasoning: 'standard',
    contextWindow: 1048576,
    defaultLimit: 1000
  },
  'gemini-3.6-flash-low': {
    id: 'gemini-3.6-flash-low',
    capability: 'FAST_CHAT',
    family: 'gemini',
    reasoning: 'standard',
    contextWindow: 1048576,
    defaultLimit: 1000
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    capability: 'FAST_CHAT',
    family: 'gemini',
    reasoning: 'standard',
    contextWindow: 1048576,
    defaultLimit: 1000
  },
  'gemini-3.1-pro-high': {
    id: 'gemini-3.1-pro-high',
    capability: 'DEEP_REASONING',
    family: 'gemini',
    reasoning: 'deep',
    contextWindow: 2097152,
    defaultLimit: 1000
  },
  'gemini-3.1-pro-low': {
    id: 'gemini-3.1-pro-low',
    capability: 'DEEP_REASONING',
    family: 'gemini',
    reasoning: 'deep',
    contextWindow: 2097152,
    defaultLimit: 1000
  },
  'claude-sonnet-4.6-thinking': {
    id: 'claude-sonnet-4.6-thinking',
    capability: 'CODE_GENERATION',
    family: 'claude',
    reasoning: 'extended_thinking',
    contextWindow: 200000,
    defaultLimit: 1000
  },
  'claude-opus-4.6-thinking': {
    id: 'claude-opus-4.6-thinking',
    capability: 'COMPLEX_LOGIC',
    family: 'claude',
    reasoning: 'extended_thinking',
    contextWindow: 200000,
    defaultLimit: 1000
  },
  'gpt-oss-120b': {
    id: 'gpt-oss-120b',
    capability: 'OPEN_WORKLOAD',
    family: 'gpt_oss',
    reasoning: 'standard',
    contextWindow: 128000,
    defaultLimit: 1000
  }
};

export class AntigravityModelRegistry {
  static resolveModelByCapability(capability = 'FAST_CHAT', preferredModel = null) {
    if (preferredModel && ANTIGRAVITY_MODELS[preferredModel]) {
      return ANTIGRAVITY_MODELS[preferredModel];
    }

    switch (capability) {
      case 'MULTIMODAL_VISION':
      case 'IMAGE_ANALYSIS':
      case 'VISION':
        return ANTIGRAVITY_MODELS['gemini-2.5-flash'];
      case 'CODE_GENERATION':
      case 'APP_SYNTHESIS':
        return ANTIGRAVITY_MODELS['claude-sonnet-4.6-thinking'];
      case 'DEEP_REASONING':
      case 'DATA_ANALYTICS':
        return ANTIGRAVITY_MODELS['gemini-3.1-pro-high'];
      case 'COMPLEX_LOGIC':
        return ANTIGRAVITY_MODELS['claude-opus-4.6-thinking'];
      case 'OPEN_WORKLOAD':
        return ANTIGRAVITY_MODELS['gpt-oss-120b'];
      case 'FAST_CHAT':
      default:
        return ANTIGRAVITY_MODELS['gemini-3.6-flash-high'] || ANTIGRAVITY_MODELS['gemini-2.5-flash'];
    }
  }

  static getAllModels() {
    return Object.values(ANTIGRAVITY_MODELS);
  }

  get models() {
    return ANTIGRAVITY_MODELS;
  }

  resolveModelForCapability(capability, preferredModel = null) {
    return AntigravityModelRegistry.resolveModelByCapability(capability, preferredModel).id;
  }
}

export const antigravityModelRegistryInstance = new AntigravityModelRegistry();
export default AntigravityModelRegistry;
