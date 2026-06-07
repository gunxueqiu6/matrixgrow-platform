# Agent 对话 + 支付集成 + Webhook 管理 开发计划

## Context

当前 MatrixGrow 的 SaaS 化基础架构已完成（用户系统、订阅分级、平台绑定、模型配置）。现在需要补齐三个核心板块：

1. **Agent 对话** — 把 stub endpoint 变成真正的 AI 助手，用户用自然语言操作整个系统
2. **支付集成** — 国内微信/支付宝收款，国外 PayPal 收款，自动化订阅激活
3. **Webhook 管理** — 让用户和第三方系统能订阅 MatrixGrow 的事件流

---

## 一、Agent 对话系统

### 1.1 现状

`POST /api/agent`（`routes/saas.js:323`）目前只返回用户上下文，不调用 LLM：

```js
res.json({ success: true, message: 'Agent 功能开发中...', context: userContext });
```

已有基础设施：
- `utils/llm-adapter.js` — 4 个 provider 的统一调用接口（`complete()` / `rewrite()` / `classifyIntent()` / `generateReply()`）
- `ai-agents/prompts/builtin-agent.md` — 完整的系统提示词（含角色定义、能力描述、示例对话）
- `server.js` 中已有发布、改写、监控等核心功能模块

### 1.2 架构设计

```
用户消息 → POST /api/agent
              ↓
         读取用户设置（LLM provider + API key）
              ↓
         读取用户上下文（订阅等级、已绑平台）
              ↓
         构建 messages = [system prompt] + [历史对话] + [user message]
              ↓
         调用 LLMAdapter.complete()
              ↓
         解析 LLM 返回的 action（JSON 结构化输出）
              ↓
         执行 action（发布/改写/查询/绑定平台）
              ↓
         返回结果给用户
```

### 1.3 对话协议

Agent 采用 **意图识别 + 动作执行** 模式。系统提示词指示 LLM 在需要执行操作时返回 JSON action，纯对话时返回自然语言。

**LLM 返回格式规范：**

```json
// 需要执行操作时：
{ "type": "action", "action": "publish", "params": { "content": "...", "platforms": ["xiaohongshu", "v2ex"] } }
{ "type": "action", "action": "rewrite", "params": { "content": "...", "style": "social-media" } }
{ "type": "action", "action": "bind_platform", "params": { "platform": "juejin", "instructions": true } }
{ "type": "action", "action": "query_stats", "params": { "period": "this_month" } }

// 纯对话时：
{ "type": "chat", "content": "好的，我帮你分析一下..." }
```

**Server 端处理流程：**

```text
if action.type === "chat" → 直接返回 content 给前端
if action.type === "action":
  ├─ "publish"        → 调用 publishToAll(params.content, params.platforms)
  ├─ "rewrite"        → 调用 LLMAdapter.rewrite(params.content, params.style)
  ├─ "bind_platform"  → 返回绑定指引 + 触发平台绑定流程
  ├─ "query_stats"    → 查询数据库统计
  ├─ "upgrade"        → 返回订阅升级引导
  └─ "unknown"        → 返回"我无法执行此操作"
```

### 1.4 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `utils/agent-handler.js` | **新建** | Agent 核心逻辑：上下文构建、LLM 调用、action 分发 |
| `utils/agent-actions.js` | **新建** | Action 执行器：publish、rewrite、query_stats 等具体操作 |
| `routes/saas.js` | **修改** | 重写 `/api/agent` 端点，接入 agent-handler |
| `ai-agents/prompts/builtin-agent.md` | **修改** | 补充 JSON action 输出格式规范 |
| `frontend/dashboard.html` | **修改** | 在控制台中添加 Agent 对话 UI（输入框 + 对话历史） |

### 1.5 Agent 对话 UI（嵌入 dashboard）

在 dashboard 控制台底部添加对话面板：

```text
┌─────────────────────────────────────────┐
│  🤖 Agent 对话                    [−]   │
│  ┌─────────────────────────────────────┐│
│  │ 用户: 帮我把昨天写的AI工具评测发到   ││
│  │       小红书和掘金                   ││
│  │                                     ││
│  │ Agent: 好的，我先帮你改写内容...     ││
│  │       小红书版本已生成 ✅            ││
│  │       掘金版本已生成 ✅              ││
│  │       点击发布 → [发布到这两个平台]   ││
│  └─────────────────────────────────────┘│
│  ┌──────────────────────────┐ [发送]    │
│  │ 输入消息...               │          │
│  └──────────────────────────┘           │
└─────────────────────────────────────────┘
```

### 1.6 构建顺序

```
1. utils/agent-actions.js      — action 执行器（可并行开发）
2. utils/agent-handler.js      — Agent 核心逻辑
3. routes/saas.js              — 重写 /api/agent
4. ai-agents/prompts/          — 更新系统提示词
5. frontend/dashboard.html     — 对话 UI
6. 端到端测试
```

---

## 二、支付集成

### 2.1 支付渠道

| 渠道 | 用户群体 | 方式 | 接入难度 |
|------|---------|------|---------|
| 微信支付 | 国内用户 | 个人收款码（JSAPI/扫码） | 中（需商户号） |
| 支付宝 | 国内用户 | 当面付（扫码）/ APP支付 | 中（需商户号） |
| PayPal | 海外用户 | REST API Orders v2 | 低（REST 接口） |

**最小可行方案**：先用 PayPal（REST API 最简单）+ 国内手动确认模式（用户上传转账截图 → 管理员后台确认升级），后续迭代接入微信/支付宝官方 API。

**完整方案（本次实现）**：PayPal 全自动 + 微信/支付宝扫码支付自动回调。

### 2.2 新表：`payment_orders`

```sql
CREATE TABLE IF NOT EXISTS payment_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_no TEXT NOT NULL UNIQUE,         -- 商户订单号 (MG-{timestamp}-{random})
  channel TEXT NOT NULL,                 -- 'wechat' | 'alipay' | 'paypal'
  amount REAL NOT NULL,                  -- 金额（元/美元）
  currency TEXT NOT NULL DEFAULT 'CNY',  -- 'CNY' | 'USD'
  tier TEXT NOT NULL,                    -- 'pro' | 'promax'
  status TEXT NOT NULL DEFAULT 'pending',-- 'pending' | 'paid' | 'expired' | 'refunded'
  transaction_id TEXT,                   -- 支付平台交易号（回调时填充）
  paid_at TIMESTAMP,                     -- 支付时间
  expires_at TIMESTAMP,                  -- 订单过期时间
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### 2.3 API 端点

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/payment/create-order` | authenticate | 创建支付订单，返回支付链接/二维码 |
| GET | `/api/payment/order/:orderNo` | authenticate | 查询订单状态 |
| POST | `/api/payment/paypal-webhook` | PayPal 签名验证 | PayPal 支付回调 |
| POST | `/api/payment/wechat-notify` | 微信签名验证 | 微信支付回调 |
| POST | `/api/payment/alipay-notify` | 支付宝签名验证 | 支付宝支付回调 |

### 2.4 支付流程

```
用户选择 tier → POST /api/payment/create-order
                      ↓
                  生成订单号 → 存储 payment_orders (pending)
                      ↓
            ┌─────────┼──────────┐
            ↓         ↓          ↓
         微信支付   支付宝     PayPal
            ↓         ↓          ↓
         扫码支付   扫码支付   PayPal 页面
            ↓         ↓          ↓
         回调通知 → 验证签名 → 更新订单 (paid)
                      ↓
                  更新 subscriptions (tier, platform_limit)
                      ↓
                  返回成功
```

### 2.5 个人开发者落地方案

微信/支付宝如果没有商户号，可以用以下过渡方案：

- **微信**：个人 JSAPI 支付（需个体工商户注册，约 1-3 天），或临时用赞赏码 + 人工确认
- **支付宝**：当面付（需个体工商户，约 1-3 天），或临时用转账 + 人工确认
- **PayPal**：个人即可接入，无需营业执照

**本次实现策略**：PayPal 全自动 + 微信/支付宝预留回调接口（代码写完整，商户号通过环境变量配置，没有配置时自动降级为手动确认模式）。

### 2.6 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `utils/payment/paypal.js` | **新建** | PayPal Orders API 封装（创建订单、验证回调） |
| `utils/payment/wechat.js` | **新建** | 微信支付 JSAPI/扫码 封装（签名、下单、回调验证） |
| `utils/payment/alipay.js` | **新建** | 支付宝当面付封装（签名、下单、回调验证） |
| `utils/payment/index.js` | **新建** | 支付统一入口（根据 channel 路由 + 订单管理） |
| `routes/payment.js` | **新建** | 支付相关 API 端点 |
| `data/database.js` | **修改** | 新增 `payment_orders` 表 + CRUD 方法 |
| `server.js` | **修改** | 注册支付路由 |
| `frontend/dashboard.html` | **修改** | 订阅页添加支付按钮和订单状态 |

### 2.7 构建顺序

```
1. data/database.js         — payment_orders 表 + CRUD
2. utils/payment/paypal.js  — PayPal 接口封装
3. utils/payment/wechat.js  — 微信支付封装
4. utils/payment/alipay.js  — 支付宝封装
5. utils/payment/index.js   — 统一入口
6. routes/payment.js        — API 端点
7. server.js                — 注册路由
8. frontend/dashboard.html  — 支付 UI
```

---

## 三、Webhook 管理

### 3.1 事件类型

| 事件 | 触发时机 | payload |
|------|---------|---------|
| `publish.completed` | 内容成功发布到某个平台 | `{ platform, url, title, timestamp }` |
| `publish.failed` | 发布失败 | `{ platform, error, title, timestamp }` |
| `intercept.matched` | 截流命中高意向帖子 | `{ platform, post_url, intent, reply }` |
| `agent.message` | Agent 对话产生结果 | `{ message, actions, timestamp }` |

### 3.2 新表：`webhooks`

```sql
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT,                               -- 用户给 webhook 起的名字
  url TEXT NOT NULL,                       -- 回调 URL
  events TEXT NOT NULL,                     -- JSON 数组: ["publish.completed", "publish.failed"]
  secret TEXT,                              -- HMAC 签名密钥（可选）
  is_active INTEGER DEFAULT 1,
  last_sent_at TIMESTAMP,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)

CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  status TEXT NOT NULL,                    -- 'success' | 'failed'
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
)
```

### 3.3 API 端点

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/webhooks` | authenticate | 获取用户的 webhook 列表 |
| POST | `/api/webhooks` | authenticate | 创建 webhook |
| PUT | `/api/webhooks/:id` | authenticate | 更新 webhook |
| DELETE | `/api/webhooks/:id` | authenticate | 删除 webhook |
| GET | `/api/webhooks/:id/logs` | authenticate | 查看 webhook 发送日志 |
| POST | `/api/webhooks/:id/test` | authenticate | 发送测试事件 |

### 3.4 投递机制

```
事件触发
    ↓
查询所有订阅该事件的 active webhooks
    ↓
并发 POST 到各 webhook URL（带 HMAC 签名头）
    ↓
超时 10s，重试 3 次（间隔 1s/5s/15s）
    ↓
记录到 webhook_logs
```

### 3.5 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `utils/webhook-dispatcher.js` | **新建** | Webhook 投递引擎（并发、重试、日志） |
| `routes/webhooks.js` | **新建** | Webhook CRUD API |
| `data/database.js` | **修改** | 新增 `webhooks` + `webhook_logs` 表 + CRUD |
| `server.js` | **修改** | 注册 webhook 路由 + 在发布/截流/Agent 事件点触发 dispatcher |
| `frontend/dashboard.html` | **修改** | Webhook 管理 UI（列表 + 添加/编辑表单） |

### 3.6 构建顺序

```
1. data/database.js          — webhooks + webhook_logs 表
2. utils/webhook-dispatcher.js — 投递引擎
3. routes/webhooks.js         — API 端点
4. server.js                  — 注册路由 + 事件埋点
5. frontend/dashboard.html    — Webhook 管理 UI
```

---

## 四、构建顺序总览

三个板块相对独立，Agent 和 Webhook 可以在 Phase 1 并行，支付在 Phase 2 独立推进。

```
Phase 1（并行，2 个板块）
  ├─ Agent 板块
  │   ├─ utils/agent-actions.js
  │   ├─ utils/agent-handler.js
  │   └─ ai-agents/prompts/builtin-agent.md（更新）
  │
  └─ Webhook 板块
      ├─ data/database.js（webhook 表部分）
      └─ utils/webhook-dispatcher.js

Phase 2（并行，所有板块依赖 Phase 1）
  ├─ Agent 路由 + UI
  │   ├─ routes/saas.js（更新 /api/agent）
  │   └─ frontend/dashboard.html（Agent 对话 UI）
  │
  ├─ Webhook 路由 + 事件埋点 + UI
  │   ├─ routes/webhooks.js
  │   ├─ server.js（webhook 事件埋点）
  │   └─ frontend/dashboard.html（Webhook UI）
  │
  └─ 支付板块（独立，无依赖）
      ├─ data/database.js（payment_orders 表）
      ├─ utils/payment/paypal.js
      ├─ utils/payment/wechat.js
      ├─ utils/payment/alipay.js
      ├─ utils/payment/index.js
      └─ routes/payment.js

Phase 3: server.js + frontend 集成 + 端到端测试
```

---

## 五、验证清单

### Agent
- [ ] `POST /api/agent` "帮我发到小红书" → Agent 调用改写 → 执行发布
- [ ] `POST /api/agent` "这个月发的什么" → Agent 查询统计并回复
- [ ] `POST /api/agent` 纯聊天消息 → Agent 正常对话，不触发 action
- [ ] 对话历史在多轮交互中保持（session 级别）

### 支付
- [ ] `POST /api/payment/create-order` 创建 PayPal 订单 → 返回支付链接
- [ ] PayPal 沙箱支付 → webhook 回调 → 订单状态更新 → 订阅自动升级
- [ ] 微信/支付宝无商户号时降级为手动确认模式
- [ ] 重复支付幂等（同 order_no 不能重复处理）

### Webhook
- [ ] `POST /api/webhooks` 创建 webhook → 保存成功
- [ ] 发帖成功后 → webhook 投递到订阅 URL
- [ ] 投递失败 → 重试 3 次 → 记录日志
- [ ] `GET /api/webhooks/:id/logs` 查看投递历史
