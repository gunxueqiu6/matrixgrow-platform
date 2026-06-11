const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow = null;
let tray = null;
let serverProcess = null;
let serverPort = null;

const isDev = !app.isPackaged;

function buildAppMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => mainWindow.loadURL(`http://localhost:${serverPort}/dashboard.html`) },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { app.isQuitting = true; app.quit(); } }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '刷新', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.webContents.reload() },
        { label: '强制刷新', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '开发者工具', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 MatrixGrow',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 MatrixGrow',
              message: `MatrixGrow v${app.getVersion()}`,
              detail: 'AI 内容分发与流量截流引擎\n\n导入 Coze/Dify 工作流到 n8n\n一键分发到 27+ 平台\nAI 改写 + 智能截流回复'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: path.join(__dirname, '../frontend/favicon.ico')
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../frontend/favicon.ico');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: '退出', click: () => {
      app.isQuitting = true;
      if (serverProcess) {
        serverProcess.kill();
      }
      app.quit();
    }}
  ]);

  tray.setToolTip('MatrixGrow');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
}

function startServer() {
  const env = {
    ...process.env,
    ELECTRON_RUN: '1',
    USER_DATA_PATH: app.getPath('userData')
  };

  serverProcess = fork(path.join(__dirname, '../server.js'), [], {
    env,
    stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
    execArgv: ['--experimental-sqlite']
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data.toString()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    console.error(`[Server Error] ${msg}`);
    // 如果服务崩溃，窗口会一直白屏，显示错误对话框
    if (msg.includes('Error') || msg.includes('Cannot find module')) {
      const { dialog } = require('electron');
      dialog.showErrorBox('服务启动失败', msg.substring(0, 500));
    }
  });

  serverProcess.on('message', (message) => {
    if (message && message.port) {
      serverPort = message.port;
      const url = `http://localhost:${serverPort}`;
      if (mainWindow) {
        mainWindow.loadURL(url);
      }
    }
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
    if (code !== 0 && !serverPort) {
      const { dialog } = require('electron');
      dialog.showErrorBox('服务异常退出', `MatrixGrow 服务进程意外退出 (退出码: ${code})\n\n请尝试重新启动应用或联系技术支持。`);
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    buildAppMenu();
    createWindow();
    createTray();
    startServer();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-server-port', () => serverPort);
ipcMain.handle('minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});
ipcMain.handle('get-app-info', () => ({
  name: app.getName(),
  version: app.getVersion(),
  electron: process.versions.electron,
  node: process.versions.node,
  chrome: process.versions.chrome,
  platform: process.platform,
  arch: process.arch
}));
