const { WorkflowIR, WorkflowNode, WorkflowEdge } = require('../workflow-ir');
const { NodeMapper } = require('../node-mapper');

class CozeParser {
  constructor() {
    this.nodeMapper = new NodeMapper();
  }

  parse(cozeWorkflow) {
    const ir = new WorkflowIR();
    ir.metadata = {
      name: cozeWorkflow.name || '未命名工作流',
      description: cozeWorkflow.description || '',
      sourceFormat: 'coze',
      version: cozeWorkflow.version || '1.0',
      created: new Date().toISOString()
    };

    const nodeIdMap = {};

    if (cozeWorkflow.nodes && Array.isArray(cozeWorkflow.nodes)) {
      cozeWorkflow.nodes.forEach(cozeNode => {
        const irNode = this.parseNode(cozeNode);
        ir.addNode(irNode);
        nodeIdMap[cozeNode.id] = irNode.id;
      });
    }

    if (cozeWorkflow.connections && Array.isArray(cozeWorkflow.connections)) {
      cozeWorkflow.connections.forEach(cozeConnection => {
        const irEdge = this.parseEdge(cozeConnection, nodeIdMap);
        if (irEdge) {
          ir.addEdge(irEdge);
        }
      });
    }

    if (cozeWorkflow.edges && Array.isArray(cozeWorkflow.edges)) {
      cozeWorkflow.edges.forEach(cozeEdge => {
        const irEdge = this.parseEdge(cozeEdge, nodeIdMap);
        if (irEdge) {
          ir.addEdge(irEdge);
        }
      });
    }

    return ir;
  }

  parseNode(cozeNode) {
    const originalType = String(cozeNode.type || cozeNode.node_type || 'unknown');
    const irType = this.nodeMapper.getIRType('coze', originalType);
    const mappingInfo = this.nodeMapper.getMappingInfo('coze', originalType);

    const config = this.extractNodeConfig(cozeNode);
    const requiresMapping = this.nodeMapper.requiresMapping(irType);
    const supportedProviders = this.nodeMapper.getSupportedProviders(irType);

    const irNode = new WorkflowNode({
      id: `coze_${cozeNode.id}`,
      type: irType,
      label: cozeNode.name || cozeNode.label || mappingInfo?.label || '未命名节点',
      config: config,
      position: cozeNode.position || { x: 0, y: 0 },
      originalType: originalType,
      originalData: cozeNode,
      requiresMapping: requiresMapping,
      supportedProviders: supportedProviders,
      warnings: []
    });

    if (irType === 'knowledge') {
      irNode.warnings.push('知识库节点需要手动配置连接');
    } else if (irType === 'plugin') {
      irNode.warnings.push('插件节点需要手动检查和配置');
    }

    return irNode;
  }

  extractNodeConfig(cozeNode) {
    const config = {};

    if (cozeNode.model) {
      config.model = cozeNode.model;
    }
    if (cozeNode.prompt) {
      config.prompt = cozeNode.prompt;
    }
    if (cozeNode.system_prompt) {
      config.systemPrompt = cozeNode.system_prompt;
    }
    if (cozeNode.inputs) {
      config.inputs = cozeNode.inputs;
    }
    if (cozeNode.outputs) {
      config.outputs = cozeNode.outputs;
    }
    if (cozeNode.parameters) {
      config.parameters = cozeNode.parameters;
    }
    if (cozeNode.code) {
      config.code = cozeNode.code;
    }
    if (cozeNode.url) {
      config.url = cozeNode.url;
    }
    if (cozeNode.method) {
      config.method = cozeNode.method;
    }
    if (cozeNode.headers) {
      config.headers = cozeNode.headers;
    }
    if (cozeNode.body) {
      config.body = cozeNode.body;
    }
    if (cozeNode.conditions) {
      config.conditions = cozeNode.conditions;
    }
    if (cozeNode.loop) {
      config.loop = cozeNode.loop;
    }

    return config;
  }

  parseEdge(cozeEdge, nodeIdMap) {
    let fromId = cozeEdge.from || cozeEdge.source;
    let toId = cozeEdge.to || cozeEdge.target;

    if (!fromId || !toId) {
      return null;
    }

    const mappedFromId = nodeIdMap[fromId] || `coze_${fromId}`;
    const mappedToId = nodeIdMap[toId] || `coze_${toId}`;

    return new WorkflowEdge({
      from: mappedFromId,
      to: mappedToId,
      condition: cozeEdge.condition || cozeEdge.label || null,
      originalData: cozeEdge
    });
  }

  detectFormat(content) {
    try {
      const data = typeof content === 'string' ? JSON.parse(content) : content;
      
      if (data.nodes && Array.isArray(data.nodes)) {
        const sampleNode = data.nodes[0];
        if (sampleNode) {
          const nodeType = String(sampleNode.type || sampleNode.node_type || '');
          if (['1', '2', '3', '4', '5', '6', '7'].includes(nodeType)) {
            return true;
          }
        }
      }
      
      if (data.bot_id || data.bot_name || data.space_id) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }
}

module.exports = { CozeParser };
