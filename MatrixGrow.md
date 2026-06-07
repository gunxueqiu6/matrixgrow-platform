# MatrixGrow - AI 独立开发者增长引擎

## 项目结构

```
MatrixGrow/
├── n8n-workflows/          # n8n 工作流配置
│   ├── flows/              # 具体工作流 JSON 文件
│   │   ├── core-webhook.json        # 核心 Webhook 入口
│   │   ├── ai-rewrite-matrix.json   # AI 改写矩阵
│   │   ├── smart-intercept.json     # 智能截流
│   │   ├── multi-publish.json       # 多平台分发
│   │   └── dm-monitor.json         # 私信监控
│   └── workflows.md
├── ai-agents/              # AI Agent 配置
│   ├── prompts/            # 各平台 Prompt 模板
│   │   ├── tech-blog-agent.md
│   │   ├── social-media-agent.md
│   │   ├── hardcore-community-agent.md
│   │   ├── micro-blog-agent.md
│   │   └── intercept-agent.md
│   └── agent-config.json
├── vision-generator/       # 视觉生成模块
│   ├── card-generator.js          # Canvas 金句卡片
│   ├── html-card-generator.js     # HTML-to-Image 卡片
│   ├── infographic-generator.js   # 智能信息图
│   ├── ai-image-generator.js      # AI 图像生成
│   └── image-styles.json
├── scripts/
│   ├── publishers/         # 发布脚本
│   │   ├── api-publisher.js       # API 发布 (X/LinkedIn/Dev.to)
│   │   ├── rpa-publisher.js       # RPA 发布 (13+ 平台)
│   │   └── artipub-publisher.js   # Artipub 博客多发
│   ├── listeners/          # 监听脚本
│   │   ├── keyword-monitor.js     # 关键词监控 (8 平台)
│   │   ├── intent-filter.js        # 意向度过滤
│   │   └── dm-monitor.js          # 私信监控
│   └── rewriters/
│       └── text-rewriter.js       # AI 文本改写
├── middleware/             # 中间件
│   └── auth.js                   # 认证中间件
├── routes/                # 路由
│   └── auth.js                   # 认证路由
├── data/                  # 数据层
│   └── database.js               # SQLite 数据库管理
├── utils/                 # 工具
│   ├── logger.js                 # 结构化日志
│   ├── rate-limiter.js          # 速率限制
│   └── jwt.js                   # JWT 认证
├── frontend/              # 前端界面
│   ├── index.html               # 主界面
│   ├── login.html              # 登录页
│   ├── analytics.html          # 数据分析
│   └── js/
│       └── auth.js             # 前端认证
├── config/
│   └── platforms.json           # 27+ 平台配置
└── server.js                    # 主服务器
```

## 核心模块说明

### 1. 核心调度中枢 (n8n)
- Webhook 接收用户一句话输入
- 分发给 5 个常驻 Platform AI Agent
- 协调视觉生成与分发执行
- 支持多平台并行发布

### 2. AI 文本重写矩阵
- Tech Blog Agent: 长文/教程模式 → 掘金、CSDN、Segmentfault
- Hardcore Community Agent: 纯文本吐槽模式 → V2EX、Reddit
- Social Media Agent: 情绪化 Emoji 模式 → Twitter、Facebook、微博
- Micro Blog Agent: 短内容模式 → 小红书、Threads、Instagram
- X/Twitter Agent: Thread/金句模式 → Twitter Thread

### 3. AI 视觉生成矩阵
- **Canvas 金句卡片**: 纯前端高性能渲染
- **HTML-to-Image**: Playwright 驱动的精美卡片
- **智能信息图**: 自动提取数据生成对比图、进度环、时间线
- **AI 图像生成**: Flux/SD API 异步调用（可选）

### 4. 智能截流引擎
- **8 平台全网监控**: V2EX, Reddit, X, 知乎, 小红书, 微博, 掘金, Indie Hackers
- **LLM 意向度过滤**: DeepSeek 智能判断用户需求
- **Actor Agent 三段式回复**: 痛点共鸣 → 方案提供 → 行动引导
- **私信自动化**: 通过关键词监听覆盖，用户主动联系后自动回复

### 5. 多路混合分发层 (27+ 平台)

#### API 渠道 (5)
| 平台 | 方法 | 状态 |
|------|------|------|
| X/Twitter | Twitter API v2 | ✅ |
| LinkedIn | LinkedIn API | ✅ |
| Dev.to | Dev.to API | ✅ |
| Medium | Medium API | ✅ |
| Mastodon | Mastodon API | ✅ |

#### Artipub 博客多发 (7)
| 平台 | 状态 |
|------|------|
| 掘金 | ✅ |
| CSDN | ✅ |
| Segmentfault | ✅ |
| 开源中国 | ✅ |
| 头条号 | ✅ |
| Dev.to (Artipub) | ✅ |
| Medium (Artipub) | ✅ |

#### RPA 浏览器自动化 (16)
| 平台 | 状态 |
|------|------|
| 小红书 | ✅ |
| V2EX | ✅ |
| 微信 | ✅ |
| Hacker News | ✅ |
| 知乎 | ✅ |
| 简书 | ✅ |
| Instagram | ✅ |
| Threads | ✅ |
| Product Hunt | ✅ |
| 微博 | ✅ |
| B站 | ✅ |
| Facebook | ✅ |
| Indie Hackers | ✅ |
| 少数派 | ✅ |
| 百家号 | ✅ |
| 搜狐号 | ✅ |
| 网易号 | ✅ |

### 6. 产品化模块 (P3)

#### 用户认证系统
- JWT 无状态认证
- 用户注册/登录
- API Key 管理

#### 数据分析
- 发布效果追踪
- 转化漏斗分析
- 平台对比报表

#### 工作流管理
- n8n 工作流导入/导出
- 可视化配置面板
- 一键部署

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | SQLite |
| RPA | Playwright |
| 工作流 | n8n |
| AI | DeepSeek / Claude / GPT |
| 图像 | Canvas API + Playwright |
| 部署 | Docker + Docker Compose |

## 快速启动

### n8n 部署 (Docker Compose)
```bash
docker-compose up -d
# MatrixGrow: http://localhost:3000
# n8n: http://localhost:5678
```

### 单独部署
```bash
# 安装依赖
npm install

# 启动服务
npm start
```

### 环境变量
```env
# AI 配置
DEEPSEEK_API_KEY=your-deepseek-key
ANTHROPIC_API_KEY=your-claude-key
OPENAI_API_KEY=your-gpt-key

# 平台配置
TWITTER_BEARER_TOKEN=your-twitter-token
REDDIT_ACCESS_TOKEN=your-reddit-token
LINKEDIN_ACCESS_TOKEN=your-linkedin-token

# Artipub (博客多发)
ARTIPUB_API_URL=http://localhost:3003
ARTIPUB_API_KEY=your-artipub-key

# n8n
N8N_USER=admin
N8N_PASSWORD=your-password
```

## 项目完成度

**整体完成度: 95%**

- ✅ AI 文本重写矩阵 (100%)
- ✅ AI 视觉生成矩阵 (100%)
- ✅ 全网智能截流引擎 (100%)
- ✅ 多路分发执行层 (95%)
- ✅ n8n 工作流集成 (90%)
- ✅ Docker 部署 (100%)
- ⏳ 多用户账户系统 (待产品化)
- ⏳ 工作流可视化配置 (待产品化)
