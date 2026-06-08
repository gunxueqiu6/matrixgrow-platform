/**
 * Logger - 结构化日志系统
 * 支持多级别日志、文件轮转、JSON 格式输出
 */

const fs = require('fs');
const path = require('path');
const { getLogsPath } = require('./app-paths');

class Logger {
  constructor(config = {}) {
    this.config = {
      level: config.level || process.env.LOG_LEVEL || 'info',
      logDir: config.logDir || getLogsPath(),
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles || 5,
      consoleEnabled: config.consoleEnabled !== false,
      fileEnabled: config.fileEnabled !== false,
      ...config
    };

    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    this.currentLevel = this.levels[this.config.level] || this.levels.info;

    // 确保日志目录存在
    if (this.config.fileEnabled) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }

    this.currentFileSize = 0;
    this.currentFileIndex = 0;
  }

  shouldLog(level) {
    return this.levels[level] >= this.currentLevel;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;

    return {
      timestamp,
      level,
      pid,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      ...meta
    };
  }

  writeToFile(message) {
    if (!this.config.fileEnabled) return;

    const logString = JSON.stringify(message) + '\n';
    const bytesWritten = Buffer.byteLength(logString, 'utf8');

    // 检查是否需要轮转文件
    if (this.currentFileSize + bytesWritten > this.config.maxFileSize) {
      this.currentFileIndex++;
      this.currentFileSize = 0;

      // 删除最旧的文件
      if (this.currentFileIndex >= this.config.maxFiles) {
        const oldestFile = path.join(this.config.logDir, `matrixgrow.${this.currentFileIndex - this.config.maxFiles}.log`);
        try {
          fs.unlinkSync(oldestFile);
        } catch (e) {
          // 文件不存在，忽略
        }
        this.currentFileIndex = 0;
      }
    }

    const fileName = this.currentFileIndex === 0 
      ? 'matrixgrow.log' 
      : `matrixgrow.${this.currentFileIndex}.log`;

    const filePath = path.join(this.config.logDir, fileName);
    fs.appendFileSync(filePath, logString);
    this.currentFileSize += bytesWritten;
  }

  writeToConsole(message, level) {
    if (!this.config.consoleEnabled) return;

    const colors = {
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m'
    };
    const reset = '\x1b[0m';

    const logLine = `[${message.timestamp}] [${message.level.toUpperCase()}] ${message.message}`;
    
    if (level === 'error') {
      console.error(`${colors[level]}${logLine}${reset}`);
    } else {
      console.log(`${colors[level]}${logLine}${reset}`);
    }
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);
    
    this.writeToConsole(formattedMessage, level);
    this.writeToFile(formattedMessage);

    return formattedMessage;
  }

  debug(message, meta = {}) {
    return this.log('debug', message, meta);
  }

  info(message, meta = {}) {
    return this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    return this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    return this.log('error', message, meta);
  }

  // 特殊日志方法

  request(req) {
    this.info(`Request: ${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  response(req, statusCode, durationMs) {
    this.info(`Response: ${req.method} ${req.path} ${statusCode} (${durationMs}ms)`);
  }

  publish(platform, status, details = {}) {
    this.info(`Publish ${status}: ${platform}`, details);
  }

  intercept(platform, intent, action) {
    this.info(`Intercept ${action}: ${platform} (intent: ${intent})`);
  }

  dm(platform, action, details = {}) {
    this.info(`DM ${action}: ${platform}`, details);
  }

  errorWithStack(error, context = '') {
    this.error(`${context}: ${error.message}`, {
      stack: error.stack,
      name: error.name
    });
  }
}

module.exports = { Logger };