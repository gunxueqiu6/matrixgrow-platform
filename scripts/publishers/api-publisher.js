/**
 * API Publisher - Handles publishing to platforms with API access
 * Supports: X, LinkedIn, Dev.to, Medium
 * Integrated with Artipub for blog platforms
 */

const axios = require('axios');
const { ArtipubPublisher } = require('./artipub-publisher');

class APIPublisher {
  constructor(config = {}) {
    this.config = {
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 5000,
      artipub: config.artipub || {},
      ...config
    };

    this.artipubPublisher = new ArtipubPublisher(this.config.artipub);
    this.artipubPlatforms = ['devto', 'medium', 'juejin', 'csdn', 'jianshu', 'zhihu', 'segmentfault'];
  }

  async publish(content, platform, options = {}) {
    // Check if platform should use Artipub
    if (this.artipubPlatforms.includes(platform) && this._isArtipubAvailable()) {
      return this.publishViaArtipub(content, platform, options);
    }

    const publishers = {
      x: this.publishToX.bind(this),
      linkedin: this.publishToLinkedIn.bind(this),
      devto: this.publishToDevTo.bind(this),
      medium: this.publishToMedium.bind(this),
      mastodon: this.publishToMastodon.bind(this)
    };

    const publisher = publishers[platform];
    if (!publisher) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    return this.withRetry(() => publisher(content, options));
  }

  _isArtipubAvailable() {
    return process.env.ARTIPUB_API_URL || this.config.artipub.apiUrl;
  }

  async publishViaArtipub(content, platform, options = {}) {
    return this.artipubPublisher.publish(content, platform, options);
  }

  async withRetry(fn) {
    let lastError;
    for (let i = 0; i < this.config.retryCount; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < this.config.retryCount - 1) {
          await this.delay(this.config.retryDelay * (i + 1));
        }
      }
    }
    throw lastError;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async publishToX(content, options = {}) {
    const { apiKey, images = [] } = options;

    const payload = {
      text: content.text || content,
      ...(images.length > 0 && { media: { url: images[0] } })
    };

    const response = await axios.post('https://api.ayrshare.com/api/post', payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      platform: 'x',
      postId: response.data.postIds?.[0],
      url: response.data.urls?.[0]
    };
  }

  async publishToLinkedIn(content, options = {}) {
    const { apiKey, images = [] } = options;

    const payload = {
      text: content.text || content,
      media: images.length > 0 ? images.map(url => ({ url })) : undefined
    };

    const response = await axios.post('https://api.ayrshare.com/api/post', payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      platform: 'linkedin',
      postId: response.data.postIds?.[0],
      url: response.data.urls?.[0]
    };
  }

  async publishToDevTo(content, options = {}) {
    const { apiKey, title, tags = [], coverImage } = options;

    // Convert to Markdown format for Dev.to
    const articleContent = typeof content === 'string' ? content : content.text;
    const markdown = this.toMarkdown(articleContent);

    const payload = {
      article: {
        title: title || 'MatrixGrow Auto-Published Article',
        published: true,
        body_markdown: markdown,
        tags,
        ...(coverImage && { cover_image: coverImage })
      }
    };

    const response = await axios.post('https://dev.to/api/articles', payload, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      platform: 'devto',
      postId: response.data.id,
      url: response.data.url
    };
  }

  async publishToMedium(content, options = {}) {
    const { integrationToken, title, tags = [] } = options;

    const articleContent = typeof content === 'string' ? content : content.text;
    const html = this.toHtml(articleContent);

    const payload = {
      title: title || 'MatrixGrow Auto-Published Article',
      contentFormat: 'html',
      content: html,
      tags,
      publishStatus: 'public'
    };

    // Note: Medium API requires user context, this is a simplified version
    const response = await axios.post('https://api.medium.com/v1/users/me/posts', payload, {
      headers: {
        'Authorization': `Bearer ${integrationToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      platform: 'medium',
      postId: response.data.data.id,
      url: response.data.data.url
    };
  }

  async publishToMastodon(content, options = {}) {
    const { accessToken, instanceUrl = 'https://mastodon.social', mediaIds = [] } = options;

    const status = typeof content === 'string' ? content : content.text;

    const payload = {
      status: status,
      language: 'zh-CN',
      visibility: 'public'
    };

    if (mediaIds.length > 0) {
      payload.media_ids = mediaIds;
    }

    const response = await axios.post(`${instanceUrl}/api/v1/statuses`, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      platform: 'mastodon',
      postId: response.data.id,
      url: response.data.url
    };
  }

  toMarkdown(text) {
    // Basic HTML to Markdown conversion
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n\n')
      .replace(/<[^>]+>/gi, '');
  }

  toHtml(text) {
    // Basic text to HTML conversion
    return text
      .split('\n\n')
      .map(p => `<p>${p}</p>`)
      .join('\n');
  }

  async getArtipubPlatforms() {
    return this.artipubPublisher.getPlatforms();
  }

  async publishToMultipleViaArtipub(content, platforms, options = {}) {
    return this.artipubPublisher.publishToMultiple(content, platforms, options);
  }

  async artipubHealthCheck() {
    return this.artipubPublisher.healthCheck();
  }
}

module.exports = { APIPublisher };
