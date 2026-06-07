/**
 * Flux/SD Image Generator - AI 图片生成集成
 * 支持 Flux API 和 Stable Diffusion API
 */

const axios = require('axios');

class AIImageGenerator {
  constructor(config = {}) {
    this.config = {
      fluxApiKey: config.fluxApiKey || process.env.FLUX_API_KEY,
      fluxApiUrl: config.fluxApiUrl || process.env.FLUX_API_URL || 'https://api.flux.ai/v1',
      sdApiKey: config.sdApiKey || process.env.SD_API_KEY,
      sdApiUrl: config.sdApiUrl || process.env.SD_API_URL || 'https://api.stability.ai/v1',
      defaultProvider: config.defaultProvider || 'flux',
      ...config
    };
  }

  /**
   * 使用 Flux API 生成图片
   * @param {string} prompt - 图片描述
   * @param {Object} options - 配置选项
   */
  async generateWithFlux(prompt, options = {}) {
    const {
      aspectRatio = '16:9',
      width = 1200,
      height = 630,
      style = 'professional',
      steps = 30
    } = options;

    if (!this.config.fluxApiKey) {
      throw new Error('Flux API key not configured');
    }

    try {
      // Flux API 调用
      const response = await axios.post(`${this.config.fluxApiUrl}/generate`, {
        prompt: this.enhancePrompt(prompt, style),
        aspect_ratio: aspectRatio,
        width,
        height,
        steps,
        output_format: 'png'
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.fluxApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      // 返回图片数据
      const imageData = response.data.image || response.data.output;
      
      return {
        success: true,
        provider: 'flux',
        prompt: prompt,
        image: imageData,
        url: response.data.url,
        metadata: {
          width,
          height,
          style,
          steps
        }
      };
    } catch (error) {
      console.error('Flux generation error:', error.message);
      return {
        success: false,
        provider: 'flux',
        error: error.message
      };
    }
  }

  /**
   * 使用 Stable Diffusion API 生成图片
   * @param {string} prompt - 图片描述
   * @param {Object} options - 配置选项
   */
  async generateWithSD(prompt, options = {}) {
    const {
      width = 1200,
      height = 630,
      style = 'professional',
      steps = 30,
      cfgScale = 7
    } = options;

    if (!this.config.sdApiKey) {
      throw new Error('Stable Diffusion API key not configured');
    }

    try {
      // Stability AI API 调用
      const response = await axios.post(`${this.config.sdApiUrl}/generation/stable-diffusion-xl-1024-v1-0/text-to-image`, {
        text_prompts: [
          { text: this.enhancePrompt(prompt, style), weight: 1 },
          { text: 'blurry, bad quality, distorted, ugly', weight: -1 }
        ],
        cfg_scale: cfgScale,
        height: Math.min(height, 1024),
        width: Math.min(width, 1024),
        steps,
        samples: 1,
        style_preset: this.getStylePreset(style)
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.sdApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 60000
      });

      const artifacts = response.data.artifacts || [];
      
      if (artifacts.length > 0) {
        return {
          success: true,
          provider: 'stable-diffusion',
          prompt: prompt,
          image: artifacts[0].base64,
          url: null,
          metadata: {
            width,
            height,
            style,
            steps,
            seed: artifacts[0].seed
          }
        };
      }

      return {
        success: false,
        provider: 'stable-diffusion',
        error: 'No image generated'
      };
    } catch (error) {
      console.error('SD generation error:', error.message);
      return {
        success: false,
        provider: 'stable-diffusion',
        error: error.message
      };
    }
  }

  /**
   * 通用生成方法 - 根据配置选择提供商
   */
  async generate(prompt, options = {}) {
    const provider = options.provider || this.config.defaultProvider;

    if (provider === 'flux') {
      return this.generateWithFlux(prompt, options);
    } else if (provider === 'sd' || provider === 'stable-diffusion') {
      return this.generateWithSD(prompt, options);
    }

    // 尝试 Flux，失败则尝试 SD
    let result = await this.generateWithFlux(prompt, options);
    if (!result.success && this.config.sdApiKey) {
      console.log('Flux failed, falling back to Stable Diffusion...');
      result = await this.generateWithSD(prompt, options);
    }

    return result;
  }

  /**
   * 生成技术博客封面图
   */
  async generateTechCover(title, options = {}) {
    const prompt = `A professional tech blog cover image. Theme: ${title}. 
Modern, minimalist design with gradient colors. 
Tech aesthetic with subtle code elements or abstract geometric shapes.
Clean typography-friendly background. High contrast, suitable for article header.`;

    return this.generate(prompt, {
      ...options,
      style: 'professional',
      aspectRatio: '16:9'
    });
  }

  /**
   * 生成社交媒体卡片背景
   */
  async generateSocialCard(text, options = {}) {
    const prompt = `A vibrant social media quote card background. 
Quote theme: "${text.substring(0, 50)}".
Colorful gradient with emotional appeal. 
Modern design suitable for Instagram/Xiaohongshu.
Eye-catching, high saturation colors. Clean space for text overlay.`;

    return this.generate(prompt, {
      ...options,
      style: 'emotional',
      aspectRatio: '3:4'
    });
  }

  /**
   * 增强 Prompt 以获得更好的生成效果
   */
  enhancePrompt(prompt, style) {
    const styleEnhancements = {
      professional: 'Professional, clean, modern tech aesthetic, high quality, sharp details, suitable for business context.',
      emotional: 'Vibrant, colorful, emotional appeal, eye-catching, high saturation, modern social media style.',
      clean: 'Minimalist, clean design, simple colors, white space, elegant, modern.',
      dark: 'Dark mode aesthetic, dark gradient background, subtle glow effects, modern tech style.'
    };

    const enhancement = styleEnhancements[style] || styleEnhancements.professional;
    return `${prompt}. ${enhancement}`;
  }

  /**
   * 获取 SD 风格预设
   */
  getStylePreset(style) {
    const presets = {
      professional: '3d-model',
      emotional: 'digital-art',
      clean: 'photographic',
      dark: 'cinematic'
    };
    return presets[style] || 'photographic';
  }

  /**
   * 批量生成多张图片
   */
  async generateBatch(prompts, options = {}) {
    const results = await Promise.all(
      prompts.map(p => this.generate(p, options))
    );
    return results;
  }
}

module.exports = { AIImageGenerator };