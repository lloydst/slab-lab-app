# SlabLab

SlabLab is a production-oriented Angular and NestJS monorepo for designing slab-built pottery and exporting accurate, shrinkage-compensated templates.

Requires Node.js 24 LTS (Angular 22 does not support odd-numbered Node 25).

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:4200`. Projects save automatically in browser local storage. Run the optional API with `npm run start:api` (health endpoint: `http://localhost:3000/api/health`).

## Quality commands

```bash
npm test
npm run build
npm run test:e2e
npm run lint
npm run typecheck
npm run format:check
```

Nx orchestrates project builds, tests, linting, and typechecks with dependency-aware caching. Use
`npm run graph` to inspect the project graph, `npx nx show projects` to list projects, or
`npx nx affected -t lint,test,build` in CI to validate only affected projects. Run `npm run format` to apply
Prettier and `npm run lint:fix` for safe ESLint fixes.

The workspace contains the Angular app in `apps/web`, reusable packages in `packages`, the NestJS boundary in `backend`, Playwright journeys in `tests/e2e`, and design notes in `docs/architecture.md`.

## Printing

Choose a shape, enter finished dimensions and clay shrinkage, then export SVG, PDF, or PNG. Print PDFs and SVGs at 100% / actual size. Validate printer scaling with a ruler before cutting clay.
