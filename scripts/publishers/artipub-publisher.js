const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * Artipub Publisher
 * Integrates with Artipub (开源博客多发工具)
 * Supports: Dev.to, Medium, Juejin, CSDN, 简书, 知乎专栏
 * 
 * Artipub API docs: https://github.com/crawlab-team/artipub
 */

class ArtipubPublisher {
  constructor(config = {}) {
    this.config = {
      apiUrl: config.apiUrl || process.env.ARTIPUB_API_URL || 'http://localhost:3000',
      apiKey: config.apiKey || process.env.ARTIPUB_API_KEY,
      defaultAuthor: config.defaultAuthor || 'MatrixGrow',
      ...config
    };
  }

  async publish(content, platform, options = {}) {
    const {
      title = content.split('\n')[0]?.substring(0, 100) || 'Untitled',
      tags = [],
      coverImage = null,
      publish = true,
      update = false,
      postId = null
    } = options;

    const platformMapping = {
      'devto': 'devto',
      'medium': 'medium',
      'juejin': 'juejin',
      'csdn': 'csdn',
      'jianshu': 'jianshu',
      'zhihu': 'zhihu',
      'segmentfault': 'segmentfault',
      'oschina': 'oschina',
      'toutiao': 'toutiao'
    };

    const targetPlatform = platformMapping[platform.toLowerCase()];
    if (!targetPlatform) {
      throw new Error(`Unsupported Artipub platform: ${platform}`);
    }

    try {
      const articleData = {
        title,
        content,
        platform: targetPlatform,
        tags: tags.slice(0, 5),
        author: this.config.defaultAuthor,
        status: publish ? 'published' : 'draft'
      };

      if (coverImage) {
        articleData.coverImage = await this.uploadImage(coverImage);
      }

      let result;
      if (update && postId) {
        result = await this.updateArticle(postId, articleData);
      } else {
        result = await this.createArticle(articleData);
      }

      return {
        success: true,
        platform,
        postId: result.id,
        url: result.url,
        message: `Successfully ${update ? 'updated' : 'published'} to ${platform}`
      };

    } catch (error) {
      throw new Error(`Artipub publish failed: ${error.message}`);
    }
  }

  async createArticle(articleData) {
    const response = await axios.post(
      `${this.config.apiUrl}/api/articles`,
      articleData,
      this._getAuthHeaders()
    );
    return response.data;
  }

  async updateArticle(postId, articleData) {
    const response = await axios.put(
      `${this.config.apiUrl}/api/articles/${postId}`,
      articleData,
      this._getAuthHeaders()
    );
    return response.data;
  }

  async deleteArticle(postId) {
    const response = await axios.delete(
      `${this.config.apiUrl}/api/articles/${postId}`,
      this._getAuthHeaders()
    );
    return response.data;
  }

  async getArticle(postId) {
    const response = await axios.get(
      `${this.config.apiUrl}/api/articles/${postId}`,
      this._getAuthHeaders()
    );
    return response.data;
  }

  async listArticles(options = {}) {
    const { platform, page = 1, limit = 20 } = options;
    const params = new URLSearchParams({ page, limit });
    if (platform) params.append('platform', platform);

    const response = await axios.get(
      `${this.config.apiUrl}/api/articles?${params}`,
      this._getAuthHeaders()
    );
    return response.data;
  }

  async uploadImage(imageBufferOrPath) {
    let buffer;
    let filename;

    if (typeof imageBufferOrPath === 'string') {
      buffer = await fs.readFile(imageBufferOrPath);
      filename = path.basename(imageBufferOrPath);
    } else {
      buffer = imageBufferOrPath;
      filename = `upload_${Date.now()}.png`;
    }

    const formData = new (require('form-data'))();
    formData.append('file', buffer, { filename });

    const response = await axios.post(
      `${this.config.apiUrl}/api/upload`,
      formData,
      {
        ...this._getAuthHeaders(),
        headers: {
          ...formData.getHeaders(),
          ...this.config.apiKey ? { 'X-API-Key': this.config.apiKey } : {}
        }
      }
    );

    return response.data.url;
  }

  async publishToMultiple(content, platforms, options = {}) {
    const results = [];

    for (const platform of platforms) {
      try {
        const result = await this.publish(content, platform, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          platform,
          error: error.message
        });
      }
    }

    return results;
  }

  async getPlatforms() {
    try {
      const response = await axios.get(
        `${this.config.apiUrl}/api/platforms`,
        this._getAuthHeaders()
      );
      return response.data;
    } catch {
      return [
        { id: 'devto', name: 'Dev.to', enabled: true },
        { id: 'medium', name: 'Medium', enabled: true },
        { id: 'juejin', name: '掘金', enabled: true },
        { id: 'csdn', name: 'CSDN', enabled: true },
        { id: 'jianshu', name: '简书', enabled: true },
        { id: 'zhihu', name: '知乎专栏', enabled: true },
        { id: 'segmentfault', name: '思否', enabled: true },
        { id: 'oschina', name: '开源中国', enabled: false },
        { id: 'toutiao', name: '头条', enabled: false }
      ];
    }
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.config.apiUrl}/health`);
      return {
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        version: response.data.version || 'unknown'
      };
    } catch {
      return { status: 'unhealthy', version: 'unknown' };
    }
  }

  _getAuthHeaders() {
    if (this.config.apiKey) {
      return {
        headers: {
          'X-API-Key': this.config.apiKey
        }
      };
    }
    return {};
  }
}

module.exports = { ArtipubPublisher };