import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('downloads each format from the consolidated mobile export menu', async ({ page }) => {
  await page.goto('/');

  for (const format of ['SVG', 'PNG']) {
    await page.getByRole('button', { name: 'Export template' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: format, exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\.${format.toLowerCase()}$`));
    expect(await download.failure()).toBeNull();
  }
});

test('keeps invalid designs from opening the export menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shape' }).click();
  await page.getByLabel('Diameter').fill('0');
  await page.getByRole('button', { name: 'Show preview' }).click();

  await expect(page.getByRole('button', { name: 'Export template' })).toBeDisabled();
});

test('switches preview modes without reducing the mobile canvas area', async ({ page }) => {
  await page.goto('/');
  const stage = page.locator('.stage');
  const initial = await stage.boundingBox();
  await page.getByRole('radio', { name: 'FLAT TEMPLATE' }).click();
  await expect(page.locator('slab-template-preview svg')).toBeVisible();
  await page.getByRole('radio', { name: '3D FORM' }).click();
  await expect(page.locator('slab-preview canvas')).toBeVisible();
  expect(await stage.boundingBox()).toEqual(initial);
});
