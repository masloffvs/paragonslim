FROM oven/bun:latest

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build:frontend

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV HYPERVISOR=docker

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "index.ts", "--port", "3000", "--volumesConfig", "/app/volumes.toml", "--serversConfig", "/app/servers.toml"]
