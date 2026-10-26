FROM node:24-alpine
WORKDIR /app/server/app/src/juling
COPY services/platform/runtime-paths.cjs /app/services/platform/runtime-paths.cjs
COPY packages/site-domains/index.js packages/site-domains/domains.json /app/packages/site-domains/
COPY server/app/src/juling/package.json ./
COPY server/app/src/juling/server.js server/app/src/juling/engine.js ./
COPY server/app/src/juling/public ./public
EXPOSE 8080
ENV PORT=8080
ENV IRIDESCENTLY_STORAGE_ROOT=/storage
ENV IRIDESCENTLY_ENVIRONMENT=production
CMD ["node", "server.js"]
