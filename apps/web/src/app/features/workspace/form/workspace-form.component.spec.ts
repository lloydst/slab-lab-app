// @vitest-environment jsdom
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it } from 'vitest';
import {
  ensureAngularTestEnvironment,
  resetTestLocalStorage,
  resolveAngularComponentResources,
} from '../../../../testing/angular-test-environment';
import { WorkspaceDesignService } from '../services/workspace-design.service';
import { WorkspaceUiService } from '../services/workspace-ui.service';
import { WorkspaceFormComponent } from './workspace-form.component';
import { WorkspaceFormHarness } from './workspace-form.harness';
import { LocalProjectRepository } from '../../../data-access/projects/local-project.repository';
import { ProjectStore } from '../../../data-access/projects/project.store';

@Component({
  standalone: true,
  imports: [WorkspaceFormComponent],
  template: '<slab-workspace-form />',
})
class FormTestComponent {}

ensureAngularTestEnvironment();

const setup = async () => {
  resetTestLocalStorage();
  await resolveAngularComponentResources();
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [FormTestComponent],
    providers: [
      WorkspaceDesignService,
      WorkspaceUiService,
      { provide: ProjectStore, useFactory: () => new ProjectStore(new LocalProjectRepository()) },
      provideNoopAnimations(),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(FormTestComponent);
  fixture.detectChanges();

  return {
    fixture,
    loader: TestbedHarnessEnvironment.loader(fixture),
    store: TestBed.inject(ProjectStore),
    design: TestBed.inject(WorkspaceDesignService),
    ui: TestBed.inject(WorkspaceUiService),
  };
};

describe('WorkspaceFormComponent', () => {
  it('represents a cube with one side length and keeps every side equal', async () => {
    const { loader, store } = await setup();
    const form = await loader.getHarness(WorkspaceFormHarness);
    await form.selectShape('Cube');
    expect(await form.getDimensionLabels()).toEqual(['Side Length', 'Wall Thickness']);
    await form.setDimension('Side Length', '150');
    expect(store.active()?.shape).toBe('cube');
    expect(store.active()?.parameters).toMatchObject({ width: 150, depth: 150, height: 150 });
  });

  it('hides dimensions that are coupled by regular and square forms', async () => {
    const { loader } = await setup();
    const form = await loader.getHarness(WorkspaceFormHarness);
    await form.selectShape('Square pyramid');
    expect(await form.getDimensionLabels()).toEqual([
      'Bottom Side Length',
      'Top Side Length',
      'Height',
      'Wall Thickness',
      'Include Base',
      'Closed Top',
    ]);
    await form.selectShape('Polygonal vase');
    expect(await form.getDimensionLabels()).not.toEqual(
      expect.arrayContaining(['Bottom Depth', 'Mid Depth', 'Top Depth']),
    );
  });

  it('converts displayed fields with the Material units select while storing millimetres', async () => {
    const { fixture, loader, store } = await setup();
    const units = await loader.getHarness(MatSelectHarness.with({ selector: '[aria-label="Units"]' }));
    await units.open();
    await units.clickOptions({ text: 'Centimeters' });
    fixture.detectChanges();

    const diameter = fixture.nativeElement.querySelector('.field-grid input') as HTMLInputElement;
    expect(diameter.value).toBe('12');
    diameter.value = '15';
    diameter.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(store.active()?.parameters['diameter']).toBe(150);
  });

  it('changes lid mode with a select harness and exposes dependent fields', async () => {
    const { fixture, loader, store } = await setup();
    await (await loader.getHarness(WorkspaceFormHarness)).selectShape('Box');
    const lid = await loader.getHarness(MatSelectHarness.with({ selector: '[aria-label="Lid type"]' }));
    await lid.open();
    await lid.clickOptions({ text: 'Box lid' });
    fixture.detectChanges();

    expect(store.active()?.parameters).toMatchObject({ hasLid: 1, lidStyle: 2 });
    expect(fixture.nativeElement.textContent).toContain('Lid Skirt Height');
  });

  it('closes the mobile inspector through its preview button', async () => {
    const { loader, ui } = await setup();
    ui.mobilePanelOpen.set(true);
    await (await loader.getHarness(WorkspaceFormHarness)).showPreview();
    expect(ui.mobilePanelOpen()).toBe(false);
  });
});
