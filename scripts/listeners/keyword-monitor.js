/**
 * Keyword Monitor - Monitors various platforms for target keywords
 * Monitors: V2EX, Reddit, 知乎, 小红书, X/Twitter, 微博, 掘金, Indie Hackers
 */

const axios = require('axios');
const { chromium } = require('playwright');

class KeywordMonitor {
  constructor(config = {}) {
    this.config = {
      checkInterval: config.checkInterval || 600000, // 10 minutes
      platforms: config.platforms || ['v2ex', 'reddit', 'zhihu', 'xiaohongshu', 'x', 'weibo', 'juejin', 'indiehackers'],
      headless: config.headless ?? true,
      cookiesPath: config.cookiesPath || './cookies',
      ...config
    };

    this.keywords = {
      v2ex: ['推广', '流量', '独立开发', '获客', '冷启动', '用户增长'],
      reddit: ['no traffic', 'how to market', 'saas launch', 'first users', 'marketing help'],
      zhihu: ['独立开发者', '产品推广', '冷启动', '用户增长', '获客'],
      xiaohongshu: ['独立开发', '获客', '推广', '变现', '流量'],
      x: ['how to market', 'saas launch', 'no traffic', 'first users', 'build in public'],
      weibo: ['独立开发', '获客', '增长', '冷启动', '流量', '推广'],
      juejin: ['独立开发', '产品推广', '增长', '冷启动', '流量'],
      indiehackers: ['no users', 'need users', 'how to grow', 'first users', 'saas launch', 'indie hacker']
    };

    this.avoidKeywords = {
      v2ex: ['广告', '推广产品'],
      reddit: ['spam', 'promotion'],
      zhihu: ['广告'],
      xiaohongshu: ['广告'],
      x: ['spam', 'promotion'],
      weibo: ['广告', '推广'],
      juejin: ['广告'],
      indiehackers: ['paid marketing', 'promotion']
    };

    this.recentlySeen = new Set();
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async checkAllPlatforms() {
    const results = [];

    for (const platform of this.config.platforms) {
      try {
        const posts = await this[`check${this.capitalize(platform)}`]();
        const filtered = this.filterPosts(posts, platform);
        results.push(...filtered);
      } catch (error) {
        console.error(`Error checking ${platform}:`, error.message);
      }
    }

    return results;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  filterPosts(posts, platform) {
    const keywords = this.keywords[platform] || [];
    const avoidWords = this.avoidKeywords[platform] || [];

    return posts.filter(post => {
      // Check if already processed
      if (this.recentlySeen.has(post.id)) {
        return false;
      }

      // Check for target keywords
      const text = `${post.title} ${post.content}`.toLowerCase();
      const hasKeyword = keywords.some(kw => text.includes(kw.toLowerCase()));

      // Check for avoid keywords
      const hasAvoid = avoidWords.some(kw => text.includes(kw.toLowerCase()));

      if (hasKeyword && !hasAvoid) {
        this.recentlySeen.add(post.id);
        return true;
      }

      return false;
    });
  }

  async checkV2EX() {
    const response = await axios.get('https://www.v2ex.com/api/topics/latest.json', {
      timeout: 10000
    });

    return response.data.map(topic => ({
      id: `v2ex_${topic.id}`,
      platform: 'v2ex',
      title: topic.title,
      content: '', // V2EX API doesn't return content in list
      url: `https://www.v2ex.com/t/${topic.id}`,
      author: topic.member?.username,
      created_at: new Date(topic.created * 1000).toISOString()
    }));
  }

  async checkReddit() {
    const subreddits = ['r/saas', 'r/indiehackers', 'r/startups'];
    const results = [];

    for (const subreddit of subreddits) {
      try {
        const response = await axios.get(`https://www.reddit.com${subreddit}/new.json?limit=20`, {
          timeout: 10000,
          headers: {
            'User-Agent': 'MatrixGrow/1.0'
          }
        });

        const posts = response.data.data.children.map(child => ({
          id: `reddit_${child.data.id}`,
          platform: 'reddit',
          title: child.data.title,
          content: child.data.selftext,
          url: `https://reddit.com${child.data.permalink}`,
          author: child.data.author,
          subreddit,
          created_at: new Date(child.data.created_utc * 1000).toISOString()
        }));

        results.push(...posts);
      } catch (error) {
        console.error(`Error checking Reddit ${subreddit}:`, error.message);
      }
    }

    return results;
  }

  async checkX() {
    // Check if we have Twitter API keys
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      console.log('Twitter API key not configured, skipping');
      return [];
    }

    const results = [];
    
    // Search for keywords
    const keywords = this.keywords.x.slice(0, 3); // First 3 to avoid rate limits
    
    for (const keyword of keywords) {
      try {
        const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
          params: {
            query: `${keyword} -is:retweet`,
            max_results: 10,
            'tweet.fields': 'created_at,author_id,text'
          },
          headers: {
            'Authorization': `Bearer ${bearerToken}`
          },
          timeout: 10000
        });

        if (response.data.data) {
          const posts = response.data.data.map(tweet => ({
            id: `x_${tweet.id}`,
            platform: 'x',
            title: tweet.text.substring(0, 100),
            content: tweet.text,
            url: `https://x.com/i/web/status/${tweet.id}`,
            author: tweet.author_id,
            created_at: tweet.created_at
          }));
          
          results.push(...posts);
        }
      } catch (error) {
        console.error(`Error searching X for "${keyword}":`, error.message);
      }
    }

    return results;
  }

  async checkZhihu() {
    await this.initialize();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    // Try to load cookies
    try {
      const cookies = require(`${this.config.cookiesPath}/zhihu.json`);
      await context.addCookies(cookies);
    } catch {
      console.log('No Zhihu cookies found, skipping');
      await context.close();
      return [];
    }

    const results = [];

    try {
      // Search each keyword
      for (const keyword of this.keywords.zhihu) {
        try {
          const searchUrl = `https://www.zhihu.com/search?q=${encodeURIComponent(keyword)}&type=content`;
          await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 15000 });

          // Wait for results
          await page.waitForTimeout(2000);

          // Extract posts
          const posts = await page.$$eval('.ContentItem-title', (nodes, keyword) => {
            return nodes.slice(0, 5).map((node, idx) => ({
              id: `zhihu_keyword_${keyword}_${idx}`,
              platform: 'zhihu',
              title: node.textContent.trim(),
              content: '',
              url: window.location.href,
              author: '',
              created_at: new Date().toISOString()
            }));
          }, keyword);

          results.push(...posts);
        } catch (error) {
          console.error(`Error searching Zhihu for "${keyword}":`, error.message);
        }
      }

      // Save cookies for next time
      const cookies = await context.cookies();
      const fs = require('fs').promises;
      await fs.mkdir(this.config.cookiesPath, { recursive: true });
      await fs.writeFile(`${this.config.cookiesPath}/zhihu.json`, JSON.stringify(cookies, null, 2));

    } finally {
      await context.close();
    }

    return results;
  }

  async checkXiaohongshu() {
    await this.initialize();
    const context = await this.browser.newContext({
      viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();

    // Try to load cookies
    try {
      const cookies = require(`${this.config.cookiesPath}/xiaohongshu.json`);
      await context.addCookies(cookies);
    } catch {
      console.log('No Xiaohongshu cookies found, skipping');
      await context.close();
      return [];
    }

    const results = [];

    try {
      // Search each keyword
      for (const keyword of this.keywords.xiaohongshu) {
        try {
          const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`;
          await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 15000 });

          // Wait for results
          await page.waitForTimeout(3000);

          // Extract posts (simplified)
          const posts = await page.$$eval('.note-item', (nodes, keyword) => {
            return nodes.slice(0, 5).map((node, idx) => ({
              id: `xhs_keyword_${keyword}_${idx}`,
              platform: 'xiaohongshu',
              title: node.textContent.substring(0, 100),
              content: '',
              url: window.location.href,
              author: '',
              created_at: new Date().toISOString()
            }));
          }, keyword);

          results.push(...posts);
        } catch (error) {
          console.error(`Error searching Xiaohongshu for "${keyword}":`, error.message);
        }
      }

      // Save cookies for next time
      const cookies = await context.cookies();
      const fs = require('fs').promises;
      await fs.mkdir(this.config.cookiesPath, { recursive: true });
      await fs.writeFile(`${this.config.cookiesPath}/xiaohongshu.json`, JSON.stringify(cookies, null, 2));

    } finally {
      await context.close();
    }

    return results;
  }

  async checkWeibo() {
    await this.initialize();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    // Try to load cookies
    try {
      const cookies = require(`${this.config.cookiesPath}/weibo.json`);
      await context.addCookies(cookies);
    } catch {
      console.log('No Weibo cookies found, skipping');
      await context.close();
      return [];
    }

    const results = [];

    try {
      // Search each keyword
      for (const keyword of this.keywords.weibo) {
        try {
          const searchUrl = `https://s.weibo.com/weibo?q=${encodeURIComponent(keyword)}&nodup=1`;
          await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 15000 });

          // Wait for results
          await page.waitForTimeout(2000);

          // Extract posts
          const posts = await page.$$eval('.card-wrap', (nodes, keyword) => {
            return nodes.slice(0, 5).map((node, idx) => {
              const titleEl = node.querySelector('.txt');
              const urlEl = node.querySelector('.date a');
              return {
                id: `weibo_keyword_${keyword}_${idx}`,
                platform: 'weibo',
                title: titleEl ? titleEl.textContent.trim().substring(0, 100) : '',
                content: '',
                url: urlEl ? urlEl.href : window.location.href,
                author: '',
                created_at: new Date().toISOString()
              };
            });
          }, keyword);

          results.push(...posts);
        } catch (error) {
          console.error(`Error searching Weibo for "${keyword}":`, error.message);
        }
      }

      // Save cookies for next time
      const cookies = await context.cookies();
      const fs = require('fs').promises;
      await fs.mkdir(this.config.cookiesPath, { recursive: true });
      await fs.writeFile(`${this.config.cookiesPath}/weibo.json`, JSON.stringify(cookies, null, 2));

    } finally {
      await context.close();
    }

    return results;
  }

  async checkJuejin() {
    await this.initialize();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    // Try to load cookies
    try {
      const cookies = require(`${this.config.cookiesPath}/juejin.json`);
      await context.addCookies(cookies);
    } catch {
      console.log('No Juejin cookies found, skipping');
      await context.close();
      return [];
    }

    const results = [];

    try {
      // Search each keyword
      for (const keyword of this.keywords.juejin) {
        try {
          const searchUrl = `https://juejin.cn/search?query=${encodeURIComponent(keyword)}&type=all`;
          await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 15000 });

          // Wait for results
          await page.waitForTimeout(2000);

          // Extract posts
          const posts = await page.$$eval('.article-item', (nodes, keyword) => {
            return nodes.slice(0, 5).map((node, idx) => {
              const titleEl = node.querySelector('.article-title');
              const urlEl = node.querySelector('a');
              return {
                id: `juejin_keyword_${keyword}_${idx}`,
                platform: 'juejin',
                title: titleEl ? titleEl.textContent.trim() : '',
                content: '',
                url: urlEl ? `https://juejin.cn${urlEl.getAttribute('href')}` : window.location.href,
                author: '',
                created_at: new Date().toISOString()
              };
            });
          }, keyword);

          results.push(...posts);
        } catch (error) {
          console.error(`Error searching Juejin for "${keyword}":`, error.message);
        }
      }

      // Save cookies for next time
      const cookies = await context.cookies();
      const fs = require('fs').promises;
      await fs.mkdir(this.config.cookiesPath, { recursive: true });
      await fs.writeFile(`${this.config.cookiesPath}/juejin.json`, JSON.stringify(cookies, null, 2));

    } finally {
      await context.close();
    }

    return results;
  }

  async checkIndiehackers() {
    await this.initialize();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    // Try to load cookies
    try {
      const cookies = require(`${this.config.cookiesPath}/indiehackers.json`);
      await context.addCookies(cookies);
    } catch {
      console.log('No Indie Hackers cookies found, skipping');
    }

    const results = [];

    try {
      // Check latest posts from community instead of search for simplicity
      await page.goto('https://www.indiehackers.com/', { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);

      // Extract posts
      const posts = await page.$$eval('.feed-item', (nodes) => {
        return nodes.slice(0, 10).map((node, idx) => {
          const titleEl = node.querySelector('h2');
          const urlEl = node.querySelector('a');
          return {
            id: `indiehackers_latest_${idx}`,
            platform: 'indiehackers',
            title: titleEl ? titleEl.textContent.trim() : '',
            content: '',
            url: urlEl ? `https://www.indiehackers.com${urlEl.getAttribute('href')}` : window.location.href,
            author: '',
            created_at: new Date().toISOString()
          };
        });
      });

      results.push(...posts);

      // Save cookies for next time
      const cookies = await context.cookies();
      const fs = require('fs').promises;
      await fs.mkdir(this.config.cookiesPath, { recursive: true });
      await fs.writeFile(`${this.config.cookiesPath}/indiehackers.json`, JSON.stringify(cookies, null, 2));

    } catch (error) {
      console.error('Error checking Indie Hackers:', error.message);
    } finally {
      await context.close();
    }

    return results;
  }

  cleanupOldEntries(maxAge = 86400000) { // 24 hours
    const now = Date.now();
    for (const id of this.recentlySeen) {
      // Entries are just IDs, would need to store timestamps in production
    }
  }
}

module.exports = { KeywordMonitor };