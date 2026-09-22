FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p uploads downloads

RUN corepack enable && corepack prepare pnpm@12.5.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN pnpm install --frozen-lockfile \
    && rm -rf /root/.local/share/pnpm/store

COPY . .

ENV PORT=3000
ENV HEADLESS=true

EXPOSE 3000

CMD ["node", "server.js"]
