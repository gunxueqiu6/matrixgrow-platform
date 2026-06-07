# MatrixGrow 架构决策记录

## ADR-001: Core Webhook 工作流架构选择

### 状态
已决定 - 保持当前内联扩展方式

### 背景
项目推进计划要求评估 core-webhook.json 的架构设计：
- **方案 A（编排层）**: 通过 Execute Workflow 节点调用子工作流
- **方案 B（内联扩展）**: 所有功能内联在单一工作流中

### 决策
**采用方案 B（内联扩展方式）**

### 理由

#### 内联扩展的优势
1. **直观性**: 所有逻辑一目了然，易于理解整个流程
2. **调试便利**: 单点断点调试，无需追踪跨工作流调用
3. **部署简单**: 只需导入一个 JSON 文件
4. **性能**: 无跨工作流调用的网络/序列化开销

#### 当前实现评估
```json
{
  "nodes": [
    "Webhook → Input Parser → Load Agent Prompts → Platform Router",
    "├── Tech Blog Agent",
    "├── Social Media Agent",  ← 5 个 Agent 并行处理
    "├── Hardcore Agent",
    "├── Micro Blog Agent",
    "Merge Results → Vision Generator → Publish Dispatcher",
    "├── API Publishers",
    "├── RPA Publisher (V2EX)",
    "├── RPA Publisher (小红书)",
    "└── Artipub Publisher"
  ]
}
```

#### 为什么不用编排层
1. **项目规模适中**: 27 平台 + 5 Agent，不需要过度模块化
2. **n8n 限制**: Execute Workflow 节点存在性能开销
3. **可维护性**: 当前规模下，单文件比多文件更易维护
4. **复杂度**: 引入子工作流会增加部署和版本管理复杂度

### 何时重新评估
如果出现以下情况，考虑迁移到编排层：
- 平台数量超过 50+
- Agent 类型超过 10+
- 需要独立复用单个工作流
- 团队规模扩大需要并行开发

### 替代方案（轻量化）
如果未来需要更好的模块化，可考虑：
1. **拆分但不全分离**: 将 Agent prompts 提取到独立的 Credential
2. **工作流模板**: 预定义可复用的子流程片段
3. **动态加载**: 使用 n8n 的 Code 节点动态选择处理逻辑

### 参考资料
- n8n 官方文档: Workflow Design Patterns
- 当前实现: [core-webhook.json](file:///d:/projects/分发与截流/n8n-workflows/flows/core-webhook.json)
