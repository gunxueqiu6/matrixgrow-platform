FROM node:20-slim

WORKDIR /app

# 安装 Playwright 依赖
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制 package 相关文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 安装 Playwright 浏览器
RUN npx playwright install chromium

# 复制项目文件
COPY . .

# 创建必要的目录
RUN mkdir -p /app/data /app/logs /app/cookies

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]
