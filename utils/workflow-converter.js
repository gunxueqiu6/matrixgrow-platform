const { NodeMapper } = require('./node-mapper');

class WorkflowConverter {
  constructor() {
    this.nodeMapper = new NodeMapper();
  }

  convert(ir) {
    const n8nWorkflow = {
      name: ir.metadata.name || '导入的工作流',
      nodes: [],
      connections: {},
      active: true,
      settings: {
        executionOrder: 'v1'
      },
      staticData: null,
      tags: []
    };

    const nodeIdMap = {};
    let nodeIndex = 1;

    ir.nodes.forEach(irNode => {
      const n8nNode = this.convertNode(irNode, nodeIndex);
      n8nWorkflow.nodes.push(n8nNode);
      nodeIdMap[irNode.id] = n8nNode.name;
      nodeIndex++;
    });

    n8nWorkflow.connections = this.convertEdges(ir.edges, nodeIdMap);

    return {
      workflow: n8nWorkflow,
      warnings: this.collectWarnings(ir)
    };
  }

  convertNode(irNode, index) {
    const n8nType = this.nodeMapper.getN8nNodeType(irNode.type);
    const nodeName = `${irNode.label.replace(/[^a-zA-Z0-9_一-鿿]/g, '_')}_${index}`;

    const n8nNode = {
      parameters: {},
      name: nodeName,
      type: n8nType,
      typeVersion: 1,
      position: [
        irNode.position.x || index * 200,
        irNode.position.y || index * 100
      ]
    };

    this.fillNodeParameters(n8nNode, irNode);

    return n8nNode;
  }

  fillNodeParameters(n8nNode, irNode) {
    switch (irNode.type) {
      case 'start':
        this.fillStartNode(n8nNode, irNode);
        break;
      case 'end':
        this.fillEndNode(n8nNode, irNode);
        break;
      case 'llm':
        this.fillLLMNode(n8nNode, irNode);
        break;
      case 'code':
        this.fillCodeNode(n8nNode, irNode);
        break;
      case 'condition':
        this.fillConditionNode(n8nNode, irNode);
        break;
      case 'loop':
        this.fillLoopNode(n8nNode, irNode);
        break;
      case 'http':
        this.fillHTTPNode(n8nNode, irNode);
        break;
      case 'json_stringify':
      case 'json_parse':
        this.fillJsonNode(n8nNode, irNode);
        break;
      case 'variable':
        this.fillVariableNode(n8nNode, irNode);
        break;
      case 'image_gen':
        this.fillImageGenNode(n8nNode, irNode);
        break;
      case 'video_gen':
        this.fillVideoGenNode(n8nNode, irNode);
        break;
      default:
        this.fillDefaultNode(n8nNode, irNode);
    }
  }

  fillStartNode(n8nNode, irNode) {
    n8nNode.parameters = {
      httpMethod: 'POST',
      path: `webhook/${Date.now()}`,
      options: {}
    };
  }

  fillEndNode(n8nNode, irNode) {
    n8nNode.parameters = {
      responseBody: '={{ $json }}',
      options: {}
    };
  }

  fillLLMNode(n8nNode, irNode) {
    const provider = irNode.selectedProvider || 'deepseek';
    const model = irNode.selectedModel;
    const prompt = JSON.stringify(irNode.config.prompt || '');

    n8nNode.parameters = {
      jsCode: [
        `const provider = ${JSON.stringify(provider)};`,
        `const model = ${JSON.stringify(model || '')};`,
        `const prompt = ${prompt};`,
        '',
        'async function callLLM(prompt, provider, model) {',
        '  try {',
        '    const response = await fetch("http://localhost:3000/api/ai/llm", {',
        '      method: "POST",',
        '      headers: { "Content-Type": "application/json" },',
        '      body: JSON.stringify({ prompt, provider, model })',
        '    });',
        '    const result = await response.json();',
        '    return result;',
        '  } catch (error) {',
        '    return { error: error.message };',
        '  }',
        '}',
        '',
        'const result = await callLLM(prompt, provider, model);',
        'return result;'
      ].join('\n')
    };
  }

  fillCodeNode(n8nNode, irNode) {
    n8nNode.parameters = {
      jsCode: irNode.config.code || 'return items;'
    };
  }

  fillConditionNode(n8nNode, irNode) {
    n8nNode.parameters = {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict'
        },
        conditions: [],
        combinator: 'and'
      }
    };

    if (irNode.config.conditions) {
      n8nNode.parameters.conditions.conditions = irNode.config.conditions.map((c, i) => ({
        id: `condition-${i}`,
        leftValue: c.left || '',
        rightValue: c.right || '',
        operator: c.operator || 'equals'
      }));
    }
  }

  fillLoopNode(n8nNode, irNode) {
    n8nNode.parameters = {
      fieldToSplitOut: 'items',
      options: {}
    };
  }

  fillHTTPNode(n8nNode, irNode) {
    n8nNode.parameters = {
      url: irNode.config.url || '',
      method: irNode.config.method || 'GET',
      headers: irNode.config.headers ? {
        parameters: Object.entries(irNode.config.headers).map(([key, value]) => ({
          name: key,
          value: value
        }))
      } : {},
      sendBody: irNode.config.body ? true : false,
      bodyParameters: irNode.config.body ? {
        parameters: Object.entries(irNode.config.body).map(([key, value]) => ({
          name: key,
          value: value
        }))
      } : {},
      options: {}
    };
  }

  fillJsonNode(n8nNode, irNode) {
    const operation = irNode.type === 'json_stringify' ? 'stringify' : 'parse';
    n8nNode.parameters = {
      values: {
        string: [
          {
            name: 'result',
            value: operation === 'stringify' 
              ? '={{ JSON.stringify($json) }}'
              : '={{ JSON.parse($json.data) }}'
          }
        ]
      },
      options: {}
    };
  }

  fillVariableNode(n8nNode, irNode) {
    n8nNode.parameters = {
      values: {
        string: []
      },
      options: {}
    };

    if (irNode.config.variables) {
      n8nNode.parameters.values.string = Object.entries(irNode.config.variables).map(([key, value]) => ({
        name: key,
        value: value
      }));
    }
  }

  fillImageGenNode(n8nNode, irNode) {
    const provider = irNode.selectedProvider || 'fal';
    const prompt = JSON.stringify(irNode.config.prompt || '');

    n8nNode.parameters = {
      jsCode: [
        `const provider = ${JSON.stringify(provider)};`,
        `const prompt = ${prompt};`,
        '',
        'async function generateImage(prompt, provider) {',
        '  try {',
        '    const response = await fetch("http://localhost:3000/api/ai/image", {',
        '      method: "POST",',
        '      headers: { "Content-Type": "application/json" },',
        '      body: JSON.stringify({ prompt, provider })',
        '    });',
        '    const result = await response.json();',
        '    return result;',
        '  } catch (error) {',
        '    return { error: error.message };',
        '  }',
        '}',
        '',
        'const result = await generateImage(prompt, provider);',
        'return result;'
      ].join('\n')
    };
  }

  fillVideoGenNode(n8nNode, irNode) {
    const provider = irNode.selectedProvider || 'heygen';
    const script = JSON.stringify(irNode.config.prompt || irNode.config.script || '');

    n8nNode.parameters = {
      jsCode: [
        `const provider = ${JSON.stringify(provider)};`,
        `const script = ${script};`,
        '',
        'async function generateVideo(script, provider) {',
        '  try {',
        '    const response = await fetch("http://localhost:3000/api/ai/video", {',
        '      method: "POST",',
        '      headers: { "Content-Type": "application/json" },',
        '      body: JSON.stringify({ script, provider })',
        '    });',
        '    const result = await response.json();',
        '    return result;',
        '  } catch (error) {',
        '    return { error: error.message };',
        '  }',
        '}',
        '',
        'const result = await generateVideo(script, provider);',
        'return result;'
      ].join('\n')
    };
  }

  fillDefaultNode(n8nNode, irNode) {
    n8nNode.parameters = {
      jsCode: `
// 节点类型: ${irNode.type}
// 原始数据: ${JSON.stringify(irNode.originalData)}
return items;
`.trim()
    };
  }

  convertEdges(irEdges, nodeIdMap) {
    const connections = {};

    irEdges.forEach(edge => {
      const fromNodeName = nodeIdMap[edge.from];
      const toNodeName = nodeIdMap[edge.to];

      if (!fromNodeName || !toNodeName) return;

      const outputIndex = edge.condition === 'false' ? 1 : 0;

      if (!connections[fromNodeName]) {
        connections[fromNodeName] = { main: [] };
      }

      if (!connections[fromNodeName].main[outputIndex]) {
        connections[fromNodeName].main[outputIndex] = [];
      }

      connections[fromNodeName].main[outputIndex].push({
        node: toNodeName,
        type: 'main',
        index: 0
      });
    });

    return connections;
  }

  collectWarnings(ir) {
    const warnings = [];

    ir.nodes.forEach(node => {
      if (node.warnings && node.warnings.length > 0) {
        node.warnings.forEach(warning => {
          warnings.push(`[${node.label}] ${warning}`);
        });
      }
    });

    const validation = ir.validate();
    if (validation.warnings && validation.warnings.length > 0) {
      warnings.push(...validation.warnings);
    }

    return warnings;
  }
}

module.exports = { WorkflowConverter };
