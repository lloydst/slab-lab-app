import { test, expect } from '@playwright/test';
test('designs a cylinder and opens its printable template', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Cylinder$/ })).toBeVisible();
  const guideIcon = page.getByRole('button', { name: 'Guide' }).locator('mat-icon');
  await expect(guideIcon).toHaveCSS('font-family', /Material Symbols Outlined/);
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('24px "Material Symbols Outlined"')))
    .toBe(true);
  await page.getByRole('button', { name: /Cylinder$/ }).click();
  await page.getByRole('radio', { name: 'FLAT TEMPLATE' }).click();
  await expect(page.locator('slab-template-preview svg')).toBeVisible();
  await expect(page.locator('slab-template-preview path.cut')).toHaveCount(3);
  await expect(page.getByText('Print at 100% for a true-to-size template')).toBeVisible();
  const svgScale = await page.locator('slab-template-preview svg').evaluate((svg) => ({
    declaredWidth: svg.getAttribute('width'),
    renderedWidth: svg.getBoundingClientRect().width,
    renderedHeight: svg.getBoundingClientRect().height,
  }));
  expect(svgScale.declaredWidth).toMatch(/mm$/);
  expect(svgScale.renderedWidth).toBeLessThan(1000);
  expect(svgScale.renderedHeight).toBeLessThan(600);
  const previewOverflow = await page.locator('slab-template-preview').evaluate((preview) => ({
    horizontal: preview.scrollWidth - preview.clientWidth,
    vertical: preview.scrollHeight - preview.clientHeight,
  }));
  expect(previewOverflow.horizontal).toBeLessThanOrEqual(0);
  expect(previewOverflow.vertical).toBeLessThanOrEqual(0);
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
  await expect(page.getByRole('button', { name: /Cylinder$/ })).toBeVisible();
  await expect(page.getByLabel('Height')).toBeVisible();

  await page.getByRole('button', { name: 'Show preview' }).click();
  await expect(inspector).not.toHaveClass(/mobile-open/);
  await expect
    .poll(async () => {
      const box = await inspector.boundingBox();
      return box ? box.y : 844;
    })
    .toBeGreaterThanOrEqual(844);
  await expect(page.getByRole('radio', { name: '3D FORM' })).toBeVisible();
  const mobileExport = page.getByRole('button', { name: 'Export template' });
  await expect(mobileExport).toBeVisible();
  const exportBounds = await mobileExport.boundingBox();
  expect(exportBounds).not.toBeNull();
  expect(exportBounds!.y + exportBounds!.height).toBeLessThanOrEqual(844);

  const topbarBounds = await page.locator('.topbar').boundingBox();
  const stageBounds = await page.locator('.stage').boundingBox();
  expect(topbarBounds!.height).toBe(56);
  expect(stageBounds!.y).toBe(56);
});

test('prioritizes the preview on a phone in landscape', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');

  const stage = page.locator('.stage');
  const stageBounds = await stage.boundingBox();
  expect(stageBounds).not.toBeNull();
  expect(stageBounds!.x).toBe(52);
  expect(stageBounds!.y).toBe(48);
  expect(stageBounds!.y + stageBounds!.height).toBeLessThanOrEqual(390);

  const canvasBounds = await page.locator('slab-preview canvas').boundingBox();
  expect(canvasBounds).not.toBeNull();
  expect(canvasBounds!.width).toBeGreaterThan(500);
  expect(canvasBounds!.height).toBeGreaterThan(150);
  await expect(page.getByRole('button', { name: 'Export template' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SVG', exact: true })).toBeHidden();

  const inspector = page.locator('.inspector');
  await expect(inspector).not.toHaveClass(/mobile-open/);
  await page.getByRole('button', { name: 'Shape' }).click();
  await expect(inspector).toHaveClass(/mobile-open/);
  await expect(page.getByLabel('Height')).toBeVisible();
  const inspectorBounds = await inspector.boundingBox();
  expect(inspectorBounds).not.toBeNull();
  expect(inspectorBounds!.y + inspectorBounds!.height).toBeLessThanOrEqual(390);
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

  await page.getByRole('radio', { name: 'FLAT TEMPLATE' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(500);
});

test('hides the 3D interaction hint while manipulating the canvas', async ({ page }) => {
  await page.goto('/');

  const hint = page.locator('.interaction-hint');
  const canvas = page.locator('slab-preview canvas');
  await expect(hint).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await expect(hint).toHaveClass(/hidden/);
  await page.mouse.up();
  await expect(hint).not.toHaveClass(/hidden/, { timeout: 2_000 });
});

test('converts displayed dimensions while retaining millimetres internally', async ({ page }) => {
  await page.goto('/');

  const diameter = page.getByLabel('Diameter');
  await expect(diameter).toHaveValue('120');
  await page.getByRole('combobox', { name: 'Units' }).click();
  await page.getByRole('option', { name: 'Centimeters' }).click();
  await expect(diameter).toHaveValue('12');

  await diameter.fill('15');
  await diameter.blur();
  await page.getByRole('combobox', { name: 'Units' }).click();
  await page.getByRole('option', { name: 'Millimeters' }).click();
  await expect(diameter).toHaveValue('150');

  const storedDiameter = await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('slablab.projects.v1') ?? '[]');
    return projects[0]?.parameters?.diameter;
  });
  expect(storedDiameter).toBe(150);
});

test('estimates the dimensions after firing from clay shrinkage', async ({ page }) => {
  await page.goto('/');

  const estimate = page.getByText('Estimated size after firing').locator('..');
  await expect(estimate).toContainText('120 × 120 × 140 mm');
  await page.getByLabel('Clay shrinkage').fill('10');
  await expect(estimate).toContainText('108 × 108 × 126 mm');
  await expect(estimate).toContainText('at 10% shrinkage');
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

test('keeps export actions accessible while narrowing', async ({ page }) => {
  for (const width of [900, 700, 390, 320]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/');
    await expect(page.locator('slab-preview canvas')).toBeVisible();
    if (width > 760) {
      for (const action of ['SVG', 'PNG', 'Borderless PDF', 'Download PDF'])
        await expect(page.getByRole('button', { name: action, exact: true })).toBeVisible();
    } else {
      await page.getByRole('button', { name: 'Export template' }).click();
      for (const action of ['SVG', 'PNG', 'Borderless PDF', 'Download PDF'])
        await expect(page.getByRole('menuitem', { name: action, exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
    }
    const canvas = await page.locator('slab-preview canvas').boundingBox();
    expect(canvas).not.toBeNull();
    expect(canvas!.width).toBeGreaterThan(100);
  }
});

test('maps oval-box SVG viewBox units to millimetres without scaling', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Oval box$/ }).click();
  await page.getByRole('radio', { name: 'FLAT TEMPLATE' }).click();

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

test('renders the frustum wall at the left edge of the template', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Frustum$/ }).click();
  await page.getByRole('radio', { name: 'FLAT TEMPLATE' }).click();

  const position = await page.locator('slab-template-preview').evaluate((preview) => {
    const svg = preview.querySelector('svg')!, wall = svg.querySelector('path.cut')!;
    const svgBounds = svg.getBoundingClientRect(), wallBounds = wall.getBoundingClientRect(), wallBox = wall.getBBox();
    return {
      pathOffset: wallBounds.left - svgBounds.left,
      pathUnitX: wallBox.x,
      scrollLeft: preview.scrollLeft,
      pathWidth: wallBounds.width,
      svgWidth: svgBounds.width,
    };
  });

  expect(position.scrollLeft).toBe(0);
  expect(position.pathUnitX).toBeCloseTo(12, 3);
  expect(position.pathOffset).toBeLessThan(60);
  expect(position.pathWidth).toBeGreaterThan(100);
});
