/**
 * Test Helpers - 共享的 mock 对象和工具函数
 *
 * 提供 mock DB、mock req/res 给各测试文件使用
 */

/**
 * 创建一个 mock 数据库实例，用于 tier-guard 和 usage-meter 测试
 * @param {Object} options - 自定义行为
 */
function createMockDb(options = {}) {
  const defaults = {
    subscription: { tier: 'free', platform_limit: 3, accounts_per_platform: 1 },
    platformsCount: 0,
    platformCount: 0,
    workflowsCount: 0,
    monthlyUsage: { image: 0, video: 0, text: 0 },
    aiUsageLogs: [],
    recordAiUsageId: 1,
  };

  const state = { ...defaults, ...options };

  const db = {
    getSubscription: async (userId) => state.subscription,
    getUserPlatformsCount: async (userId) => state.platformsCount,
    getPlatformCountForUser: async (userId, platform) => state.platformCount,
    countUserWorkflows: async (userId) => state.workflowsCount,
    getMonthlyUsage: async (userId, type) => state.monthlyUsage[type] || 0,
    recordAiUsage: async (userId, type, provider, model, amount, unit, workflowId) => {
      const id = state.recordAiUsageId++;
      state.aiUsageLogs.push({ userId, type, provider, model, amount, unit, workflowId, id });
      return id;
    },
    getAiUsageLogs: async (userId, limit) =>
      state.aiUsageLogs.slice(0, limit),

    // 允许测试覆写单个方法
    __setState: (newState) => Object.assign(state, newState),
    __getState: () => state,
  };

  return db;
}

/**
 * 创建一个 mock Express req 对象
 */
function createMockReq(overrides = {}) {
  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    user: null,
    app: { locals: { db: createMockDb() } },
    ...overrides,
  };
}

/**
 * 创建一个 mock Express res 对象
 * 返回 { res, calls } — calls 记录所有调用
 */
function createMockRes() {
  const calls = [];

  const res = {
    statusCode: 200,
    _json: null,
    _headers: {},

    status(code) {
      this.statusCode = code;
      calls.push({ method: 'status', args: [code] });
      return this;
    },

    json(data) {
      this._json = data;
      calls.push({ method: 'json', args: [data] });
      return this;
    },

    setHeader(name, value) {
      this._headers[name] = value;
      calls.push({ method: 'setHeader', args: [name, value] });
      return this;
    },
  };

  return { res, calls };
}

/**
 * 创建一个简单的 Coze 格式工作流 JSON
 */
function createCozeWorkflow(overrides = {}) {
  return {
    name: '测试工作流',
    description: '自动化测试用工作流',
    nodes: [
      { id: '1', type: '1', name: '开始', prompt: '', position: { x: 0, y: 0 } },
      { id: '2', type: '3', name: 'LLM 节点', prompt: '写一篇技术文章', model: 'deepseek-chat', position: { x: 200, y: 0 } },
      { id: '3', type: '2', name: '结束', position: { x: 400, y: 0 } },
    ],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
    ],
    ...overrides,
  };
}

/**
 * 创建一个简单的 Dify 格式工作流 JSON
 */
function createDifyWorkflow(overrides = {}) {
  return {
    name: 'Dify 测试工作流',
    description: 'Dify 格式测试',
    graph: {
      nodes: [
        { id: 'start1', type: 'start', name: '开始', data: {}, position: [0, 0] },
        { id: 'llm1', type: 'llm', name: 'LLM', data: { prompt: '你好', model: 'gpt-4' }, position: [200, 0] },
        { id: 'end1', type: 'end', name: '结束', data: {}, position: [400, 0] },
      ],
      edges: [
        { source: 'start1', target: 'llm1' },
        { source: 'llm1', target: 'end1' },
      ],
    },
    ...overrides,
  };
}

module.exports = {
  createMockDb,
  createMockReq,
  createMockRes,
  createCozeWorkflow,
  createDifyWorkflow,
};
