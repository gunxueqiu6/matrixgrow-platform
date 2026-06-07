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
