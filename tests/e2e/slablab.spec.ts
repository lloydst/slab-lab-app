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
  await expect(page.getByText('Vector 1:1 · screen size varies')).toBeVisible();
  const svgScale = await page.locator('slab-template-preview svg').evaluate((svg) => ({
    declaredWidth: svg.getAttribute('width'),
    renderedWidth: svg.getBoundingClientRect().width,
  }));
  expect(svgScale.declaredWidth).toMatch(/mm$/);
  expect(svgScale.renderedWidth).toBeGreaterThan(1500);
  await expect(page.getByText(/Print at 100%/)).toBeVisible();
  await expect(page.getByText('Surface area')).toBeVisible();
});

test('keeps design controls accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const projectSelector = page.getByLabel('Open project');
  const projectName = page.getByLabel('Project name');
  await expect(projectSelector).toBeVisible();
  await expect(projectName).toBeVisible();
  for (const control of [projectSelector, projectName]) {
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(70);
  }

  const inspector = page.locator('.inspector');
  await expect(inspector).not.toHaveClass(/mobile-open/);
  await page.getByRole('button', { name: 'Shape' }).click();
  await expect(inspector).toHaveClass(/mobile-open/);
  await expect(page.getByText('Choose your form')).toBeVisible();
  await expect(page.getByLabel('Height')).toBeVisible();

  await page.getByRole('button', { name: 'Show preview' }).click();
  await expect(inspector).not.toHaveClass(/mobile-open/);
  await expect
    .poll(async () => {
      const box = await inspector.boundingBox();
      return box ? box.x + box.width : 0;
    })
    .toBeLessThanOrEqual(0);
  await expect(page.getByRole('button', { name: '3D FORM' })).toBeVisible();
  const mobileExport = page.getByRole('button', { name: 'Download PDF' });
  await expect(mobileExport).toBeVisible();
  const exportBounds = await mobileExport.boundingBox();
  expect(exportBounds).not.toBeNull();
  expect(exportBounds!.y + exportBounds!.height).toBeLessThanOrEqual(844);
});

test('keeps the stage within a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 500 });
  await page.goto('/');

  const stage = page.locator('.stage');
  await expect(stage).toBeVisible();
  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(500);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(500);

  await page.getByRole('button', { name: 'FLAT TEMPLATE' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(500);
});

test('downloads SVG and PNG templates from the footer', async ({ page }) => {
  await page.goto('/');

  for (const format of ['SVG', 'PNG']) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: format, exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format.toLowerCase()}$`));
    expect(await download.failure()).toBeNull();
  }
});

test('keeps the preview and all footer actions visible while narrowing', async ({ page }) => {
  for (const width of [900, 700, 390, 320]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/');
    await expect(page.locator('slab-preview canvas')).toBeVisible();
    for (const action of ['SVG', 'PNG', 'Borderless PDF', 'Download PDF'])
      await expect(page.getByRole('button', { name: action, exact: true })).toBeVisible();
    const canvas = await page.locator('slab-preview canvas').boundingBox();
    expect(canvas).not.toBeNull();
    expect(canvas!.width).toBeGreaterThan(100);
  }
});

test('maps oval-box SVG viewBox units to millimetres without scaling', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Oval box$/ }).click();
  await page.getByRole('button', { name: 'FLAT TEMPLATE' }).click();

  const metrics = await page.locator('slab-template-preview svg').evaluate((svg) => {
    const viewBox = svg.viewBox.baseVal;
    const bounds = svg.getBoundingClientRect();
    const calibration = svg.querySelector('rect');
    if (!calibration) throw new Error('Calibration square not found');
    const calibrationBounds = calibration.getBoundingClientRect();
    return {
      declaredWidth: svg.getAttribute('width'),
      viewBoxWidth: viewBox.width,
      renderedWidth: bounds.width,
      squareUnits: calibration.getAttribute('width'),
      squarePixels: calibrationBounds.width,
      pixelsPerUnit: bounds.width / viewBox.width,
    };
  });

  expect(Number.parseFloat(metrics.declaredWidth!)).toBeCloseTo(metrics.viewBoxWidth, 3);
  expect(metrics.squareUnits).toBe('50');
  expect(metrics.squarePixels / metrics.pixelsPerUnit).toBeCloseTo(50, 3);
});
