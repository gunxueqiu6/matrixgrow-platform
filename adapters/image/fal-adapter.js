const axios = require('axios');

class FalAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.FAL_API_KEY;
    this.endpoint = 'https://fal.run/fal-ai/flux-pro';
  }

  async generateImage(prompt, options = {}) {
    try {
      const { width = 1024, height = 768, numImages = 1, negativePrompt = '' } = options;

      const response = await axios.post(this.endpoint, {
        prompt,
        negative_prompt: negativePrompt,
        image_size: { width, height },
        num_images: numImages,
        enable_safety_checker: true
      }, {
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const imageUrls = response.data.images?.map(img => img.url) || [];

      return {
        success: true,
        provider: 'fal',
        images: imageUrls,
        prompt,
        metadata: {
          inferenceTime: response.data.inference_time,
          timings: response.data.timings
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
        provider: 'fal'
      };
    }
  }
}

module.exports = { FalAdapter };
