FROM node:25-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app

ARG API_INTERNAL_URL=http://api:8080
ARG NEXT_PUBLIC_CF_ACCESS_CLIENT_ID=
ARG NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET=
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ENV NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_CF_ACCESS_CLIENT_ID=${NEXT_PUBLIC_CF_ACCESS_CLIENT_ID}
ENV NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET=${NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET}
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN npm run build -w @pipiseries/web

FROM node:25-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV API_INTERNAL_URL=http://api:8080
ENV NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_CF_ACCESS_CLIENT_ID=
ENV NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET=
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev

COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/public apps/web/public
COPY --from=build /app/apps/web/next.config.mjs apps/web/next.config.mjs

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@pipiseries/web"]
