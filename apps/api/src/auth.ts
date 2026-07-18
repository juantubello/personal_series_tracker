import type { FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./env.js";
import { getUserByEmail } from "./db.js";
import type { CurrentUser } from "./types.js";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const getDevEmail = (request: FastifyRequest) => {
  const headerEmail = request.headers["x-dev-user-email"];
  if (typeof headerEmail === "string" && headerEmail.trim()) {
    return headerEmail.trim();
  }

  return config.auth.devAuthEmail;
};

const resolveCloudflareEmail = async (request: FastifyRequest) => {
  if (!config.auth.cloudflareTeamDomain || !config.auth.cloudflareAud) {
    throw new Error("Cloudflare Access is not configured");
  }

  const token = request.headers["cf-access-jwt-assertion"];
  if (typeof token !== "string" || !token) {
    throw new Error("Missing Cloudflare Access JWT");
  }

  jwks ??= createRemoteJWKSet(new URL(`${config.auth.cloudflareTeamDomain}/cdn-cgi/access/certs`));

  const { payload } = await jwtVerify(token, jwks, {
    issuer: config.auth.cloudflareTeamDomain,
    audience: config.auth.cloudflareAud
  });

  const email = payload.email;
  if (typeof email !== "string" || !email) {
    throw new Error("Cloudflare Access JWT did not include an email");
  }

  return email;
};

export const resolveCurrentUser = async (request: FastifyRequest): Promise<CurrentUser> => {
  const email = !config.isProduction && config.auth.enableDevAuth
    ? getDevEmail(request)
    : await resolveCloudflareEmail(request);

  return getUserByEmail(email);
};

export const isDevAuthEnabled = () => !config.isProduction && config.auth.enableDevAuth;
