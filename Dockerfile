FROM node:20-alpine

WORKDIR /app

# ffmpeg for video watermark & processing
RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["node", "src/bot_start.js"]
