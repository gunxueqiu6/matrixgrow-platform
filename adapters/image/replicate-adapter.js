const axios = require('axios');

class ReplicateAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.REPLICATE_API_KEY;
    this.endpoint = 'https://api.replicate.com/v1/predictions';
  }

  async generateImage(prompt, options = {}) {
    try {
      const { width = 1024, height = 768, numOutputs = 1, negativePrompt = '' } = options;

      const createResponse = await axios.post(this.endpoint, {
        version: 'af1a68a2791f585c41d45b44d4471474dc9956659ae0fecfcdbcee5a5e1',
        input: {
          prompt,
          negative_prompt: negativePrompt,
          width,
          height,
          num_outputs: numOutputs,
          num_inference_steps: 28,
          guidance_scale: 7.5
        }
      }, {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const predictionId = createResponse.data.id;
      
      let result = createResponse.data;
      let attempts = 0;
      const maxAttempts = 30;

      while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await axios.get(`${this.endpoint}/${predictionId}`, {
          headers: {
            'Authorization': `Token ${this.apiKey}`
          }
        });
        result = statusResponse.data;
        attempts++;
      }

      if (result.status === 'succeeded') {
        return {
          success: true,
          provider: 'replicate',
          images: result.output || [],
          prompt,
          predictionId
        };
      } else {
        return {
          success: false,
          error: result.error || '生成超时',
          provider: 'replicate'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
        provider: 'replicate'
      };
    }
  }
}

module.exports = { ReplicateAdapter };
