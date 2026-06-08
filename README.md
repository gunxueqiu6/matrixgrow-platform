# MatrixGrow — AI Content Distribution Engine

> Import Coze/Dify workflows directly into n8n. One-click publish to 27+ platforms. AI rewriting + intelligent traffic interception.

> Coze/Dify 工作流直接导入 n8n，27+ 平台一键发布，AI 改写 + 智能截流获客。

<p align="center">
  <img src="https://img.shields.io/badge/import-Coze_|_Dify_→_n8n-blue" alt="Workflow Import">
  <img src="https://img.shields.io/badge/distribution-27+_platforms-green" alt="27+ Platforms">
  <img src="https://img.shields.io/badge/AI_rewrite-5_styles-orange" alt="AI Rewrite">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="License">
</p>

## About / 关于

**MatrixGrow** is an AI-powered content distribution and traffic interception engine for indie developers and growth teams. It solves the "build it and they don't come" problem by automating content distribution across 27+ platforms, monitoring keywords 24/7 for relevant discussions, and generating AI-powered replies that attract users to your product.

**MatrixGrow** 是一个面向独立开发者和增长团队的 AI 内容分发与截流引擎。解决"做出来了没人用"的问题——自动分发内容到 27+ 平台，7x24 监控关键词和讨论，AI 生成回复吸引用户。

### Key Capabilities / 核心能力

| Capability | Description |
|---|---|
| **Workflow Import** / 工作流导入 | Paste Coze/Dify workflow JSON → auto-convert to runnable n8n workflow |
| **AI Rewriting** / AI 改写 | One input → 5 platform-optimized styles (tech blog, social, forum, micro-blog, Xiaohongshu) |
| **Multi-Channel Publish** / 多轨分发 | API direct + RPA simulation + Artipub blog, three tracks in parallel |
| **Smart Interception** / 智能截流 | 24/7 keyword monitoring, AI intent filtering, 3-stage auto-reply |
| **Template Store** / 模板商店 | Free/paid one-click install workflow templates for various growth scenarios |
| **AI Visuals** / AI 视觉 | Fal.ai + HeyGen for quote cards, infographics, and AI video generation |

## Quick Start / 快速开始

```bash
git clone https://github.com/gunxueqiu6/matrixgrow-platform.git
cd matrixgrow-platform
cp .env.example .env   # Add your API keys / 填入 API Key
npm install && npm start
# Open http://localhost:3000
```

**Docker / Docker 部署：**

```bash
docker-compose up -d
# MatrixGrow → http://localhost:3000
# n8n → http://localhost:5678
```

**Desktop App / 桌面应用：**

Download the latest `.exe` installer from [Releases](https://github.com/gunxueqiu6/matrixgrow-platform/releases), double-click to run. No terminal needed.

从 [Releases](https://github.com/gunxueqiu6/matrixgrow-platform/releases) 下载最新 `.exe` 安装包，双击即用，无需命令行。

## Why MatrixGrow / 为什么选择 MatrixGrow

| | Manual / 手动 | Artipub | Coze Direct | **MatrixGrow** |
|---|---|---|---|---|
| Platform Coverage / 平台覆盖 | Login one by one | Blogs only | Requires DIY | **27+ all platforms** |
| Coze/Dify Workflows | — | — | Own only | **Import to n8n directly** |
| AI Rewriting / AI 改写 | Manual | None | Basic | **5 styles per platform** |
| Smart Interception / 智能截流 | None | None | None | **24/7 monitor + AI reply** |
| Template Store / 模板商店 | None | None | None | **One-click install** |
| Distribution Channels / 分发通道 | 1 | 1 | 1 | **API + RPA + Artipub** |

**Unique advantage / 独家能力：** Workflows you've already built in Coze or Dify — paste the JSON and convert to n8n in seconds. No rebuilding required.

你在 Coze/Dify 搭好的工作流，粘贴 JSON 就能转成 n8n 工作流直接运行——不用重新搭建。

## Feature Matrix / 功能矩阵

| | Feature / 功能 | Description / 说明 |
|---|---|---|
| 🔄 | **Workflow Import** / 工作流导入 | Coze/Dify JSON → auto-map n8n nodes, one-click install |
| ✍️ | **AI Rewriting** / AI 内容改写 | One input, 5 platform styles (tech/social/forum/micro-blog/Xiaohongshu) |
| 🚀 | **Multi-Channel Publish** / 多轨分发 | API + RPA + Artipub in parallel |
| 🎯 | **Smart Interception** / 智能截流 | Keywords → intent filter → AI reply, fully automated |
| 🛒 | **Template Store** / 模板商店 | One-click install for Xiaohongshu/Zhihu/overseas growth workflows |
| 🎨 | **AI Visuals** / AI 视觉生成 | Fal.ai + HeyGen: quote cards, infographics, AI videos |
| 📊 | **Subscription Tiers** / 订阅管理 | Free / Pro / Promax, usage-based scaling |
| 🐳 | **Docker** / Docker 部署 | `docker-compose up -d` — MatrixGrow + n8n dual service |
| 🖥️ | **Desktop App** / 桌面应用 | Electron `.exe`, double-click to run |

## Project Structure / 项目结构

```
.
├── server.js                     # Express main server / 主服务
├── electron/                     # Electron desktop app / 桌面应用
│   ├── main.js                   # Main process (tray, window, IPC)
│   └── preload.js                # Context bridge
├── docker-compose.yml            # Docker dual-service / 双服务编排
├── Dockerfile                    # MatrixGrow container / 容器
├── routes/
│   ├── auth.js                   # User authentication / 用户认证
│   ├── workflow-import.js        # ★ Coze/Dify → n8n import engine
│   ├── workflows.js              # Template store + user workflows
│   ├── payment.js                # Payment integration / 支付集成
│   ├── saas.js                   # SaaS management / SaaS 管理
│   └── webhooks.js               # Webhook handling / Webhook 处理
├── utils/
│   ├── workflow-converter.js     # ★ IR → n8n JSON converter
│   ├── node-mapper.js            # ★ Node type mapping engine
│   ├── tier-guard.js             # Subscription tier middleware
│   ├── usage-meter.js            # AI usage billing / AI 用量计费
│   ├── llm-adapter.js            # LLM adapter / LLM 调用适配
│   └── app-paths.js              # Cross-platform path resolver
├── n8n-nodes/
│   └── nodes/
│       └── MatrixGrowPublish.node.js  # Custom n8n publish node
├── adapters/
│   ├── image/                    # Fal.ai / Replicate adapters
│   └── video/                    # HeyGen adapter
├── scripts/
│   ├── rewriters/text-rewriter.js    # AI rewrite pipeline
│   ├── publishers/                   # API/RPA/Artipub publishers
│   └── listeners/                    # Keyword/intent/DM monitors
├── config/
│   ├── platforms.json            # 27+ platform config / 平台配置
│   ├── workflow-mappings.json    # Coze/Dify node mapping table
│   └── ai-providers.json         # AI provider config / AI 提供商配置
├── data/database.js              # SQLite persistence / 数据持久化
├── middleware/auth.js             # JWT authentication / JWT 认证
├── frontend/                     # Web console / Web 控制台
│   ├── dashboard.html            # Dashboard / 控制台
│   ├── create.html               # ★ Create center (AI + Publish)
│   ├── workflow-import.html      # ★ Workflow import page
│   ├── workflows.html            # Workflow store / 工作流商店
│   ├── subscription.html         # Subscription / 订阅管理
│   └── agent.html                # AI Assistant / AI 助手
├── ai-agents/prompts/            # Per-platform prompt templates
└── tests/                        # Test suite / 测试套件
```

★ = v2 core modules / v2 核心模块

## API

### Workflow Import (v2 Core / v2 核心)

| Endpoint | Description / 说明 |
|---|---|
| `POST /api/workflow/import` | Submit Coze/Dify JSON, auto-detect nodes |
| `PUT /api/workflow/import/:id/mapping` | Configure node mapping (LLM provider, etc.) |
| `POST /api/workflow/import/:id/install` | Convert to n8n workflow and install |

### Template Store / 模板商店

| Endpoint | Description / 说明 |
|---|---|
| `GET /api/workflows/templates` | List templates (filter by category/free) |
| `GET /api/workflows/templates/:id` | Template details / 模板详情 |
| `POST /api/workflows/templates/:id/install` | Install to my workflows / 安装到我的工作流 |

### User Workflows / 用户工作流

| Endpoint | Description / 说明 |
|---|---|
| `GET /api/workflows/my` | My workflow list / 我的工作流列表 |
| `GET /api/workflows/my/:id` | Workflow details / 工作流详情 |
| `PUT /api/workflows/my/:id` | Update workflow / 更新工作流 |
| `DELETE /api/workflows/my/:id` | Delete workflow / 删除工作流 |

### AI Generation / AI 生成

| Endpoint | Description / 说明 |
|---|---|
| `POST /api/ai/llm` | LLM text (DeepSeek/Claude/OpenAI) |
| `POST /api/ai/image` | AI image (Fal.ai/Replicate) |
| `POST /api/ai/video` | AI video (HeyGen) |

### Usage / 用量统计

| Endpoint | Description / 说明 |
|---|---|
| `GET /api/workflows/usage` | Usage stats and history / 使用统计和历史 |
| `GET /api/workflows/usage/monthly` | Monthly usage details / 月度使用详情 |

## Supported Platforms / 支持的平台

### Developer Communities / 开发者社区
Dev.to · Medium · Hacker News · V2EX · Product Hunt · Juejin · CSDN · SegmentFault · Oschina

### Social Media / 社交媒体
X (Twitter) · Instagram · Threads · LinkedIn · Xiaohongshu · Weibo · Facebook · Mastodon

### Content & Media / 内容/自媒体
Zhihu · Jian Shu · WeChat Official · Toutiao · Bilibili · Baijia · Sohu · NetEase · Shaoshupai · Indie Hackers

> API direct · RPA simulation · Artipub multi-publish — three tracks in parallel.
> API 直发 · RPA 模拟 · Artipub 多发 — 三轨并行覆盖。

## Desktop App / 桌面应用

MatrixGrow is also available as a standalone Windows desktop app built with Electron. Download from [Releases](https://github.com/gunxueqiu6/matrixgrow-platform/releases).

- Double-click `.exe` to run — no Node.js, npm, or terminal required
- System tray support — minimize to tray, runs in background
- Auto-starts Express server on random port
- Same features as the web version, packaged for non-technical users

MatrixGrow 也提供 Electron 桌面版。从 [Releases](https://github.com/gunxueqiu6/matrixgrow-platform/releases) 下载。

- 双击 `.exe` 运行——无需安装 Node.js、npm 或命令行
- 系统托盘支持——最小化到托盘，后台运行
- 自动启动 Express 服务（随机端口）
- 与 Web 版本功能一致，面向非技术用户

### Development / 开发

```bash
npm run electron      # Run in dev mode / 开发模式运行
npm run build:exe     # Build NSIS installer / 构建安装包
```

## Contributing / 贡献

Contributions welcome! Open an issue or PR on GitHub.

欢迎贡献！在 GitHub 上提交 Issue 或 PR。

## License / 许可证

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>Team or enterprise?</b> <a href="https://matrixgrow.cn">Contact us</a> for Studio Enterprise Edition with advanced features, priority support, and custom integrations.
</p>
<p align="center">
  <b>团队/企业使用？</b><a href="https://matrixgrow.cn">联系我们</a>获取 Studio 企业版——高级功能、优先支持、定制集成。
</p>
