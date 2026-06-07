/**
 * MatrixGrow Demo Script
 * Demonstrates the full pipeline: AI rewrite → vision generation → publishing
 */

const visionGenerator = require('./vision-generator/card-generator');
const fs = require('fs').promises;
const path = require('path');

async function demo() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  MatrixGrow - 完整演示                    ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  // 1. Sample input
  const sampleText = '我做了一个用 AI 自动帮产品改写并分发到全网的工具，再也不用人肉贴了。';
  console.log('📝 输入:', sampleText, '\n');

  // 2. Generate images
  console.log('🎨 正在生成图片...');

  const techCover = await visionGenerator.generateTechCover(sampleText);
  const quoteCard = await visionGenerator.generateQuoteCard(sampleText, {
    style: 'emotional',
    platform: 'xiaohongshu'
  });

  const outputDir = path.join(__dirname, 'output');
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(path.join(outputDir, 'tech-cover.png'), techCover);
  await fs.writeFile(path.join(outputDir, 'quote-card.png'), quoteCard);

  console.log('✅ 图片已保存到 output/ 目录\n');

  // 3. Show AI agent prompts
  console.log('🤖 AI Agent Prompt 示例:');
  console.log('  - tech-blog-agent.md - 技术博客风格改写');
  console.log('  - social-media-agent.md - 小红书风格改写');
  console.log('  - intercept-agent.md - 截流三段式话术\n');

  console.log('🚀 下一步:');
  console.log('  1. npm install  安装依赖');
  console.log('  2. 配置 .env 文件');
  console.log('  3. node server.js  启动服务器');
  console.log('  4. 访问 http://localhost:3000\n');
}

demo().catch(console.error);
