const { HtmlCardGenerator } = require('./html-card-generator');

/**
 * Infographic Generator
 * Automatically extracts data from text and generates infographics
 * Supports: statistics visualization, comparison charts, progress indicators
 */

class InfographicGenerator {
  constructor(options = {}) {
    this.generator = new HtmlCardGenerator(options);
  }

  async initialize() {
    await this.generator.initialize();
    return this;
  }

  async close() {
    await this.generator.close();
  }

  extractDataFromText(text) {
    const dataPoints = [];
    
    // Extract numbers with units
    const numberPattern = /(\d+(?:\.\d+)?)\s*(万|亿|千|百|\%)?/g;
    let match;
    while ((match = numberPattern.exec(text)) !== null) {
      const value = parseFloat(match[1]);
      const unit = match[2] || '';
      
      let convertedValue = value;
      let displayUnit = '';
      
      switch (unit) {
        case '万':
          convertedValue = value * 10000;
          displayUnit = '万';
          break;
        case '亿':
          convertedValue = value * 100000000;
          displayUnit = '亿';
          break;
        case '千':
          convertedValue = value * 1000;
          displayUnit = 'K';
          break;
        case '百':
          convertedValue = value * 100;
          displayUnit = '';
          break;
        case '%':
          convertedValue = value;
          displayUnit = '%';
          break;
        default:
          displayUnit = '';
      }
      
      dataPoints.push({
        rawValue: value,
        value: convertedValue,
        unit: displayUnit,
        displayText: displayUnit ? `${value}${displayUnit}` : `${value}`,
        position: match.index
      });
    }

    // Extract keywords
    const keywords = text.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) || [];
    
    return {
      dataPoints,
      keywords,
      summary: text.substring(0, 100) + '...'
    };
  }

  async generateFromText(text, options = {}) {
    const extracted = this.extractDataFromText(text);
    
    if (extracted.dataPoints.length === 0) {
      return this.generator.generateQuoteCard(text, options);
    }

    const stats = extracted.dataPoints.slice(0, 4).map(point => ({
      value: point.displayText,
      label: this.guessLabel(point, extracted.keywords)
    }));

    const title = options.title || extracted.keywords.slice(0, 3).join(' ') || '数据概览';

    return this.generator.generateInfographic(title, stats, {
      ...options,
      highlight: extracted.summary
    });
  }

  guessLabel(point, keywords) {
    const value = point.rawValue;
    
    if (point.unit === '%') {
      if (value >= 0 && value <= 100) {
        return '转化率';
      }
      return '增长率';
    }
    
    if (point.unit === '万' || point.unit === '亿') {
      return '用户量';
    }
    
    if (value >= 1 && value <= 365) {
      return '天数';
    }
    
    if (value >= 1 && value <= 24) {
      return '小时';
    }
    
    if (keywords.length > 0) {
      return keywords[0] || '指标';
    }
    
    return '数值';
  }

  async generateComparisonChart(items, options = {}) {
    const {
      title = '对比分析',
      style = 'dark',
      width = 1200,
      height = 700
    } = options;

    const maxValue = Math.max(...items.map(item => item.value));

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: ${width}px; 
      height: ${height}px; 
      background: linear-gradient(135deg, #2C3E50, #34495E);
      font-family: 'Arial', sans-serif;
      padding: 40px;
      color: white;
    }
    .title {
      font-size: 32px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 40px;
    }
    .chart-container {
      display: flex;
      flex-direction: column;
      gap: 25px;
    }
    .bar-item {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .bar-label {
      width: 120px;
      font-size: 18px;
      font-weight: 600;
    }
    .bar-wrapper {
      flex: 1;
      height: 40px;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3498DB, #2ECC71);
      border-radius: 8px;
      transition: width 0.5s ease;
      display: flex;
      align-items: center;
      padding-left: 15px;
    }
    .bar-value {
      font-size: 16px;
      font-weight: bold;
      color: white;
    }
    .bar-percent {
      position: absolute;
      right: 15px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 16px;
      color: rgba(255,255,255,0.8);
    }
    .legend {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-top: 30px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      background: linear-gradient(90deg, #3498DB, #2ECC71);
    }
  </style>
</head>
<body>
  <div class="title">${title}</div>
  <div class="chart-container">
    ${items.map(item => `
    <div class="bar-item">
      <div class="bar-label">${item.label}</div>
      <div class="bar-wrapper">
        <div class="bar-fill" style="width: ${(item.value / maxValue) * 100}%">
          <span class="bar-value">${item.value}</span>
        </div>
        <span class="bar-percent">${((item.value / maxValue) * 100).toFixed(0)}%</span>
      </div>
    </div>
    `).join('')}
  </div>
  <div class="legend">
    <div class="legend-item">
      <div class="legend-color"></div>
      <span>数值对比</span>
    </div>
  </div>
</body>
</html>
    `;

    const page = await this.generator.browser.newPage({ viewport: { width, height } });
    
    try {
      await page.setContent(html);
      await page.waitForLoadState('networkidle');
      
      return page.screenshot({ type: 'png', fullPage: true });
    } finally {
      await page.close();
    }
  }

  async generateProgressChart(data, options = {}) {
    const {
      title = '进度追踪',
      style = 'ocean',
      width = 800,
      height = 500
    } = options;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: ${width}px; 
      height: ${height}px; 
      background: linear-gradient(135deg, #4ECDC4, #44A08D);
      font-family: 'Arial', sans-serif;
      padding: 40px;
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 40px;
    }
    .progress-ring {
      position: relative;
      width: 250px;
      height: 250px;
    }
    .ring-bg {
      fill: none;
      stroke: rgba(255,255,255,0.2);
      stroke-width: 20;
    }
    .ring-progress {
      fill: none;
      stroke: white;
      stroke-width: 20;
      stroke-linecap: round;
      stroke-dasharray: ${data.percentage * 6.28} 628;
      transform: rotate(-90deg);
      transform-origin: center;
      transition: stroke-dasharray 0.5s ease;
    }
    .ring-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    .ring-value {
      font-size: 56px;
      font-weight: bold;
    }
    .ring-label {
      font-size: 18px;
      opacity: 0.8;
      margin-top: 5px;
    }
    .details {
      margin-top: 30px;
      text-align: center;
    }
    .detail-item {
      font-size: 16px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="title">${title}</div>
  <div class="progress-ring">
    <svg width="250" height="250">
      <circle class="ring-bg" cx="125" cy="125" r="100"></circle>
      <circle class="ring-progress" cx="125" cy="125" r="100"></circle>
    </svg>
    <div class="ring-center">
      <div class="ring-value">${data.percentage}%</div>
      <div class="ring-label">${data.label}</div>
    </div>
  </div>
  <div class="details">
    <div class="detail-item">目标: ${data.target}</div>
    <div class="detail-item">当前: ${data.current}</div>
    <div class="detail-item">剩余: ${data.remaining}</div>
  </div>
</body>
</html>
    `;

    const page = await this.generator.browser.newPage({ viewport: { width, height } });
    
    try {
      await page.setContent(html);
      await page.waitForLoadState('networkidle');
      
      return page.screenshot({ type: 'png', fullPage: true });
    } finally {
      await page.close();
    }
  }

  async generateTimeline(items, options = {}) {
    const {
      title = '时间线',
      style = 'dark',
      width = 1000,
      height = 600
    } = options;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: ${width}px; 
      height: ${height}px; 
      background: linear-gradient(180deg, #1a1a2e, #16213e);
      font-family: 'Arial', sans-serif;
      padding: 40px;
      color: white;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 40px;
    }
    .timeline {
      position: relative;
      padding-left: 50px;
    }
    .timeline::before {
      content: '';
      position: absolute;
      left: 22px;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(180deg, #4ECDC4, #44A08D);
      border-radius: 2px;
    }
    .timeline-item {
      position: relative;
      margin-bottom: 30px;
    }
    .timeline-dot {
      position: absolute;
      left: -46px;
      top: 5px;
      width: 16px;
      height: 16px;
      background: #4ECDC4;
      border-radius: 50%;
      border: 3px solid white;
    }
    .timeline-date {
      font-size: 14px;
      color: #4ECDC4;
      margin-bottom: 5px;
    }
    .timeline-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .timeline-desc {
      font-size: 14px;
      color: rgba(255,255,255,0.7);
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="title">${title}</div>
  <div class="timeline">
    ${items.map(item => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-date">${item.date}</div>
      <div class="timeline-title">${item.title}</div>
      <div class="timeline-desc">${item.description}</div>
    </div>
    `).join('')}
  </div>
</body>
</html>
    `;

    const page = await this.generator.browser.newPage({ viewport: { width, height } });
    
    try {
      await page.setContent(html);
      await page.waitForLoadState('networkidle');
      
      return page.screenshot({ type: 'png', fullPage: true });
    } finally {
      await page.close();
    }
  }
}

module.exports = { InfographicGenerator };