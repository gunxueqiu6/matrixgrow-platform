# n8n 接入文档

MatrixGrow 通过 n8n 实现可视化工作流编排。此文档描述如何部署 n8n 并与 MatrixGrow 集成。

## 部署方式

### Docker Compose（推荐）

项目根目录 `docker-compose.yml` 已包含 n8n 服务：

```bash
docker compose up -d
```

n8n 将在 `http://localhost:5678` 启动，默认启用 Basic Auth。

### 手动部署

```bash
npm install n8n -g
n8n start
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `N8N_BASIC_AUTH_ACTIVE` | 启用 Basic Auth（`true`） |
| `N8N_BASIC_AUTH_USER` | 用户名 |
| `N8N_BASIC_AUTH_PASSWORD` | 密码 |

## 工作流导入

1. 打开 n8n 界面（`http://localhost:5678`）
2. 点击 **Import from File**
3. 导入 `n8n-workflows/flows/` 下的三个工作流：
   - `core-webhook.json` — 核心分发流程
   - `smart-intercept.json` — 智能截流流程
   - `dm-monitor.json` — 私信监控流程
4. 激活工作流（Active toggle）

## Webhook 对接

MatrixGrow 暴露以下 webhook 供 n8n 调用：

### 内容分发入口

```
POST http://localhost:3000/api/webhook/matrixgrow-input
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "text": "产品介绍文案",
  "platforms": ["tech-blog", "social", "x"],
  "source": "n8n"
}
```

### 截流回复

```
POST http://localhost:3000/api/intercept/reply
Content-Type: application/json

{
  "platform": "v2ex",
  "topic_id": "12345",
  "content": "回复内容"
}
```

### 工作流执行追踪

```
POST http://localhost:3000/api/workflow/execute
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "workflowName": "core-webhook",
  "inputPayload": { "text": "..." }
}
```

## 认证

生产环境建议使用 JWT 认证。在 n8n HTTP Request 节点中添加 Header：

```
Authorization: Bearer <JWT_TOKEN>
```

## 定时触发

n8n 内置 Cron 节点可替代 MatrixGrow 自带的 `setInterval` 调度：

1. 添加 **Schedule Trigger** 节点
2. 设置 Cron 表达式（如 `*/10 * * * *` 每 10 分钟）
3. 连接 HTTP Request 节点调用 `/api/monitor/check`

## 故障排除

- **n8n 无法连接 MatrixGrow**：确认 Docker 网络配置，两个服务必须在同一网络
- **Webhook 返回 401**：检查 JWT Token 是否过期
- **工作流未激活**：在 n8n 界面确认 Active 开关已打开
