# MatrixGrow 快速启动指南

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装依赖
npm install
```

### 2. 配置环境变量

```bash
# 复制并配置 .env 文件
cp .env.example .env
# 编辑 .env 填入你的 API keys
```

### 3. 初始化数据库

```bash
# 数据库会自动在第一次启动时创建
```

### 4. 启动服务

```bash
# 方式 1: 仅启动 Node.js 服务
npm start

# 方式 2: 使用 Docker 启动（推荐）
docker-compose up -d
```

## 📊 项目架构

```
MatrixGrow/
├── server.js                    # 主服务器
├── ai-agents/                # AI 代理配置
├── config/                    # 平台配置
├── data/                     # 数据库管理
├── scripts/
│   ├── publishers/          # 发布器
│   └── listeners/         # 监听器
├── vision-generator/         # 视觉生成
├── n8n-workflows/           # 工作流配置
└── utils/                   # 工具模块
```

## 🔌 API 端点

| 端点 | 功能 |
|------|------|
| / | 前端界面 |
| /api/rewrite | AI 文本改写 |
| /api/publish | 发布内容 |
| /api/monitor | 关键词监听 |
| /api/vision | 视觉生成 |
| /api/stats | 统计数据 |

## 🎨 支持平台（27+）

### API 发布
- X (Twitter)
- LinkedIn
- Dev.to
- Medium
- Mastodon

### Artipub 发布
- 掘金
- CSDN
- 思否
- 开源中国
- 头条号

### RPA 发布
- 小红书
- V2EX
- 微信
- Hacker News
- 知乎
- 简书
- Instagram
- Threads
- Product Hunt
- 微博
- B站
- Facebook
- Indie Hackers
- 少数派
- 百家号
- 搜狐号
- 网易号

### 关键词监听
- V2EX
- Reddit
- X
- 知乎
- 小红书
- 微博
- 掘金
- Indie Hackers

## 📝 开发命令

```bash
# 开发模式
npm run dev

# 测试
npm test

# 检查依赖
npm audit
```
