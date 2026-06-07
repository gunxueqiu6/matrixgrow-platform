# MatrixGrow — AI 内容分发引擎

> Coze/Dify 工作流直接导入 n8n，27+ 平台一键发布，AI 改写 + 智能截流获客。

<p align="center">
  <img src="https://img.shields.io/badge/工作流导入-Coze_|_Dify_→_n8n-blue" alt="工作流导入">
  <img src="https://img.shields.io/badge/分发-27+_平台-green" alt="27+ 平台">
  <img src="https://img.shields.io/badge/AI_改写-5_种风格-orange" alt="AI 改写">
</p>

## 快速开始

```bash
git clone https://github.com/gunxueqiu6/matrixgrow-platform.git
cd matrixgrow-platform
cp .env.example .env   # 填入 API Key
npm install && npm start
# 打开 http://localhost:3000
```

**Docker 部署：**

```bash
docker-compose up -d
# MatrixGrow → http://localhost:3000
# n8n → http://localhost:5678
```

## 为什么选择 MatrixGrow

| 对比维度 | 手动发布 | Artipub | Coze 直发 | **MatrixGrow** |
|----------|---------|---------|-----------|----------------|
| 平台覆盖 | 逐个登录 | 博客为主 | 需自建 | **27+ 全平台** |
| Coze/Dify 工作流 | — | — | 仅自家 | **直接导入 n8n** |
| AI 改写 | 手动 | 无 | 基础 | **5 种风格适配** |
| 智能截流 | 无 | 无 | 无 | **7x24 监控 + AI 回复** |
| 模板商店 | 无 | 无 | 无 | **一键安装** |
| 分发通道 | 1 | 1 | 1 | **API + RPA + Artipub 三轨** |

**独家能力：** 你在 Coze/Dify 搭好的工作流，粘贴 JSON 就能转成 n8n 工作流直接运行——不用重新搭建。

## 功能矩阵

| | 功能 | 说明 |
|---|------|------|
| 🔄 | **工作流导入** | Coze/Dify 工作流 JSON → 自动映射 n8n 节点，一键安装 |
| ✍️ | **AI 内容改写** | 一句话输入，自动适配 5 种平台风格（技术博客/社交媒体/硬核社区/微型博客/小红书） |
| 🚀 | **多轨分发** | API 直发 + RPA 模拟 + Artipub 博客多发，三轨并行 |
| 🎯 | **智能截流** | 7x24 关键词监控，AI 意图过滤，三段式自动回复 |
| 🛒 | **模板商店** | 免费/付费工作流模板一键安装，覆盖小红书/知乎/海外增长等场景 |
| 🎨 | **AI 视觉生成** | Fal.ai + HeyGen，金句卡片/信息图/AI 视频 |
| 📊 | **订阅管理** | Free/Pro/Promax 三级分层，按需扩展 |
| 🐳 | **Docker 部署** | docker-compose up -d，MatrixGrow + n8n 双服务 |

## 项目结构

```
.
├── server.js                     # Express 主服务
├── docker-compose.yml            # Docker 双服务编排
├── Dockerfile                    # MatrixGrow 容器
├── routes/
│   ├── auth.js                   # 用户认证
│   ├── workflow-import.js        # ★ Coze/Dify → n8n 导入引擎
│   ├── workflows.js              # 模板商店 + 用户工作流
│   ├── payment.js                # 支付集成
│   ├── saas.js                   # SaaS 管理
│   └── webhooks.js               # Webhook 处理
├── utils/
│   ├── workflow-converter.js     # ★ IR → n8n JSON 转换器
│   ├── node-mapper.js            # ★ 节点类型映射引擎
│   ├── tier-guard.js             # 订阅分级中间件
│   ├── usage-meter.js            # AI 用量计费
│   └── llm-adapter.js            # LLM 调用适配
├── n8n-nodes/
│   └── nodes/
│       └── MatrixGrowPublish.node.js  # n8n 自定义发布节点
├── adapters/
│   ├── image/                    # Fal.ai / Replicate 适配
│   └── video/                    # HeyGen 适配
├── scripts/
│   ├── rewriters/text-rewriter.js    # AI 改写管线
│   ├── publishers/                   # API/RPA/Artipub 发布器
│   └── listeners/                    # 关键词/意向/私信监控
├── config/
│   ├── platforms.json            # 27+ 平台配置
│   ├── workflow-mappings.json    # Coze/Dify 节点映射表
│   └── ai-providers.json         # AI 提供商配置
├── data/database.js              # SQLite 数据持久化
├── middleware/auth.js             # JWT 认证
├── frontend/                     # Web 控制台
│   ├── dashboard.html            # 控制台首页
│   ├── create.html               # ★ 创作中心（AI + 发布）
│   ├── workflow-import.html      # ★ 工作流导入页
│   ├── workflows.html            # 工作流商店
│   ├── subscription.html         # 订阅管理
│   └── agent.html                # AI 助手
├── ai-agents/prompts/            # 各平台 Prompt 模板
└── tests/                        # 测试套件
```

★ = v2 核心模块

## API

### 工作流导入（v2 核心）

| 端点 | 说明 |
|------|------|
| `POST /api/workflow/import` | 提交 Coze/Dify 工作流 JSON，自动检测节点 |
| `PUT /api/workflow/import/:id/mapping` | 配置节点映射（LLM 提供商等） |
| `POST /api/workflow/import/:id/install` | 转换为 n8n 工作流并安装 |

### 模板商店

| 端点 | 说明 |
|------|------|
| `GET /api/workflows/templates` | 获取模板列表（支持分类/免费筛选） |
| `GET /api/workflows/templates/:id` | 获取模板详情 |
| `POST /api/workflows/templates/:id/install` | 安装模板到我的工作流 |

### 用户工作流

| 端点 | 说明 |
|------|------|
| `GET /api/workflows/my` | 获取我的工作流列表 |
| `GET /api/workflows/my/:id` | 获取工作流详情 |
| `PUT /api/workflows/my/:id` | 更新工作流 |
| `DELETE /api/workflows/my/:id` | 删除工作流 |

### AI 生成

| 端点 | 说明 |
|------|------|
| `POST /api/ai/llm` | LLM 文本生成（DeepSeek/Claude/OpenAI） |
| `POST /api/ai/image` | AI 图片生成（Fal.ai/Replicate） |
| `POST /api/ai/video` | AI 视频生成（HeyGen） |

### 用量统计

| 端点 | 说明 |
|------|------|
| `GET /api/workflows/usage` | 获取 AI 使用统计和历史 |
| `GET /api/workflows/usage/monthly` | 获取月度使用详情 |

## 支持的平台

### 开发者社区
Dev.to · Medium · Hacker News · V2EX · Product Hunt · 掘金 · CSDN · 思否 · 开源中国

### 社交媒体
X (Twitter) · Instagram · Threads · LinkedIn · 小红书 · 微博 · Facebook · Mastodon

### 内容/自媒体
知乎 · 简书 · 微信公众号 · 头条号 · B站专栏 · 百家号 · 搜狐号 · 网易号 · 少数派 · Indie Hackers

> API 直发 · RPA 模拟 · Artipub 多发，三轨并行覆盖。

---

<p align="center">
  团队/企业使用？<a href="https://matrixgrow.cn">联系我们</a>获取 Studio 企业版。
</p>
