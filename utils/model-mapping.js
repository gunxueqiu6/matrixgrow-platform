const aiProviders = require('../config/ai-providers.json');

class ModelMapping {
  static getAvailableModels(type) {
    const providers = aiProviders[type] || {};
    const models = [];

    Object.entries(providers).forEach(([providerId, providerConfig]) => {
      providerConfig.models.forEach(modelId => {
        models.push({
          provider: providerId,
          model: modelId,
          name: `${providerConfig.name} - ${modelId}`
        });
      });
    });

    return models;
  }

  static getProviderConfig(provider, type = 'llm') {
    const providers = aiProviders[type] || {};
    return providers[provider] || null;
  }

  static getDefaultModel(provider, type = 'llm') {
    const config = this.getProviderConfig(provider, type);
    return config?.defaultModel || null;
  }

  static hasCapability(provider, capability, type = 'llm') {
    const config = this.getProviderConfig(provider, type);
    if (!config) return false;
    return config.capabilities.includes(capability);
  }

  static getProviderOptions(type) {
    const providers = aiProviders[type] || {};
    return Object.entries(providers).map(([id, config]) => ({
      id,
      name: config.name,
      capabilities: config.capabilities,
      pricing: config.pricing
    }));
  }

  static getModelOptions(provider, type = 'llm') {
    const config = this.getProviderConfig(provider, type);
    if (!config) return [];

    return config.models.map(modelId => ({
      id: modelId,
      name: modelId
    }));
  }
}

module.exports = { ModelMapping };
