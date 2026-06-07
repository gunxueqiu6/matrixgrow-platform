/**
 * Intent Filter - Classifies post intent using LLM
 * Determines if a post is worth engaging with
 */

const axios = require('axios');

class IntentFilter {
  constructor(config = {}) {
    this.config = {
      model: config.model || 'deepseek-chat',
      apiUrl: config.apiUrl || process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1',
      apiKey: config.apiKey || process.env.DEEPSEEK_API_KEY,
      threshold: config.threshold || 'HIGH',
      ...config
    };
  }

  async classify(post) {
    const prompt = this.buildPrompt(post);

    try {
      const response = await axios.post(`${this.config.apiUrl}/chat/completions`, {
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are a lead classification assistant for an indie hacker tool.
Your job is to classify posts based on their potential as sales leads.

Classify intent levels:
- HIGH: Person is actively seeking help with marketing, traffic, user acquisition, or growth. They are in pain and looking for solutions.
- MEDIUM: Person is discussing related topics but not explicitly asking for help. Could be interesting to engage.
- LOW: Person is just sharing their product/demo without seeking help, or is too vague.

Respond with ONLY one word: HIGH, MEDIUM, or LOW`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const classification = response.data.choices[0]?.message?.content?.trim().toUpperCase();

      return {
        intent: ['HIGH', 'MEDIUM', 'LOW'].includes(classification) ? classification : 'LOW',
        confidence: response.data.choices[0]?.finish_reason === 'stop' ? 1 : 0.5,
        reasoning: '' // Could extract more info in production
      };
    } catch (error) {
      console.error('Intent classification error:', error.message);
      return {
        intent: 'MEDIUM', // Default to medium on error
        confidence: 0,
        error: error.message
      };
    }
  }

  buildPrompt(post) {
    return `Title: ${post.title || 'No title'}
Content: ${post.content || 'No content'}
Platform: ${post.platform || 'unknown'}
Author: ${post.author || 'unknown'}

Classify this post's intent level.`;
  }

  async batchClassify(posts) {
    const results = await Promise.all(
      posts.map(post => this.classify(post))
    );

    return posts.map((post, i) => ({
      ...post,
      intent: results[i].intent,
      confidence: results[i].confidence
    }));
  }

  filterHighIntent(posts) {
    return posts.filter(post => post.intent === 'HIGH');
  }
}

module.exports = { IntentFilter };
