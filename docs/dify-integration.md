# Dify 集成文档

MatrixGrow 可通过 Dify 作为可选前端，提供更友好的 AI 应用交互界面。

## 概述

[Dify](https://dify.ai) 是一个开源 LLM 应用开发平台。MatrixGrow 的 AI 能力（文本改写、截流回复、意图识别）可以封装为 Dify 应用，通过 Dify 的聊天界面或 API 对外暴露。

## 集成架构

```
用户 → Dify 聊天界面 → Dify Workflow → MatrixGrow API → 发布/截流
```

## Dify 应用类型

### 1. 内容分发助手（Chatbot）

**用途：** 用户输入产品介绍，AI 自动改写并全网分发。

**Dify 工作流步骤：**
1. **输入节点** — 接收用户的产品介绍文本
2. **LLM 节点** — 分析内容类型，推荐发布平台
3. **HTTP 请求节点** → 调用 MatrixGrow webhook：
   ```
   POST http://localhost:3000/api/webhook/matrixgrow-input
   ```
4. **答案节点** — 返回分发结果摘要

### 2. 截流监控助手（Agent）

**用途：** 自动监听各平台关键词，识别高意向帖子并回复。

**Dify 工作流步骤：**
1. **定时触发** — 每 10 分钟执行
2. **HTTP 请求节点** → 获取监控数据：
   ```
   GET http://localhost:3000/api/monitor/check
   ```
3. **条件分支** — 如果 `highIntent.length > 0`
4. **迭代节点** — 遍历高意向帖子
5. **LLM 节点** — 生成截流回复
6. **HTTP 请求节点** → 发布回复：
   ```
   POST http://localhost:3000/api/intercept/reply
   ```

### 3. 智能配图生成器

**用途：** 输入文案，生成金句卡片和信息图。

直接调用 MatrixGrow 的图片生成 API：
```
POST http://localhost:3000/api/images/html-quote
POST http://localhost:3000/api/images/infographic/from-text
```

## Dify 部署

### Docker 部署

```bash
git clone https://github.com/langgenius/dify.git
cd dify/docker
docker compose up -d
```

Dify 默认运行在 `http://localhost:3001`。

### 与 MatrixGrow 共存

如果 Dify 和 MatrixGrow 在同一台机器，注意端口不冲突：
- MatrixGrow: `3000`
- Dify: `3001`
- n8n: `5678`

可以在 `docker-compose.yml` 中添加 Dify 服务实现三服务编排。

## API Key 配置

在 Dify 的 HTTP 请求节点中配置 MatrixGrow 认证：

1. 在 MatrixGrow 注册用户并创建 API Key：
   ```
   POST /api/auth/register
   POST /api/auth/api-keys
   ```
2. 在 Dify 的 **API 密钥** 设置中添加 `Authorization: Bearer <key>`

## Dify 工作流模板

MatrixGrow 的 AI Agent 提示词（`ai-agents/prompts/`）可以直接用作 Dify LLM 节点的 System Prompt：

| MatrixGrow Agent | Dify 应用类型 | 提示词文件 |
|------------------|--------------|-----------|
| tech-blog-agent | 技术文章改写 | `tech-blog-agent.md` |
| social-media-agent | 社交媒体文案 | `social-media-agent.md` |
| intercept-agent | 截流回复生成 | `intercept-agent.md` |
| hardcore-community-agent | 硬核社区文案 | `hardcore-community-agent.md` |
| micro-blog-agent | 短文/金句 | `micro-blog-agent.md` |

## 对比：n8n vs Dify

| 特性 | n8n | Dify |
|------|-----|------|
| 定位 | 自动化工作流 | LLM 应用平台 |
| 可视化 | 拖拽式工作流 | 聊天界面 + 工作流 |
| LLM 集成 | 通过 HTTP 节点 | 内置 LLM 节点 |
| 适用场景 | 定时任务、多步骤编排 | AI 聊天助手、知识库问答 |
| MatrixGrow 角色 | 核心调度引擎 | 可选前端 |

当前 MatrixGrow 以 n8n 为核心调度引擎，Dify 作为面向用户的可选前端界面。
