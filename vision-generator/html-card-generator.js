const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

/**
 * HTML-to-Image Card Generator
 * Uses Playwright to render HTML templates and capture screenshots
 * Supports: quote cards, infographics, data cards
 */

const TEMPLATES = {
  quote: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: {{width}}px; 
      height: {{height}}px; 
      display: flex; 
      flex-direction: column; 
      justify-content: center; 
      align-items: center;
      background: linear-gradient(135deg, {{bgColor1}}, {{bgColor2}});
      font-family: '{{fontFamily}}', sans-serif;
      padding: 60px;
    }
    .quote {
      font-size: {{fontSize}}px;
      font-weight: bold;
      color: {{textColor}};
      text-align: center;
      line-height: 1.6;
      max-width: 90%;
    }
    .author {
      margin-top: 40px;
      font-size: {{authorSize}}px;
      color: {{authorColor}};
      opacity: 0.8;
    }
    .brand {
      position: absolute;
      bottom: 30px;
      font-size: 18px;
      color: rgba(255,255,255,0.6);
    }
    .decorative {
      position: absolute;
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
      {{decorationPosition}}
    }
  </style>
</head>
<body>
  <div class="decorative"></div>
  <div class="quote">"{{quote}}"</div>
  {{#if author}}
  <div class="author">— {{author}}</div>
  {{/if}}
  <div class="brand">MatrixGrow</div>
</body>
</html>
`,

  infographic: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: {{width}}px; 
      height: {{height}}px; 
      background: {{bgColor}};
      font-family: 'Arial', sans-serif;
      padding: 40px;
    }
    .title {
      font-size: 36px;
      font-weight: bold;
      color: {{titleColor}};
      text-align: center;
      margin-bottom: 30px;
    }
    .stats-container {
      display: flex;
      justify-content: space-around;
      flex-wrap: wrap;
      gap: 20px;
    }
    .stat-card {
      background: white;
      border-radius: 16px;
      padding: 30px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      min-width: 180px;
    }
    .stat-value {
      font-size: 48px;
      font-weight: bold;
      color: {{accentColor}};
    }
    .stat-label {
      font-size: 16px;
      color: #666;
      margin-top: 10px;
    }
    .highlight-box {
      background: linear-gradient(135deg, {{accentColor}}, {{accentColor2}});
      border-radius: 12px;
      padding: 20px;
      margin-top: 30px;
      color: white;
      text-align: center;
    }
    .highlight-text {
      font-size: 24px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="title">{{title}}</div>
  <div class="stats-container">
    {{#each stats}}
    <div class="stat-card">
      <div class="stat-value">{{this.value}}</div>
      <div class="stat-label">{{this.label}}</div>
    </div>
    {{/each}}
  </div>
  {{#if highlight}}
  <div class="highlight-box">
    <div class="highlight-text">{{highlight}}</div>
  </div>
  {{/if}}
</body>
</html>
`,

  dataCard: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: {{width}}px; 
      height: {{height}}px; 
      background: linear-gradient(180deg, {{bgTop}} 0%, {{bgBottom}} 100%);
      font-family: 'Arial', sans-serif;
      display: flex;
      flex-direction: column;
      padding: 30px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 25px;
    }
    .icon {
      width: 50px;
      height: 50px;
      background: {{iconBg}};
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }
    .category {
      font-size: 14px;
      color: {{categoryColor}};
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      color: {{titleColor}};
      margin-bottom: 15px;
    }
    .content {
      font-size: 16px;
      color: {{contentColor}};
      line-height: 1.8;
    }
    .metrics {
      display: flex;
      gap: 20px;
      margin-top: auto;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.2);
    }
    .metric {
      display: flex;
      flex-direction: column;
    }
    .metric-value {
      font-size: 20px;
      font-weight: bold;
      color: {{accentColor}};
    }
    .metric-label {
      font-size: 12px;
      color: rgba(255,255,255,0.6);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="icon">{{icon}}</div>
    <div class="category">{{category}}</div>
  </div>
  <div class="title">{{title}}</div>
  <div class="content">{{content}}</div>
  <div class="metrics">
    {{#each metrics}}
    <div class="metric">
      <div class="metric-value">{{this.value}}</div>
      <div class="metric-label">{{this.label}}</div>
    </div>
    {{/each}}
  </div>
</body>
</html>
`
};

const PRESET_STYLES = {
  sunset: {
    bgColor1: '#FF6B6B',
    bgColor2: '#FFE66D',
    textColor: '#FFFFFF',
    accentColor: '#FF6B6B'
  },
  ocean: {
    bgColor1: '#4ECDC4',
    bgColor2: '#44A08D',
    textColor: '#FFFFFF',
    accentColor: '#4ECDC4'
  },
  forest: {
    bgColor1: '#2ECC71',
    bgColor2: '#27AE60',
    textColor: '#FFFFFF',
    accentColor: '#2ECC71'
  },
  dark: {
    bgColor1: '#2C3E50',
    bgColor2: '#34495E',
    textColor: '#FFFFFF',
    accentColor: '#3498DB'
  },
  light: {
    bgColor1: '#F8F9FA',
    bgColor2: '#E9ECEF',
    textColor: '#2D3436',
    accentColor: '#3498DB'
  }
};

class HtmlCardGenerator {
  constructor(options = {}) {
    this.options = {
      headless: options.headless ?? true,
      viewport: options.viewport || { width: 1200, height: 630 },
      ...options
    };
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async generate(templateType, data, options = {}) {
    await this.initialize();

    const template = TEMPLATES[templateType];
    if (!template) {
      throw new Error(`Template ${templateType} not found`);
    }

    const html = this.renderTemplate(template, data);
    const page = await this.browser.newPage({ viewport: this.options.viewport });

    try {
      await page.setContent(html);
      await page.waitForLoadState('networkidle');
      
      const screenshot = await page.screenshot({
        type: options.format || 'png',
        fullPage: true,
        omitBackground: options.omitBackground || false
      });

      return screenshot;
    } finally {
      await page.close();
    }
  }

  renderTemplate(template, data) {
    let result = template;

    // Handle {{variable}} syntax
    const variableRegex = /\{\{(\w+)\}\}/g;
    result = result.replace(variableRegex, (_, key) => {
      return data[key] !== undefined ? data[key] : '';
    });

    // Handle {{#if variable}}...{{/if}} syntax
    const ifRegex = /\{\{#if (\w+)\}\}(.*?)\{\{\/if\}\}/gs;
    result = result.replace(ifRegex, (_, condition, content) => {
      return data[condition] ? content : '';
    });

    // Handle {{#each array}}...{{/each}} syntax
    const eachRegex = /\{\{#each (\w+)\}\}(.*?)\{\{\/each\}\}/gs;
    result = result.replace(eachRegex, (_, arrayName, itemTemplate) => {
      const array = data[arrayName] || [];
      return array.map(item => {
        let itemResult = itemTemplate;
        const itemVarRegex = /\{\{this\.(\w+)\}\}/g;
        itemResult = itemResult.replace(itemVarRegex, (_, key) => {
          return item[key] !== undefined ? item[key] : '';
        });
        return itemResult;
      }).join('');
    });

    return result;
  }

  async generateQuoteCard(text, options = {}) {
    const {
      style = 'ocean',
      width = 1200,
      height = 630,
      author = '',
      fontFamily = 'Georgia'
    } = options;

    const preset = PRESET_STYLES[style] || PRESET_STYLES.ocean;
    
    const fontSize = Math.max(32, Math.min(56, Math.floor(800 / text.length)));

    const data = {
      width,
      height,
      quote: text,
      author,
      fontFamily,
      fontSize,
      authorSize: Math.floor(fontSize * 0.5),
      bgColor1: preset.bgColor1,
      bgColor2: preset.bgColor2,
      textColor: preset.textColor,
      authorColor: preset.textColor,
      decorationPosition: 'top: 50px; right: 50px;'
    };

    return this.generate('quote', data);
  }

  async generateInfographic(title, stats, options = {}) {
    const {
      width = 1200,
      height = 800,
      style = 'dark',
      highlight = ''
    } = options;

    const preset = PRESET_STYLES[style] || PRESET_STYLES.dark;

    const data = {
      width,
      height,
      title,
      stats,
      highlight,
      bgColor: preset.bgColor1,
      titleColor: preset.textColor,
      accentColor: preset.accentColor,
      accentColor2: preset.bgColor2
    };

    return this.generate('infographic', data);
  }

  async generateDataCard(options = {}) {
    const {
      width = 600,
      height = 400,
      style = 'ocean',
      icon = '📊',
      category = 'Analytics',
      title = 'Data Report',
      content = 'Key insights and metrics overview.',
      metrics = []
    } = options;

    const preset = PRESET_STYLES[style] || PRESET_STYLES.ocean;

    const data = {
      width,
      height,
      icon,
      category,
      title,
      content,
      metrics,
      bgTop: preset.bgColor1,
      bgBottom: preset.bgColor2,
      iconBg: 'rgba(255,255,255,0.2)',
      categoryColor: 'rgba(255,255,255,0.8)',
      titleColor: '#FFFFFF',
      contentColor: 'rgba(255,255,255,0.9)',
      accentColor: '#FFFFFF'
    };

    return this.generate('dataCard', data);
  }

  async generateSocialCards(text, count = 3, options = {}) {
    const styles = ['sunset', 'ocean', 'forest', 'dark', 'light'];
    const cards = [];

    const segments = text.length > 150
      ? text.match(/.{1,50}/g).slice(0, count)
      : Array(count).fill(text);

    for (let i = 0; i < count; i++) {
      const buffer = await this.generateQuoteCard(segments[i], {
        ...options,
        style: styles[i % styles.length]
      });
      cards.push(buffer);
    }

    return cards;
  }
}

module.exports = { HtmlCardGenerator, PRESET_STYLES, TEMPLATES };