class WorkflowNode {
  constructor(data) {
    this.id = data.id;
    this.type = data.type;
    this.label = data.label || data.name || '未命名节点';
    this.config = data.config || {};
    this.position = data.position || { x: 0, y: 0 };
    this.originalType = data.originalType;
    this.originalData = data.originalData || {};
    this.requiresMapping = data.requiresMapping || false;
    this.supportedProviders = data.supportedProviders || [];
    this.selectedProvider = data.selectedProvider || null;
    this.selectedModel = data.selectedModel || null;
    this.warnings = data.warnings || [];
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      config: this.config,
      position: this.position,
      originalType: this.originalType,
      requiresMapping: this.requiresMapping,
      supportedProviders: this.supportedProviders,
      selectedProvider: this.selectedProvider,
      selectedModel: this.selectedModel,
      warnings: this.warnings
    };
  }

  static fromJSON(json) {
    return new WorkflowNode(json);
  }
}

class WorkflowEdge {
  constructor(data) {
    this.id = data.id || `${data.from}-${data.to}`;
    this.from = data.from;
    this.to = data.to;
    this.condition = data.condition || null;
    this.originalData = data.originalData || {};
  }

  toJSON() {
    return {
      id: this.id,
      from: this.from,
      to: this.to,
      condition: this.condition
    };
  }

  static fromJSON(json) {
    return new WorkflowEdge(json);
  }
}

class WorkflowIR {
  constructor(data = {}) {
    this.nodes = (data.nodes || []).map(n => 
      n instanceof WorkflowNode ? n : new WorkflowNode(n)
    );
    this.edges = (data.edges || []).map(e => 
      e instanceof WorkflowEdge ? e : new WorkflowEdge(e)
    );
    this.metadata = data.metadata || {
      name: '未命名工作流',
      description: '',
      sourceFormat: 'unknown',
      version: '1.0',
      created: new Date().toISOString()
    };
    this.importId = data.importId || `import_${Date.now()}`;
  }

  addNode(node) {
    const workflowNode = node instanceof WorkflowNode ? node : new WorkflowNode(node);
    this.nodes.push(workflowNode);
    return workflowNode;
  }

  addEdge(edge) {
    const workflowEdge = edge instanceof WorkflowEdge ? edge : new WorkflowEdge(edge);
    this.edges.push(workflowEdge);
    return workflowEdge;
  }

  getNode(id) {
    return this.nodes.find(n => n.id === id);
  }

  getNodesByType(type) {
    return this.nodes.filter(n => n.type === type);
  }

  getDetectedNodes() {
    const types = {};
    this.nodes.forEach(node => {
      if (!types[node.type]) {
        types[node.type] = [];
      }
      types[node.type].push({
        id: node.id,
        label: node.label,
        requiresMapping: node.requiresMapping,
        supportedProviders: node.supportedProviders,
        currentModel: node.selectedModel,
        currentProvider: node.selectedProvider
      });
    });
    return types;
  }

  updateNodeMappings(nodeMappings) {
    Object.entries(nodeMappings).forEach(([nodeId, mapping]) => {
      const node = this.getNode(nodeId);
      if (node) {
        if (mapping.provider !== undefined) {
          node.selectedProvider = mapping.provider;
        }
        if (mapping.model !== undefined) {
          node.selectedModel = mapping.model;
        }
        if (mapping.config) {
          node.config = { ...node.config, ...mapping.config };
        }
      }
    });
  }

  validate() {
    const errors = [];
    const warnings = [];
    const nodeIds = new Set(this.nodes.map(n => n.id));

    this.edges.forEach(edge => {
      if (!nodeIds.has(edge.from)) {
        errors.push(`边 ${edge.id} 的源节点 ${edge.from} 不存在`);
      }
      if (!nodeIds.has(edge.to)) {
        errors.push(`边 ${edge.id} 的目标节点 ${edge.to} 不存在`);
      }
    });

    const llmNodes = this.getNodesByType('llm');
    llmNodes.forEach(node => {
      if (!node.selectedProvider) {
        warnings.push(`LLM 节点 ${node.label} (${node.id}) 尚未选择提供商`);
      }
    });

    const imageGenNodes = this.getNodesByType('image_gen');
    imageGenNodes.forEach(node => {
      if (!node.selectedProvider) {
        warnings.push(`图片生成节点 ${node.label} (${node.id}) 尚未选择提供商`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  toJSON() {
    return {
      nodes: this.nodes.map(n => n.toJSON()),
      edges: this.edges.map(e => e.toJSON()),
      metadata: this.metadata,
      importId: this.importId
    };
  }

  static fromJSON(json) {
    return new WorkflowIR(json);
  }
}

module.exports = {
  WorkflowNode,
  WorkflowEdge,
  WorkflowIR
};
