FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY server.js engine.js ./
COPY public ./public
RUN mkdir -p /app/data
EXPOSE 8080
ENV PORT=8080
ENV DATA_DIR=/app/data
CMD ["node", "server.js"]
