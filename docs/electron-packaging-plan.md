# MatrixGrow Electron 打包方案

## Context

将 MatrixGrow Express.js Web 应用打包为单个 `.exe` 文件，用户双击即可运行。已逆向分析竞品（小V猫、推兔），确认均为 **Electron + electron-builder + NSIS** 方案。

## 架构

```
electron/main.js (主进程)
  ├── 单实例锁 (app.requestSingleInstanceLock)
  ├── 中文应用菜单 (文件/编辑/视图/帮助, autoHideMenuBar)
  ├── 系统托盘 (Tray) + 最小化到托盘
  ├── fork → server.js (Express HTTP 服务, 子进程)
  │     ├── SQLite → node:sqlite (DatabaseSync, Node.js 内置, 零编译)
  │     ├── Playwright (按需下载, 功能门控)
  │     └── n8n (可选外部服务)
  └── BrowserWindow → http://localhost:PORT (应用窗口)
```

- **不内嵌 n8n** — 需要 Docker/JVM，作为可选外部依赖
- **Playwright 按需下载** — 首次使用 RPA 功能时 `npx playwright install chromium`
- **SQLite 零依赖** — 使用 Node.js 内置 `node:sqlite` (DatabaseSync)，无需编译原生模块

## 文件清单

### 新建文件

| 文件 | 用途 |
|------|------|
| `electron/main.js` | 主进程：单实例锁、中文菜单、托盘、窗口管理、fork Express |
| `electron/preload.js` | 预加载脚本：暴露 `electronAPI` 到渲染进程 |
| `utils/app-paths.js` | 路径解析：Electron 模式用 `app.getPath('userData')` |
| `scripts/build-exe.mjs` | 一键构建：npm install → electron-rebuild → electron-builder |
| `electron-builder.yml` | electron-builder 配置：NSIS + 中文安装向导 |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `package.json` | `main: "electron/main.js"`、build 脚本、electron/electron-builder devDependencies |
| `server.js` | `ELECTRON_RUN=1` 检测；监听随机端口；通过 `process.send({ port })` IPC 通信 |
| `data/database.js` | `better-sqlite3` → `node:sqlite` (DatabaseSync)；`pragma()` → `exec('PRAGMA ...')` |
| `utils/logger.js` | 日志目录改用 `app-paths.js` |
| `scripts/publishers/rpa-publisher.js` | cookies 路径迁移 + Playwright 按需安装提示 |

## 当前 electron-builder 配置

```yaml
appId: com.matrixgrow.app
productName: MatrixGrow
directories:
  output: dist
win:
  target: nsis
  icon: frontend/favicon.ico
  signAndEditExecutable: false    # 跳过 winCodeSign 下载
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: frontend/favicon.ico
  uninstallerIcon: frontend/favicon.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: "MatrixGrow"
  language: "2052"                # 简体中文安装向导
asarUnpack:
  - "node_modules/@napi-rs/canvas/**"
files:
  - electron/**/*
  - frontend/**/*
  - routes/**/*
  - utils/**/*
  - data/**/*
  - scripts/**/*
  - ai-agents/**/*
  - config/**/*
  - middleware/**/*
  - adapters/**/*
  - vision-generator/**/*
  - n8n-nodes/**/*
  - server.js
  - package.json
  - node_modules/**/*
  - "!node_modules/**/*.{md,MD,txt,TXT}"
  - "!node_modules/**/test{,s}/**"
  - "!node_modules/**/tests/**"
  - "!node_modules/**/.git/**"
  - "!node_modules/**/*.tsbuildinfo"
compression: maximum
```

## 构建流程

```bash
node scripts/build-exe.mjs
```

1. 检查 Node.js 环境
2. `npm install` — 安装依赖
3. `npx @electron/rebuild -f -w @napi-rs/canvas -m .` — 重建 @napi-rs/canvas 匹配 Electron ABI
4. `npx electron-builder --win --config electron-builder.yml` — 打包 NSIS 安装器
   - `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
   - `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`
5. 输出：`dist/MatrixGrow Setup 1.0.0.exe` (~92MB)

## 关键技术决策

| 决策 | 原因 |
|------|------|
| `better-sqlite3` → `node:sqlite` | Node 24 无预编译二进制；node:sqlite 是内置模块，API 兼容，零编译 |
| `npm ci` → `npm install` | npm ci 在 node_modules 有 electron 锁文件时 EBUSY |
| `signAndEditExecutable: false` | 跳过 winCodeSign 从 GitHub 下载（国内阻断） |
| 镜像源 | npm/cnpm 镜像 + ELECTRON_MIRROR + ELECTRON_BUILDER_BINARIES_MIRROR |
| NSIS `language: "2052"` | 简体中文安装向导 |
| `autoHideMenuBar: true` + 中文菜单 | 默认隐藏菜单栏，按 Alt 显示中文菜单（文件/编辑/视图/帮助） |

## 已验证问题及修复

1. **better-sqlite3 编译失败** (Node 24 + ClangCL 未安装) → 用 `node:sqlite` 替代
2. **GitHub 下载阻断** → 全线使用 npmmirror.com 镜像
3. **electron-builder.yml `win.arch` 报错** → 移除（v25 不支持）
4. **图标太小 16x16** → ImageMagick 生成 256x256 多分辨率 ICO
5. **安装向导是英文** → NSIS `language: "2052"`
6. **应用菜单栏是英文** → 自定义中文菜单 + `autoHideMenuBar: true`

## 验证方案

1. **开发模式**：`npx electron .` — 确认窗口打开、服务启动、中文菜单、托盘图标
2. **构建验证**：`node scripts/build-exe.mjs` — 确认生成 exe 安装器
3. **安装测试**：
   - 安装向导显示中文
   - 双击启动 → 托盘图标出现 → 浏览器窗口加载 MatrixGrow 界面
   - 菜单栏按 Alt 显示中文菜单（文件/编辑/视图/帮助）
   - 设置页面数据库读写正常
   - 工作流导入功能可用（Coze/Dify → n8n）
   - 关闭窗口 → 最小化到托盘 → 右键"退出"完全关闭
4. **Playwright 按需下载**：触发 RPA 发布 → 提示安装 Chromium → 安装后功能正常
