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

  async pushToN8n(workflow, options = {}) {
    const axios = require('axios');
    const n8nUrl = options.n8nUrl || process.env.N8N_API_URL || 'http://localhost:5678';
    const n8nUser = options.n8nUser || process.env.N8N_AUTH_USER || 'admin@scm-platform.local';
    const n8nPass = options.n8nPass || process.env.N8N_AUTH_PASSWORD || 'Fulfill_Admin_2024';

    try {
      // Step 1: Login to get session cookie
      const loginResponse = await axios.post(
        `${n8nUrl}/rest/login`,
        { emailOrLdapLoginId: n8nUser, password: n8nPass },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );

      const cookies = loginResponse.headers['set-cookie'];
      if (!cookies || cookies.length === 0) {
        throw new Error('n8n 登录未返回会话 Cookie');
      }

      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;

      // Step 2: Create workflow with session cookie
      const response = await axios.post(
        `${n8nUrl}/rest/workflows`,
        { ...workflow, name: workflow.name || '导入的工作流' },
        {
          headers: {
            'Cookie': cookieStr,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return { id: response.data.data.id, name: response.data.data.name };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('n8n 认证失败，请检查 N8N_AUTH_USER/N8N_AUTH_PASSWORD 配置');
      }
      throw new Error(`推送 n8n 失败: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = { WorkflowImporter };
