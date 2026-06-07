const workflowMappings = require('../config/workflow-mappings.json');

class NodeMapper {
  constructor() {
    this.mappings = workflowMappings;
  }

  getIRType(sourceFormat, originalType) {
    const sourceMappings = this.mappings[sourceFormat];
    if (!sourceMappings) {
      return 'unknown';
    }
    
    const mapping = sourceMappings[originalType];
    return mapping ? mapping.type : 'unknown';
  }

  getN8nNodeType(irType) {
    if (!this._n8nTypeMap) {
      this._n8nTypeMap = {};
      for (const sourceMappings of Object.values(this.mappings)) {
        for (const entry of Object.values(sourceMappings)) {
          if (entry.type && entry.n8n && !this._n8nTypeMap[entry.type]) {
            this._n8nTypeMap[entry.type] = entry.n8n;
          }
        }
      }
    }
    return this._n8nTypeMap[irType] || 'n8n-nodes-base.code';
  }

  getSupportedProviders(nodeType) {
    const providers = {
      'llm': ['claude', 'deepseek', 'openai', 'qwen'],
      'image_gen': ['fal', 'replicate'],
      'video_gen': ['heygen']
    };
    return providers[nodeType] || [];
  }

  requiresMapping(nodeType) {
    const typesRequiringMapping = ['llm', 'image_gen', 'video_gen', 'knowledge', 'plugin'];
    return typesRequiringMapping.includes(nodeType);
  }

  convertVariableSyntax(text, sourceFormat, nodeIdMap = {}) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let converted = text;
    
    if (sourceFormat === 'coze') {
      converted = converted.replace(/\{\{([^}]+)\}\}/g, (match, varPath) => {
        const parts = varPath.split('.');
        if (parts.length >= 2) {
          const sourceNodeId = parts[0];
          const rest = parts.slice(1).join('.');
          const mappedNodeId = nodeIdMap[sourceNodeId] || sourceNodeId;
          return `{{ $json.${mappedNodeId}.${rest} }}`;
        }
        return `{{ $json.${varPath} }}`;
      });
    } else if (sourceFormat === 'dify') {
      converted = converted.replace(/\{\{#([^}]+)#\}\}/g, (match, varPath) => {
        const parts = varPath.split('.');
        if (parts.length >= 2) {
          const sourceNodeId = parts[0];
          const rest = parts.slice(1).join('.');
          const mappedNodeId = nodeIdMap[sourceNodeId] || sourceNodeId;
          return `{{ $json.${mappedNodeId}.${rest} }}`;
        }
        return `{{ $json.${varPath} }}`;
      });
    }

    return converted;
  }

  convertConfig(config, sourceFormat, nodeIdMap = {}) {
    if (!config || typeof config !== 'object') {
      return config;
    }

    const converted = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        converted[key] = this.convertVariableSyntax(value, sourceFormat, nodeIdMap);
      } else if (typeof value === 'object' && value !== null) {
        converted[key] = this.convertConfig(value, sourceFormat, nodeIdMap);
      } else if (Array.isArray(value)) {
        converted[key] = value.map(item => 
          typeof item === 'string' 
            ? this.convertVariableSyntax(item, sourceFormat, nodeIdMap)
            : this.convertConfig(item, sourceFormat, nodeIdMap)
        );
      } else {
        converted[key] = value;
      }
    }
    return converted;
  }

  getMappingInfo(sourceFormat, originalType) {
    const sourceMappings = this.mappings[sourceFormat];
    if (!sourceMappings) {
      return null;
    }
    return sourceMappings[originalType] || null;
  }
}

module.exports = { NodeMapper };
