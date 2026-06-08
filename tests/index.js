/**
 * Test Suite - 测试文件
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDir = path.join(__dirname, '../test-results');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

async function runTests() {
  let db = null;

  console.log('\n=== Testing RateLimiter ===');
  const { RateLimiter } = require('../utils/rate-limiter');

  await test('RateLimiter should initialize with default rates', () => {
    const limiter = new RateLimiter();
    assert.ok(limiter);
    assert.ok(limiter.getStatus('v2ex'));
  });

  await test('RateLimiter should allow requests within rate limit', () => {
    const limiter = new RateLimiter({ rates: { test: { rate: 100, burst: 10 } } });
    let allowedCount = 0;
    for (let i = 0; i < 10; i++) {
      const result = limiter.tryAcquire('test');
      if (result.allowed) allowedCount++;
    }
    assert.strictEqual(allowedCount, 10);
  });

  await test('RateLimiter should enforce rate limits', () => {
    const limiter = new RateLimiter({ rates: { slow: { rate: 1, burst: 1 } } });
    const result1 = limiter.tryAcquire('slow');
    assert(result1.allowed);
    const result2 = limiter.tryAcquire('slow');
    assert(!result2.allowed);
    assert(result2.waitTime > 0);
  });

  console.log('\n=== Testing Logger ===');
  const { Logger } = require('../utils/logger');

  await test('Logger should initialize without errors', () => {
    const logger = new Logger({ fileEnabled: false });
    assert.ok(logger);
  });

  await test('Logger should format messages correctly', () => {
    const logger = new Logger({ consoleEnabled: false, fileEnabled: false });
    const message = logger.formatMessage('info', 'test message', { key: 'value' });
    assert(message.timestamp);
    assert.strictEqual(message.level, 'info');
    assert.strictEqual(message.message, 'test message');
    assert.strictEqual(message.key, 'value');
  });

  console.log('\n=== Testing DatabaseManager ===');
  const { DatabaseManager } = require('../data/database');

  await test('DatabaseManager should initialize', async () => {
    db = new DatabaseManager({ dbPath: './test-results/test.db' });
    await db.initialize();
    assert.ok(db);
  });

  await test('DatabaseManager should record posts', async () => {
    const id = await db.recordPost('test text', 'test_platform', { content: 'test content' });
    assert.ok(id > 0);
  });

  await test('DatabaseManager should update post status', async () => {
    const changes = await db.updatePostStatus(1, 'published', { postUrl: 'https://test.com' });
    assert(changes > 0);
  });

  await test('DatabaseManager should get statistics', async () => {
    const stats = await db.getPostStats();
    assert.ok(stats);
    assert(typeof stats.total === 'number');
  });

  await test('DatabaseManager should update statistics', async () => {
    const result = await db.updateStatistics(null, { postsPublished: 1 });
    assert.ok(result);
  });

  console.log('\n=== Testing TextRewriter ===');
  const { TextRewriter } = require('../scripts/rewriters/text-rewriter');

  await test('TextRewriter should initialize', () => {
    const rewriter = new TextRewriter();
    assert.ok(rewriter);
  });

  await test('TextRewriter should map platforms to agents', () => {
    const rewriter = new TextRewriter();
    const agent = rewriter.getAgentForPlatform('v2ex');
    assert.strictEqual(agent, 'hardcore-community-agent');
  });

  console.log('\n=== Testing Vision Generator ===');
  const visionGenerator = require('../vision-generator/card-generator');

  await test('Card generator should generate images', async () => {
    const buffer = await visionGenerator.generateQuoteCard('Test quote', { style: 'clean', platform: 'general' });
    assert.ok(buffer);
    assert(Buffer.isBuffer(buffer));
  });

  await test('Tech cover generator should generate images', async () => {
    const buffer = await visionGenerator.generateTechCover('Test Title');
    assert.ok(buffer);
    assert(Buffer.isBuffer(buffer));
  });

  console.log('\n=== Testing AgentActions ===');
  const { AgentActions } = require('../utils/agent-actions');

  await test('AgentActions should initialize', () => {
    const actions = new AgentActions({ db, logger: { info: () => {}, error: () => {} } });
    assert.ok(actions);
  });

  console.log('\n=== Testing AgentHandler ===');
  const { AgentHandler } = require('../utils/agent-handler');

  await test('AgentHandler should initialize', () => {
    const handler = new AgentHandler({ db, actions: { publish: () => {}, rewrite: () => {} } });
    assert.ok(handler);
  });

  console.log('\n=== Testing WebhookDispatcher ===');
  const { WebhookDispatcher } = require('../utils/webhook-dispatcher');

  await test('WebhookDispatcher should initialize', () => {
    const dispatcher = new WebhookDispatcher({ db });
    assert.ok(dispatcher);
  });

  console.log('\n=== Testing PaymentService ===');
  const { PaymentService } = require('../utils/payment');

  await test('PaymentService should initialize', () => {
    const service = new PaymentService({ db });
    assert.ok(service);
  });

  await test('PaymentService should get tier config', () => {
    const service = new PaymentService({ db });
    const config = service.getTierConfig('pro');
    assert.ok(config);
    assert.strictEqual(config.price, 99);
  });

  await test('PaymentService should return null for invalid tier', () => {
    const service = new PaymentService({ db });
    const config = service.getTierConfig('enterprise');
    assert.strictEqual(config, null);
  });

  console.log('\n=== Testing LLMAdapter ===');
  const { LLMAdapter } = require('../utils/llm-adapter');

  await test('LLMAdapter should initialize with default DeepSeek provider', () => {
    const adapter = new LLMAdapter();
    assert.strictEqual(adapter.config.provider, 'deepseek');
    assert.strictEqual(adapter.config.model, 'deepseek-chat');
  });

  await test('LLMAdapter should support all 4 providers', () => {
    const providers = LLMAdapter.getSupportedProviders();
    assert(providers.includes('claude'));
    assert(providers.includes('deepseek'));
    assert(providers.includes('openai'));
    assert(providers.includes('qwen'));
  });

  await test('LLMAdapter should return provider template', () => {
    const template = LLMAdapter.getProviderTemplate('deepseek');
    assert.ok(template);
    assert.strictEqual(template.model, 'deepseek-chat');
  });

  await test('LLMAdapter should return null for unknown provider template', () => {
    const template = LLMAdapter.getProviderTemplate('unknown');
    assert.strictEqual(template, null);
  });

  await test('LLMAdapter complete() should fail without API key', async () => {
    const adapter = new LLMAdapter({ provider: 'deepseek', apiKey: '' });
    try {
      await adapter.complete([{ role: 'user', content: 'hello' }]);
      assert.fail('Should have thrown');
    } catch (error) {
      assert(error.message.includes('API key not configured'));
    }
  });

  await test('LLMAdapter updateConfig should merge settings', () => {
    const adapter = new LLMAdapter();
    adapter.updateConfig({ model: 'deepseek-chat-v2', temperature: 0.5 });
    assert.strictEqual(adapter.config.model, 'deepseek-chat-v2');
  });

  console.log('\n=== Testing TierGuard ===');
  const { TierGuard } = require('../utils/tier-guard');
  const tiers = TierGuard.getTierLimits();

  await test('TierGuard should define free tier', () => {
    assert.ok(tiers.free);
    assert.strictEqual(tiers.free.platforms, 3);
    assert.strictEqual(tiers.free.accountsPerPlatform, 1);
  });

  await test('TierGuard should define pro tier', () => {
    assert.ok(tiers.pro);
    assert.strictEqual(tiers.pro.platforms, 27);
    assert.strictEqual(tiers.pro.accountsPerPlatform, 1);
  });

  await test('TierGuard should define promax tier', () => {
    assert.ok(tiers.promax);
    assert.strictEqual(tiers.promax.platforms, 27);
    assert.strictEqual(tiers.promax.accountsPerPlatform, 5);
  });

  await test('TierGuard free tier should have no whiteLabel', () => {
    assert.strictEqual(tiers.free.whiteLabel, false);
    assert.strictEqual(tiers.pro.whiteLabel, false);
  });

  await test('TierGuard pro > free for all limits', () => {
    assert(tiers.pro.platforms > tiers.free.platforms);
    assert(tiers.pro.aiImagesPerMonth > tiers.free.aiImagesPerMonth);
    assert(tiers.pro.workflowLimit > tiers.free.workflowLimit);
    assert(tiers.pro.scheduledTasks > tiers.free.scheduledTasks);
  });

  await test('TierGuard promax >= pro for all limits', () => {
    assert(tiers.promax.platforms >= tiers.pro.platforms);
    assert(tiers.promax.aiImagesPerMonth >= tiers.pro.aiImagesPerMonth);
    assert(tiers.promax.workflowLimit >= tiers.pro.workflowLimit);
    assert(tiers.promax.apiKeys >= tiers.pro.apiKeys);
  });

  console.log('\n=== Testing Auth & Password Hashing ===');
  const bcrypt = require('bcryptjs');

  await test('bcrypt should hash and verify password', async () => {
    const password = 'testPassword123';
    const hash = await bcrypt.hash(password, 10);
    assert.notStrictEqual(hash, password);
    const match = await bcrypt.compare(password, hash);
    assert.strictEqual(match, true);
  });

  await test('bcrypt should reject wrong password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    const match = await bcrypt.compare('wrong', hash);
    assert.strictEqual(match, false);
  });

  await test('bcrypt should generate unique hashes for same password', async () => {
    const h1 = await bcrypt.hash('password', 10);
    const h2 = await bcrypt.hash('password', 10);
    assert.notStrictEqual(h1, h2);
  });

  // Cleanup
  if (db) {
    try {
      await db.close();
    } catch (e) {}
  }
  try {
    fs.unlinkSync('./test-results/test.db');
  } catch (e) {}

  console.log('\n' + '='.repeat(50));
  console.log('TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.passed + results.failed}`);
  const coverage = results.passed + results.failed > 0 
    ? ((results.passed / (results.passed + results.failed)) * 100).toFixed(1)
    : 0;
  console.log(`Coverage: ${coverage}%`);

  const resultFile = path.join(testDir, `results-${Date.now()}.json`);
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${resultFile}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
