#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

console.log('=========================================');
console.log('MatrixGrow Electron 打包开始');
console.log('=========================================\n');

try {
  console.log('[1/4] 检查环境...');
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`Node.js 版本: ${nodeVersion}`);

  console.log('\n[2/4] 安装依赖...');
  process.chdir(projectRoot);
  execSync('npm install', { stdio: 'inherit' });

  console.log('\n[3/4] 重建原生模块...');
  try {
    execSync('npx @electron/rebuild -f -w @napi-rs/canvas -m .', { stdio: 'inherit' });
  } catch (e) {
    console.warn('警告: 原生模块重建可能失败，继续尝试...');
  }

  console.log('\n[4/4] 构建 NSIS 安装包...');
  execSync('npx electron-builder --win --config electron-builder.yml', {
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/',
      ELECTRON_BUILDER_BINARIES_MIRROR: 'https://npmmirror.com/mirrors/electron-builder-binaries/'
    }
  });

  console.log('\n=========================================');
  console.log('✅ 打包完成！');
  console.log('输出目录: dist/');

  const distDir = path.join(projectRoot, 'dist');
  const files = fs.readdirSync(distDir).filter(f => f.endsWith('.exe'));
  if (files.length > 0) {
    console.log('生成的文件:');
    files.forEach(f => {
      const filePath = path.join(distDir, f);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  - ${f} (${sizeMB} MB)`);
    });
  }
  console.log('=========================================\n');

} catch (error) {
  console.error('\n❌ 打包失败:', error.message);
  process.exit(1);
}
