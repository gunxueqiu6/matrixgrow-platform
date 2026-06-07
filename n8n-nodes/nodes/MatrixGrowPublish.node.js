const axios = require('axios');

class MatrixGrowPublish {
  constructor() {
    this.description = {
      displayName: 'MatrixGrow Publish',
      name: 'matrixgrowPublish',
      group: ['output'],
      version: 1,
      description: 'Publish content to multiple platforms using MatrixGrow',
      defaults: {
        name: 'MatrixGrow Publish',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Content',
          name: 'content',
          type: 'string',
          default: '',
          placeholder: 'Enter content to publish',
          description: 'The content to publish',
        },
        {
          displayName: 'Images',
          name: 'images',
          type: 'string',
          default: '',
          placeholder: 'JSON array of image URLs',
          description: 'JSON array of image URLs to include',
        },
        {
          displayName: 'Platforms',
          name: 'platforms',
          type: 'multiOptions',
          options: [
            {
              name: 'Xiaohongshu',
              value: 'xiaohongshu',
            },
            {
              name: 'Juejin',
              value: 'juejin',
            },
            {
              name: 'X (Twitter)',
              value: 'x',
            },
            {
              name: 'Dev.to',
              value: 'devto',
            },
          ],
          default: [],
          description: 'Select platforms to publish to',
        },
        {
          displayName: 'Options',
          name: 'options',
          type: 'collection',
          placeholder: 'Add Option',
          default: {},
          options: [
            {
              displayName: 'Schedule',
              name: 'schedule',
              type: 'options',
              options: [
                {
                  name: 'Now',
                  value: 'now',
                },
                {
                  name: 'Scheduled',
                  value: 'scheduled',
                },
              ],
              default: 'now',
            },
            {
              displayName: 'Scheduled At',
              name: 'scheduledAt',
              type: 'dateTime',
              default: '',
              displayOptions: {
                show: {
                  schedule: ['scheduled'],
                },
              },
            },
            {
              displayName: 'Review Required',
              name: 'reviewRequired',
              type: 'boolean',
              default: false,
            },
          ],
        },
        {
          displayName: 'MatrixGrow API URL',
          name: 'apiUrl',
          type: 'string',
          default: 'http://localhost:3000',
          description: 'URL of your MatrixGrow server',
        },
      ],
    };
  }

  async execute() {
    const items = this.getInputData();
    const returnData = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      const content = this.getNodeParameter('content', i, '');
      const images = this.getNodeParameter('images', i, '[]');
      const platforms = this.getNodeParameter('platforms', i, []);
      const options = this.getNodeParameter('options', i, {});
      const apiUrl = this.getNodeParameter('apiUrl', i, 'http://localhost:3000');

      try {
        let parsedImages;
        try {
          parsedImages = typeof images === 'string' ? JSON.parse(images) : images;
        } catch {
          parsedImages = [];
        }

        const response = await axios.post(`${apiUrl}/api/publish`, {
          content: content || item.json?.content || '',
          images: parsedImages || item.json?.images || [],
          platforms: platforms,
          options: options,
        });

        returnData.push({
          json: {
            success: true,
            data: response.data,
          },
        });
      } catch (error) {
        returnData.push({
          json: {
            success: false,
            error: error.message,
          },
        });
      }
    }

    return [returnData];
  }
}

module.exports = { MatrixGrowPublish };
