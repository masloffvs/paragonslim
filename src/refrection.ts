import { YAML } from "bun";

export interface DockerBuildConfig {
  context: string;
  dockerfile?: string;
}

export interface DependsOnCondition {
  condition:
    "service_healthy" | "service_started" | "service_completed_successfully";
}

export type DependsOn = string[] | Record<string, DependsOnCondition>;

export interface HealthCheck {
  test: string[];
  interval?: string;
  timeout?: string;
  retries?: number;
  start_period?: string;
}

export interface DockerService {
  image?: string;
  build?: string | DockerBuildConfig;
  container_name?: string;
  ports?: string[];
  volumes?: string[];
  environment?: string[] | Record<string, string | number | boolean>;
  env_file?: string | string[];
  depends_on?: DependsOn;
  entrypoint?: string | string[];
  tmpfs?: string | string[];
  healthcheck?: HealthCheck;
  restart?: "no" | "always" | "on-failure" | "unless-stopped";
}

export interface DockerComposeConfig {
  version?: string;
  services: Record<string, DockerService>;
}

export function getCurrentDockerComposePath(): string {
  return "docker-compose.yml";
}

export async function getCurrentDockerComposeContent(): Promise<DockerComposeConfig> {
  const content = await Bun.file(getCurrentDockerComposePath()).text();
  return YAML.parse(content) as DockerComposeConfig;
}

function parseEnvValue(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/^\$\{(.+)\}$/);
  if (match) {
    const envVarName = String(match[1]);
    return process.env[envVarName];
  }
  return value;
}

export async function getClickhouseHostMachineCreds(): Promise<{
  host: string;
  port: number;
  user?: string;
  password?: string;
  database?: string;
}> {
  const compose = await getCurrentDockerComposeContent();
  const chService = compose.services?.clickhouse;

  if (!chService) {
    throw new Error("Сервис 'clickhouse' не найден в docker-compose.yml");
  }

  let hostPort = 8123; // Значение по умолчанию
  if (chService.ports && chService.ports.length > 0) {
    const httpPortMapping = chService.ports.find((p) => p.endsWith(":8123"));

    if (httpPortMapping) {
      const parts = httpPortMapping.split(":");
      hostPort = parseInt(parts[0]!, 10);
    } else {
      const firstPort = chService.ports[0]!.split(":")[0]!;
      hostPort = parseInt(firstPort, 10);
    }
  }

  const envMap: Record<string, string> = {};
  if (Array.isArray(chService.environment)) {
    for (const item of chService.environment) {
      const [key, ...valParts] = String(item).split("=");
      if (key) envMap[key] = valParts.join("=");
    }
  } else if (chService.environment) {
    for (const [key, val] of Object.entries(chService.environment)) {
      envMap[key] = String(val);
    }
  }

  const user = parseEnvValue(envMap["CLICKHOUSE_USER"]);
  const password = parseEnvValue(envMap["CLICKHOUSE_PASSWORD"]);
  const database = parseEnvValue(envMap["CLICKHOUSE_DB"]);

  return {
    host: "localhost",
    port: hostPort,
    ...(user && { user }),
    ...(password && { password }),
    ...(database && { database }),
  };
}