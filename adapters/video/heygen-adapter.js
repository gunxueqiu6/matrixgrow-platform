const axios = require('axios');

class HeygenAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.HEYGEN_API_KEY;
    this.baseEndpoint = 'https://api.heygen.com/v1';
  }

  async generateVideo(script, options = {}) {
    try {
      const {
        avatarId = 'Ann_public',
        voiceId = '445e643d5a39474a92176a531407d8d6',
        backgroundType = 'color',
        backgroundColor = '#191919',
        ratio = '16:9',
        version = 'v2',
        test = true
      } = options;

      const response = await axios.post(`${this.baseEndpoint}/video/generate`, {
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: avatarId,
              avatar_style: 'normal'
            },
            voice: {
              type: 'text',
              input_text: script,
              voice_id: voiceId
            },
            background: {
              type: backgroundType,
              value: backgroundColor
            }
          }
        ],
        test,
        version,
        aspect_ratio: ratio
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const videoId = response.data.data?.video_id;

      return {
        success: true,
        provider: 'heygen',
        videoId,
        status: response.data.data?.status || 'submitted',
        script,
        estimatedWaitTime: response.data.data?.callback_id ? 30 : 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        provider: 'heygen'
      };
    }
  }

  async getVideoStatus(videoId) {
    try {
      const response = await axios.get(`${this.baseEndpoint}/video.get`, {
        params: { video_id: videoId },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const videoData = response.data.data;

      return {
        success: true,
        provider: 'heygen',
        videoId,
        status: videoData.status,
        videoUrl: videoData.video_url,
        thumbnailUrl: videoData.thumbnail_url,
        duration: videoData.duration
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        provider: 'heygen'
      };
    }
  }

  async pollVideoStatus(videoId, maxWaitTime = 600000) {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getVideoStatus(videoId);
      
      if (!status.success) {
        return status;
      }

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'failed') {
        return {
          success: false,
          error: 'Video generation failed',
          provider: 'heygen'
        };
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return {
      success: false,
      error: 'Video generation timed out',
      provider: 'heygen'
    };
  }
}

module.exports = { HeygenAdapter };
