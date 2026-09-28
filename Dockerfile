FROM node:20-alpine

WORKDIR /app

# 先装依赖（利用层缓存）
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev

# 拷贝源码
COPY server ./server
COPY public ./public

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/server.js"]
