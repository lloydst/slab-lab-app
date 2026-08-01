import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.spec.ts', 'backend/**/*.spec.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
});
