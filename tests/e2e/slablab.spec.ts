import { test, expect } from '@playwright/test';
test('designs a cylinder and opens its printable template', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Choose your form')).toBeVisible();
  const guideIcon = page.getByRole('button', { name: 'Guide' }).locator('mat-icon');
  await expect(guideIcon).toHaveCSS('font-family', /Material Symbols Outlined/);
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('24px "Material Symbols Outlined"')))
    .toBe(true);
  await page.getByRole('button', { name: /Cylinder$/ }).click();
  await page.getByRole('button', { name: 'FLAT TEMPLATE' }).click();
  await expect(page.locator('slab-template-preview svg')).toBeVisible();
  await expect(page.locator('slab-template-preview path.cut')).toHaveCount(3);
  await expect(page.getByText('100% · 1:1')).toBeVisible();
  const svgScale = await page.locator('slab-template-preview svg').evaluate((svg) => ({
    declaredWidth: svg.getAttribute('width'),
    renderedWidth: svg.getBoundingClientRect().width,
  }));
  expect(svgScale.declaredWidth).toMatch(/mm$/);
  expect(svgScale.renderedWidth).toBeGreaterThan(1500);
  await expect(page.getByText(/Print at 100%/)).toBeVisible();
  await expect(page.getByText('Surface area')).toBeVisible();
});
