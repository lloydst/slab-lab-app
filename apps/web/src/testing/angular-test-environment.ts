import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { getTestBed } from '@angular/core/testing';
import { ɵresolveComponentResources } from '@angular/core';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

let initialized = false;

export const ensureAngularTestEnvironment = (): void => {
  if (initialized) return;
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
  initialized = true;
};

export const resolveAngularComponentResources = async (): Promise<void> => {
  await ɵresolveComponentResources(async (resourceUrl) => {
    const webRoot = basename(process.cwd()) === 'web' ? process.cwd() : resolve(process.cwd(), 'apps/web');
    const featurePath = resourceUrl.includes('template-preview')
      ? 'src/app/features/template-preview'
      : `src/app/features/workspace/${
          resourceUrl.includes('workspace-header')
            ? 'header'
            : resourceUrl.includes('workspace-sidebar')
              ? 'sidebar'
              : 'form'
        }`;
    const resourcePath = resolve(
      webRoot,
      featurePath,
      basename(resourceUrl),
    );

    return readFile(resourcePath, 'utf8');
  });
};

export const resetTestLocalStorage = (): void => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
};
