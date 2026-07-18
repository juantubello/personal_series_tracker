import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

type ProcessWithEnvFile = typeof process & {
  loadEnvFile?: (path?: string | URL) => void;
};

const candidateEnvFiles = [
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), ".env")
];

for (const envFile of candidateEnvFiles) {
  if (existsSync(envFile)) {
    (process as ProcessWithEnvFile).loadEnvFile?.(envFile);
    break;
  }
}

const booleanFromEnv = (value: string | undefined) => value === "true" || value === "1";

export const config = {
  apiHost: process.env.API_HOST ?? "0.0.0.0",
  apiPort: Number(process.env.API_PORT ?? "8080"),
  databasePath: process.env.DATABASE_PATH ?? "./data/app.db",
  tmdb: {
    accessToken: process.env.TMDB_ACCESS_TOKEN ?? "",
    apiKey: process.env.TMDB_API_KEY ?? "",
    baseUrl: process.env.TMDB_BASE_URL ?? "https://api.themoviedb.org/3",
    imageBaseUrl: process.env.TMDB_IMAGE_BASE_URL ?? "https://image.tmdb.org/t/p",
    language: process.env.TMDB_LANGUAGE ?? "es-AR",
    fallbackLanguage: process.env.TMDB_FALLBACK_LANGUAGE ?? "es-ES",
    watchRegion: process.env.TMDB_WATCH_REGION ?? "AR"
  },
  auth: {
    enableDevAuth: booleanFromEnv(process.env.ENABLE_DEV_AUTH),
    devAuthEmail: process.env.DEV_AUTH_EMAIL ?? "juan@local.pipiseries",
    juanEmail: process.env.JUAN_EMAIL ?? "juan@local.pipiseries",
    camiEmail: process.env.CAMI_EMAIL ?? "cami@local.pipiseries",
    cloudflareTeamDomain: process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN ?? "",
    cloudflareAud: process.env.CLOUDFLARE_ACCESS_AUD ?? ""
  },
  isProduction: process.env.NODE_ENV === "production"
};

export const hasTmdbCredentials = () => Boolean(config.tmdb.accessToken || config.tmdb.apiKey);
