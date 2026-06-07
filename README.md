# MatrixGrow - AI 独立开发者增长引擎

> 一句话，全网分发。智能截流，自动获客。

## 🎯 产品介绍

MatrixGrow 是一个 AI 驱动的内容分发和智能获客系统，专为独立开发者和数字创业者打造。

**核心功能：**

| 功能 | 说明 | 状态 |
|------|------|------|
| AI 文本重写矩阵 | 一句话输入，自动适配 5 种平台风格 | ✅ 已完成 |
| 视觉生成模块 | Canvas + HTML-to-Image + Infographic | ✅ 已完成 |
| 多路混合分发 | API + RPA + Artipub 三轨并行，覆盖 27+ 平台 | ✅ 已完成 |
| 智能截流引擎 | 7x24 监听 + 三段式回复，覆盖 8+ 平台 | ✅ 已完成 |
| 私信监控闭环 | 私信自动回复 + 产品链接推送 | ✅ 已完成 |
| 定时监控调度 | 每 10 分钟自动检查新帖子 | ✅ 已完成 |
| Docker 部署 | 一键启动 n8n + MatrixGrow 双服务 | ✅ 已完成 |

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
npm run install:playwright  # 安装 Playwright 浏览器
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入你的 API Keys：

```env
# 必需
ANTHROPIC_API_KEY=sk-ant-xxxxx  # Claude API
OPENAI_API_KEY=sk-xxxxx         # GPT-4o
DEEPSEEK_API_KEY=sk-xxxxx       # 意向度过滤

# 可选
FLUX_API_KEY=xxxxx              # AI 图片生成
AYRSHARE_API_KEY=xxxxx          # X/LinkedIn 发布
DEVTO_API_KEY=xxxxx             # Dev.to 发布
```

### 3. 启动服务器

```bash
npm start
```

访问 [http://localhost:3000](http://localhost:3000)

### 4. Docker 部署（推荐）

```bash
docker-compose up -d
```

### 5. 启用定时监控

```bash
ENABLE_MONITOR=true npm start
```

## 📁 项目结构

```
.
├── server.js                 # Express 后端服务器
├── demo.js                 # 演示脚本
├── docker-compose.yml        # Docker 部署配置
├── Dockerfile               # MatrixGrow 容器文件
├── n8n-workflows/
│   ├── flows/             # n8n 工作流
│   │   ├── core-webhook.json   # 核心 webhook 工作流
│   │   ├── smart-intercept.json # 智能截流工作流
│   │   ├── dm-monitor.json    # 私信监控工作流
│   │   ├── ai-rewrite-matrix.json # AI 改写矩阵工作流（新）
│   │   └── multi-publish.json # 全平台批量发布（新）
│   └── workflows.md        # n8n 配置文档
├── ai-agents/
│   ├── prompts/           # 各平台 Prompt 模板
│   │   ├── tech-blog-agent.md
│   │   ├── social-media-agent.md
│   │   ├── hardcore-community-agent.md
│   │   ├── micro-blog-agent.md
│   │   └ intercept-agent.md
│   └── agent-config.json
├── vision-generator/       # 视觉生成
│   ├── card-generator.js  # Canvas 金句卡片
│   ├── ai-image-generator.js # Flux/SD API
│   ├── html-card-generator.js # HTML-to-Image（新）
│   ├── infographic-generator.js # 智能信息图（新）
│   └── image-styles.json
├── scripts/
│   ├── rewriters/         # AI 改写
│   │   └── text-rewriter.js  # 核心 LLM 改写管线
│   ├── publishers/        # 发布脚本
│   │   ├── api-publisher.js  # API 发布
│   │   ├── rpa-publisher.js # RPA 发布 + 回复
│   │   └── artipub-publisher.js # Artipub 博客多发（新）
│   └── listeners/         # 监听脚本
│       ├── keyword-monitor.js   # 关键词监控
│       ├── intent-filter.js  # 意向度过滤
│       └── dm-monitor.js    # 私信监控
├── data/
│   └── database.js         # SQLite 数据库持久化
├── frontend/
│   └ index.html          # 前端界面
├── config/
│   └ platforms.json     # 平台配置
├── utils/
│   ├── logger.js         # 结构化日志
│   └── rate-limiter.js     # 速率限制 + 队列
└── tests/
    └── index.js          # 测试套件
```

## 🔧 API 文档

### 基础接口

#### POST /api/webhook/matrixgrow-input

输入内容，启动 AI 改写 + 分发

**请求：**
```json
{
  "text": "我做了一个用 AI 自动帮产品改写并分发到全网的工具",
  "platforms": ["all"]
}
```

#### GET /api/health

健康检查，返回服务状态

#### GET /api/stats

获取统计数据

---

### AI 改写接口

#### POST /api/rewrite

仅 AI 文本改写（不发布）

**请求：**
```json
{
  "text": "原始内容",
  "platforms": ["tech-blog", "social-media"]
}
```

---

### 图片生成接口

#### Canvas 生成

- `POST /api/images/quote-card` - 生成金句卡片
- `POST /api/images/tech-cover` - 生成技术博客封面

#### HTML-to-Image 生成

- `POST /api/images/html-quote` - 生成 HTML 金句卡片
- `POST /api/images/html-infographic` - 生成 HTML 信息图
- `POST /api/images/html-data-card` - 生成 HTML 数据卡片

#### 智能信息图

- `POST /api/images/infographic/from-text` - 从文本自动生成信息图
- `POST /api/images/infographic/comparison` - 生成对比图表
- `POST /api/images/infographic/progress` - 生成进度环图表
- `POST /api/images/infographic/timeline` - 生成时间线图表

---

### 发布接口

#### API 发布

- `POST /api/publish` - API 平台发布 (X/LinkedIn/Dev.to/Medium/Mastodon)

#### RPA 发布

- `POST /api/publish/rpa` - RPA 平台发布 (20+ 个平台)

#### Artipub 集成

- `GET /api/artipub/platforms` - 获取 Artipub 支持的平台
- `POST /api/artipub/publish` - Artipub 单平台发布
- `POST /api/artipub/publish-multiple` - Artipub 批量发布
- `GET /api/artipub/health` - Artipub 健康检查

---

### 截流接口

#### GET /api/monitor/check

检查最新帖子，分类意向度

#### POST /api/intercept/run

手动触发截流流程

#### POST /api/intercept/reply

截流回复（调用 RPA）

## 📖 n8n 工作流配置

见 [n8n-workflows/workflows.md](file:///d:/projects/分发与截流/n8n-workflows/workflows.md)

**已配置的工作流：**
1. `core-webhook.json` - 内容分发主流程
2. `smart-intercept.json` - 智能截流闭环
3. `dm-monitor.json` - 私信监控闭环
4. `ai-rewrite-matrix.json` - AI 改写矩阵（新）
5. `multi-publish.json` - 全平台批量发布（新）

## 📌 支持的平台矩阵

### 开发者社区（8 个）

| 平台 | 支持方式 | 发布功能 | 截流功能 |
|------|----------|---------|---------|
| Dev.to | API ✅ | ✅ | ❌ |
| Medium | API/Artipub | ✅ | ❌ |
| Hacker News | RPA | ✅ | ❌ |
| V2EX | RPA | ✅ | ✅ |
| Product Hunt | RPA | ✅ | ❌ |
| 掘金 | Artipub | ✅ | ✅ |
| CSDN | Artipub | ✅ | ❌ |
| 思否 | Artipub | ✅ | ❌ |
| 开源中国 | Artipub | ✅ | ❌ |

### 社交媒体（8 个）

| 平台 | 支持方式 | 发布功能 | 截流功能 |
|------|----------|---------|---------|
| X (Twitter) | API/Ayrshare | ✅ | ✅ |
| Instagram | RPA | ✅ | ❌ |
| Threads | RPA | ✅ | ❌ |
| LinkedIn | API/Ayrshare | ✅ | ❌ |
| 小红书 | RPA | ✅ | ✅ |
| 微博 | RPA | ✅ | ✅ |
| Facebook | RPA | ✅ | ❌ |
| Mastodon | API | ✅ | ❌ |

### 内容/自媒体平台（9 个）

| 平台 | 支持方式 | 发布功能 |
|------|----------|---------|
| 知乎 | RPA | ✅ | ✅ |
| 简书 | RPA | ✅ | ❌ |
| 微信公众号 | RPA | ✅ | ❌ |
| 头条号 | Artipub | ✅ | ❌ |
| B站专栏 | RPA | ✅ | ❌ |
| 百家号 | RPA | ✅ | ❌ |
| 搜狐号 | RPA | ✅ | ❌ |
| 网易号 | RPA | ✅ | ❌ |
| 少数派 | RPA | ✅ | ❌ |
| Indie Hackers | RPA | ✅ | ✅ |

## 📌 各平台发布策略

### V2EX/Reddit - 硬核社区

- **文案风格：** 技术吐槽、分享
- **图片：** 不配图或贴代码
- **反风控策略：** 伪装成技术讨论
- **截流方式：** 无外链，只提私信

### 小红书/Instagram - 视觉社媒

- **文案风格：** 情绪化 + 高饱和度 emoji
- **图片：** 金句卡片 3 张起
- **反风控：** RPA 模拟真人

### X/Twitter - 微型博客

- **文案风格：** Thread 式叙事
- **标签：** #buildinpublic #saas
- **截流：** 只夸赞产品后私信

### 技术博客 - Medium/Dev.to

- **文案风格：** Build in Public 长文
- **图片：** 技术感封面 + 截图
- **策略：** 痛点 → 方案 → 踩坑 → 效果

## 🤖 AI 截流三段式话术

**第一段：共情切入**
> "太真实了，上个月我的 App 上线也是一个用户没有，切 Tab 发到手软..."

**第二段：干货提供**
> "其实小红书/X 严抓一稿多发，你得把文案改成适合平台的风格..."

**第三段：弱化钩子**
> "我后来实在人肉发不动了，自己用工作流拼了个工具，要的话私信我..."

## 📊 项目完成度

**整体完成度：95%**

### 核心功能模块

| 模块 | 完成度 | 状态 |
|------|--------|------|
| AI 文本重写矩阵 | 100% | ✅ |
| AI 视觉生成矩阵 | 100% | ✅ |
| 全网智能截流引擎 | 100% | ✅ |
| 多路分发执行层 | 95% | ✅ |
| n8n 工作流集成 | 90% | ✅ |
| Docker 部署 | 100% | ✅ |

### 已完成任务清单

| 优先级 | 任务 | 状态 |
|--------|------|------|
| P0-1 | docker-compose.yml - 一键启动 n8n + Node | ✅ 完成 |
| P0-2 | X/Twitter Mention 监听 | ✅ 完成 |
| P1-3 | Hacker News 发布器 | ✅ 完成 |
| P1-4 | Instagram 发布器 | ✅ 完成 |
| P1-5 | Threads 发布器 | ✅ 完成 |
| P1-6 | 知乎发布器 | ✅ 完成 |
| P1-7 | 简书发布器 | ✅ 完成 |
| P1-9 | 小红书关键词监控 | ✅ 完成 |
| P1-10 | 知乎关键词监控 | ✅ 完成 |
| P2-11 | Artipub 博客多发集成 | ✅ 完成 |
| P2-12 | HTML-to-Image 卡片生成 | ✅ 完成 |
| P2-13 | 信息图生成 | ✅ 完成 |
| P2-14 | 新增平台 RPA (微博/B站/Facebook/Indie Hackers/少数派/百家号/搜狐号/网易号) | ✅ 完成 |
| P2-15 | Mastodon API 发布 | ✅ 完成 |
| P2-16 | n8n 新工作流 (ai-rewrite-matrix + multi-publish) | ✅ 完成 |
| P2-17 | 更新平台配置和 agent 配置 | ✅ 完成 |

### 待完成任务（P3 产品化）

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P3-14 | 多用户账户系统 | 用户注册/登录/API Key 管理 |
| P3-15 | n8n 工作流产品化封装 | 将工作流暴露为带 UI 的 SaaS 功能 |
| P3-16 | Dify 可选前端 | 参考文档提到 Dify 可作为前端 |
| P3-17 | 用户行为分析 | 发布效果追踪、转化漏斗 |

## 🎓 学习资源

- [项目思路.md](file:///d:/projects/分发与截流/项目思路.md) - 原始产品文档
- [项目推进计划.md](file:///d:/projects/分发与截流/项目推进计划.md) - 差距分析
- [ai-agents/prompts/](file:///d:/projects/分发与截流/ai-agents/prompts/) - 各平台 Prompt 模板