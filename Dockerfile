FROM oven/bun:latest

WORKDIR /app
COPY package.json bun.lock ./

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY . .
RUN bun run build:frontend

EXPOSE 3000

CMD ["bun", "index.ts", "--port", "3000"]