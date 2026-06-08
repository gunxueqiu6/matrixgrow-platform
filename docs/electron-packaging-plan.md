# MatrixGrow Electron 打包方案

## Context

将 MatrixGrow Express.js Web 应用打包为单个 `.exe` 文件，用户双击即可运行（傻瓜式操作）。已逆向分析 `F:\应用程序\多渠道分发` 下的竞品（小V猫 v0.3.3/v1.0.0、推兔 public 1.0.9），确认均为 **Electron + electron-builder + NSIS v2.51** 方案，32 位，体积 178-220MB。

## 架构

```
electron/main.js (主进程)
  ├── 单实例锁 (app.requestSingleInstanceLock)
  ├── 系统托盘 (Tray) + 最小化到托盘
  ├── fork → server.js (Express HTTP 服务, 子进程)
  │     ├── SQLite (data/matrixgrow.db)
  │     ├── Playwright (按需下载, 功能门控)
  │     └── n8n (可选外部进程, docker-compose 或本地安装)
  └── BrowserWindow → http://localhost:PORT (应用窗口)
```

- **不内嵌 n8n** — n8n 需要 Java/JVM 运行时，体积过大（>1GB），作为可选外部依赖
- **Playwright 按需下载** — 仅在用户首次使用 RPA 发布功能时通过 `npx playwright install chromium` 安装

## 文件变更清单

### 新建文件

| 文件 | 用途 |
|------|------|
| `electron/main.js` | Electron 主进程：单实例锁、托盘、窗口管理、fork Express、协议注册 |
| `electron/preload.js` | 预加载脚本：暴露 `electronAPI` 到渲染进程（托盘通知、窗口控制） |
| `utils/app-paths.js` | 集中化路径解析：Electron 模式用 `app.getPath('userData')`，否则 CWD 相对路径 |
| `scripts/build-exe.mjs` | 一键构建脚本：检查环境 → npm install → electron-rebuild → electron-builder |
| `electron-builder.yml` | electron-builder 配置：NSIS 输出、asar 打包、原生模块解包规则 |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `package.json` | 添加 `main: "electron/main.js"`、build 脚本、electron/electron-builder devDependencies |
| `server.js` | 检测 Electron 模式(环境变量 `ELECTRON_RUN=1`)；不监听外部端口仅 IPC 通信；随机端口避免冲突；处理 shutdown 信号 |
| `data/database.js` | `DATABASE_PATH` 默认值改用 `app-paths.js` 的 `getDataPath('matrixgrow.db')` |
| `utils/logger.js` | 日志目录改用 `app-paths.js` 的 `getDataPath('logs')` |
| `scripts/publishers/rpa-publisher.js` | cookies 路径迁移 + Playwright 未安装时的友好错误提示 |
| `.gitignore` | 添加 `dist/`、`build/`、`*.exe` |

## 关键技术风险与对策

| 风险 | 等级 | 对策 |
|------|------|------|
| `sqlite3` (C++ addon) 需匹配 Electron ABI | 中 | `@electron/rebuild` 自动重建，electron-builder 配置 `asarUnpack` |
| `@napi-rs/canvas` (Rust N-API) 跨平台兼容 | 低-中 | N-API 二进制兼容性好，仍需 `asarUnpack` |
| `playwright` Chromium 体积 ~150MB | 高 | 不打包进 exe，运行时按需下载 `npx playwright install chromium`，功能门控 |
| n8n 依赖 Docker/Node 环境 | 高 | 不打包，作为可选外部服务。应用内提供 docker-compose 一键启动指引 |
| 端口冲突 (3000) | 低 | Electron 模式下服务器监听随机端口，通过 IPC 告知主进程 |

## electron-builder 配置要点

```yaml
appId: com.matrixgrow.app
productName: MatrixGrow
directories:
  output: dist
win:
  target: nsis
  icon: frontend/favicon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: frontend/favicon.ico
asarUnpack:
  - "node_modules/sqlite3/**"
  - "node_modules/@napi-rs/canvas/**"
files:
  - electron/**/*
  - frontend/**/*
  - routes/**/*
  - utils/**/*
  - data/**/*
  - scripts/**/*
  - server.js
  - package.json
  - node_modules/**/*
```

## 构建流程 (scripts/build-exe.mjs)

1. `npm ci --production` — 安装运行时依赖
2. `npx @electron/rebuild -f -w sqlite3 -m .` — 重建原生模块匹配 Electron ABI
3. `npx electron-builder --win --config electron-builder.yml` — 打包 NSIS 安装器
4. 输出：`dist/MatrixGrow Setup x.x.x.exe` (~200MB)

## 验证方案

1. **开发模式验证**：`npx electron .` — 确认应用窗口打开、Express 服务启动、托盘图标显示
2. **构建验证**：运行 `node scripts/build-exe.mjs`，确认生成 `.exe` 安装器
3. **安装测试**：在干净 Windows 环境安装并运行，验证：
   - 双击 exe 启动 → 托盘图标出现 → 浏览器窗口加载正常
   - 设置页面可正常操作（数据库读写正常）
   - 工作流导入功能可用（Coze/Dify → n8n）
   - 关闭窗口 → 最小化到托盘 → 右键退出完全关闭
4. **Playwright 按需下载**：触发 RPA 发布功能 → 确认提示安装 Chromium → 安装后功能正常
