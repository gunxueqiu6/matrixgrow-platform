const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs').promises;
const path = require('path');

/**
 * MatrixGrow Vision Generator
 * Generates quote cards and cover images for multi-platform distribution
 */

const CARD_STYLES = {
  emotional: {
    background: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'],
    textColor: '#FFFFFF',
    fontFamily: 'Arial, sans-serif',
    emojiSize: 80
  },
  professional: {
    background: ['#2C3E50', '#34495E', '#2980B9', '#1ABC9C'],
    textColor: '#FFFFFF',
    fontFamily: 'Georgia, serif',
    emojiSize: 60
  },
  clean: {
    background: ['#FFFFFF', '#F8F9FA'],
    textColor: '#2D3436',
    fontFamily: 'Helvetica, Arial, sans-serif',
    emojiSize: 50
  }
};

const SIZES = {
  xiaohongshu: { width: 1080, height: 1440 },
  x: { width: 1200, height: 675 },
  general: { width: 1200, height: 630 },
  instagram: { width: 1080, height: 1080 }
};

/**
 * Generate a multi-color block quote card
 */
async function generateQuoteCard(text, options = {}) {
  const {
    style = 'clean',
    platform = 'general',
    size = SIZES[platform] || SIZES.general,
    textOverride = null
  } = options;

  const canvasConfig = CARD_STYLES[style] || CARD_STYLES.clean;
  const { width, height } = size;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  const colors = canvasConfig.background;
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.5, colors[1] || colors[0]);
  gradient.addColorStop(1, colors[2] || colors[0]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add decorative elements
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(
      Math.random() * width,
      Math.random() * height,
      Math.random() * 200 + 50,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Calculate font size based on text length
  const baseFontSize = Math.max(40, Math.min(80, 1200 / text.length * 3));
  ctx.font = `bold ${baseFontSize}px ${canvasConfig.fontFamily}`;
  ctx.fillStyle = canvasConfig.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Word wrap text
  const maxWidth = width * 0.8;
  const lineHeight = baseFontSize * 1.4;
  const words = text.split('');
  const lines = [];
  let currentLine = '';

  for (const char of words) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Draw text
  const totalHeight = lines.length * lineHeight;
  const startY = (height - totalHeight) / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, startY + i * lineHeight);
  });

  // Add branding
  ctx.font = '24px Arial';
  ctx.globalAlpha = 0.7;
  ctx.fillText('MatrixGrow', width / 2, height - 60);
  ctx.globalAlpha = 1;

  return canvas.toBuffer('image/png');
}

/**
 * Generate a tech blog cover image
 */
async function generateTechCover(text, options = {}) {
  const { style = 'professional' } = options;
  const canvasConfig = CARD_STYLES[style];

  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext('2d');

  // Dark gradient background
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);

  // Add grid pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1200; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 630);
    ctx.stroke();
  }
  for (let y = 0; y < 630; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1200, y);
    ctx.stroke();
  }

  // Title
  ctx.font = 'bold 56px Georgia';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = text.split('');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + word;
    if (ctx.measureText(testLine).width > 1000) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = 70;
  const startY = (630 - lines.length * lineHeight) / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, 600, startY + i * lineHeight);
  });

  // Accent line
  ctx.strokeStyle = '#4ECDC4';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(400, 560);
  ctx.lineTo(800, 560);
  ctx.stroke();

  // Branding
  ctx.font = '28px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('MatrixGrow - AI Growth Engine', 600, 590);

  return canvas.toBuffer('image/png');
}

/**
 * Generate multiple quote cards for social media
 */
async function generateSocialCards(text, options = {}) {
  const { count = 3, style = 'emotional' } = options;
  const cards = [];

  // Split text into segments
  const segments = text.length > 100
    ? text.match(/.{1,50}/g).slice(0, count)
    : [text];

  for (let i = 0; i < count; i++) {
    const segment = segments[i] || segments[segments.length - 1];
    const buffer = await generateQuoteCard(segment, {
      ...options,
      style: i % 2 === 0 ? style : 'clean'
    });
    cards.push(buffer);
  }

  return cards;
}

/**
 * Main export
 */
module.exports = {
  generateQuoteCard,
  generateTechCover,
  generateSocialCards,
  CARD_STYLES,
  SIZES
};
