const { WorkflowIR, WorkflowNode, WorkflowEdge } = require('../workflow-ir');
const { NodeMapper } = require('../node-mapper');

class DifyParser {
  constructor() {
    this.nodeMapper = new NodeMapper();
  }

  parse(difyWorkflow) {
    const ir = new WorkflowIR();
    ir.metadata = {
      name: difyWorkflow.name || difyWorkflow.app?.name || '未命名工作流',
      description: difyWorkflow.description || difyWorkflow.app?.description || '',
      sourceFormat: 'dify',
      version: difyWorkflow.version || '1.0',
      created: new Date().toISOString()
    };

    const nodeIdMap = {};

    const graph = difyWorkflow.graph || difyWorkflow.workflow_graph || {};
    const nodes = graph.nodes || difyWorkflow.nodes || [];
    const edges = graph.edges || difyWorkflow.edges || difyWorkflow.connections || [];

    if (Array.isArray(nodes)) {
      nodes.forEach(difyNode => {
        const irNode = this.parseNode(difyNode);
        ir.addNode(irNode);
        nodeIdMap[difyNode.id] = irNode.id;
      });
    }

    if (Array.isArray(edges)) {
      edges.forEach(difyEdge => {
        const irEdge = this.parseEdge(difyEdge, nodeIdMap);
        if (irEdge) {
          ir.addEdge(irEdge);
        }
      });
    }

    return ir;
  }

  parseNode(difyNode) {
    const originalType = String(difyNode.type || difyNode.node_type || 'unknown');
    const irType = this.nodeMapper.getIRType('dify', originalType);
    const mappingInfo = this.nodeMapper.getMappingInfo('dify', originalType);

    const config = this.extractNodeConfig(difyNode);
    const requiresMapping = this.nodeMapper.requiresMapping(irType);
    const supportedProviders = this.nodeMapper.getSupportedProviders(irType);

    const irNode = new WorkflowNode({
      id: `dify_${difyNode.id}`,
      type: irType,
      label: difyNode.name || difyNode.label || difyNode.title || mappingInfo?.label || '未命名节点',
      config: config,
      position: difyNode.position || difyNode.data?.position || { x: 0, y: 0 },
      originalType: originalType,
      originalData: difyNode,
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

  extractNodeConfig(difyNode) {
    const config = {};
    const nodeData = difyNode.data || difyNode;

    if (nodeData.model) {
      config.model = nodeData.model;
    }
    if (nodeData.model_config) {
      config.modelConfig = nodeData.model_config;
    }
    if (nodeData.prompt) {
      config.prompt = nodeData.prompt;
    }
    if (nodeData.prompt_template) {
      config.promptTemplate = nodeData.prompt_template;
    }
    if (nodeData.system_prompt) {
      config.systemPrompt = nodeData.system_prompt;
    }
    if (nodeData.inputs) {
      config.inputs = nodeData.inputs;
    }
    if (nodeData.outputs) {
      config.outputs = nodeData.outputs;
    }
    if (nodeData.variables) {
      config.variables = nodeData.variables;
    }
    if (nodeData.code) {
      config.code = nodeData.code;
    }
    if (nodeData.script) {
      config.script = nodeData.script;
    }
    if (nodeData.url) {
      config.url = nodeData.url;
    }
    if (nodeData.method) {
      config.method = nodeData.method;
    }
    if (nodeData.headers) {
      config.headers = nodeData.headers;
    }
    if (nodeData.body) {
      config.body = nodeData.body;
    }
    if (nodeData.params) {
      config.params = nodeData.params;
    }
    if (nodeData.conditions) {
      config.conditions = nodeData.conditions;
    }
    if (nodeData.if) {
      config.if = nodeData.if;
    }
    if (nodeData.loop) {
      config.loop = nodeData.loop;
    }
    if (nodeData.iteration) {
      config.iteration = nodeData.iteration;
    }
    if (nodeData.knowledge_id) {
      config.knowledgeId = nodeData.knowledge_id;
    }

    return config;
  }

  parseEdge(difyEdge, nodeIdMap) {
    let fromId = difyEdge.from || difyEdge.source || difyEdge.sourceNode;
    let toId = difyEdge.to || difyEdge.target || difyEdge.targetNode;

    if (difyEdge.source_handle) {
      fromId = difyEdge.source_handle.split('-')[0] || fromId;
    }
    if (difyEdge.target_handle) {
      toId = difyEdge.target_handle.split('-')[0] || toId;
    }

    if (!fromId || !toId) {
      return null;
    }

    const mappedFromId = nodeIdMap[fromId] || `dify_${fromId}`;
    const mappedToId = nodeIdMap[toId] || `dify_${toId}`;

    return new WorkflowEdge({
      from: mappedFromId,
      to: mappedToId,
      condition: difyEdge.condition || difyEdge.label || difyEdge.type || null,
      originalData: difyEdge
    });
  }

  detectFormat(content) {
    try {
      const data = typeof content === 'string' ? JSON.parse(content) : content;
      
      if (data.app && data.app.mode) {
        return true;
      }
      
      if (data.graph && data.graph.nodes) {
        const sampleNode = data.graph.nodes[0];
        if (sampleNode && sampleNode.type) {
          if (['start', 'end', 'llm', 'code', 'http-request', 'if-else'].includes(sampleNode.type)) {
            return true;
          }
        }
      }
      
      if (data.nodes && Array.isArray(data.nodes)) {
        const sampleNode = data.nodes[0];
        if (sampleNode && sampleNode.type) {
          if (['start', 'end', 'llm', 'code', 'http-request', 'if-else'].includes(sampleNode.type)) {
            return true;
          }
        }
      }
      
      if (data.workflow_id || data.app_id) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }
}

module.exports = { DifyParser };
