import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/*.spec.ts', 'packages/**/*.spec.ts', 'backend/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'packages/geometry-engine/src/**/*.ts',
        'packages/exporters/src/**/*.ts',
      ],
      exclude: [
        'packages/**/src/index.ts',
        'packages/**/src/template-exporter.ts',
      ],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
