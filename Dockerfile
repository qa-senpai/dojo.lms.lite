FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run package:standalone

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DATABASE_PATH=/data/dojo.sqlite NODE_OPTIONS=--max-old-space-size=256
COPY --from=build --chown=node:node /app/release/ ./
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
