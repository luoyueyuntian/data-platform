FROM node:20-bookworm-slim

WORKDIR /app

ARG PNPM_VERSION=9.15.0
ARG NPM_REGISTRY=https://registry.npmjs.org
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV npm_config_registry=${NPM_REGISTRY}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm install -g pnpm@${PNPM_VERSION}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.js vitest.config.ts ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN find apps packages -name '*.tsbuildinfo' -delete
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate
RUN pnpm turbo build --filter=@ssas/app-web...

EXPOSE 3000

CMD ["pnpm", "-F", "@ssas/app-web", "start"]
