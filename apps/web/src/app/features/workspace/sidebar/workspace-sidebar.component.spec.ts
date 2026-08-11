// @vitest-environment jsdom
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { describe, expect, it } from 'vitest';
import {
  ensureAngularTestEnvironment,
  resetTestLocalStorage,
  resolveAngularComponentResources,
} from '../../../../testing/angular-test-environment';
import { WorkspaceUiService } from '../services/workspace-ui.service';
import { WorkspaceSidebarComponent } from './workspace-sidebar.component';
import { WorkspaceSidebarHarness } from './workspace-sidebar.harness';
import { LocalProjectRepository } from '../../../data-access/projects/local-project.repository';
import { ProjectStore } from '../../../data-access/projects/project.store';

@Component({
  standalone: true,
  imports: [WorkspaceSidebarComponent],
  template: '<slab-workspace-sidebar />',
})
class SidebarTestComponent {}

ensureAngularTestEnvironment();

const setup = async () => {
  resetTestLocalStorage();
  await resolveAngularComponentResources();
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [SidebarTestComponent],
    providers: [
      WorkspaceUiService,
      { provide: ProjectStore, useFactory: () => new ProjectStore(new LocalProjectRepository()) },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SidebarTestComponent);
  fixture.detectChanges();

  return {
    fixture,
    loader: TestbedHarnessEnvironment.loader(fixture),
    store: TestBed.inject(ProjectStore),
    ui: TestBed.inject(WorkspaceUiService),
  };
};

describe('WorkspaceSidebarComponent', () => {
  it('opens shape and project drawers through its component harness', async () => {
    const { loader, ui } = await setup();
    const sidebar = await loader.getHarness(WorkspaceSidebarHarness);
    await sidebar.clickRailAction('Projects');
    expect(ui.panel()).toBe('projects');
    expect(ui.mobilePanelOpen()).toBe(true);

    ui.mobilePanelOpen.set(false);
    await sidebar.clickRailAction('Shape');
    expect(ui.panel()).toBe('shape');
    expect(ui.mobilePanelOpen()).toBe(true);
  });

  it('creates a project and returns to the shape panel', async () => {
    const { loader, store, ui } = await setup();
    await (await loader.getHarness(WorkspaceSidebarHarness)).clickRailAction('New');
    expect(store.projects()).toHaveLength(2);
    expect(store.active()?.name).toBe('Untitled vessel');
    expect(ui.panel()).toBe('shape');
  });
});
