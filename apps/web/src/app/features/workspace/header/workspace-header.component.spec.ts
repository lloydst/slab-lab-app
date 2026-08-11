// @vitest-environment jsdom
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it } from 'vitest';
import {
  ensureAngularTestEnvironment,
  resetTestLocalStorage,
  resolveAngularComponentResources,
} from '../../../../testing/angular-test-environment';
import { WorkspaceUiService } from '../services/workspace-ui.service';
import { WorkspaceHeaderComponent } from './workspace-header.component';
import { LocalProjectRepository } from '../../../data-access/projects/local-project.repository';
import { ProjectStore } from '../../../data-access/projects/project.store';

@Component({
  standalone: true,
  imports: [WorkspaceHeaderComponent],
  template: '<slab-workspace-header />',
})
class HeaderTestComponent {}

ensureAngularTestEnvironment();

const setup = async () => {
  resetTestLocalStorage();
  await resolveAngularComponentResources();
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [HeaderTestComponent],
    providers: [
      WorkspaceUiService,
      { provide: ProjectStore, useFactory: () => new ProjectStore(new LocalProjectRepository()) },
      provideNoopAnimations(),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(HeaderTestComponent);
  fixture.detectChanges();

  return {
    fixture,
    loader: TestbedHarnessEnvironment.loader(fixture),
    store: TestBed.inject(ProjectStore),
    ui: TestBed.inject(WorkspaceUiService),
  };
};

describe('WorkspaceHeaderComponent', () => {
  it('selects saved projects through the Material select harness', async () => {
    const { loader, store } = await setup();
    store.create('Second project', 'box');
    const original = store.projects().find((project) => project.name === 'Cylinder study')!;
    const selector = await loader.getHarness(MatSelectHarness.with({ selector: '[aria-label="Open project"]' }));

    await selector.open();
    await selector.clickOptions({ text: 'Cylinder study' });

    expect(store.activeId()).toBe(original.id);
  });

  it('duplicates and deletes the active project through button harnesses', async () => {
    const { loader, store } = await setup();
    const duplicate = await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Duplicate project"]' }));
    await duplicate.click();
    expect(store.projects()).toHaveLength(2);
    expect(store.active()?.name).toBe('Cylinder study copy');

    const remove = await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Delete project"]' }));
    await remove.click();
    expect(store.projects()).toHaveLength(1);
    expect(store.active()?.name).toBe('Cylinder study');
  });

  it('opens the guide and does not expose the removed header export action', async () => {
    const { loader, ui } = await setup();
    const guide = await loader.getHarness(MatButtonHarness.with({ text: /Guide/ }));
    await guide.click();
    expect(ui.panel()).toBe('guide');
    expect(ui.mobilePanelOpen()).toBe(true);
    expect(await loader.getAllHarnesses(MatButtonHarness.with({ text: /Export/ }))).toHaveLength(0);
  });
});
