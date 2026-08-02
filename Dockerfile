FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/geometry-engine/package.json packages/geometry-engine/package.json
COPY packages/exporters/package.json packages/exporters/package.json

RUN npm ci

COPY tsconfig.json ./
COPY backend ./backend

RUN npm run build -w @slablab/api
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/api ./dist/api

USER node

EXPOSE 8080

CMD ["node", "dist/api/main.js"]
