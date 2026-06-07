const { CozeParser } = require('./workflow-parsers/coze-parser');
const { DifyParser } = require('./workflow-parsers/dify-parser');
const { WorkflowConverter } = require('./workflow-converter');
const { WorkflowIR } = require('./workflow-ir');

class WorkflowImporter {
  constructor() {
    this.cozeParser = new CozeParser();
    this.difyParser = new DifyParser();
    this.converter = new WorkflowConverter();
    this.importSessions = new Map();
  }

  async importWorkflow(content, options = {}) {
    const { source, autoDetect = true } = options;
    let detectedSource = source;

    if (autoDetect && !detectedSource) {
      detectedSource = this.detectFormat(content);
    }

    if (!detectedSource) {
      throw new Error('无法检测工作流格式，请指定 source 参数');
    }

    let ir;
    if (detectedSource === 'coze') {
      ir = this.cozeParser.parse(this.parseContent(content));
    } else if (detectedSource === 'dify') {
      ir = this.difyParser.parse(this.parseContent(content));
    } else {
      throw new Error(`不支持的工作流格式: ${detectedSource}`);
    }

    const importId = ir.importId;
    this.importSessions.set(importId, {
      ir,
      source: detectedSource,
      createdAt: new Date(),
      nodeMappings: {}
    });

    const detectedNodes = ir.getDetectedNodes();

    return {
      success: true,
      importId,
      ir: ir.toJSON(),
      source: detectedSource,
      detectedNodes,
      availableModels: {
        llm: ['claude', 'deepseek', 'openai', 'qwen'],
        image: ['fal', 'replicate'],
        video: ['heygen']
      }
    };
  }

  async updateMappings(importId, nodeMappings) {
    const session = this.importSessions.get(importId);
    if (!session) {
      throw new Error('导入会话不存在');
    }

    session.ir.updateNodeMappings(nodeMappings);
    session.nodeMappings = nodeMappings;

    const { workflow, warnings } = this.converter.convert(session.ir);

    return {
      success: true,
      importId,
      n8nWorkflow: workflow,
      warnings
    };
  }

  async convertWithMappings(importId, nodeMappings) {
    try {
      const result = await this.updateMappings(importId, nodeMappings);
      return {
        success: true,
        n8nWorkflow: result.n8nWorkflow,
        warnings: result.warnings || []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        warnings: []
      };
    }
  }

  async getPreview(importId) {
    const session = this.importSessions.get(importId);
    if (!session) {
      throw new Error('导入会话不存在');
    }

    const { workflow, warnings } = this.converter.convert(session.ir);

    return {
      success: true,
      n8nWorkflow: workflow,
      warnings
    };
  }

  detectFormat(content) {
    const parsed = this.parseContent(content);
    if (this.cozeParser.detectFormat(parsed)) {
      return 'coze';
    }
    if (this.difyParser.detectFormat(parsed)) {
      return 'dify';
    }
    return null;
  }

  parseContent(content) {
    if (typeof content === 'string') {
      try {
        return JSON.parse(content);
      } catch {
        return content;
      }
    }
    return content;
  }

  getSession(importId) {
    return this.importSessions.get(importId);
  }

  clearSession(importId) {
    this.importSessions.delete(importId);
  }
}

module.exports = { WorkflowImporter };
