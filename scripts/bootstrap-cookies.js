/**
 * Cookie Bootstrapper - Cookie 初始化引导流程
 * 帮助用户首次设置平台登录 Cookie
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class CookieBootstrapper {
  constructor(config = {}) {
    this.config = {
      cookiesPath: config.cookiesPath || './cookies',
      headless: config.headless === undefined ? false : config.headless,
      ...config
    };
    this.browser = null;
  }

  async initialize() {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 引导用户登录并保存 Cookie
   */
  async bootstrapPlatform(platform) {
    const platforms = {
      v2ex: {
        name: 'V2EX',
        loginUrl: 'https://www.v2ex.com/signin',
        checkUrl: 'https://www.v2ex.com/',
        checkSelector: 'a[href="/signout"]',
        instructions: '请在打开的浏览器中登录你的 V2EX 账号，登录成功后 Cookie 将自动保存。'
      },
      reddit: {
        name: 'Reddit',
        loginUrl: 'https://www.reddit.com/login',
        checkUrl: 'https://www.reddit.com/',
        checkSelector: 'a[href="/user"]',
        instructions: '请在打开的浏览器中登录你的 Reddit 账号，登录成功后 Cookie 将自动保存。'
      },
      x: {
        name: 'X (Twitter)',
        loginUrl: 'https://x.com/i/flow/login',
        checkUrl: 'https://x.com/',
        checkSelector: 'a[href="/home"]',
        instructions: '请在打开的浏览器中登录你的 X/Twitter 账号，登录成功后 Cookie 将自动保存。'
      },
      xiaohongshu: {
        name: '小红书',
        loginUrl: 'https://creator.xiaohongshu.com/login',
        checkUrl: 'https://creator.xiaohongshu.com/',
        checkSelector: '.user-info',
        instructions: '请在打开的浏览器中登录你的小红书账号，登录成功后 Cookie 将自动保存。'
      },
      zhihu: {
        name: '知乎',
        loginUrl: 'https://www.zhihu.com/signin',
        checkUrl: 'https://www.zhihu.com/',
        checkSelector: '.ProfileAvatar',
        instructions: '请在打开的浏览器中登录你的知乎账号，登录成功后 Cookie 将自动保存。'
      },
      weixin: {
        name: '微信公众号',
        loginUrl: 'https://mp.weixin.qq.com/',
        checkUrl: 'https://mp.weixin.qq.com/',
        checkSelector: '#userinfo',
        instructions: '请在打开的浏览器中登录你的微信公众号账号，登录成功后 Cookie 将自动保存。'
      }
    };

    const platformConfig = platforms[platform];
    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    if (!this.browser) {
      await this.initialize();
    }

    const context = await this.browser.newContext({
      viewport: platform === 'xiaohongshu' ? { width: 390, height: 844 } : { width: 1200, height: 800 }
    });
    const page = await context.newPage();

    console.log(`\n🚀 正在引导 ${platformConfig.name} Cookie 设置`);
    console.log(`📝 ${platformConfig.instructions}`);

    try {
      // 导航到登录页面
      await page.goto(platformConfig.loginUrl, { waitUntil: 'networkidle' });

      // 等待用户登录（最多等待 5 分钟）
      const timeout = 5 * 60 * 1000; // 5 分钟
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        await page.waitForTimeout(3000); // 每 3 秒检查一次

        // 导航到检查页面
        try {
          await page.goto(platformConfig.checkUrl, { waitUntil: 'networkidle', timeout: 10000 });
        } catch (e) {
          continue;
        }

        // 检查是否已登录
        const loggedIn = await page.$(platformConfig.checkSelector);
        if (loggedIn) {
          console.log(`✅ ${platformConfig.name} 登录成功！`);
          
          // 保存 Cookie
          const cookies = await context.cookies();
          await this.saveCookies(cookies, platform);
          
          console.log(`✅ Cookie 已保存到: ${this.config.cookiesPath}/${platform}.json`);
          return { success: true, platform, cookiesCount: cookies.length };
        }
      }

      throw new Error('登录超时，请重试');
    } finally {
      await context.close();
    }
  }

  /**
   * 保存 Cookie 到文件
   */
  async saveCookies(cookies, platform) {
    const dir = this.config.cookiesPath;
    await fs.mkdir(dir, { recursive: true });
    
    const cookiesFile = path.join(dir, `${platform}.json`);
    await fs.writeFile(cookiesFile, JSON.stringify(cookies, null, 2));
  }

  /**
   * 检查平台 Cookie 是否已配置
   */
  async checkCookieStatus(platform) {
    const cookiesFile = path.join(this.config.cookiesPath, `${platform}.json`);
    try {
      const data = await fs.readFile(cookiesFile, 'utf-8');
      const cookies = JSON.parse(data);
      return {
        configured: true,
        count: cookies.length,
        lastModified: (await fs.stat(cookiesFile)).mtime
      };
    } catch {
      return { configured: false, count: 0 };
    }
  }

  /**
   * 检查所有平台的 Cookie 状态
   */
  async checkAllCookies() {
    const platforms = ['v2ex', 'reddit', 'x', 'xiaohongshu', 'zhihu', 'weixin'];
    const results = {};

    for (const platform of platforms) {
      results[platform] = await this.checkCookieStatus(platform);
    }

    return results;
  }

  /**
   * 交互式引导流程
   */
  async startInteractiveGuide() {
    console.log('\n' + '='.repeat(50));
    console.log('🍪 MatrixGrow Cookie 配置向导');
    console.log('='.repeat(50));
    console.log('\n此向导将帮助你配置各平台的登录 Cookie。');
    console.log('请确保你已经准备好各平台的账号信息。');
    console.log('\n当前 Cookie 状态:');

    // 显示当前状态
    const status = await this.checkAllCookies();
    for (const [platform, info] of Object.entries(status)) {
      const icon = info.configured ? '✅' : '❌';
      console.log(`  ${icon} ${platform}: ${info.configured ? '已配置' : '未配置'}`);
    }

    // 获取需要配置的平台
    const unconfigured = Object.entries(status)
      .filter(([, info]) => !info.configured)
      .map(([platform]) => platform);

    if (unconfigured.length === 0) {
      console.log('\n🎉 所有平台 Cookie 已配置完成！');
      await this.close();
      return;
    }

    console.log(`\n需要配置的平台: ${unconfigured.join(', ')}`);
    console.log('\n开始配置...');

    for (const platform of unconfigured) {
      try {
        await this.bootstrapPlatform(platform);
      } catch (error) {
        console.log(`❌ ${platform} 配置失败: ${error.message}`);
      }
    }

    await this.close();
    console.log('\n🎉 Cookie 配置向导完成！');
  }
}

// 命令行入口
async function main() {
  const platform = process.argv[2];
  const bootstrapper = new CookieBootstrapper();

  try {
    if (platform) {
      // 配置单个平台
      await bootstrapper.bootstrapPlatform(platform);
    } else {
      // 交互式引导
      await bootstrapper.startInteractiveGuide();
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await bootstrapper.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { CookieBootstrapper };