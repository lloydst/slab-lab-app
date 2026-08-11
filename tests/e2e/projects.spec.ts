import { expect, test } from '@playwright/test';

test('creates, renames, duplicates, persists, and deletes projects', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Untitled vessel');

  await page.getByLabel('Project name').fill('Serving bowl');
  await page.getByRole('button', { name: /Bowl$/ }).click();
  await page.getByRole('button', { name: 'Duplicate project' }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Serving bowl copy');

  await page.reload();
  await expect(page.getByLabel('Project name')).toHaveValue('Serving bowl copy');
  await page.getByRole('button', { name: 'Delete project' }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Serving bowl');
});

test('opens the guide and returns to design controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Guide' }).click();
  await expect(page.getByRole('heading', { name: 'From form to slab' })).toBeVisible();
  await page.getByRole('button', { name: /Back to design/ }).click();
  await expect(page.getByRole('button', { name: /Cylinder$/ })).toBeVisible();
});
