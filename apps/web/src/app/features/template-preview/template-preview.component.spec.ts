// @vitest-environment jsdom
import '@angular/compiler';
import { signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatButtonHarness } from '@angular/material/button/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it } from 'vitest';
import {
  ensureAngularTestEnvironment,
  resolveAngularComponentResources,
} from '../../../testing/angular-test-environment';
import { TemplatePreviewComponent } from './template-preview.component';

ensureAngularTestEnvironment();

const template = {
  paths: [],
  dimensions: { width: 100, height: 80 },
  unit: 'mm' as const,
  notes: [],
};

const setup = async () => {
  await resolveAngularComponentResources();
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [TemplatePreviewComponent],
    providers: [provideNoopAnimations()],
  }).compileComponents();
  const fixture = TestBed.createComponent(TemplatePreviewComponent);
  (fixture.componentInstance as unknown as { template: Signal<typeof template> }).template = signal(template);
  fixture.detectChanges();
  return {
    fixture,
    loader: TestbedHarnessEnvironment.loader(fixture),
    preview: fixture.componentInstance,
  };
};

const pointerEvent = (
  paper: HTMLElement,
  pointerId: number,
  clientX: number,
  clientY: number,
  mouse?: { button: number; buttons: number },
): PointerEvent => ({
  currentTarget: paper,
  pointerId,
  clientX,
  clientY,
  pointerType: mouse ? 'mouse' : 'touch',
  button: mouse?.button ?? 0,
  buttons: mouse?.buttons ?? 1,
  preventDefault: () => undefined,
}) as unknown as PointerEvent;

describe('TemplatePreviewComponent', () => {
  it('zooms with Material controls and resets to fit', async () => {
    const { loader, preview } = await setup();
    await (await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Zoom in"]' }))).click();
    expect(preview.zoom()).toBe(125);
    await (await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Zoom out"]' }))).click();
    expect(preview.zoom()).toBe(100);
    await (await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Zoom out"]' }))).click();
    await (await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Reset zoom"]' }))).click();
    expect(preview.zoom()).toBe(100);
  });

  it('zooms with the mouse wheel', async () => {
    const { fixture, preview } = await setup();
    const paper = fixture.nativeElement.querySelector('.paper') as HTMLElement;
    paper.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -1 }));
    fixture.detectChanges();
    expect(preview.zoom()).toBe(110);
  });

  it('pans the zoomed template by dragging with a pointer', async () => {
    const { fixture, preview } = await setup();
    const paper = fixture.nativeElement.querySelector('.paper') as HTMLElement;
    paper.scrollLeft = 100;
    paper.scrollTop = 100;

    preview.onPointerDown(pointerEvent(paper, 1, 10, 10));
    preview.onPointerMove(pointerEvent(paper, 1, 30, 35));
    preview.onPointerEnd(pointerEvent(paper, 1, 30, 35));

    expect(paper.scrollLeft).toBe(80);
    expect(paper.scrollTop).toBe(75);
    expect(preview.isPanning()).toBe(false);
  });

  it('zooms with a two-finger pinch gesture', async () => {
    const { fixture, preview } = await setup();
    const paper = fixture.nativeElement.querySelector('.paper') as HTMLElement;

    preview.onPointerDown(pointerEvent(paper, 1, 0, 0));
    preview.onPointerDown(pointerEvent(paper, 2, 100, 0));
    preview.onPointerMove(pointerEvent(paper, 2, 150, 0));

    expect(preview.zoom()).toBe(150);
  });

  it('only pans mouse pointers while the left button is held', async () => {
    const { fixture, preview } = await setup();
    const paper = fixture.nativeElement.querySelector('.paper') as HTMLElement;
    paper.scrollLeft = 100;

    preview.onPointerDown(pointerEvent(paper, 1, 10, 10, { button: 2, buttons: 2 }));
    preview.onPointerMove(pointerEvent(paper, 1, 30, 10, { button: 0, buttons: 0 }));
    expect(paper.scrollLeft).toBe(100);
    expect(preview.isPanning()).toBe(false);

    preview.onPointerDown(pointerEvent(paper, 1, 10, 10, { button: 0, buttons: 1 }));
    preview.onPointerMove(pointerEvent(paper, 1, 30, 10, { button: 0, buttons: 0 }));
    expect(paper.scrollLeft).toBe(100);
    expect(preview.isPanning()).toBe(false);
  });
});
