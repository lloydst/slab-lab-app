import { Injectable, signal } from '@angular/core';

export type WorkspacePanel = 'shape' | 'projects' | 'guide';
export type WorkspaceTab = 'form' | 'template';

@Injectable()
export class WorkspaceUiService {
  readonly tab = signal<WorkspaceTab>('form');
  readonly panel = signal<WorkspacePanel>('shape');
  readonly mobilePanelOpen = signal(false);

  openPanel(panel: WorkspacePanel): void {
    this.panel.set(panel);
    this.mobilePanelOpen.set(true);
  }

  openTemplate(): void {
    this.openPanel('shape');
    this.tab.set('template');
  }
}
