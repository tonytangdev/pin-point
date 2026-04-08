FROM node:20-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/pin-point-server/package.json packages/pin-point-server/
RUN pnpm install --frozen-lockfile --filter pin-point-server
COPY packages/pin-point-server packages/pin-point-server
RUN pnpm --filter pin-point-server build

FROM node:20-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=builder /app/packages/pin-point-server/dist ./dist
COPY --from=builder /app/packages/pin-point-server/package.json .
COPY --from=builder /app/pnpm-lock.yaml .
RUN pnpm install --prod
ENV DATABASE_URL=/data/pin-point.db
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/index.js"]
