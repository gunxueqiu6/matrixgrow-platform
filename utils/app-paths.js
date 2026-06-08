const path = require('path');
const fs = require('fs');

let isElectronMode = false;
let userDataPath = null;

function setElectronMode(isElectron, userData) {
  isElectronMode = isElectron;
  userDataPath = userData;
}

function getDataPath(filename = '') {
  if (isElectronMode && userDataPath) {
    const dataDir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return filename ? path.join(dataDir, filename) : dataDir;
  }
  
  return filename ? path.join(process.cwd(), 'data', filename) : path.join(process.cwd(), 'data');
}

function getLogsPath(filename = '') {
  if (isElectronMode && userDataPath) {
    const logsDir = path.join(userDataPath, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    return filename ? path.join(logsDir, filename) : logsDir;
  }
  
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return filename ? path.join(logsDir, filename) : logsDir;
}

function getCookiesPath(filename = '') {
  if (isElectronMode && userDataPath) {
    const cookiesDir = path.join(userDataPath, 'cookies');
    if (!fs.existsSync(cookiesDir)) {
      fs.mkdirSync(cookiesDir, { recursive: true });
    }
    return filename ? path.join(cookiesDir, filename) : cookiesDir;
  }
  
  const cookiesDir = path.join(process.cwd(), 'cookies');
  if (!fs.existsSync(cookiesDir)) {
    fs.mkdirSync(cookiesDir, { recursive: true });
  }
  return filename ? path.join(cookiesDir, filename) : cookiesDir;
}

function isElectron() {
  return isElectronMode;
}

module.exports = {
  setElectronMode,
  getDataPath,
  getLogsPath,
  getCookiesPath,
  isElectron
};
