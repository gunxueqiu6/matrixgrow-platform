/**
 * n8n Custom Nodes Manager
 * 管理 n8n 自定义节点的注册和使用
 */

class N8nCustomNodes {
  constructor(config = {}) {
    this.n8nApiUrl = config.n8nApiUrl || process.env.N8N_API_URL || 'http://localhost:5678';
    this.n8nApiKey = config.n8nApiKey || process.env.N8N_API_KEY;
    this.nodesPackage = config.nodesPackage || 'matrixgrow-nodes';
  }

  /**
   * 获取 n8n API 实例
   */
  getN8nApi() {
    return {
      baseUrl: this.n8nApiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.n8nApiKey ? { 'X-N8n-API-Key': this.n8nApiKey } : {})
      }
    };
  }

  /**
   * 获取可用的自定义节点列表
   */
  async getAvailableNodes() {
    // 这里应该调用 n8n API 获取节点列表
    // 暂时返回静态定义
    return [
      {
        name: 'MatrixGrow Publish',
        type: 'matrixgrow-nodes.publish',
        description: 'MatrixGrow 多平台发布节点',
        category: 'MatrixGrow',
        icon: 'fa:paper-plane'
      }
    ];
  }

  /**
   * 创建包含 MatrixGrow 发布节点的工作流
   */
  createWorkflowWithPublish(publishConfig = {}) {
    const { content, images, platforms, options = {} } = publishConfig;

    return {
      name: 'MatrixGrow Content Publish',
      active: false,
      nodes: [
        {
          parameters: {},
          id: 'start-node',
          name: 'Start',
          type: 'n8n-nodes-base.start',
          typeVersion: 1,
          position: [250, 300]
        },
        {
          parameters: {
            content: content || '={{ $json.content }}',
            images: images || '={{ $json.images }}',
            platforms: platforms || ['xiaohongshu', 'juejin'],
            options: {
              schedule: options.schedule || 'now',
              scheduledAt: options.scheduledAt || '',
              reviewRequired: options.reviewRequired || false
            }
          },
          id: 'publish-node',
          name: 'MatrixGrow Publish',
          type: 'matrixgrow-nodes.publish',
          typeVersion: 1,
          position: [550, 300]
        }
      ],
      connections: {
        'Start': {
          'main': [[{ node: 'MatrixGrow Publish', type: 'main', index: 0 }]]
        }
      },
      settings: {},
      staticData: null,
      tags: ['MatrixGrow', 'Publish']
    };
  }

  /**
   * 将导入的工作流添加 MatrixGrow 发布节点
   */
  addPublishNodeToWorkflow(n8nWorkflow, publishConfig = {}) {
    const workflow = JSON.parse(JSON.stringify(n8nWorkflow));

    // 找到最后一个节点的位置
    let lastNode = workflow.nodes[workflow.nodes.length - 1];
    let lastNodePosition = lastNode?.position || [0, 0];

    // 添加发布节点
    const publishNode = {
      parameters: {
        content: publishConfig.content || '={{ $json.content }}',
        images: publishConfig.images || '={{ $json.images }}',
        platforms: publishConfig.platforms || ['xiaohongshu', 'juejin'],
        options: publishConfig.options || {}
      },
      id: `matrixgrow-publish-${Date.now()}`,
      name: 'MatrixGrow Publish',
      type: 'matrixgrow-nodes.publish',
      typeVersion: 1,
      position: [lastNodePosition[0] + 300, lastNodePosition[1]]
    };

    workflow.nodes.push(publishNode);

    // 连接最后一个节点到发布节点
    if (lastNode) {
      if (!workflow.connections[lastNode.name]) {
        workflow.connections[lastNode.name] = { main: [[]] };
      }
      if (!workflow.connections[lastNode.name].main) {
        workflow.connections[lastNode.name].main = [[]];
      }
      workflow.connections[lastNode.name].main[0].push({
        node: 'MatrixGrow Publish',
        type: 'main',
        index: 0
      });
    }

    return workflow;
  }

  /**
   * 安装自定义节点包到 n8n
   * 注意：这需要 n8n 环境能够访问自定义节点包
   */
  async installCustomNodes() {
    // 这个方法应该在实际部署时实现
    // 用于将自定义节点安装到 n8n 实例
    console.log('Custom nodes installation would be handled in deployment');
    return { success: true, message: 'Custom nodes installation prepared' };
  }
}

module.exports = { N8nCustomNodes };
