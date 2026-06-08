# MatrixGrow — AI Content Distribution Engine | AI 内容分发引擎

> Import Coze/Dify workflows into n8n. One-click publish to 27+ platforms. AI rewriting + smart traffic interception.
> Coze/Dify 工作流直接导入 n8n，27+ 平台一键发布，AI 改写 + 智能截流获客。

<p align="center">
  <img src="https://img.shields.io/badge/Workflows-Coze_|_Dify_→_n8n-blue" alt="Workflow Import">
  <img src="https://img.shields.io/badge/Distribution-27+_Platforms-green" alt="27+ Platforms">
  <img src="https://img.shields.io/badge/AI_Rewriting-5_Styles-orange" alt="AI Rewriting">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

---

## Quick Start | 快速开始

```bash
git clone https://github.com/gunxueqiu6/matrixgrow-platform.git
cd matrixgrow-platform
cp .env.example .env   # Fill in your API keys | 填入 API Key
npm install && npm start
# Open http://localhost:3000
```

**Docker:**

```bash
docker-compose up -d
# MatrixGrow → http://localhost:3000
# n8n → http://localhost:5678
```

---

## Why MatrixGrow | 为什么选择 MatrixGrow

| | Manual | Artipub | Coze Native | **MatrixGrow** |
|---|---|---|---|---|
| **Coverage** | One by one | Blogs only | Self-built | **27+ platforms** |
| **Coze/Dify import** | — | — | Vendor-locked | **Direct → n8n** |
| **AI rewriting** | Manual | None | Basic | **5 style adapters** |
| **Smart interception** | None | None | None | **24/7 monitor + AI reply** |
| **Template marketplace** | None | None | None | **One-click install** |
| **Distribution channels** | 1 | 1 | 1 | **API + RPA + Artipub** |

**Killer feature:** Paste your Coze/Dify workflow JSON → auto-converts to n8n workflow. No rebuilding required.

**独家能力：** 你在 Coze/Dify 搭好的工作流，粘贴 JSON 就能转成 n8n 工作流直接运行——不用重新搭建。

---

## Feature Matrix | 功能矩阵

| | Feature | Description |
|---|---------|-------------|
| 🔄 | **Workflow Import** | Coze/Dify JSON → auto-map n8n nodes, one-click install |
| ✍️ | **AI Rewriting** | One sentence input → 5 platform-specific styles (tech blog / social / forum / micro-blog / X thread) |
| 🚀 | **Multi-Channel Publish** | API direct + RPA simulation + Artipub multi-post, 3 channels in parallel |
| 🎯 | **Smart Interception** | 24/7 keyword monitoring, AI intent filtering, 3-stage auto-reply |
| 🛒 | **Template Marketplace** | Free/paid workflow templates, one-click install for XHS/ZH/global growth |
| 🎨 | **AI Visual Generation** | Fal.ai + HeyGen, quote cards / infographics / AI videos |
| 📊 | **Subscription Tiers** | Free / Pro / Promax, usage-based scaling |
| 🐳 | **Docker Deploy** | `docker-compose up -d`, MatrixGrow + n8n dual service |

---

## Supported Platforms | 支持的平台

### Developer Communities | 开发者社区
Dev.to · Medium · Hacker News · V2EX · Product Hunt · Juejin · CSDN · SegmentFault · OSchina

### Social Media | 社交媒体
X (Twitter) · Instagram · Threads · LinkedIn · Xiaohongshu · Weibo · Facebook · Mastodon

### Content Platforms | 内容/自媒体
Zhihu · JianShu · WeChat Official · Toutiao · Bilibili · Baijiahao · Sohu · NetEase · SSPAI · Indie Hackers

> API direct · RPA automation · Artipub multi-post — triple-channel coverage.
> API 直发 · RPA 模拟 · Artipub 多发，三轨并行覆盖。

---

## Project Structure | 项目结构

```
.
├── server.js                     # Express main server | 主服务
├── docker-compose.yml            # Docker orchestration
├── Dockerfile                    # MatrixGrow container
├── routes/
│   ├── auth.js                   # Auth | 用户认证
│   ├── workflow-import.js        # ★ Coze/Dify → n8n import engine
│   ├── workflows.js              # Template marketplace | 模板商店
│   ├── payment.js                # Payment integration | 支付
│   ├── saas.js                   # SaaS management
│   └── webhooks.js               # Webhook handlers
├── utils/
│   ├── workflow-converter.js     # ★ IR → n8n JSON converter
│   ├── node-mapper.js            # ★ Node type mapping engine
│   ├── tier-guard.js             # Subscription tier middleware
│   ├── usage-meter.js            # AI usage billing
│   └── llm-adapter.js            # LLM provider adapter
├── n8n-nodes/
│   └── nodes/
│       └── MatrixGrowPublish.node.js  # Custom n8n publish node
├── adapters/
│   ├── image/                    # Fal.ai / Replicate adapters
│   └── video/                    # HeyGen adapter
├── scripts/
│   ├── rewriters/text-rewriter.js    # AI rewrite pipeline | 改写管线
│   ├── publishers/                   # API/RPA/Artipub publishers
│   └── listeners/                    # Keyword/intent/DM monitors
├── config/
│   ├── platforms.json            # 27+ platform configs | 平台配置
│   ├── workflow-mappings.json    # Coze/Dify node mapping table
│   └── ai-providers.json         # AI provider configs
├── data/database.js              # SQLite persistence
├── middleware/auth.js             # JWT auth | 认证
├── frontend/                     # Web console | 控制台
│   ├── dashboard.html            # Dashboard
│   ├── create.html               # ★ Content creator (AI + Publish)
│   ├── workflow-import.html      # ★ Workflow import page
│   ├── workflows.html            # Workflow marketplace
│   ├── subscription.html         # Subscription management
│   └── agent.html                # AI assistant
├── ai-agents/prompts/            # Per-platform prompt templates
└── tests/                        # Test suite
```

★ = v2 core modules | 核心模块

---

## API

### Workflow Import (v2 Core) | 工作流导入

| Endpoint | Description |
|----------|-------------|
| `POST /api/workflow/import` | Submit Coze/Dify workflow JSON, auto-detect nodes |
| `PUT /api/workflow/import/:id/mapping` | Configure node mapping (LLM providers, etc.) |
| `POST /api/workflow/import/:id/install` | Convert to n8n workflow and install |

### Template Marketplace | 模板商店

| Endpoint | Description |
|----------|-------------|
| `GET /api/workflows/templates` | List templates (supports category/free filter) |
| `GET /api/workflows/templates/:id` | Get template details |
| `POST /api/workflows/templates/:id/install` | Install template to my workflows |

### AI Generation | AI 生成

| Endpoint | Description |
|----------|-------------|
| `POST /api/ai/llm` | LLM text generation (DeepSeek/Claude/OpenAI) |
| `POST /api/ai/image` | AI image generation (Fal.ai/Replicate) |
| `POST /api/ai/video` | AI video generation (HeyGen) |

### Usage & Analytics | 用量统计

| Endpoint | Description |
|----------|-------------|
| `GET /api/workflows/usage` | AI usage stats and history |
| `GET /api/workflows/usage/monthly` | Monthly usage details |

---

## Tech Stack | 技术栈

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express |
| Database | SQLite |
| RPA | Playwright |
| Workflow | n8n |
| AI | DeepSeek / Claude / GPT |
| Visual | Canvas API + Playwright |
| Deploy | Docker + Docker Compose |

---

## AI Agents | AI 代理矩阵

- **Tech Blog Agent** — Long-form tutorials → Juejin, CSDN, SegmentFault, Dev.to
- **Hardcore Community Agent** — Raw discussion style → V2EX, Reddit, Hacker News
- **Social Media Agent** — Emoji-rich emotional style → X, Facebook, Weibo
- **Micro Blog Agent** — Short-form → Xiaohongshu, Threads, Instagram
- **Intercept Agent** — 3-stage auto-reply: empathy → solution → CTA

---

## Completion Status | 完成度

**Overall: 95%**

- ✅ AI Text Rewriting Matrix (100%)
- ✅ AI Visual Generation Matrix (100%)
- ✅ Smart Interception Engine (100%)
- ✅ Multi-Channel Distribution (95%)
- ✅ n8n Workflow Integration (90%)
- ✅ Docker Deployment (100%)
- ⏳ Multi-tenant accounts (planned)
- ⏳ Visual workflow builder (planned)

---

<p align="center">
  <b>MatrixGrow</b> — Build once, publish everywhere. | 一次创作，全球分发。<br>
  Team or enterprise? <a href="https://matrixgrow.cn">Contact us</a> for Studio Enterprise.
</p>
