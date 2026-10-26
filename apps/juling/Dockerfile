FROM node:24-alpine
WORKDIR /app/server/app/src/juling
COPY server/runtime-paths.cjs /app/server/runtime-paths.cjs
COPY shared/site-domains.js shared/site-domains.json /app/shared/
COPY server/app/src/juling/package.json ./
COPY server/app/src/juling/server.js server/app/src/juling/engine.js ./
COPY server/app/src/juling/public ./public
EXPOSE 8080
ENV PORT=8080
ENV IRIDESCENTLY_STORAGE_ROOT=/storage
ENV IRIDESCENTLY_ENVIRONMENT=production
CMD ["node", "server.js"]
