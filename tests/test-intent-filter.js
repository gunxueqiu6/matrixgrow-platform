/**
 * Intent Filter - 意图过滤器单元测试
 *
 * 测试帖子意图分类的核心逻辑（buildPrompt, filter, batch）
 * LLM API 调用使用 mock 避免真实网络请求
 */

const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');
const { IntentFilter } = require('../scripts/listeners/intent-filter');

describe('IntentFilter', () => {
  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const filter = new IntentFilter();
      assert.strictEqual(filter.config.model, 'deepseek-chat');
      assert.strictEqual(filter.config.threshold, 'HIGH');
      assert.ok(filter.config.apiUrl);
    });

    it('should accept custom config', () => {
      const filter = new IntentFilter({
        model: 'gpt-4',
        threshold: 'MEDIUM',
        apiUrl: 'https://custom.api.com/v1',
      });
      assert.strictEqual(filter.config.model, 'gpt-4');
      assert.strictEqual(filter.config.threshold, 'MEDIUM');
      assert.strictEqual(filter.config.apiUrl, 'https://custom.api.com/v1');
    });

    it('should override default with partial config', () => {
      const filter = new IntentFilter({ threshold: 'LOW' });
      assert.strictEqual(filter.config.threshold, 'LOW');
      assert.strictEqual(filter.config.model, 'deepseek-chat'); // unchanged default
    });
  });

  // ==================== buildPrompt ====================

  describe('buildPrompt', () => {
    it('should build prompt with all post fields', () => {
      const filter = new IntentFilter();
      const post = {
        title: '如何提高网站流量？',
        content: '我的网站上线了但没流量，求助！',
        platform: 'v2ex',
        author: 'testuser',
      };
      const prompt = filter.buildPrompt(post);
      assert.ok(prompt.includes('如何提高网站流量？'));
      assert.ok(prompt.includes('我的网站上线了但没流量'));
      assert.ok(prompt.includes('v2ex'));
      assert.ok(prompt.includes('testuser'));
    });

    it('should handle missing fields', () => {
      const filter = new IntentFilter();
      const prompt = filter.buildPrompt({});
      assert.ok(prompt.includes('No title'));
      assert.ok(prompt.includes('No content'));
      assert.ok(prompt.includes('unknown'));
    });

    it('should handle null post gracefully', () => {
      const filter = new IntentFilter();
      const prompt = filter.buildPrompt({ title: null, content: null });
      assert.ok(prompt);
      assert.ok(typeof prompt === 'string');
    });
  });

  // ==================== classify (mocked) ====================

  describe('classify', () => {
    let filter;

    before(() => {
      // Mock axios to avoid real API calls
      const axios = require('axios');
      mock.method(axios, 'post', async (url, data, config) => {
        return {
          data: {
            choices: [{
              message: { content: 'HIGH' },
              finish_reason: 'stop',
              index: 0,
            }],
            usage: { total_tokens: 50 },
          },
        };
      });
      filter = new IntentFilter({ apiKey: 'test-key' });
    });

    after(() => {
      mock.restoreAll();
    });

    it('should classify a post as HIGH intent', async () => {
      const result = await filter.classify({
        title: '如何获得更多用户？',
        content: '我做了个产品但不知道怎么推广，需要帮助',
        platform: 'reddit',
        author: 'indie_hacker',
      });
      assert.strictEqual(result.intent, 'HIGH');
      assert.strictEqual(result.confidence, 1);
    });

    it('should default to LOW when classification is invalid', async () => {
      // Override mock temporarily to return invalid value
      const axios = require('axios');
      mock.method(axios, 'post', async () => ({
        data: { choices: [{ message: { content: 'INVALID', finish_reason: 'stop' } }] },
      }));

      const result = await filter.classify({ title: 'test', content: 'test' });
      assert.strictEqual(result.intent, 'LOW');
    });

    it('should return MEDIUM on API error', async () => {
      const axios = require('axios');
      mock.method(axios, 'post', async () => { throw new Error('API timeout'); });

      const result = await filter.classify({ title: 'test', content: 'test' });
      assert.strictEqual(result.intent, 'MEDIUM');
      assert.strictEqual(result.confidence, 0);
      assert.ok(result.error);
    });
  });

  // ==================== batchClassify ====================

  describe('batchClassify', () => {
    let filter;

    before(() => {
      const axios = require('axios');
      mock.method(axios, 'post', async (url, data, config) => ({
        data: { choices: [{ message: { content: 'HIGH', finish_reason: 'stop' } }] },
      }));
      filter = new IntentFilter({ apiKey: 'test-key' });
    });

    after(() => {
      mock.restoreAll();
    });

    it('should classify multiple posts', async () => {
      const posts = [
        { title: 'Post A', content: 'Help me with growth' },
        { title: 'Post B', content: 'My new product launch' },
      ];
      const results = await filter.batchClassify(posts);
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].intent, 'HIGH');
      assert.strictEqual(results[1].intent, 'HIGH');
      assert.ok(results[0].confidence !== undefined);
    });

    it('should handle empty posts array', async () => {
      const results = await filter.batchClassify([]);
      assert.deepStrictEqual(results, []);
    });

    it('should handle single post', async () => {
      const results = await filter.batchClassify([{ title: 'Only one', content: 'test' }]);
      assert.strictEqual(results.length, 1);
    });
  });

  // ==================== filterHighIntent ====================

  describe('filterHighIntent', () => {
    it('should only return posts with HIGH intent', () => {
      const filter = new IntentFilter();
      const posts = [
        { title: 'A', intent: 'HIGH', confidence: 1 },
        { title: 'B', intent: 'LOW', confidence: 0.5 },
        { title: 'C', intent: 'MEDIUM', confidence: 0.8 },
        { title: 'D', intent: 'HIGH', confidence: 0.9 },
      ];
      const highPosts = filter.filterHighIntent(posts);
      assert.strictEqual(highPosts.length, 2);
      assert.strictEqual(highPosts[0].title, 'A');
      assert.strictEqual(highPosts[1].title, 'D');
    });

    it('should return empty array when no HIGH intent posts', () => {
      const filter = new IntentFilter();
      const result = filter.filterHighIntent([{ title: 'A', intent: 'LOW' }]);
      assert.deepStrictEqual(result, []);
    });

    it('should return empty array for empty input', () => {
      const filter = new IntentFilter();
      assert.deepStrictEqual(filter.filterHighIntent([]), []);
    });
  });

  // ==================== End-to-End ====================

  describe('integration scenarios', () => {
    it('should classify and filter in pipeline', async () => {
      const axios = require('axios');
      mock.method(axios, 'post', async (url, data, config) => ({
        data: { choices: [{ message: { content: 'HIGH', finish_reason: 'stop' } }] },
      }));

      const filter = new IntentFilter({ apiKey: 'test-key' });
      const posts = [
        { title: 'Growth help', content: 'Need users' },
        { title: 'Just sharing', content: 'Check my project' },
      ];

      const classified = await filter.batchClassify(posts);
      const high = filter.filterHighIntent(classified);

      assert.strictEqual(classified.length, 2);
      assert.strictEqual(high.length, 2); // both will be HIGH due to mock

      mock.restoreAll();
    });
  });
});
