# syntax=docker/dockerfile:1.7
#
# 生产级多阶段构建镜像（CI 用途：类型检查 + 单元测试 + 构建产物校验）。
# 重要说明：
# - 本仓库交付物是 Electron 桌面应用，macOS .dmg 只能在 macOS runner 上打包
#   （见 .github/workflows/release-mac.yml），本镜像不承载 GUI 运行时；
# - 最终 runner 层仅包含 node 运行时与构建产物，目标体积 < 100MB。

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts：测试/构建不需要下载 Electron 二进制，避免镜像膨胀
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

FROM deps AS build
WORKDIR /app
COPY tsconfig.json vitest.config.mts electron.vite.config.ts ./
COPY src ./src
COPY test ./test
RUN --mount=type=cache,target=/root/.npm \
    npx tsc --noEmit && \
    npm test && \
    npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/out ./out
COPY package.json ./
COPY scripts/smoke.mjs ./smoke.mjs
# 非 root 运行：nobody (uid/gid 65534)
RUN chown -R 65534:65534 /app
USER 65534:65534

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["node", "smoke.mjs"]

ENTRYPOINT ["node", "smoke.mjs"]
