FROM node:24-alpine
WORKDIR /app/apps/juling
COPY services/platform/runtime-paths.cjs /app/services/platform/runtime-paths.cjs
COPY packages/site-domains/index.js packages/site-domains/domains.json /app/packages/site-domains/
COPY apps/juling/package.json ./
COPY apps/juling/server.js apps/juling/engine.js ./
COPY apps/juling/public ./public
EXPOSE 8080
ENV PORT=8080
ENV IRIDESCENTLY_STORAGE_ROOT=/storage
ENV IRIDESCENTLY_ENVIRONMENT=production
CMD ["node", "server.js"]
