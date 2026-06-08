const express = require('express');
const path = require('path');
require('dotenv').config();

// App paths
const { setElectronMode, isElectron } = require('./utils/app-paths');
const isElectronMode = process.env.ELECTRON_RUN === '1';

if (isElectronMode) {
  setElectronMode(true, process.env.USER_DATA_PATH);
}

// Core modules
const { APIPublisher } = require('./scripts/publishers/api-publisher');
const { RPAPublisher } = require('./scripts/publishers/rpa-publisher');
const { ArtipubPublisher } = require('./scripts/publishers/artipub-publisher');
const { KeywordMonitor } = require('./scripts/listeners/keyword-monitor');
const { IntentFilter } = require('./scripts/listeners/intent-filter');
const { TextRewriter } = require('./scripts/rewriters/text-rewriter');
const visionGenerator = require('./vision-generator/card-generator');
const { HtmlCardGenerator } = require('./vision-generator/html-card-generator');
const { InfographicGenerator } = require('./vision-generator/infographic-generator');

// New modules for production readiness
const { DatabaseManager } = require('./data/database');
const { Logger } = require('./utils/logger');
const { RateLimiter, PublishingQueue } = require('./utils/rate-limiter');
const { optionalAuth, authenticate } = require('./middleware/auth');
const { createAuthRouter } = require('./routes/auth');
const { createSaasRouter } = require('./routes/saas');
const { createWebhookRouter } = require('./routes/webhooks');
const { createPaymentRouter } = require('./routes/payment');
const { createWorkflowImportRouter } = require('./routes/workflow-import');
const { createWorkflowsRouter } = require('./routes/workflows');
const { AgentHandler } = require('./utils/agent-handler');
const { FalAdapter } = require('./adapters/image/fal-adapter');
const { ReplicateAdapter } = require('./adapters/image/replicate-adapter');
const { HeygenAdapter } = require('./adapters/video/heygen-adapter');
const { LLMAdapter } = require('./utils/llm-adapter');
const { AgentActions } = require('./utils/agent-actions');
const { WebhookDispatcher } = require('./utils/webhook-dispatcher');
const { PaymentService } = require('./utils/payment');
const { UsageMeter } = require('./utils/usage-meter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'frontend')));

// Initialize new modules
const logger = new Logger();
const db = new DatabaseManager();
app.locals.db = db;  // TierGuard 中间件通过 req.app.locals.db 访问
const rateLimiter = new RateLimiter();
const publishingQueue = new PublishingQueue({ 
  rateLimiter, 
  logger 
});

// Initialize core modules
const apiPublisher = new APIPublisher();
const rpaPublisher = new RPAPublisher({
  headless: process.env.PLAYWRIGHT_HEADLESS !== 'false'
});
const keywordMonitor = new KeywordMonitor({
  platforms: ['v2ex', 'reddit', 'x', 'zhihu', 'xiaohongshu', 'weibo', 'juejin', 'indiehackers']
});
const intentFilter = new IntentFilter({
  apiKey: process.env.DEEPSEEK_API_KEY,
  apiUrl: process.env.DEEPSEEK_API_URL
});
const textRewriter = new TextRewriter();
const htmlCardGenerator = new HtmlCardGenerator({
  headless: process.env.PLAYWRIGHT_HEADLESS !== 'false'
});
const infographicGenerator = new InfographicGenerator({
  headless: process.env.PLAYWRIGHT_HEADLESS !== 'false'
});
const artipubPublisher = new ArtipubPublisher();

// Initialize Agent, Webhook, and Payment modules
const llmAdapter = new LLMAdapter();
const falAdapter = new FalAdapter(process.env.FAL_API_KEY);
const replicateAdapter = new ReplicateAdapter(process.env.REPLICATE_API_KEY);
const heygenAdapter = new HeygenAdapter(process.env.HEYGEN_API_KEY);
const agentActions = new AgentActions({ db, textRewriter, apiPublisher, rpaPublisher, artipubPublisher, llmAdapter });
const agentHandler = new AgentHandler({ db, llmAdapter, agentActions });
agentHandler.initialize();   // 加载 Agent 系统提示词
const webhookDispatcher = new WebhookDispatcher({ db });
const paymentService = new PaymentService({
  db,
  config: { baseUrl: process.env.BASE_URL || 'http://localhost:3000' }
});

// 定时监控调度器
let monitorInterval = null;
const MONITOR_INTERVAL_MS = 10 * 60 * 1000; // 10 分钟

// 启动定时监控
async function startScheduledMonitor() {
  logger.info('启动定时监控', { interval: '10分钟' });
  
  monitorInterval = setInterval(async () => {
    try {
      logger.info('开始检查各平台', { type: 'scheduled' });
      const posts = await keywordMonitor.checkAllPlatforms();
      
      if (posts.length === 0) {
        logger.debug('没有发现新帖子');
        return;
      }

      logger.info(`发现 ${posts.length} 个新帖子`);
      
      // 记录监控历史
      await db.recordMonitorHistory('all', posts.length, 0, 0);
      
      // 意向度过滤
      const classified = await intentFilter.batchClassify(posts);
      const highIntentPosts = classified.filter(p => p.intent === 'HIGH');
      
      logger.info(`高意向帖子: ${highIntentPosts.length} 个`);
      
      // 更新统计
      await db.updateStatistics(null, { interceptsFound: highIntentPosts.length });
      
      // 自动触发截流回复（通过队列）
      for (const post of highIntentPosts) {
        logger.info(`处理高意向帖子: ${post.title}`);
        await handleInterceptPost(post);
      }
    } catch (error) {
      logger.errorWithStack(error, '定时监控错误');
    }
  }, MONITOR_INTERVAL_MS);
}

// 处理截流帖子
async function handleInterceptPost(post) {
  try {
    // 记录到数据库
    const interceptId = await db.recordIntercept(
      post.platform,
      post.id,
      post.title,
      post.url,
      post.content || '',
      post.intent || 'HIGH'
    );

    // 1. AI 生成回复
    const replyResult = await textRewriter.generateInterceptReply(
      `${post.title}\n${post.content}`,
      post.platform
    );

    if (!replyResult.success) {
      logger.error('AI 回复生成失败', { error: replyResult.error });
      await db.updateInterceptReply(interceptId, '', 'failed');
      return;
    }

    logger.info('AI 回复已生成');

    // 2. 通过队列发布回复（带速率限制）
    const task = await publishingQueue.add({
      type: 'intercept_reply',
      platform: post.platform,
      handler: async () => {
        const replyData = {
          platform: post.platform,
          content: replyResult.content,
          topic_id: post.id,
          post_id: post.id,
          no_links: true
        };
        return rpaPublisher.reply(replyData);
      }
    });

    // 更新数据库
    await db.updateInterceptReply(interceptId, replyResult.content, 'replied');
    await db.updateStatistics(null, { interceptsReplied: 1 });
    
    logger.info(`已在 ${post.platform} 发布截流回复`);
    
  } catch (error) {
    logger.errorWithStack(error, '截流处理失败');
  }
}

// 请求日志中间件
app.use((req, res, next) => {
  logger.request(req);
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.response(req, res.statusCode, duration);
  });
  
  next();
});

// Health check
app.get('/api/health', async (req, res) => {
  const postStats = await db.getPostStats();
  const interceptStats = await db.getInterceptStats();
  const dmStats = await db.getDMStats();
  
  res.json({ 
    status: 'ok', 
    service: 'MatrixGrow',
    features: {
      textRewriter: !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY,
      rpaPublisher: true,
      scheduledMonitor: monitorInterval !== null,
      database: true,
      rateLimiter: true
    },
    stats: {
      posts: postStats,
      intercepts: interceptStats,
      dms: dmStats
    },
    queue: publishingQueue.getStatus()
  });
});

// Webhook endpoint for n8n
app.post('/api/webhook/matrixgrow-input', optionalAuth, async (req, res) => {
  try {
    const { text, platforms = ['all'], source = 'manual' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing text field' });
    }

    res.json({
      success: true,
      message: 'Request received, processing in background',
      data: {
        originalText: text,
        platforms,
        source
      }
    });

    // 通过队列处理
    publishingQueue.add({
      type: 'content_distribution',
      platform: 'all',
      handler: () => processContent(text, platforms)
    });
    
  } catch (error) {
    logger.errorWithStack(error, 'Webhook处理错误');
    res.status(500).json({ error: error.message });
  }
});

// Content processing pipeline - 核心改写 + 发布流程
async function processContent(originalText, platforms) {
  logger.info('开始处理内容', { length: originalText.length, platforms });

  // Step 1: AI 文本改写
  logger.info('Step 1: AI 文本改写');
  const rewrittenResults = await textRewriter.rewrite(originalText, platforms);
  
  for (const [platform, result] of Object.entries(rewrittenResults)) {
    if (result.success) {
      logger.info(`${platform} 改写完成`, { length: result.rewrittenLength });
    } else {
      logger.error(`${platform} 改写失败`, { error: result.error });
    }
  }

  // Step 2: 视觉生成
  logger.info('Step 2: 视觉生成');
  const images = {
    techCover: null,
    socialCards: []
  };

  try {
    images.techCover = await visionGenerator.generateTechCover(originalText);
    logger.info('技术封面图已生成');

    if (platforms.includes('social') || platforms.includes('all')) {
      images.socialCards = await visionGenerator.generateSocialCards(originalText, { count: 3 });
      logger.info(`社交卡片已生成 ${images.socialCards.length} 张`);
    }
  } catch (error) {
    logger.errorWithStack(error, '视觉生成失败');
  }

  // Step 3: 发布到各平台
  logger.info('Step 3: 多平台发布');
  let publishedCount = 0;

  // 技术博客平台
  if (platforms.includes('tech-blog') || platforms.includes('all')) {
    const techContent = rewrittenResults['tech-blog']?.content || originalText;
    
    // Dev.to
    try {
      const result = await apiPublisher.publish(techContent, 'devto', {
        apiKey: process.env.DEVTO_API_KEY,
        title: techContent.split('\n')[0].substring(0, 100),
        coverImage: images.techCover ? 'generated' : undefined
      });
      
      await db.recordPost(originalText, 'devto', { 
        content: techContent, 
        status: 'published',
        postUrl: result.url,
        postId: result.postId
      });
      publishedCount++;
      logger.publish('devto', 'success');
    } catch (e) {
      await db.recordPost(originalText, 'devto', { 
        content: techContent, 
        status: 'failed',
        errorMessage: e.message
      });
      logger.publish('devto', 'failed', { error: e.message });
    }
  }

  // 记录统计
  await db.updateStatistics(null, { postsPublished: publishedCount });
  logger.info('内容处理完成', { publishedCount });
}

// Publishing endpoints
app.post('/api/publish', async (req, res) => {
  try {
    const { content, platform, options = {} } = req.body;

    if (['x', 'linkedin', 'devto', 'medium'].includes(platform)) {
      const result = await apiPublisher.publish(content, platform, options);
      await db.recordPost(content, platform, { 
        status: 'published',
        postUrl: result.url,
        postId: result.postId
      });
      res.json(result);
    } else {
      res.status(400).json({ error: 'Unsupported API platform' });
    }
  } catch (error) {
    logger.errorWithStack(error, 'API发布错误');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/publish/rpa', async (req, res) => {
  try {
    const { content, platform, options = {} } = req.body;

    if (['xiaohongshu', 'v2ex', 'weixin'].includes(platform)) {
      const result = await rpaPublisher.publish(content, platform, options);
      await db.recordPost(content, platform, { 
        status: 'published',
        postUrl: result.url 
      });
      res.json(result);
    } else {
      res.status(400).json({ error: 'Unsupported RPA platform' });
    }
  } catch (error) {
    logger.errorWithStack(error, 'RPA发布错误');
    res.status(500).json({ error: error.message });
  }
});

// Intercept endpoints
app.get('/api/monitor/check', async (req, res) => {
  try {
    const { platform } = req.query;
    let posts;

    if (platform) {
      const methodName = `check${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
      if (typeof keywordMonitor[methodName] === 'function') {
        posts = await keywordMonitor[methodName]();
      } else {
        return res.status(400).json({ error: `Unsupported platform: ${platform}` });
      }
    } else {
      posts = await keywordMonitor.checkAllPlatforms();
    }

    const classified = await intentFilter.batchClassify(posts);

    res.json({
      success: true,
      count: classified.length,
      highIntent: intentFilter.filterHighIntent(classified),
      data: classified
    });
  } catch (error) {
    logger.errorWithStack(error, '监控检查错误');
    res.status(500).json({ error: error.message });
  }
});

// 截流回复端点 - 实际调用 RPA 发布
app.post('/api/intercept/reply', async (req, res) => {
  try {
    const { platform, topic_id, post_id, tweet_id, content, no_links = true } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Missing content' });
    }

    const replyData = {
      platform,
      content,
      topic_id,
      post_id,
      tweet_id,
      no_links
    };

    const result = await rpaPublisher.reply(replyData);

    res.json({
      success: true,
      message: `Reply posted to ${platform}`,
      data: result
    });
  } catch (error) {
    logger.errorWithStack(error, '截流回复错误');
    res.status(500).json({ error: error.message });
  }
});

// 手动触发截流流程
app.post('/api/intercept/run', async (req, res) => {
  try {
    logger.info('手动触发截流流程');
    
    const posts = await keywordMonitor.checkAllPlatforms();
    const classified = await intentFilter.batchClassify(posts);
    const highIntentPosts = classified.filter(p => p.intent === 'HIGH');

    for (const post of highIntentPosts) {
      await handleInterceptPost(post);
    }

    res.json({
      success: true,
      processed: highIntentPosts.length,
      posts: highIntentPosts
    });
  } catch (error) {
    logger.errorWithStack(error, '手动截流错误');
    res.status(500).json({ error: error.message });
  }
});

// AI 改写端点
app.post('/api/rewrite', async (req, res) => {
  try {
    const { text, platforms = ['all'] } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const results = await textRewriter.rewrite(text, platforms);
    res.json({
      success: true,
      original: text,
      results
    });
  } catch (error) {
    logger.errorWithStack(error, '改写错误');
    res.status(500).json({ error: error.message });
  }
});

// Image generation endpoints
app.post('/api/images/quote-card', async (req, res) => {
  try {
    const { text, style = 'clean', platform = 'general' } = req.body;
    const buffer = await visionGenerator.generateQuoteCard(text, { style, platform });

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    logger.errorWithStack(error, '图片生成错误');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/images/tech-cover', async (req, res) => {
  try {
    const { text, style = 'professional' } = req.body;
    const buffer = await visionGenerator.generateTechCover(text, { style });

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    logger.errorWithStack(error, '封面生成错误');
    res.status(500).json({ error: error.message });
  }
});

// HTML-to-Image endpoints
app.post('/api/images/html-quote', async (req, res) => {
  try {
    const { text, style = 'ocean', author = '' } = req.body;
    const buffer = await htmlCardGenerator.generateQuoteCard(text, { style, author });

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    logger.errorWithStack(error, 'HTML卡片生成错误');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/images/html-infographic', async (req, res) => {
  try {
    const { title, stats, style = 'dark', highlight = '' } = req.body;
    const buffer = await htmlCardGenerator.generateInfographic(title, stats, { style, highlight });

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    logger.errorWithStack(error, 'HTML信息图生成错误');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/images/html-data-card', async (req, res) => {
  try {
    const { icon = '📊', category = 'Analytics', title, content, metrics = [], style = 'ocean' } = req.body;
    const buffer = await htmlCardGenerator.generateDataCard({ icon, category, title, content, metrics, style });

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    logger.errorWithStack(error, 'HTML数据卡片生成错误');
    res.status(500).json({ error: error.message });
  }
});

// Infographic generator endpoints
app.post('/api/images/infographic/from-text', async (req, res) => {
  try {
    const { text, style = 'dark' } = req.body;
    const buffer = await infographicGenerator.generateFromText(text, { style });

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    logger.errorWithStack(error, '文本信息图生成错误');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/images/infographic/comparison', async (req, res) => {
  try {
    const { title = '对比分析', items } = req.body;
    const buffer = await infographicGenerator.generateComparisonChart(items, { title });

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    logger.errorWithStack(error, '对比图表生成错误');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/images/infographic/progress', async (req, res) => {
  try {
    const { title = '进度追踪', data } = req.body;
    const buffer = await infographicGenerator.generateProgressChart(data, { title });

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    logger.errorWithStack(error, '进度图表生成错误');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/images/infographic/timeline', async (req, res) => {
  try {
    const { title = '时间线', items } = req.body;
    const buffer = await infographicGenerator.generateTimeline(items, { title });

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    logger.errorWithStack(error, '时间线生成错误');
    res.status(500).json({ error: error.message });
  }
});

// Artipub endpoints
app.get('/api/artipub/platforms', async (req, res) => {
  try {
    const platforms = await apiPublisher.getArtipubPlatforms();
    res.json({ success: true, platforms });
  } catch (error) {
    logger.errorWithStack(error, 'Artipub平台获取错误');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/artipub/publish', async (req, res) => {
  try {
    const { content, platform, title, tags = [], coverImage } = req.body;
    
    if (!content || !platform) {
      return res.status(400).json({ error: 'Missing content or platform' });
    }

    const result = await apiPublisher.publish(content, platform, { title, tags, coverImage });
    res.json({ success: true, ...result });
  } catch (error) {
    logger.errorWithStack(error, 'Artipub发布错误');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/artipub/publish-multiple', async (req, res) => {
  try {
    const { content, platforms, title, tags = [] } = req.body;
    
    if (!content || !platforms || !Array.isArray(platforms)) {
      return res.status(400).json({ error: 'Missing content or platforms array' });
    }

    const results = await apiPublisher.publishToMultipleViaArtipub(content, platforms, { title, tags });
    res.json({ 
      success: true, 
      results,
      successCount: results.filter(r => r.success).length,
      failCount: results.filter(r => !r.success).length
    });
  } catch (error) {
    logger.errorWithStack(error, 'Artipub批量发布错误');
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/artipub/health', async (req, res) => {
  try {
    const health = await apiPublisher.artipubHealthCheck();
    res.json({ success: true, ...health });
  } catch (error) {
    logger.errorWithStack(error, 'Artipub健康检查错误');
    res.status(500).json({ error: error.message });
  }
});

// Auth routes
app.use('/api/auth', createAuthRouter(db));

// Analytics endpoints
app.get('/api/analytics/overview', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : null;
    const overview = await db.getAnalyticsOverview(userId);
    res.json({ success: true, data: overview });
  } catch (error) {
    logger.errorWithStack(error, '分析概览错误');
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/daily', optionalAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const userId = req.user ? req.user.userId : null;
    const stats = await db.getDailyStats(parseInt(days), userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.errorWithStack(error, '每日统计错误');
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/platforms', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : null;
    const breakdown = await db.getPlatformBreakdown(userId);
    res.json({ success: true, data: breakdown });
  } catch (error) {
    logger.errorWithStack(error, '平台分析错误');
    res.status(500).json({ error: error.message });
  }
});

// SaaS Routes - 订阅、平台绑定、设置、Agent
app.use('/api', createSaasRouter(db, agentHandler));

// Webhook Routes
app.use('/api', createWebhookRouter(db, webhookDispatcher));

// Payment Routes
app.use('/api', createPaymentRouter(db, paymentService));

// Workflow Import & Management Routes
app.use('/api/workflow', createWorkflowImportRouter(db));
app.use('/api/workflows', createWorkflowsRouter(db));

// ========== AI Gateway Endpoints ==========

// POST /api/ai/llm - LLM 调用（已有，通过 llmAdapter）
app.post('/api/ai/llm', authenticate, async (req, res) => {
  try {
    const { prompt, provider, model, system_prompt, temperature = 0.7, max_tokens = 2048 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: '缺少 prompt' });
    }

    const result = await llmAdapter.generate(prompt, {
      provider,
      model,
      systemPrompt: system_prompt,
      temperature,
      maxTokens: max_tokens
    });

    // 记录使用量
    if (result.success) {
      await UsageMeter.recordUsage(
        db, 
        req.user.userId, 
        'text', 
        provider || llmAdapter.defaultProvider, 
        model || 'default', 
        (result.text?.length || 0) / 1000,
        null
      );
    }

    res.json(result);
  } catch (error) {
    logger.errorWithStack(error, 'LLM API 错误');
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ai/image - 图像生成
app.post('/api/ai/image', authenticate, async (req, res) => {
  try {
    const { prompt, provider = 'fal', width = 1024, height = 768, num_images = 1, negative_prompt = '' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: '缺少 prompt' });
    }

    let result;
    
    if (provider === 'fal') {
      result = await falAdapter.generateImage(prompt, { width, height, numImages: num_images, negativePrompt: negative_prompt });
    } else if (provider === 'replicate') {
      result = await replicateAdapter.generateImage(prompt, { width, height, numImages: num_images, negativePrompt: negative_prompt });
    } else {
      return res.status(400).json({ error: '不支持的图像生成提供商' });
    }

    // 记录使用量
    if (result.success) {
      await UsageMeter.recordUsage(
        db, 
        req.user.userId, 
        'image', 
        provider, 
        'default', 
        num_images,
        null
      );
    }

    res.json(result);
  } catch (error) {
    logger.errorWithStack(error, 'Image API 错误');
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ai/video - 视频生成
app.post('/api/ai/video', authenticate, async (req, res) => {
  try {
    const { script, provider = 'heygen', avatar_id, voice_id } = req.body;

    if (!script) {
      return res.status(400).json({ error: '缺少 script' });
    }

    if (provider !== 'heygen') {
      return res.status(400).json({ error: '不支持的视频生成提供商' });
    }

    const result = await heygenAdapter.generateVideo(script, { avatarId: avatar_id, voiceId: voice_id });

    // 记录使用量（预计 1 分钟）
    if (result.success) {
      await UsageMeter.recordUsage(
        db, 
        req.user.userId, 
        'video', 
        provider, 
        'default', 
        1, // 1 分钟
        null
      );
    }

    res.json(result);
  } catch (error) {
    logger.errorWithStack(error, 'Video API 错误');
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ai/video/:videoId/status - 查询视频生成状态
app.get('/api/ai/video/:videoId/status', authenticate, async (req, res) => {
  try {
    const { videoId } = req.params;
    const result = await heygenAdapter.getVideoStatus(videoId);
    res.json(result);
  } catch (error) {
    logger.errorWithStack(error, 'Video Status API 错误');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Workflow execution tracking
app.post('/api/workflow/execute', optionalAuth, async (req, res) => {
  try {
    const { workflowName, inputPayload } = req.body;

    if (!workflowName) {
      return res.status(400).json({ error: 'Missing workflowName' });
    }

    const userId = req.user ? req.user.userId : null;
    const executionId = await db.recordWorkflowExecution(userId, workflowName, inputPayload);

    res.json({ success: true, executionId });
  } catch (error) {
    logger.errorWithStack(error, 'Workflow执行记录错误');
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workflow/executions', optionalAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const userId = req.user ? req.user.userId : null;
    const executions = await db.getWorkflowExecutions(userId, parseInt(limit));
    res.json({ success: true, data: executions });
  } catch (error) {
    logger.errorWithStack(error, 'Workflow执行列表错误');
    res.status(500).json({ error: error.message });
  }
});

// 统计端点
app.get('/api/stats', async (req, res) => {
  try {
    const [postStats, interceptStats, dmStats, dailyStats] = await Promise.all([
      db.getPostStats(),
      db.getInterceptStats(),
      db.getDMStats(),
      db.getStatistics()
    ]);

    res.json({
      success: true,
      posts: postStats,
      intercepts: interceptStats,
      dms: dmStats,
      today: dailyStats,
      queue: publishingQueue.getStatus()
    });
  } catch (error) {
    logger.errorWithStack(error, '统计获取错误');
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// 启动服务器
async function startServer() {
  // 初始化数据库
  try {
    await db.initialize();
    logger.info('数据库已初始化');
  } catch (e) {
    logger.error('数据库初始化失败', { error: e.message });
  }

  // 初始化改写器
  try {
    await textRewriter.initialize();
    logger.info('AI 改写器已初始化');
  } catch (e) {
    logger.warn('AI 改写器初始化失败', { error: e.message });
  }

  const listenPort = isElectronMode ? 0 : PORT;
  const server = app.listen(listenPort, '127.0.0.1', async () => {
    const actualPort = server.address().port;

    if (isElectronMode) {
      // Electron 模式：通过 IPC 发送端口
      if (process.send) {
        process.send({ port: actualPort });
      }
    } else {
      // 普通模式：打印启动信息
      console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   MatrixGrow - AI 增长引擎 (Agent+支付+Webhook版)                ║
║                                                                  ║
║   服务器已启动: http://localhost:${actualPort}                     ║
║                                                                  ║
║   API 文档:                                                      ║
║   认证相关:                                                       ║
║   - POST /api/auth/register        - 用户注册                      ║
║   - POST /api/auth/login           - 用户登录                      ║
║   - GET  /api/auth/me              - 个人信息                      ║
║   - POST /api/auth/api-keys        - 创建API Key                   ║
║                                                                  ║
║   Agent 对话:                                                     ║
║   - POST /api/agent                - AI Agent 对话                  ║
║   - POST /api/agent/clear-session  - 清除对话历史                  ║
║                                                                  ║
║   Webhook:                                                        ║
║   - GET  /api/webhooks             - 获取Webhook列表               ║
║   - POST /api/webhooks             - 创建Webhook                   ║
║   - PUT  /api/webhooks/:id         - 更新Webhook                   ║
║   - DELETE /api/webhooks/:id       - 删除Webhook                   ║
║   - GET  /api/webhooks/:id/logs    - Webhook日志                   ║
║   - POST /api/webhooks/:id/test    - 发送测试事件                  ║
║                                                                  ║
║   支付:                                                          ║
║   - POST /api/payment/create       - 创建支付订单                  ║
║   - GET  /api/payment/url          - 获取支付链接                  ║
║   - GET  /api/payment/status       - 查询支付状态                  ║
║   - GET  /api/payment/orders       - 支付订单列表                  ║
║                                                                  ║
║   SaaS 功能:                                                     ║
║   - GET  /api/subscription         - 获取订阅信息                  ║
║   - PUT  /api/subscription/upgrade - 升级订阅                      ║
║   - GET  /api/subscription/tiers   - 套餐对比                      ║
║   - GET  /api/platforms            - 获取平台列表                   ║
║   - GET  /api/my-platforms         - 已绑定平台                     ║
║   - POST /api/my-platforms         - 绑定新平台                     ║
║   - PUT  /api/my-platforms/:id     - 更新平台绑定                   ║
║   - DELETE /api/my-platforms/:id   - 解绑平台                      ║
║   - GET  /api/settings             - 获取设置                       ║
║   - PUT  /api/settings             - 保存设置                       ║
║                                                                  ║
║   内容发布:                                                      ║
║   - POST /api/rewrite              - AI 文本改写                   ║
║   - POST /api/publish              - API 平台发布                  ║
║   - POST /api/publish/rpa          - RPA 平台发布                  ║
║   - GET  /api/monitor/check        - 关键词监控检查                ║
║   - POST /api/intercept/run        - 手动触发截流                  ║
║   - POST /api/intercept/reply      - 截流回复                     ║
║   - POST /api/images/*             - 图片生成                      ║
║   - POST /api/images/infographic/* - 智能信息图生成               ║
║                                                                  ║
║   分析统计:                                                      ║
║   - GET  /api/analytics/overview   - 分析概览                     ║
║   - GET  /api/analytics/daily      - 每日统计                      ║
║   - GET  /api/analytics/platforms  - 平台分布                      ║
║   - GET  /api/stats                - 统计数据                      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
      `);
    }

    // 启动定时监控
    if (process.env.ENABLE_MONITOR === 'true') {
      startScheduledMonitor();
    } else if (!isElectronMode) {
      logger.info('定时监控未启动 (设置 ENABLE_MONITOR=true 启用)');
    }
  });
}

startServer();

// Cleanup on shutdown
async function gracefulShutdown() {
  logger.info('正在关闭服务器...');

  if (monitorInterval) {
    clearInterval(monitorInterval);
  }

  await rpaPublisher.close();
  await db.close();

  logger.info('服务器已关闭');
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);