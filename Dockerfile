ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts：测试/构建不需要下载 Electron 二进制，避免镜像膨胀
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --registry=$NPM_REGISTRY

FROM deps AS build
WORKDIR /app
COPY tsconfig.json vitest.config.mts electron.vite.config.ts ./
COPY src ./src
COPY test ./test
RUN --mount=type=cache,target=/root/.npm \
    npm config set registry $NPM_REGISTRY && \
    npx tsc --noEmit && \
    npm test && \
    npm run build

FROM alpine:3.20 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/out ./out
COPY package.json ./
COPY scripts/smoke.sh ./smoke.sh
# 非 root 运行
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["/bin/sh", "/app/smoke.sh"]

ENTRYPOINT ["/bin/sh", "/app/smoke.sh"]

# 可选变体：带 Node 运行时的完整语法校验（node --check），体积较大
FROM runner AS runner-node
COPY --from=node:22-alpine /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-alpine /usr/lib/libstdc++.so.6 /usr/lib/libstdc++.so.6
COPY --from=node:22-alpine /usr/lib/libgcc_s.so.1 /usr/lib/libgcc_s.so.1
COPY scripts/smoke.mjs ./smoke.mjs
USER 65534:65534

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["node", "/app/smoke.mjs"]

ENTRYPOINT ["node", "/app/smoke.mjs"]
