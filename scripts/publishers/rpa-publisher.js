/**
 * RPA Publisher - Handles publishing to platforms requiring browser automation
 * Platforms: 小红书, V2EX, 微信
 */

const { chromium } = require('playwright');

class RPAPublisher {
  constructor(config = {}) {
    this.config = {
      headless: config.headless ?? true,
      cookiesPath: config.cookiesPath || './cookies',
      retryCount: config.retryCount || 3,
      ...config
    };
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async publish(content, platform, options = {}) {
    const publishers = {
      xiaohongshu: this.publishToXiaohongshu.bind(this),
      v2ex: this.publishToV2EX.bind(this),
      weixin: this.publishToWeixin.bind(this),
      zhihu: this.publishToZhihu.bind(this),
      hackernews: this.publishToHackerNews.bind(this),
      jianshu: this.publishToJianshu.bind(this),
      instagram: this.publishToInstagram.bind(this),
      threads: this.publishToThreads.bind(this),
      producthunt: this.publishToProductHunt.bind(this),
      weibo: this.publishToWeibo.bind(this),
      bilibili: this.publishToBilibili.bind(this),
      facebook: this.publishToFacebook.bind(this),
      indiehackers: this.publishToIndieHackers.bind(this),
      sspai: this.publishToSspai.bind(this),
      baijiahao: this.publishToBaijiahao.bind(this),
      souhu: this.publishToSouhu.bind(this),
      wangyi: this.publishToWangyi.bind(this)
    };

    const publisher = publishers[platform];
    if (!publisher) {
      throw new Error(`Unsupported RPA platform: ${platform}`);
    }

    await this.initialize();

    let lastError;
    for (let i = 0; i < this.config.retryCount; i++) {
      try {
        return await publisher(content, options);
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${i + 1} failed:`, error.message);
      }
    }
    throw lastError;
  }

  async loadCookies(context, platform) {
    try {
      const cookiesFile = `${this.config.cookiesPath}/${platform}.json`;
      const cookies = require(cookiesFile);
      await context.addCookies(cookies);
      return true;
    } catch {
      return false;
    }
  }

  async saveCookies(context, platform) {
    const cookies = await context.cookies();
    const fs = require('fs').promises;
    const dir = this.config.cookiesPath;
    await fs.mkdir(dir, { recursive: true });
    const cookiesFile = `${dir}/${platform}.json`;
    await fs.writeFile(cookiesFile, JSON.stringify(cookies, null, 2));
  }

  async publishToXiaohongshu(content, options = {}) {
    const { images = [], title } = options;
    const context = await this.browser.newContext({
      viewport: { width: 390, height: 844 } // Mobile viewport
    });
    const page = await context.newPage();

    // Load cookies if available
    await this.loadCookies(context, 'xiaohongshu');

    try {
      await page.goto('https://creator.xiaohongshu.com/publish/publish', {
        waitUntil: 'networkidle'
      });

      // Check if logged in
      const isLoggedIn = await page.$('.login-container');
      if (isLoggedIn) {
        throw new Error('Please login to Xiaohongshu manually and save cookies');
      }

      // Upload images first
      if (images.length > 0) {
        const imageInput = await page.$('input[type="file"]');
        for (const imagePath of images) {
          await imageInput.setInputFiles(imagePath);
          await page.waitForTimeout(1000);
        }
      }

      // Fill in title
      if (title) {
        const titleInput = await page.$('input[data-testid="title-input"]');
        await titleInput.fill(title);
      }

      // Fill in content - simulate typing for anti-detection
      const contentInput = await page.$('textarea');
      await this.humanTyping(contentInput, content.text || content);

      // Click publish button
      const publishBtn = await page.$('button[data-testid="publish-button"]');
      await publishBtn.click();

      await page.waitForTimeout(3000);

      // Save cookies for next time
      await this.saveCookies(context, 'xiaohongshu');

      return {
        success: true,
        platform: 'xiaohongshu',
        url: 'Published via RPA'
      };
    } finally {
      await context.close();
    }
  }

  async publishToV2EX(content, options = {}) {
    const { node = 'v2ex' } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'v2ex');

    try {
      await page.goto('https://www.v2ex.com/new', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginLink = await page.$('a[href="/signin"]');
      if (loginLink) {
        throw new Error('Please login to V2EX manually and save cookies');
      }

      // Fill title
      const titleInput = await page.$('input[name="title"]');
      await this.humanTyping(titleInput, content.title || 'Untitled');

      // Select node
      const nodeSelect = await page.$('select[name="node"]');
      if (nodeSelect) {
        await nodeSelect.selectOption(node);
      }

      // Fill content - V2EX uses markdown
      const contentArea = await page.$('textarea[name="content"]');
      await this.humanTyping(contentArea, content.text || content);

      // Submit
      const submitBtn = await page.$('input[type="submit"]');
      await submitBtn.click();

      await page.waitForLoadState('networkidle');

      await this.saveCookies(context, 'v2ex');

      const url = page.url();

      return {
        success: true,
        platform: 'v2ex',
        url
      };
    } finally {
      await context.close();
    }
  }

  async publishToWeixin(content, options = {}) {
    const { images = [] } = options;
    const context = await this.browser.newContext({
      viewport: { width: 375, height: 812 } // Mobile viewport
    });
    const page = await context.newPage();

    await this.loadCookies(context, 'weixin');

    try {
      // WeChat public platform
      await page.goto('https://mp.weixin.qq.com/', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginArea = await page.$('.login_bar');
      if (loginArea) {
        throw new Error('Please login to WeChat manually and save cookies');
      }

      // Navigate to new article
      await page.click('a[href*="draft"]');

      // Fill title
      const titleInput = await page.$('#title');
      await this.humanTyping(titleInput, content.title || 'Untitled');

      // Fill content using rich text editor
      const editor = await page.$('#editable');
      await this.humanTyping(editor, content.text || content);

      // Upload images if any
      if (images.length > 0) {
        const imageUpload = await page.$('input[type="file"]');
        for (const imagePath of images) {
          await imageUpload.setInputFiles(imagePath);
          await page.waitForTimeout(500);
        }
      }

      // Save draft and get URL
      await page.click('a[id="js_submit"]');

      await this.saveCookies(context, 'weixin');

      return {
        success: true,
        platform: 'weixin',
        url: 'Published via RPA'
      };
    } finally {
      await context.close();
    }
  }

  async humanTyping(element, text) {
    await element.click();
    await element.fill(''); // Clear first

    // Simulate human typing with variable delays
    for (const char of text) {
      await element.type(char, { delay: Math.random() * 50 + 20 });
    }
  }

  /**
   * Reply to a post on various platforms (截流回复)
   * @param {Object} replyData - { platform, content, topic_id, post_id, tweet_id, no_links }
   */
  async reply(replyData) {
    const { platform, content, topic_id, post_id, tweet_id, no_links = true } = replyData;

    const repliers = {
      v2ex: this.replyToV2EX.bind(this),
      reddit: this.replyToReddit.bind(this),
      x: this.replyToX.bind(this),
      zhihu: this.replyToZhihu.bind(this),
      xiaohongshu: this.replyToXiaohongshu.bind(this)
    };

    const replier = repliers[platform];
    if (!replier) {
      throw new Error(`Unsupported reply platform: ${platform}`);
    }

    await this.initialize();

    return replier({ content, topic_id, post_id, tweet_id, no_links });
  }

  /**
   * Reply to V2EX topic
   */
  async replyToV2EX({ content, topic_id, no_links }) {
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'v2ex');

    try {
      // Navigate to the topic
      const topicUrl = topic_id.includes('v2ex_') 
        ? `https://www.v2ex.com/t/${topic_id.replace('v2ex_', '')}`
        : topic_id;
      
      await page.goto(topicUrl, { waitUntil: 'networkidle' });

      // Check login
      const loginLink = await page.$('a[href="/signin"]');
      if (loginLink) {
        throw new Error('Please login to V2EX manually and save cookies');
      }

      // Find reply textarea
      const replyArea = await page.$('textarea[name="content"]');
      if (!replyArea) {
        // Maybe need to click "回复" button first
        const replyBtn = await page.$('a.reply_link');
        if (replyBtn) {
          await replyBtn.click();
          await page.waitForTimeout(500);
        }
      }

      // Fill reply content
      const finalContent = no_links 
        ? content.replace(/https?:\/\/[^\s]+/g, '') // Remove all links
        : content;

      const replyInput = await page.$('textarea[name="content"]') || await page.$('#reply_content');
      await this.humanTyping(replyInput, finalContent);

      // Submit reply
      const submitBtn = await page.$('input[type="submit"]') || await page.$('button.submit');
      if (submitBtn) {
        await submitBtn.click();
      }

      await page.waitForTimeout(2000);
      await this.saveCookies(context, 'v2ex');

      return {
        success: true,
        platform: 'v2ex',
        topic_id,
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Reply to Reddit post
   */
  async replyToReddit({ content, post_id, no_links }) {
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'reddit');

    try {
      const postUrl = post_id.includes('reddit_')
        ? `https://reddit.com/comments/${post_id.replace('reddit_', '')}`
        : post_id;

      await page.goto(postUrl, { waitUntil: 'networkidle' });

      // Check login
      const loginBtn = await page.$('a[href="/login"]');
      if (loginBtn) {
        throw new Error('Please login to Reddit manually and save cookies');
      }

      // Click reply button
      const replyBtn = await page.$('button[data-click-id="reply"]');
      if (replyBtn) {
        await replyBtn.click();
        await page.waitForTimeout(500);
      }

      // Fill reply
      const replyInput = await page.$('textarea[name="text"]');
      const finalContent = no_links 
        ? content.replace(/https?:\/\/[^\s]+/g, '')
        : content;

      await this.humanTyping(replyInput, finalContent);

      // Submit
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
      }

      await page.waitForTimeout(2000);
      await this.saveCookies(context, 'reddit');

      return {
        success: true,
        platform: 'reddit',
        post_id,
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Reply to X/Twitter tweet
   */
  async replyToX({ content, tweet_id, no_links }) {
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'x');

    try {
      const tweetUrl = tweet_id.includes('x_')
        ? `https://x.com/i/web/status/${tweet_id.replace('x_', '')}`
        : tweet_id;

      await page.goto(tweetUrl, { waitUntil: 'networkidle' });

      // Check login
      const loginBtn = await page.$('a[href="/login"]');
      if (loginBtn) {
        throw new Error('Please login to X manually and save cookies');
      }

      // Click reply button
      const replyBtn = await page.$('[data-testid="reply"]');
      if (replyBtn) {
        await replyBtn.click();
        await page.waitForTimeout(500);
      }

      // Fill reply
      const replyInput = await page.$('[data-testid="tweetTextarea_0"]');
      const finalContent = no_links 
        ? content.replace(/https?:\/\/[^\s]+/g, '')
        : content;

      await this.humanTyping(replyInput, finalContent);

      // Submit
      const submitBtn = await page.$('[data-testid="tweetButton"]');
      if (submitBtn) {
        await submitBtn.click();
      }

      await page.waitForTimeout(2000);
      await this.saveCookies(context, 'x');

      return {
        success: true,
        platform: 'x',
        tweet_id,
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Reply to 知乎 question/answer
   */
  async replyToZhihu({ content, topic_id, no_links }) {
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'zhihu');

    try {
      await page.goto(topic_id, { waitUntil: 'networkidle' });

      // Check login
      const loginBtn = await page.$('.SignFlow-accountLogin');
      if (loginBtn) {
        throw new Error('Please login to 知乎 manually and save cookies');
      }

      // Click write answer/comment
      const writeBtn = await page.$('.WriteAnswerButton') || await page.$('.CommentItem-replyBtn');
      if (writeBtn) {
        await writeBtn.click();
        await page.waitForTimeout(500);
      }

      // Fill content
      const contentInput = await page.$('.WriteAnswer-content') || await page.$('.CommentInput-textarea');
      const finalContent = no_links 
        ? content.replace(/https?:\/\/[^\s]+/g, '')
        : content;

      await this.humanTyping(contentInput, finalContent);

      // Submit
      const submitBtn = await page.$('.PublishButton') || await page.$('.CommentInput-submit');
      if (submitBtn) {
        await submitBtn.click();
      }

      await page.waitForTimeout(2000);
      await this.saveCookies(context, 'zhihu');

      return {
        success: true,
        platform: 'zhihu',
        topic_id,
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Reply to 小红书 post
   */
  async replyToXiaohongshu({ content, topic_id, no_links }) {
    const context = await this.browser.newContext({
      viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();

    await this.loadCookies(context, 'xiaohongshu');

    try {
      await page.goto(topic_id, { waitUntil: 'networkidle' });

      // Check login
      const loginBtn = await page.$('.login-container');
      if (loginBtn) {
        throw new Error('Please login to 小红书 manually and save cookies');
      }

      // Click comment button
      const commentBtn = await page.$('.comment-btn') || await page.$('[data-testid="comment-button"]');
      if (commentBtn) {
        await commentBtn.click();
        await page.waitForTimeout(500);
      }

      // Fill comment
      const commentInput = await page.$('.comment-input') || await page.$('textarea');
      const finalContent = no_links 
        ? content.replace(/https?:\/\/[^\s]+/g, '')
        : content;

      await this.humanTyping(commentInput, finalContent);

      // Submit
      const submitBtn = await page.$('.submit-btn') || await page.$('[data-testid="submit-comment"]');
      if (submitBtn) {
        await submitBtn.click();
      }

      await page.waitForTimeout(2000);
      await this.saveCookies(context, 'xiaohongshu');

      return {
        success: true,
        platform: 'xiaohongshu',
        topic_id,
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to 知乎 (知乎专栏)
   */
  async publishToZhihu(content, options = {}) {
    const { title = 'Untitled', tags = [] } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'zhihu');

    try {
      await page.goto('https://zhuanlan.zhihu.com/write', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('.SignFlow-accountLogin');
      if (loginBtn) {
        throw new Error('Please login to 知乎 manually and save cookies');
      }

      // Fill title
      const titleInput = await page.$('.TitleInput');
      if (titleInput) {
        await this.humanTyping(titleInput, title);
      }

      // Fill content - Zhihu uses rich text editor
      const contentInput = await page.$('.RichContent-editable');
      if (contentInput) {
        await contentInput.click();
        await this.humanTyping(contentInput, content);
      }

      // Add tags if provided
      if (tags.length > 0) {
        const tagInput = await page.$('.TagInput');
        if (tagInput) {
          for (const tag of tags) {
            await tagInput.type(tag);
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
          }
        }
      }

      // Click publish button
      const publishBtn = await page.$('.PublishButton');
      if (publishBtn) {
        await publishBtn.click();
      }

      await page.waitForTimeout(3000);
      await this.saveCookies(context, 'zhihu');

      return {
        success: true,
        platform: 'zhihu',
        title,
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to Hacker News
   */
  async publishToHackerNews(content, options = {}) {
    const { title = 'Show HN', url, tags = [] } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'hackernews');

    try {
      await page.goto('https://news.ycombinator.com/submit', {
        waitUntil: 'networkidle'
      });

      // Check login (HN uses simple login)
      const loginLink = await page.$('a[href*="login"]');
      if (loginLink) {
        throw new Error('Please login to Hacker News manually and save cookies');
      }

      // Fill title
      const titleInput = await page.$('input[name="title"]');
      if (titleInput) {
        await titleInput.fill(title);
      }

      // Fill URL or text
      if (url) {
        const urlInput = await page.$('input[name="url"]');
        if (urlInput) {
          await urlInput.fill(url);
        }
      } else {
        const textInput = await page.$('textarea[name="text"]');
        if (textInput) {
          await this.humanTyping(textInput, content);
        }
      }

      // Submit
      const submitBtn = await page.$('input[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
      }

      await page.waitForTimeout(2000);
      await this.saveCookies(context, 'hackernews');

      return {
        success: true,
        platform: 'hackernews',
        title,
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to 简书
   */
  async publishToJianshu(content, options = {}) {
    const { title = 'Untitled', tags = [] } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'jianshu');

    try {
      await page.goto('https://www.jianshu.com/writer#/notebooks/0/notes/new', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('.sign-in-btn');
      if (loginBtn) {
        throw new Error('Please login to 简书 manually and save cookies');
      }

      // Fill title
      const titleInput = await page.$('input._24i7u');
      if (titleInput) {
        await this.humanTyping(titleInput, title);
      }

      // Fill content
      const contentInput = await page.$('textarea._2w2XJ');
      if (contentInput) {
        await this.humanTyping(contentInput, content);
      }

      // Click publish button
      const publishBtn = await page.$('button._21b6D');
      if (publishBtn) {
        await publishBtn.click();
      }

      await page.waitForTimeout(3000);
      await this.saveCookies(context, 'jianshu');

      return {
        success: true,
        platform: 'jianshu',
        title,
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to Instagram
   */
  async publishToInstagram(content, options = {}) {
    const { images = [], caption } = options;
    const context = await this.browser.newContext({
      viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();

    await this.loadCookies(context, 'instagram');

    try {
      await page.goto('https://www.instagram.com/', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) {
        throw new Error('Please login to Instagram manually and save cookies');
      }

      // Click create button
      const createBtn = await page._click('svg[aria-label="New post"]') || await page.$('[role="button"][aria-label*="Create"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }

      // Upload images
      if (images.length > 0) {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(images);
          await page.waitForTimeout(2000);
        }
      }

      // Fill caption
      const captionInput = await page.$('textarea[aria-label="Write a caption…"]');
      if (captionInput) {
        await this.humanTyping(captionInput, caption || content);
      }

      // Share
      const shareBtn = await page._click('text="Share"');
      if (shareBtn) {
        await shareBtn.click();
      }

      await page.waitForTimeout(3000);
      await this.saveCookies(context, 'instagram');

      return {
        success: true,
        platform: 'instagram',
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to Threads
   */
  async publishToThreads(content, options = {}) {
    const { images = [] } = options;
    const context = await this.browser.newContext({
      viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();

    await this.loadCookies(context, 'threads');

    try {
      await page.goto('https://www.threads.net/', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) {
        throw new Error('Please login to Threads manually and save cookies');
      }

      // Click new thread button
      const newThreadBtn = await page.$('[aria-label="New thread"]');
      if (newThreadBtn) {
        await newThreadBtn.click();
        await page.waitForTimeout(500);
      }

      // Fill content
      const contentInput = await page.$('[role="textbox"]');
      if (contentInput) {
        await this.humanTyping(contentInput, content);
      }

      // Upload images
      if (images.length > 0) {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(images);
        }
      }

      // Post
      const postBtn = await page.$('text="Post"');
      if (postBtn) {
        await postBtn.click();
      }

      await page.waitForTimeout(2000);
      await this.saveCookies(context, 'threads');

      return {
        success: true,
        platform: 'threads',
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }
  /**
   * Publish to Product Hunt (Hub 平台)
   */
  async publishToProductHunt(content, options = {}) {
    const { title = 'Untitled', tagline, url, topics = [] } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'producthunt');

    try {
      await page.goto('https://www.producthunt.com/launch', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('a[href*="sign_in"]');
      if (loginBtn) {
        throw new Error('Please login to Product Hunt manually and save cookies');
      }

      // Fill product name
      const nameInput = await page.$('input[name="product[name]"]');
      if (nameInput) {
        await nameInput.fill(title);
      }

      // Fill tagline
      const taglineInput = await page.$('input[name="product[tagline]"]');
      if (taglineInput) {
        await this.humanTyping(taglineInput, tagline || content.substring(0, 60));
      }

      // Fill product URL
      if (url) {
        const urlInput = await page.$('input[name="product[website_url]"]');
        if (urlInput) {
          await urlInput.fill(url);
        }
      }

      // Fill description
      const descInput = await page.$('textarea[name="product[description]"]');
      if (descInput) {
        await this.humanTyping(descInput, content);
      }

      // Select topics if provided
      if (topics.length > 0) {
        for (const topic of topics) {
          const topicInput = await page.$('input[placeholder*="topic"]');
          if (topicInput) {
            await topicInput.fill(topic);
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
          }
        }
      }

      // Submit for review or save draft
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
      }

      await page.waitForTimeout(3000);
      await this.saveCookies(context, 'producthunt');

      return {
        success: true,
        platform: 'producthunt',
        title,
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to 微博
   */
  async publishToWeibo(content, options = {}) {
    const { images = [], title = '' } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'weibo');

    try {
      await page.goto('https://weibo.com/', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('a[href*="login"]');
      if (loginBtn) {
        throw new Error('Please login to 微博 manually and save cookies');
      }

      // Click post button
      const publishBtn = await page.$('.W_ficon.ficon_plus, [aria-label*="发布"]');
      if (publishBtn) {
        await publishBtn.click();
        await page.waitForTimeout(500);
      }

      // Fill content
      const contentInput = await page.$('textarea.W_input');
      if (contentInput) {
        await this.humanTyping(contentInput, content);
      }

      // Upload images
      if (images.length > 0) {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(images);
          await page.waitForTimeout(2000);
        }
      }

      // Click send button
      const sendBtn = await page.$('a.W_btn_a');
      if (sendBtn) {
        await sendBtn.click();
      }

      await page.waitForTimeout(2000);
      await this.saveCookies(context, 'weibo');

      return {
        success: true,
        platform: 'weibo',
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to B站 (专栏)
   */
  async publishToBilibili(content, options = {}) {
    const { title = 'Untitled', coverImage, tags = [] } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'bilibili');

    try {
      await page.goto('https://member.bilibili.com/article/list', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('.login-btn');
      if (loginBtn) {
        throw new Error('Please login to B站 manually and save cookies');
      }

      // Click create article
      const createBtn = await page.$('.create-btn, a[href*="article"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }

      // Fill title
      const titleInput = await page.$('input[placeholder*="标题"]');
      if (titleInput) {
        await this.humanTyping(titleInput, title);
      }

      // Fill content
      const contentInput = await page.$('textarea[placeholder*="内容"]');
      if (contentInput) {
        await this.humanTyping(contentInput, content);
      }

      // Upload cover
      if (coverImage) {
        const coverInput = await page.$('input[type="file"]');
        if (coverInput) {
          await coverInput.setInputFiles(coverImage);
        }
      }

      // Add tags
      if (tags.length > 0) {
        const tagInput = await page.$('input[placeholder*="标签"]');
        if (tagInput) {
          for (const tag of tags) {
            await tagInput.type(tag);
            await page.keyboard.press('Enter');
          }
        }
      }

      // Publish
      const publishBtn = await page.$('.publish-btn, button[type="submit"]');
      if (publishBtn) {
        await publishBtn.click();
      }

      await page.waitForTimeout(3000);
      await this.saveCookies(context, 'bilibili');

      return {
        success: true,
        platform: 'bilibili',
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to Facebook
   */
  async publishToFacebook(content, options = {}) {
    const { images = [], title = '' } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'facebook');

    try {
      await page.goto('https://www.facebook.com/', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('a[href*="login"]');
      if (loginBtn) {
        throw new Error('Please login to Facebook manually and save cookies');
      }

      // Click create post
      const createBtn = await page.$('[aria-label*="Create"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }

      // Fill content
      const contentInput = await page.$('div[role="textbox"], textarea');
      if (contentInput) {
        await contentInput.click();
        await this.humanTyping(contentInput, content);
      }

      // Upload images
      if (images.length > 0) {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(images);
        }
      }

      // Post
      const postBtn = await page.$('div[role="button"][aria-label*="Post"]');
      if (postBtn) {
        await postBtn.click();
      }

      await page.waitForTimeout(2000);
      await this.saveCookies(context, 'facebook');

      return {
        success: true,
        platform: 'facebook',
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to Indie Hackers
   */
  async publishToIndieHackers(content, options = {}) {
    const { title = 'Untitled', tags = [] } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'indiehackers');

    try {
      await page.goto('https://www.indiehackers.com/posts', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('a[href*="login"]');
      if (loginBtn) {
        throw new Error('Please login to Indie Hackers manually and save cookies');
      }

      // Click new post
      const newPostBtn = await page.$('a[href*="post"]');
      if (newPostBtn) {
        await newPostBtn.click();
        await page.waitForTimeout(1000);
      }

      // Fill title
      const titleInput = await page.$('input[placeholder*="title"]');
      if (titleInput) {
        await this.humanTyping(titleInput, title);
      }

      // Fill content
      const contentInput = await page.$('textarea[placeholder*="body"]');
      if (contentInput) {
        await this.humanTyping(contentInput, content);
      }

      // Add tags
      if (tags.length > 0) {
        const tagInput = await page.$('input[placeholder*="tag"]');
        if (tagInput) {
          for (const tag of tags) {
            await tagInput.type(tag);
            await page.keyboard.press('Enter');
          }
        }
      }

      // Publish
      const publishBtn = await page.$('button[type="submit"]');
      if (publishBtn) {
        await publishBtn.click();
      }

      await page.waitForTimeout(2000);
      await this.saveCookies(context, 'indiehackers');

      return {
        success: true,
        platform: 'indiehackers',
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to 少数派
   */
  async publishToSspai(content, options = {}) {
    const { title = 'Untitled', coverImage, tags = [] } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'sspai');

    try {
      await page.goto('https://sspai.com/editor', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('a[href*="login"]');
      if (loginBtn) {
        throw new Error('Please login to 少数派 manually and save cookies');
      }

      // Fill title
      const titleInput = await page.$('input[placeholder*="标题"]');
      if (titleInput) {
        await this.humanTyping(titleInput, title);
      }

      // Fill content
      const contentInput = await page.$('textarea[placeholder*="正文"]');
      if (contentInput) {
        await this.humanTyping(contentInput, content);
      }

      // Upload cover
      if (coverImage) {
        const coverInput = await page.$('input[type="file"]');
        if (coverInput) {
          await coverInput.setInputFiles(coverImage);
        }
      }

      // Add tags
      if (tags.length > 0) {
        const tagInput = await page.$('input[placeholder*="标签"]');
        if (tagInput) {
          for (const tag of tags) {
            await tagInput.type(tag);
            await page.keyboard.press('Enter');
          }
        }
      }

      // Submit for review
      const submitBtn = await page.$('button[type="submit"], [aria-label*="发布"]');
      if (submitBtn) {
        await submitBtn.click();
      }

      await page.waitForTimeout(3000);
      await this.saveCookies(context, 'sspai');

      return {
        success: true,
        platform: 'sspai',
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to 百家号
   */
  async publishToBaijiahao(content, options = {}) {
    const { title = 'Untitled', coverImage, tags = [] } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'baijiahao');

    try {
      await page.goto('https://baijiahao.baidu.com/bjh/home', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('a[href*="login"]');
      if (loginBtn) {
        throw new Error('Please login to 百家号 manually and save cookies');
      }

      // Click create article
      const createBtn = await page.$('a[href*="create"], .create-btn');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }

      // Fill title
      const titleInput = await page.$('input[placeholder*="标题"]');
      if (titleInput) {
        await this.humanTyping(titleInput, title);
      }

      // Fill content
      const contentInput = await page.$('textarea[placeholder*="内容"]');
      if (contentInput) {
        await this.humanTyping(contentInput, content);
      }

      // Upload cover
      if (coverImage) {
        const coverInput = await page.$('input[type="file"]');
        if (coverInput) {
          await coverInput.setInputFiles(coverImage);
        }
      }

      // Add tags
      if (tags.length > 0) {
        const tagInput = await page.$('input[placeholder*="标签"]');
        if (tagInput) {
          for (const tag of tags) {
            await tagInput.type(tag);
            await page.keyboard.press('Enter');
          }
        }
      }

      // Publish
      const publishBtn = await page.$('button[type="submit"], .publish-btn');
      if (publishBtn) {
        await publishBtn.click();
      }

      await page.waitForTimeout(3000);
      await this.saveCookies(context, 'baijiahao');

      return {
        success: true,
        platform: 'baijiahao',
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to 搜狐号
   */
  async publishToSouhu(content, options = {}) {
    const { title = 'Untitled', coverImage, tags = [] } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'souhu');

    try {
      await page.goto('https://mp.sohu.com/profile', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('a[href*="login"]');
      if (loginBtn) {
        throw new Error('Please login to 搜狐号 manually and save cookies');
      }

      // Click create article
      const createBtn = await page.$('a[href*="create"], .create-btn');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }

      // Fill title
      const titleInput = await page.$('input[placeholder*="标题"]');
      if (titleInput) {
        await this.humanTyping(titleInput, title);
      }

      // Fill content
      const contentInput = await page.$('textarea[placeholder*="内容"]');
      if (contentInput) {
        await this.humanTyping(contentInput, content);
      }

      // Upload cover
      if (coverImage) {
        const coverInput = await page.$('input[type="file"]');
        if (coverInput) {
          await coverInput.setInputFiles(coverImage);
        }
      }

      // Add tags
      if (tags.length > 0) {
        const tagInput = await page.$('input[placeholder*="标签"]');
        if (tagInput) {
          for (const tag of tags) {
            await tagInput.type(tag);
            await page.keyboard.press('Enter');
          }
        }
      }

      // Publish
      const publishBtn = await page.$('button[type="submit"], .publish-btn');
      if (publishBtn) {
        await publishBtn.click();
      }

      await page.waitForTimeout(3000);
      await this.saveCookies(context, 'souhu');

      return {
        success: true,
        platform: 'souhu',
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Publish to 网易号
   */
  async publishToWangyi(content, options = {}) {
    const { title = 'Untitled', coverImage, tags = [] } = options;
    const context = await this.browser.newContext();
    const page = await context.newPage();

    await this.loadCookies(context, 'wangyi');

    try {
      await page.goto('https://mp.163.com/', {
        waitUntil: 'networkidle'
      });

      // Check login
      const loginBtn = await page.$('a[href*="login"]');
      if (loginBtn) {
        throw new Error('Please login to 网易号 manually and save cookies');
      }

      // Click create article
      const createBtn = await page.$('a[href*="create"], .create-btn');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }

      // Fill title
      const titleInput = await page.$('input[placeholder*="标题"]');
      if (titleInput) {
        await this.humanTyping(titleInput, title);
      }

      // Fill content
      const contentInput = await page.$('textarea[placeholder*="内容"]');
      if (contentInput) {
        await this.humanTyping(contentInput, content);
      }

      // Upload cover
      if (coverImage) {
        const coverInput = await page.$('input[type="file"]');
        if (coverInput) {
          await coverInput.setInputFiles(coverImage);
        }
      }

      // Add tags
      if (tags.length > 0) {
        const tagInput = await page.$('input[placeholder*="标签"]');
        if (tagInput) {
          for (const tag of tags) {
            await tagInput.type(tag);
            await page.keyboard.press('Enter');
          }
        }
      }

      // Publish
      const publishBtn = await page.$('button[type="submit"], .publish-btn');
      if (publishBtn) {
        await publishBtn.click();
      }

      await page.waitForTimeout(3000);
      await this.saveCookies(context, 'wangyi');

      return {
        success: true,
        platform: 'wangyi',
        url: page.url()
      };
    } finally {
      await context.close();
    }
  }
}

module.exports = { RPAPublisher };
